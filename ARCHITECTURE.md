# Architecture guide (for the next developer or AI)

Digital Microscope Gridoverlay Studio is a **static web app**: plain HTML + CSS + JavaScript, no build step, no
dependencies, no server logic. It lays a to-scale grid (the wells of a microfluidic chip) over a microscope
photo so the photo can be corrected (fisheye, distortion, crop) until it lines up with the grid.

Run it: open `grid-studio/index.html`, or `python3 -m http.server 8765 --directory grid-studio`.
Check it: open `grid-studio/tests.html` (should say **PASS**).

## The idea in one minute

```
 image file ──► [gl.js: WebGL]  ──►  <canvas id="gl">   (the picture: move/scale/rotate + fisheye + distortion)
                                       ▲
 S (state.js) ── drives ──────────────┤
                                       ▼
                [grid.js: Canvas2D] ──►  <canvas id="grid"> (the static overlay, never moves with the image)
```

* **The grid is static. The image is what you adjust** to fit it. This is a deliberate product decision.
* One object, `S` in `state.js`, holds all state. Everything else reads it and changes it through small functions,
  then calls `dirty(...)` / `refresh(...)`. A single animation-frame loop (`main.js → frame()`) redraws what is stale.
* There are **no modules or bundler**: files are classic `<script>` tags that share one global scope, loaded in the
  order listed in `index.html` (so it also works when double-clicked from disk). `state.js` first, `main.js` last.

## File map (`grid-studio/js/`)

| File | Responsibility | Touch it when you want to… |
|---|---|---|
| `state.js` | `S` (all state), default factories, DOM handles (`dom`), `TOOLS` / `dragTypes` registries, `dirty()` / `refresh()` scheduler, `toast()` | add a state field, a redraw layer |
| `presets.js` | The chip table (`CHIPS`), µm→px scale (`pxPerUm`), image calibration (`umPerPx`), chip select / zoom / fit logic, the chip info box | add or fix a chip version; change scaling rules |
| `actions.js` | Small named commands (reset, centre, fit, toggle grid, nudge) | add a one-line command reused by buttons + keys |
| `warp.js` | Distort tool: control-point maths, mesh generation, on-canvas handles, its drag types | change how distortion works |
| `gl.js` | WebGL (GPU): shaders, two-pass render (`renderGL`), texture upload | add an image effect, change the lens model |
| `cpu.js` | Software renderer (Canvas 2-D): same picture as `gl.js`, used when WebGL is unavailable | mirror any change made in `gl.js` |
| `render.js` | Chooses GPU or software: `initRenderer`, `renderImage`, `enterCpuMode`, `maxTextureSize`, `setRendererImage` | change the fallback rules |
| `images.js` | Load file / paste / drop, built-in fisheye sample, `setImage()` (reset-everything entry point) | change what happens on image load |
| `grid.js` | `gridLayout()` (where cells go) and `drawGrid()` (draws them; also used for export) | change grid geometry or look |
| `view.js` | Stage size, view zoom, pointer→canvas coords, status bar, µm scale bar | change zoom or status readouts |
| `crop.js` | Crop tool: selection maths, canvas→image rect conversion, apply / undo / reset, crop box, its drag types | change cropping |
| `cv.js` | Vision toolbox with no app state: blur, gradients, FFT, lattice peak finder, phase demodulation, phase unwrapping, robust least squares | reuse or improve a vision step |
| `autofit.js` | Auto-fit: finds the well lattice in the photo and fits the image model to the chip grid; Auto-fit / Undo buttons | change how auto-fit decides |
| `ui.js` | Widget helpers: `slider`, `checkbox`, `buttons`, `line`, `note`, `setter`, `KEY_STEP` | add a new kind of control |
| `panels.js` | Builds the right-hand panels from the widgets | add a slider / setting |
| `tools.js` | Active tool, `setTool`, mouse/touch dispatch, pan + image-move drags | add a tool |
| `keyboard.js` | Shortcuts (`KEY_ACTIONS`, `MOD_ACTIONS`), arrow-key rules, help overlay, status hint | add a shortcut |
| `export.js` | `buildExportCanvas()` (image then grid, full resolution) and PNG download | change export |
| `main.js` | `frame()` loop, top-bar wiring, `init()` | start-up order |

