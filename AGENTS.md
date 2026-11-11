# Instructions for AI coding agents

Start with **[ARCHITECTURE.md](ARCHITECTURE.md)** — file map, concepts, recipes and gotchas. Then:

1. App = `grid-studio/` (static, no build). One global state object `S` in `js/state.js`. Read the header comment of
   any file before editing it; each one states what it owns.
2. Never replace `S.img / S.lens / S.warp / S.grid / S.chip` objects; mutate in place (`Object.assign`).
3. After changing state call `refresh('gl' | 'grid' | 'layout' | 'crop' | 'warp' | 'status')` (updates panels + redraws).
4. Units: canvas px vs µm vs normalised 0..1 — see "Coordinate spaces" in ARCHITECTURE.md. Chip data is µm.
5. Classic `<script>` tags, order in `grid-studio/index.html` matters; new files must be added there.
6. Verify: open `grid-studio/tests.html` (expect PASS) and exercise the feature in the app with no console errors.
   Browsers cache JS during development: hard-refresh before concluding something "didn't change".
7. Image drawing has two renderers (GPU `gl.js`, software `cpu.js`, chosen in `render.js`). Call `renderImage()`, and mirror
   any image-maths change in both files; `tests.html` compares them.
8. Keep the product rule: **the grid is static; the image is adjusted to fit it.**
9. Don't commit secrets or machine-specific folders (`.claude/` is git-ignored).
