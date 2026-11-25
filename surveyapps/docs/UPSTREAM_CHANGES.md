# Source preservation and integration changes

`vendor/provenance.json` records pinned commits. `vendor/grid-studio/` is based on the public files at Grid Studio commit `590ada2746dc95cb73ee0214d3c42d5784351c20`, including corner-assisted alignment, crop to array (with bit-exact full-canvas slicing), per-axis polarity Auto-fit, shared warp evaluation, full undo restoration, and the refreshed interface. SUGAR 1.1.1 applies the Chocolate Bar name to the vendored page title and toolbar. `vendor/microscopy/` preserves the original scientific Python sources. No user photos, unrelated essay, machine configuration or git metadata are included.

The runtime copy `backend/microscopy_app.py` retains upstream algorithms and callbacks. Targeted changes:

- Replace startup network download with the upstream deterministic synthetic fallback, always offline.
- Local Dash assets, title and blue/cyan desktop CSS; explicit 8-bit RGB intensity interpretation.
- Bound Pillow input to 100 million pixels and HTTP uploads to 256 MiB; unreadable images produce a visible error.
- Clear image rotation cache on upload/crop/reset to avoid stale previews from Python object identity reuse.
- Make separate Y spacing and placed center consistent between the existing preview, fluorescence, well options/cropping, grid export and merged export via a shared grid-geometry helper. Previously these server callbacks used X spacing for both axes and some ignored the placed center.
- Clear stale fluorescence when source image, alignment or channel changes. Recompute to export current results.
- Reject non-finite/invalid settings and invalid well indices instead of running invalid geometry.

`backend/server.py` owns authentication, atomically allocated loopback port, local health check, parent pipe lifetime, payload limits and headers. The original debug Flask entry point is never used in the desktop package.

Scientific limits retained: images convert to RGB 8-bit; multi-page TIFF uses the first frame. Fluorophore labels map to RGB weights, not spectral unmixing or concentration. Edge partial wells are excluded. Well selector lists at most 1,000 wells. Grid Studio has its upstream 8192 px document and GPU/CPU limits; auto-fit depends on visible regular arrays and should be checked visually. Neither Grid Studio portable settings JSON (`grid-studio-settings`) nor Lab grid settings JSON embeds source image pixels or measured matrices.

Neither repository snapshot contains a LICENSE. Confirm public redistribution rights before distributing outside the authorized local project. Dependencies retain their own licenses in the bundled runtimes and source lockfiles.

Grid Studio: SurveyApps used to carry one small patch to `autofit.js` (a start-spread guard for distortion-only fitting). Upstream now has its own safeguards for that case and its self-tests pass unmodified, so the Auto-fit patch was dropped.

Plotly compatibility: change deprecated heatmap axis `titlefont` to `title.font`. Plotly 7 otherwise raised a callback error after fluorescence computation.

The App B runtime diff is included as `vendor/app-b-surveyapps.patch`, with the original file retained alongside. `scripts/sync_grid_studio.py` applies the Chocolate Bar name when it vendors App A. No original repo working-tree file is edited by SurveyApps build or test commands.

## Grid Studio settings integration (1.0.3)
Grid Studio 1.0.3 integration added portable alignment settings save/load (`grid-studio/js/settings.js`, **Save settings…** / **Load settings…**, workspace `.json` drop, `⌘/Ctrl+S` shortcut) and top-bar loaded image filename display (`#imgName`). The current source revision and synchronization process are documented in [Architecture](ARCHITECTURE.md). `desktop/protocol.cjs` owns protocol resource handling. Local builds use `dist-local`.

Startup uses an empty Lab work surface with an Upload image prompt. Image operations and measurements require an upload; no demonstration pixels are measured. Grid Studio starts empty with a translucent dark overlay (`#hint`) dimming the stage grid so the drop/open prompt is legible until a valid image or sample is loaded. The optional Grid Studio sample uses grayscale pixels. Uploaded image colors are preserved.

## Segment spatial ROI tool (1.1.0)
`segment/` is a clean-room, zero-dependency offline JavaScript tool implementing Survey Genomics' spatial ROI segmentation workflow (referencing `survey-genomics/survey` commit `a77dd6cdca80bdf31036b6a741102f0ad80e5513`, `src/survey/spatial/segment.py`, `core.py`, and `segutils.py`). No Python files or datasets from `survey-genomics/survey` are vendored or redistributed in SUGAR. It accepts CSV/TSV/whitespace-delimited cell tables and optional JSON or `value,color` metadata, performs well-level painting and 4-connected flood fill/erase, renders with WebGL point sprites (with Canvas 2D software fallback), and exports standard RFC 4180 per-cell CSVs, per-ROI summary CSVs, and resumable session JSON files. Synthetic demo files live under `segment/sample/`.
