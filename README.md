# Digital Microscope Gridoverlay Studio

A browser-based, Photoshop-style tool for laying a static grid of small squares over an image,
correcting fisheye distortion, nudging the image with the arrow keys, and cropping.

## Requirements

- A current desktop browser: Chrome, Edge, Firefox or Safari. WebGL (GPU) is used when available, otherwise it falls back to software rendering.
- Nothing else. There are no dependencies and no build step.

## Install

1. Get the code (either way works):

   ```bash
   git clone https://github.com/zcays/Digital-Microscope-Gridoverlay-Studio.git
   cd Digital-Microscope-Gridoverlay-Studio
   ```

   Or use **Code → Download ZIP** on the GitHub page and unzip it.

2. Run it with **one** of these:

   - **Open the file directly:** double-click `grid-studio/index.html`.
   - **Python 3 (preinstalled on macOS and most Linux):**

     ```bash
     python3 -m http.server 8765 --directory grid-studio
     ```

     then open <http://localhost:8765/>. Press `Ctrl+C` in the terminal to stop it.
   - **Node.js:**

     ```bash
     npx serve grid-studio
     ```

3. Click **Load sample** to try it with a built-in fisheye test image, or **Open image…** (or drag and drop / paste) to use your own.

**Hardware acceleration off?** It still works. If the browser blocks WebGL (for example "Use hardware acceleration" is switched off,
or on a remote / locked-down machine) the app switches itself to a built-in software renderer, shows a notice, and the status bar
says `software` instead of `GPU`. The picture is the same; large images with fisheye correction or distortion just take a moment
longer (heavy edits are drawn at reduced resolution while you drag, then sharpen when you pause; export is always full quality).
Add `?renderer=cpu` to the address to force software mode for testing.

## Features

- **Chip versions:** tick one of V1-Square, V3.1, V3.2, V7.0, V9.0–V9.2, V10.2, V11, V12, V15.1, V15.2 and the grid takes that chip's well shape (square or circle), well size and pitch from the geometry table, true to scale, filling the whole canvas. Adjust the image (move / scale / rotate) until it lines up; the app shows the image's µm per pixel. By default the canvas is resized to fit the chip's real N × M well array plus an adjustable dead-room border ("Fit canvas to array" / "Dead room %"); untick it to tile the grid across a fixed canvas instead.
- **Auto-fit (computer vision):** tick the chip version, press **Auto-fit image to grid** (or `A`) and the app finds the wells in the
  photo and sets tilt, size, position, fisheye strength and the distortion handles so the photo lines up with the grid. It reports the
  typical error, refuses (and changes nothing) when it cannot do it reliably, and has **Undo auto-fit**. See "Auto-fit" below.
- **Auto-fix distortion:** a button in the Distort panel that bends the image onto the grid without touching tilt, size or position.
  Besides the 8 handles it fills a fine correction mesh that follows local deviations (a warped chip, sides that are slightly off).
- Grid overlay: square size, horizontal / vertical / combined spacing, dead-space margins, columns/rows, colour, opacity, outline or filled
- Distort tool (`D`): drag the 4 corners, drag a side to move the whole edge, Alt-drag a side to bend it; the grid stays fixed. A fine correction mesh (set automatically, no handles) sits on top of these
- Fisheye (barrel / pincushion) correction with lens centre, plus before/after toggle
- Move, scale and rotate the image; arrow-key nudging
- Crop tool with aspect presets and undo — it trims **only the image**; the canvas and the grid never change (Reset crop brings the whole image back); a crop drawn on a rotated image keeps the straight edges you drew
- Keyboard shortcuts (press `?` in the app) and per-setting arrow-key adjustment
- PNG export of image + grid (both, or either one) at the full canvas resolution, including fisheye correction, distortion and crop
- Grid line ("wall") thickness is adjustable (Line width) and scales with the canvas size so it stays clearly visible

## Auto-fit

1. Open the photo and tick the chip version it shows (for example V12).
2. Click **Auto-fit image to grid** in the Chip version panel, or press `A`. Large or difficult photos can take several seconds.
3. Read the message under the button, e.g. "tilt 2.1° removed, typical error 1.2 px (6% of a well), 94% of the array matched".
   Fine-tune by hand afterwards if you want (arrow keys, Distort tool), or press **Undo auto-fit**.

