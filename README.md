# Digital Microscope Gridoverlay Studio

A browser-based, Photoshop-style tool for laying a static grid of small squares over an image,
correcting fisheye distortion, nudging the image with the arrow keys, and cropping.

## Run

Open `grid-studio/index.html` in a browser (no build step), or serve the folder:

```bash
python3 -m http.server 8765 --directory grid-studio
```

## Features

- Grid overlay: square size, horizontal / vertical / combined spacing, dead-space margins, columns/rows, colour, opacity, outline or filled
- Fisheye (barrel / pincushion) correction with lens centre, plus before/after toggle
- Move, scale and rotate the image; arrow-key nudging
- Crop tool with aspect presets and undo
- Keyboard shortcuts (press `?` in the app) and per-setting arrow-key adjustment
- PNG export of image + grid

## Layout

`grid-studio/js/` holds one script per concern (state, gl, grid, crop, controls, input, main).
