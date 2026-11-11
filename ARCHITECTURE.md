# Architecture guide (for the next developer or AI)

Digital Microscope Gridoverlay Studio is a **static web app**: plain HTML + CSS + JavaScript, no build step, no
dependencies, no server logic. It lays a to-scale grid (the wells of a microfluidic chip) over a microscope
photo so the photo can be corrected (fisheye, distortion, crop) until it lines up with the grid.

Run it: open `grid-studio/index.html`, or `python3 -m http.server 8765 --directory grid-studio`.
Check it: open `grid-studio/tests.html` (should say **PASS**, 69/69 at the time of writing).

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
| `gl.js` | WebGL: shaders, two-pass render (`renderGL`), texture upload | add an image effect, change the lens model |
| `images.js` | Load file / paste / drop, built-in fisheye sample, `setImage()` (reset-everything entry point) | change what happens on image load |
| `grid.js` | `gridLayout()` (where cells go) and `drawGrid()` (draws them; also used for export) | change grid geometry or look |
| `view.js` | Stage size, view zoom, pointer→canvas coords, status bar, µm scale bar | change zoom or status readouts |
| `crop.js` | Crop tool: rect maths, apply / undo, crop box, its drag types | change cropping |
| `ui.js` | Widget helpers: `slider`, `checkbox`, `buttons`, `line`, `note`, `setter`, `KEY_STEP` | add a new kind of control |
| `panels.js` | Builds the right-hand panels from the widgets | add a slider / setting |
| `tools.js` | Active tool, `setTool`, mouse/touch dispatch, pan + image-move drags | add a tool |
| `keyboard.js` | Shortcuts (`KEY_ACTIONS`, `MOD_ACTIONS`), arrow-key rules, help overlay, status hint | add a shortcut |
| `export.js` | PNG export | change export |
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

**Image calibration.** `umPerPx() = S.img.scale / pxPerUm()`. When the grid scale changes (new chip, grid zoom),
`keepingImageScale()` rescales the image so its µm/px stays the same. The user adjusts the image to fit the wells; the
displayed µm/px is then that microscope's calibration.

**Two grid modes.** `activePreset()` null → manual sliders (`S.grid`). Non-null → chip geometry. In chip mode
`S.chip.fit` (default) makes the canvas = real N×M array + a border (`S.chip.margin` %), restoring the old canvas size
on untick (`S.chip.savedDoc`); otherwise the grid tiles across the existing canvas.

**Image pipeline (gl.js).** Pass 1 (fragment shader, inverse mapping): translate/scale/rotate then radial lens
correction `r' = r(1 − k1 r² − k2 r⁴)`. Pass 2 (only if the distortion is not identity): the pass-1 result is drawn on a
32×32 mesh whose vertices come from a biquadratic patch over 3×3 control points (`warp.js`). Premultiplied alpha.

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
* **WebGL feedback loops:** pass 1 renders into `fbTexture`; never have it bound as the sampled texture at the same time.
* **Distort handles** live outside the canvas box, so the stage is `overflow: visible` when `data-tool="warp"` (css).
* Outlines are drawn *inset* so a cell's outer size is exactly the well size regardless of line width.
* Canvas max is `MAX_DOC` = 8192 px; chip fit mode clamps grid zoom so the canvas stays within it.

## Verifying a change

1. Open `tests.html` → must show `PASS` (69/69). Add a test there for new maths.
2. Open the app, **Load sample**, exercise the feature, check the browser console for errors.
3. For anything visual, look at it (zoom 100%): the tests do not check pixels.

## Known limits / ideas

* Only crop has undo. No project save/load. Fisheye is one radial model, not a per-lens profile.
* Chip draft angle, bottom shape and depth are listed but not drawn (top view only). The table's "well size" is drawn
  as given (assumed to be the top opening).
* Table quirk: V10.2 and V12 list well counts one lower than array size ÷ pitch (66 vs 66.7; 49 vs 50).
  Kept as given — check with the owner of the table.
* No automated pixel tests; `tests.html` checks maths and behaviour only.
