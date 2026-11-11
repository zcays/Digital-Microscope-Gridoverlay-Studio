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

- Grid overlay: square size, horizontal / vertical / combined spacing, dead-space margins, columns/rows, colour, opacity, outline or filled
- Fisheye (barrel / pincushion) correction with lens centre, plus before/after toggle
- Move, scale and rotate the image; arrow-key nudging
- Crop tool with aspect presets and undo
- Keyboard shortcuts (press `?` in the app) and per-setting arrow-key adjustment
- PNG export of image + grid

## Project layout

`grid-studio/index.html` is the page, `grid-studio/css/` the styles, and `grid-studio/js/` holds one script per concern
(state, gl, grid, crop, controls, input, main). Scripts are plain `<script>` tags loaded in order, which is why the app also works from disk.