Other files: `index.html` (markup, panel containers, help overlay, script order), `css/style.css`,
`tests.html` (self-test page), `../README.md` (user-facing), `../AGENTS.md` (short rules for AI agents).

## Concepts you must know

**Coordinate spaces.** Three, and mixing them is the classic bug:
1. *Canvas px* — `S.doc` (canvas size), `S.img.x/y`, grid layout, pointer positions passed to drag handlers.
2. *µm* — all chip data in `presets.js`. Convert with `pxPerUm()` (canvas px per µm).
3. *Canvas-normalised 0..1* — warp control points (`S.warp`).
View zoom (`S.zoom`) is separate: screen px per canvas px. It never affects the document or the export.

**True-to-scale grid.** With a chip ticked, `well px = well µm × k` and `pitch px = pitch µm × k` with the same `k`,
so well : wall : pitch proportions are always exact (verified by `tests.html`). `pitch = well + wall` for every chip.

**Image calibration.** `umPerPx() = S.img.scale / pxPerUm()`. When the grid scale changes (new chip, fit mode on/off),
`keepingImageScale()` rescales the image so its µm/px stays the same. The user adjusts the image to fit the wells; the
displayed µm/px is then that microscope's calibration.

**Two grid modes.** `activePreset()` null → manual sliders (`S.grid`). Non-null → chip geometry. In chip mode
`S.chip.fit` (default) makes the canvas = real N×M array + a border (`S.chip.margin` %), restoring the old canvas size
on untick (`S.chip.savedDoc`); otherwise the grid tiles across the existing canvas.

**Two renderers, one picture.** With hardware acceleration off many browsers give no WebGL. `render.js` tries WebGL
(`initGL()` returns false on any failure, and a lost context also triggers it) and otherwise calls `enterCpuMode()`, which swaps in a
fresh `<canvas>` (a canvas that had a WebGL context cannot give a 2-D one) and uses `cpu.js`. Everything else calls only
`renderImage()` / `maxTextureSize()` / `setRendererImage()` — never `renderGL()` / `uploadTexture()` directly. The status bar shows
`GPU` or `software`; `index.html?renderer=cpu` forces software. `cpu.js` is a JS twin of the shader (per-pixel lens + bilinear,
transformed `drawImage` when there is no lens, triangle mesh for the distortion) and draws heavy interactive frames at ~1 MP, then a
full-quality frame ~250 ms later; export always uses full quality. **Any change to the image maths in `gl.js` must be repeated in
`cpu.js`** — `tests.html` renders six cases with both and requires them to match.

**Image pipeline (gl.js).** Pass 1 (fragment shader, inverse mapping): translate/scale/rotate then radial lens
correction `r' = r(1 − k1 r² − k2 r⁴)`. Pass 2 (only if the distortion is not identity): the pass-1 result is drawn on a
32×32 mesh whose vertices come from `warpPoint()` = a biquadratic patch over 3×3 control points (the 8 handles) plus the optional fine
mesh `S.warp.mesh` (`warp.js`). The fine mesh has 16 cells per side on purpose: its nodes coincide with vertices of both render meshes
(32 GPU, 16 software), so the two renderers agree. Premultiplied alpha.

**Crop only affects the image.** `S.img.crop` is a rect in *image* pixels (null = uncropped). The Crop tool lets you draw on the
canvas, converts that rect to image pixels (`canvasRectToImageRect`) and `gl.js` masks everything outside it in the corrected-image
space. It never changes `S.doc`, the grid or the chip scale, and it moves/scales/rotates with the image. Non-destructive: Reset crop /
Undo restore the full picture. (For a rotated image the stored rect is the bounding box of the selection.)

**Auto-fit (computer vision, `autofit.js` + `cv.js`).** One button sets `S.lens.k1`, `S.img` (rot/scale/x/y) and `S.warp` so the photo
matches the ticked chip's grid. Steps, in order:
1. *Lattice frequency.* Wells repeat, so the summed power spectra of `|gx|` and `|gy|` have two perpendicular peaks → pitch and tilt.
   The basis chosen is the lowest-frequency strong pair that generates the strongest pair (avoids harmonics and the lattice diagonal).