**Auto-fix distortion** (Distort panel) does only the bending part: it keeps your tilt, size and position and re-fits the 8 distortion
handles plus a fine correction mesh underneath them. Auto-fit already runs it as its last step, so use the button after you have moved
handles or the image by hand and want the distortion redone. The image must already be roughly on the grid (within about a third of a
well, and not a whole well off); otherwise it tells you to run Auto-fit first. **Reset distortion** clears the handles and the fine mesh.
The message reports the typical error before and after the fine correction, the worst side, and how much of the array showed a usable well pattern. Tissue-covered or faint areas are inferred from visible patches. Check any reported hidden corners or uncertain array edges by eye: a small residual on visible wells does not prove that an obscured edge is correctly numbered.

The adaptive fit combines brightness and edge measurements, separates visible patches around tissue, and matches their wall numbers before fitting the image. Regression tests cover all chip presets, tissue, glare, rotation, distortion, and two local real photographs (V11 and V12). This is not a guarantee for every sample; completely hidden boundaries and very small wells remain ambiguous.

What it needs: the **whole well array in the picture**, wells at least about 5 px across in the photo, and the **right chip version
ticked** (it uses that version's well count to find the array's edges). It works with dark or bright walls, a tilted or keystoned
(angled) photo, fisheye, and a non-square chip turned 90°. When it cannot line things up reliably, or the photo has a different number of
wells than the ticked version, it says so and leaves the image untouched. Photos where each well is only a few pixels (for example a whole
V9.0 array with 333 wells across) are too small to fit.

## Keyboard shortcuts

Press `?` (or `H`) in the app to see this list. On Mac use `⌘` where it says `Ctrl`.

| Key | Action |
|---|---|
| `V` / `D` / `C` | Move tool / Distort tool / Crop tool |
| `←` `→` `↑` `↓` | Nudge the image 1 px (`Shift` = 10 px, `Alt` = 0.1 px) |
| `R` / `M` | Reset the image position, scale and rotation / centre the image |
| `\` | Show the original / fisheye-corrected image (before / after) |
| `A` | Auto-fit the image to the ticked chip's grid |
| `G` | Show or hide the grid |
| `[` `]` | Square size − / + (manual grid only) |
| `{` `}` | Grid spacing − / + (manual grid only) |
| `+` `-` | Zoom the view in / out |
| `F` or `0` / `1` | Fit the canvas to the window / 100% |
| `Space` + drag | Pan the view (or middle-mouse drag) |
| `Ctrl` + wheel | Zoom the view |
| `Enter` / `Esc` | Apply / cancel a crop (`Esc` also leaves the Distort tool) |
| `Ctrl+Z` | Undo the last crop (image only) |
| `Ctrl+O` / `Ctrl+E` | Open an image / export PNG |
| `?` or `H` | Show the shortcut list |

**Distort tool:** drag a corner to move it, drag a side to move the whole edge, `Alt`-drag a side to bend it.

**Adjusting a setting from the keyboard:** click or `Tab` to a slider or number box, then use the arrow keys to change it by a
fixed step (e.g. 1 px, 0.01 fisheye strength, 0.5° rotation). `Shift` = ×10, `Alt` = ×0.1. Press `Esc` or click the canvas
to send the arrow keys back to the image.

## For developers and AI agents

See **[ARCHITECTURE.md](ARCHITECTURE.md)** (how it works, file map, how to add chips / tools / settings, gotchas) and **[AGENTS.md](AGENTS.md)**.
Self-tests: open `grid-studio/tests.html` (should say PASS).

## Project layout

`grid-studio/index.html` is the page, `grid-studio/css/` the styles, and `grid-studio/js/` holds one script per concern:
`state` (state + scheduler), `presets` (chip table + scale), `actions`, `warp` (distort), `gl` (GPU image layer), `cpu` (software image layer), `render` (picks one), `images`, `grid`,
`view`, `crop`, `cv` (vision toolbox) + `autofit` (Auto-fit), `ui` + `panels` (settings), `tools` (mouse), `keyboard`, `export`, `main`. Scripts are plain `<script>` tags
loaded in order, which is why the app also works from disk. Chip data lives in `grid-studio/js/presets.js`.
