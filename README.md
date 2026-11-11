# Digital Microscope Gridoverlay Studio

A browser-based, Photoshop-style tool for laying a static grid of small squares over an image,
correcting fisheye distortion, nudging the image with the arrow keys, and cropping.

## Requirements

- A current desktop browser with WebGL: Chrome, Edge, Firefox or Safari.
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

If the page is blank, check that WebGL is enabled in your browser settings.

## Features

- **Chip versions:** tick one of V1-Square, V3.1, V3.2, V7.0, V9.0–V9.2, V10.2, V11, V12, V15.1, V15.2 and the grid takes that chip's well shape (square or circle), well size and pitch from the geometry table, true to scale, filling the whole canvas. Adjust the image (move / scale / rotate) until it lines up; the app shows the image's µm per pixel. By default the canvas is resized to fit the chip's real N × M well array plus an adjustable dead-room border ("Fit canvas to array" / "Dead room %"); untick it to tile the grid across a fixed canvas instead.
- Grid overlay: square size, horizontal / vertical / combined spacing, dead-space margins, columns/rows, colour, opacity, outline or filled
- Distort tool (`D`): drag the 4 corners, drag a side to move the whole edge, Alt-drag a side to bend it; the grid stays fixed
- Fisheye (barrel / pincushion) correction with lens centre, plus before/after toggle
- Move, scale and rotate the image; arrow-key nudging
- Crop tool with aspect presets and undo — it trims **only the image**; the canvas and the grid never change (Reset crop brings the whole image back)
- Keyboard shortcuts (press `?` in the app) and per-setting arrow-key adjustment
- PNG export of image + grid (both, or either one) at the full canvas resolution, including fisheye correction, distortion and crop
- Grid line ("wall") thickness is adjustable (Line width) and scales with the canvas size so it stays clearly visible

## Keyboard shortcuts

Press `?` (or `H`) in the app to see this list. On Mac use `⌘` where it says `Ctrl`.

| Key | Action |
|---|---|
| `V` / `D` / `C` | Move tool / Distort tool / Crop tool |
| `←` `→` `↑` `↓` | Nudge the image 1 px (`Shift` = 10 px, `Alt` = 0.1 px) |
| `R` / `M` | Reset the image position, scale and rotation / centre the image |
| `\` | Show the original / fisheye-corrected image (before / after) |
| `G` | Show or hide the grid |
| `[` `]` | Square size − / + (grid zoom − / + when a chip version is ticked) |
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
`state` (state + scheduler), `presets` (chip table + scale), `actions`, `warp` (distort), `gl` (image layer), `images`, `grid`,
`view`, `crop`, `ui` + `panels` (settings), `tools` (mouse), `keyboard`, `export`, `main`. Scripts are plain `<script>` tags
loaded in order, which is why the app also works from disk. Chip data lives in `grid-studio/js/presets.js`.