2. *Phase.* Complex demodulation of `|gradient along f|` gives, per pixel, "line index mod 1" for each wall direction. Using the
   gradient magnitude makes dark and bright walls equivalent. Chips whose well is ~half the pitch (V7.0, V15.2) have edge patterns
   that repeat at HALF the pitch, sitting on the well edges, so they are fitted with `q = 2` (twice the lines, different origin).
3. *Unwrap* (quality-guided flood fill) → absolute line indices over the strong area. The number of periods the pattern spans is
   compared with the chip's well count to fix a wrong harmonic and to detect a 90°-turned non-square chip.
4. *Coarse fit on the unwrapped samples:* tilt/scale/position → + lens `k1` → distortion corners with tilt/scale FROZEN. Fitting
   tilt/scale together with the corners is degenerate (a huge tilt cancelled by huge corner moves), so they are never free together.
5. *Array edges.* A blurred box of N periods is slid along the two-direction lattice energy (rejects 1-D things like a bright bar);
   the exact first wall is the candidate with strong line energy on the edge walls and none just outside. Lines are renumbered and
   step 4 is repeated.
6. *Polish* on every sample inside the array with wrapped (mod 1) residuals, then edge bows. Only ever started from the coarse
   solution, never from scratch (wrapped residuals alone can slip by a whole wall).
7. *Fine mesh.* What the 8 handles cannot follow goes into `S.warp.mesh` (17 × 17 nodes of small canvas offsets, bilinear in between,
   added to the handle patch inside `warpPoint()` so both renderers and the overlay get it). Each sample says "move the picture here by
   −error"; a smooth mesh of such moves is solved as a linear least-squares problem per axis (bilinear data term + second-difference
   smoothness, Huber weights, a few passes because errors are only known mod 1). It is dropped if it does not reduce the error.
   Stiffness / passes / maximum shift are `AF.meshSmooth`, `AF.meshPasses`, `AF.meshMaxShift`.
8. *Refuse rather than guess:* median error > 10% of a period, < 75% of samples matched, or the well pattern continuing beyond the
   fitted array (> 55% of the inside level = more wells than the ticked chip) → nothing is changed and the user gets the reason.
**Auto-fix distortion** (`autoFixDistortion()`, Distort panel) runs the same analysis with `start = {th: current settings}`: tilt, scale,
position and lens are frozen; the wall numbering is taken from where the user put the image (the typical offset to the absolute line
indices must be close to a whole number), the handles and a first mesh are fitted from the absolute indices (so a bulge larger than half
a well is still recovered), then the mod-1 mesh passes polish. Afterwards the array edges are checked: if the image sits a whole well
off, it refuses instead of locking the picture one column out.
`afForward()` is a third copy of the image maths (source px → canvas px, i.e. the INVERSE direction of the shader, plus the warp).
`AF.debug` holds the last run's internals. Works on the raw source pixels, so it ignores the current image settings except the lens centre.

**Registries instead of a big switch.** A tool = an entry in `TOOLS` (`cursor`, optional `enter`, `pick(e,p)` → drag name).
A drag = an entry in `dragTypes` (`start`, `move`, optional `end`). `tools.js` only dispatches. Crop and Distort register
themselves in their own files.

**Arrow keys have two owners.** A focused slider/number box consumes arrows itself (stepping by `KEY_STEP`, Shift ×10,
Alt ×0.1, with `stopPropagation`). Otherwise `keyboard.js` nudges the image. Esc or clicking the canvas blurs the control.

## How-to recipes

* **Add a chip version:** add an object to `CHIPS` in `presets.js` (copy a neighbour). The panel and tests pick it up.
  Run `tests.html`; it checks `pitch = well + wall` and that wells × pitch matches the array size within one pitch.
* **Add a setting:** field in `S` (`state.js`) → use it where drawn (`grid.js` / `gl.js` …) → one `slider(...)` or
  `checkbox(...)` line in `panels.js` using `setter([...layers], fn)` → optionally an arrow-key step in `KEY_STEP` (`ui.js`).
* **Add a tool:** toolbar `<button data-tool="x">` in `index.html` → new file registering `TOOLS.x` and its `dragTypes`
  (copy `warp.js` bottom or `crop.js` bottom) → add the `<script>` in `index.html` → shortcut in `keyboard.js`.
* **Add a shortcut:** `KEY_ACTIONS` / `MOD_ACTIONS` in `keyboard.js` + the `#help` overlay in `index.html`.
* **Add an image effect:** extend `FRAGMENT_SRC` + `UNIFORMS` + `drawImagePass` in `gl.js`.

## Gotchas (each of these bit us once)

* **Never replace `S.img`, `S.lens`, `S.warp`, `S.grid`, `S.chip` — mutate with `Object.assign`.** Panels hold references.
* **Script order matters** and everything is global. Top-level `const`/`let` are *not* on `window`; from outside (tests,
  console) read them with `eval('S')` — in the browser console they are directly visible.
* **Browsers cache the `.js/.css` files while you develop** (a normal reload may serve old code). Hard refresh (⌘⇧R)
  or open DevTools → Network → "Disable cache".
* **Comment terminators:** a stray missing `*/` in a file header silently comments out the whole file.
* **Three copies of the image maths:** `gl.js` (shader), `cpu.js` (software) and `afForward()` in `autofit.js`. Change one → change all;
  `tests.html` compares GPU vs software and checks auto-fit results in the rendered picture.
* `grid-studio/samples/` is git-ignored (the user's own photos). The real-photo auto-fit test skips itself when the file is missing.
* **Don't call `renderGL()` directly** (it only exists on the GPU path) — use `renderImage()`. `dom.gl` is *replaced* by a new element in
  software mode, so never cache a reference to it across frames.
* **WebGL feedback loops:** pass 1 renders into `fbTexture`; never have it bound as the sampled texture at the same time.
* **Distort handles** live outside the canvas box, so the stage is `overflow: visible` when `data-tool="warp"` (css).
* **`drawGrid()` must never clear its canvas.** Export draws the grid on top of the image in one canvas; a `clearRect` inside it once
  erased the image and the PNG contained only the grid. `renderGrid()` does the clearing for the on-screen overlay. `tests.html` guards this.
* Grid line width = `S.grid.stroke × max(1, canvasWidth / 1200)` (`gridLineWidth()` in `grid.js`) so walls look equally thick on big chip-fit canvases.
* Outlines are drawn *inset* so a cell's outer size is exactly the well size regardless of line width.
* Canvas max is `MAX_DOC` = 8192 px; chip fit mode sizes the canvas to about 2000 px on its longer side, well within it.

## Verifying a change

1. Open `tests.html` → must show `PASS`. Add a test there for new maths.
2. Open the app, **Load sample**, exercise the feature, check the browser console for errors.
3. For anything visual, look at it (zoom 100%): the tests do not check pixels.

## Known limits / ideas

* The fine mesh has no handles: only Auto-fit / Auto-fix distortion write it and only Reset distortion (or Undo) clears it. Dragging a
  handle keeps the mesh, so a manual tweak after an auto-fix stays a small change on top of it.
* Auto-fit has been validated on ONE real photo (a V12 chip, ~21 px per well) plus synthetic chips. Expect to tune the thresholds in `AF`
  (top of `autofit.js`) as more real photos arrive. It needs the whole array in view and ≥ ~5 px per well; lens centre is not fitted.
* Only crop and auto-fit have undo (crop restores the previous image crop; auto-fit has its own one-step undo). No project save/load. Fisheye is one radial model, not a per-lens profile.
* Chip draft angle, bottom shape and depth are listed but not drawn (top view only). The table's "well size" is drawn
  as given (assumed to be the top opening).
* Table quirk: V10.2 and V12 list well counts one lower than array size ÷ pitch (66 vs 66.7; 49 vs 50).
  Kept as given — check with the owner of the table.
* Software mode is roughly 0.4 s per full 2000×2000 render with a lens (GPU: instant) and the distortion uses a coarser mesh (16×16).
* `tests.html` has a few pixel-level checks (export contents, GPU vs software), but no general visual regression tests.
