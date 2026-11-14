# SurveyApps! — agent handoff

## Goal
Build a complete downloadable desktop application named **SurveyApps!** combining:
- https://github.com/zcays/Digital-Microscope-Gridoverlay-Studio
- https://github.com/zcays/Microscopy-Grid-Overlay

Deliver unified dashboard/navigation, both existing scientific tools, original icon (PNG/ICNS/ICO and SVG if practical), bundled dependencies, local macOS ARM64 `.app` and DMG, Windows installer and portable ZIP where buildable, cross-platform GitHub Actions, installation/development/release documentation, and verified test results. Do not push changes or publish releases.

## Initial inspection / existing work
- Workspace is the first repository, origin `https://github.com/zcays/Digital-Microscope-Gridoverlay-Studio.git`, initial HEAD `212374d`.
- Read `ARCHITECTURE.md` and `AGENTS.md` before editing. App A is static HTML/CSS/classic JavaScript under `grid-studio/`.
- Preserve pre-existing uncommitted edits in `grid-studio/js/autofit.js`, `panels.js`, `state.js`, `warp.js`, and `grid-studio/tests.html`. These belong to the user. Do not reset or overwrite them.
- Host reports macOS ARM64. `node` was not found on the initial PATH; check installed runtimes before selecting bootstrap steps.
- Second repository has not yet been inspected. No architecture decision or implementation has been made yet.
- Preserve original source repositories; build a separate SurveyApps project directory, vendor pinned copies with provenance as appropriate. Never include `.claude/` or user photos in packaged artifacts.

## Model assignments and verified availability
T3 `orchestrator_capabilities` verified:
- Codex provider `codex`: `gpt-6-astra` (lead preferred).
- Antigravity provider `antigravity`: `gemini-4-argon`, `gemini-4-hydrogen`, `gemini-3.8-flash`, `claude-opus-5-5`.
- No native Claude use is authorized. Leadership fallback: Astra → Opus 5.5 via Antigravity. Implementation fallback: Argon → Hydrogen → exact exposed Flash. No unapproved cheaper model substitutions.
- Current root thread is still Sol; no automatic main-thread model switch has occurred. Astra is to receive lead ownership through a T3 delegated task.
- Delegate IDs/links: pending assignment; lead must record them here.
- Before model-limit switching, save progress here, distinguish model vs provider failure, preserve work and resume rather than restart.

## Architecture decisions
Pending repository inspection. Evaluate Electron/Tauri/alternatives for existing functionality, Python bundling if required, offline behavior, security, cross-platform builds, maintainability and size. Do not rewrite scientific algorithms without need.

## Required validation
Startup, dashboard, navigation, image loading, grid adjustment/alignment, original processing, fluorescence calculations, image/CSV/config export, packaged resources, bundled Python if applicable, clean backend shutdown, original Grid Studio `tests.html` PASS, and platform builds. Report unverified combinations accurately. Local backend must use localhost, safe ports, managed lifetime and useful startup errors.

## Completed tasks
- Read workspace architecture and inspected git status.
- Verified exact model IDs through T3 orchestration.
- Created this continuity checkpoint.

## Remaining / exact next steps
1. Astra: inspect this file, both repositories and existing diffs; choose architecture.
2. Delegate explicit non-overlapping implementation to Argon immediately; use independent Opus review when useful and available.
3. Implement, integrate, create real icons, run scientific and desktop tests, build local macOS artifacts and configure Windows builds.
4. Update this handoff at milestones with file ownership, commands, errors and evidence.
5. Deliver actual local artifacts and source paths, with precise signing/platform limitations.

## Modified files for this project
- `AGENT_HANDOFF.md` (bootstrap only).

## Build/test commands and latest verified results
No project build/tests have been executed yet. Original instructions: open `grid-studio/tests.html` and expect PASS; exercise features without console errors.

## Known errors / limitations
- None established yet beyond missing `node` on initial PATH.
- No signing/notarization credentials supplied. Do not claim signed or notarized builds without performing them.
- Do not claim Windows artifacts exist merely because a workflow is configured.

## Lead milestone 1 — repository inspection and architecture (2026-11-13)
- Actual delegated lead is Codex **gpt-6-astra**, confirmed by orchestrator_capabilities; prior root Sol has not changed model.
- Inspected BOTH repositories. B scientific source is `microscopy_app.py` (Dash/Plotly/Pillow/NumPy); root HTML/CSS/assets belong to an unrelated essay and are excluded. `microscopy_app_test.py` is a duplicate app, not a unit-test suite.
- Selected Electron + PyInstaller-frozen Python. Evaluation and renderer contract: `surveyapps/docs/ARCHITECTURE.md`.
- Vendored tracked App A working tree INCLUDING all five existing modifications, no samples. Vendored relevant B files pinned to `caf7312461360903f340f55e577d16b5f86c5ac2`. Full hashes/provenance in `surveyapps/vendor/provenance.json`; originals unchanged.
- Neither snapshot has an explicit LICENSE; public redistribution rights need confirmation before public distribution. Local builds are authorized.
- Argon frontend task RUNNING, ownership only `surveyapps/renderer/`:
  - taskId: `node:delegated-task:command%3Amcp%3A85760f7f-398e-4fe0-b41b-8903202bcd4c%3Adelegate-task%3A6fbfc972-d798-46d7-ab11-6598d336edf8`
  - link: [SurveyApps frontend implementation](t3-thread://v2/bd43d951-49b6-4e5c-bd2c-03428e40fba3/thread:delegated-task:command%3Amcp%3A85760f7f-398e-4fe0-b41b-8903202bcd4c%3Adelegate-task%3A6fbfc972-d798-46d7-ab11-6598d336edf8)
  - provider/model: antigravity / gemini-4-argon, thinking_level high.
  - Tool next says completion wakes lead; end turn, no polling.
- Lead owns desktop/, backend/, package/build configuration, assets/, scripts/, docs/, integration and packaging. Next: bootstrap local Node (missing PATH), create isolated Python venv, freeze backend with managed loopback OS-assigned port/auth/lifetime, Electron resource loading/security, icon files and build pipelines. Delegate tests to Argon after frontend result; preserve no-overlap ownership.
- Python available at `~/miniforge3/bin/python3` (3.13.13), host arm64, Chrome installed. No builds/tests executed yet.

## Lead milestone 2 — implemented integration and first builds
- Argon frontend task completed with renderer/index.html, styles.css, app.js. Inspected code and actual Electron screenshots; it works but needs plainer product copy and small readability refinement.
- Lead implemented desktop/main.cjs, preload.cjs, backend.cjs; custom local resource protocol, sandbox/context isolation/no renderer Node, exact loopback allowlist and per-launch secret header, single-instance window, native downloads, lifecycle cleanup.
- Python service is frozen by PyInstaller (135 MB unpacked), atomically binds 127.0.0.1 port 0, stdin launch secret/EOF watchdog, health endpoint. All original scientific sources retained; runtime copy backend/microscopy_app.py fixes rectangular/placed-origin analysis/export consistency, stale measurements, malformed configs, upload errors, offline sample, and Plotly 7 titlefont compatibility. See UPSTREAM_CHANGES.md.
- Original SVG + genuine 1024/2048 PNG + ICNS + ICO generated in assets/. Dependencies pinned: Electron 45.3.2, electron-builder 26.18.0, Playwright 1.65.0; Python full lock requirements-build.txt. Node 24.22.3 bootstrapped at ~/.cache/surveyapps-tools/node/bin (not source).
- First actual mac ARM64 .app / DMG / ZIP built in surveyapps/dist. They are INTERMEDIATE and need rebuild after fixes; do not deliver them yet. Unsigned (no Developer ID/notarization). Windows/Intel not built; manual-only artifact workflow added .github/workflows/build-surveyapps.yml (never publish).
- Baseline ORIGINAL App A tests: 98/100, 2 existing failures (distortion-only gross misalignment accepted, following mesh test cascades); real user photo test passed. Kept originals untouched.
- VENDORED App A tests: 100/100 PASS, zero page errors, optional photo skipped. Runtime-only fix adds AF.maxStartSpread=1.5 and checks absolute phase spread before distortion-only fitting; original algorithms otherwise retained. Evidence test-results/original-grid.json and vendor-grid.json.
- First Electron smoke exercised dashboard/both frames/fluorescence and shutdown. Found host protocol net.fetch blocked by local allowlist; fixed to explicit safe resource reads. Found upstream Plotly titlefont removed in Plotly 7; corrected runtime copy and direct heatmap test now PASS. Re-freezing backend currently (backend-build.log).
- Native downloads, upload/config/CSV round trips, failure/retry, packaged tests and final visual inspection remain. Tests/launch-smoke.cjs is preliminary; it printed PASS despite collected errors and must not be final evidence. Backend cleanup after smoke confirmed no remaining process.
- Build commands: export PATH="$HOME/.cache/surveyapps-tools/node/bin:$PATH"; surveyapps/.venv/bin/python surveyapps/scripts/build_backend.py; cd surveyapps && CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac. Electron tests use Playwright _electron and need no preview tool/server.
- npm audit reports 6 moderate BUILD-ONLY transitive minimatch findings; current audit suggests downgrade, not automatically applied. Production node dependencies are empty. Review/document or compatible override before final.

## Current active delegate — milestone 3
- Argon packaged testing and frontend refinement RUNNING.
- taskId: `node:delegated-task:command%3Amcp%3A85760f7f-398e-4fe0-b41b-8903202bcd4c%3Adelegate-task%3Ada742825-b14e-48f2-8471-e9342d9564af`
- link: [SurveyApps packaged testing and UI refinement](t3-thread://v2/bd43d951-49b6-4e5c-bd2c-03428e40fba3/thread:delegated-task:command%3Amcp%3A85760f7f-398e-4fe0-b41b-8903202bcd4c%3Adelegate-task%3Ada742825-b14e-48f2-8471-e9342d9564af)
- Model antigravity/gemini-4-argon high; ownership tests/, renderer/, test-results/ only. Authorized build/dist generation, no other source modifications.
- Acceptance: pytest-free unittest science/backend suite; packaged/dev Playwright desktop.cjs, image fixtures/uploads/configs/exports/persistence/errors/runtime/cleanup; responsive screenshots; concise dashboard copy and clipped art fixes. Exact report test-results/delegate-report.md.
- Backend re-freeze completed successfully before assignment. All five original dirty file hashes reconfirmed unchanged.
- Next directive: completion wakes lead; end turn, do not poll. On resume read report, independently validate work, fix outside-ownership issues, rebuild final artifacts, test actual mounted/copied DMG app, verify signing/resources/shutdown, finish VALIDATION.md and artifact/source deliverables. No publish or push.

## Lead milestone 4 — independent final QA (in progress)
- Argon packaged tests task completed. Actual code/evidence is useful and independently validated, but its prose report hallucinated versions, selectors, API names, features and failure reasons. Replaced test-results/delegate-report.md with corrected facts. Do NOT repeat its claims of two-point calibration, custom fluorescence weights, /api/shutdown, restartBackend(), or duplicate S/exportPNG baseline causes.
- Lead independent tests: Python 8/8; packaged Electron 8 groups PASS with zero unexpected page/console/HTTP500 errors and zero orphans. JSON/log evidence under test-results/.
- ARM64 DMG verified, mounted read-only, app copied to /tmp/surveyapps-install-test, detached; full tests against installed copy PASS, with app PATH limited to system dirs and Python/Node env paths removed. No developer runtime needed by app.
- First unsigned bundle had invalid leftover linker ad-hoc signature. Added scripts/adhoc_sign.cjs afterPack: recursive ad-hoc sealing and strict verification PASS. Still no Developer ID/notarization. DMG/ZIP rebuilt with valid seal.
- Rosetta and Intel Python available; froze separate x64 backend in build/backend-x64 using CPython 3.13.3. Intel package script initially merged duplicate resources causing EEXIST; fixed by using an explicit generated full config file. x64 .app/DMG/ZIP build succeeded, final refresh pending below.
- Minor final fixes: Dash 4 slider label contrast and Pillow >100M pixel warning promoted to error. Re-freezing ARM and then x64 (session 87689); final builds and DMG tests must follow. No other scientific changes.
- Updated Windows E2E process discovery from missing WMIC to PowerShell CIM; no silent recovery-test skip. Added explicit installed executable/test-label overrides. Workflow pinned Node 24.22.3 / Python 3.13.13; official macos-15 ARM64 / macos-15-intel labels verified.
- Remaining: finish refreshed backend builds, package both archs, validate final installed ARM and Rosetta x64 binaries; update exact platform evidence; source archive/checksums and final links. Windows EXE/ZIP explicitly NOT BUILT; workflow only. Five original file hashes still unchanged. No push/publish.

## Final milestone — completed delivery (2026-11-13)
- Complete separate SurveyApps source at surveyapps/. Both scientific tools embedded with offline runtimes, unified dashboard/help/navigation, original icons, lifecycle/security, native exports and documented upstream fixes.
- Final ARM64 installed-DMG E2E: **8/8 PASS**, zero unexpected page/console/HTTP500 errors. Test driver launches app with only system PATH and cleared Python/Node env paths. `desktop-dmg-arm64-final.json` includes actual Electron runtime architecture/versions.
- Final Intel installed-DMG E2E: **8/8 PASS**, zero unexpected errors, under Rosetta on ARM64 host (not physical Intel). `desktop-dmg-x64-rosetta.json`; top-level arch there is test driver arm64, architecture evidence confirms actual app AND backend x86_64.
- Final Python frozen/service/scientific suite **8/8 PASS**. Integrated Grid Studio **100/100 PASS**. Original preserved baseline **98/100** as described earlier; do not claim original suite now passes.
- Startup-missing-engine unit check PASS. Deliberate backend crash/retry and normal/EOF shutdown PASS, zero orphans. Corrected harness premature success after teardown: late errors are now rechecked, only intentional shutdown network cancellations classified expected, new Dash frame awaited after recovery.
- Both DMGs verified with hdiutil, mounted read-only, copied elsewhere and detached before full testing. Both .app signatures pass `codesign --verify --deep --strict`. Ad-hoc only: no Developer ID, notarization, Gatekeeper on fresh downloaded/quarantined Mac, or physical Intel test.
- Both ZIP archives verified, all contents matched built apps (ARM64 2,575 files, x64 2,579). Final packaged runtime JS/HTML/CSS/auto-fit bytes match current source. Native app runtime does not depend on the development .venvs or Node.
- Artifacts: surveyapps/dist/SurveyApps-1.0.0-mac-arm64.dmg (168,767,186 bytes), mac-arm64.zip (165,667,211); mac-x64.dmg (178,002,946), mac-x64.zip (174,856,272). .app bundles at dist/mac-arm64/SurveyApps!.app and dist/mac/SurveyApps!.app.
- Source archive generated by scripts/package_source.py uses explicit allowlists and includes source/assets/locks/workflow/selected evidence, no runtimes/user photos/machine folders. SHA256SUMS.txt covers deliverables. DELIVERY.md provides relative artifact links; docs/VALIDATION.md contains precise coverage/limits and corrected report.
- Windows EXE/ZIP NOT BUILT or tested. Native Windows x64 manual workflow configured (also native Intel and ARM Mac), not triggered or pushed. No release published. Local x64 CPython 3.13.3; ARM 3.13.13; workflow pins Python 3.13.13 / Node24.22.3. No universal/Linux artifact claimed.
- All 5 original dirty file hashes verified unchanged. Their exact user patch is preserved at vendor/app-a-user-changes.patch, with separate SurveyApps correction diffs. No source commits or pushes.
- No active delegates or required implementation remaining. If user requests release later, review redistribution rights (upstream LICENSE files absent), obtain signing/notarization credentials via appropriate secret tool, and run native Windows/Intel CI before claiming that coverage.

---

# Adaptive Grid Studio auto-fit continuation (2026-11-13)

## Objective and scope
Improve the static Grid Studio auto-fit algorithm (`grid-studio/js/autofit.js`, `grid-studio/js/cv.js`) for biological tissue-covered photographs and across all 12 chip presets (`CHIPS` in `presets.js`), while keeping the grid static, preserving chip geometry and renderer math, mutating shared state objects (`S.*`) in place, and preserving unrelated `surveyapps/` working-tree edits. Do not commit, push, or publish private sample photos.

## Leadership and continuity
- Native Claude (`claude-fable-5-2`) implemented the adaptive dual-phasor demodulation, phase-step coherence presence map, multi-patch unwrapping/joining, cross-wall array-edge scoring, and initial synthetic/real-photo test expansion before pausing at its 5-hour usage limit.
- Continuation followed the fallback chain (`claude-opus-5-5` → `gpt-6-astra` → `gemini-4-argon`), recovering Fable's exact edits and harness without resetting work.

## Implementation summary (`grid-studio/`)
- **Dual-phasor demodulation & local polarity (`cv.js`, `autofit.js`):** Combines high-pass brightness (`flat`, clipped at `3 × P85` to suppress glints, glare bars, and bright tissue rims) and directional edge magnitude (`|gradient along f|`). Calibrates local phase polarity between brightness and edges where edges are crisp, carrying that calibration into faint tissue-covered regions. Supports both full-pitch (`q = 1`) and half-pitch (`q = 2` for `V7.0`, `V15.2`) lattices.
- **Warp-tolerant presence map (`autofit.js`):** Measures 2.5-period symmetric lag phase-step coherence (`lag = round(1.25 * pitchW / step)`) gated by combined SNR above the noise floor, so regions stretched by barrel distortion or local chip warping still register as orderly lattice rather than being dropped.
- **Multi-patch unwrapping & integer-offset joining (`cv.js`, `autofit.js`):** Unwraps all connected components of the presence mask (`cvUnwrap` returns `{un, label, main, count}`). Seeds the coarse fit on the largest patch (`main`), then iteratively joins secondary patches whose median offset from the fitted model sits within `0.3` of an integer with `< 0.2` median spread.
- **Cross-wall array boundary detection (`autofit.js`):** Correlates brightness inside each candidate column/row with the perpendicular lattice in short segments (`4 * q` periods), using a narrow comb template for thin-wall square chips (`wallFrac < 0.25`) and sinusoidal correlation otherwise. Evaluates boundary sharpness (`edgeSure`) and outside continuation (`spill`).
- **True wall numbers in polish & side-error safeguard (`autofit.js`):** Uses known absolute wall numbers (`K - koff`) for joined cells during wrapped polish and residual evaluation (`AF.maxAbsError = 2.5`), preventing whole-well corner slips from masquerading as small mod-1 residuals. Rejects fits when any adequately sampled side (`AF.minSideSamples = 30`) exceeds `AF.maxSideError = 0.10` of a well.
- **In-place state restoration & user messaging (`autofit.js`, `panels.js`):** If `autoFitNow()` temporarily switches `S.chip.fit` from tiled (`false`) to array-fit (`true`) and the fit is refused or throws, the previous layout (`S.chip`, `S.doc`, `S.zoom`) and image state are restored in place without replacing state object references. `afMessage()` reports visible array coverage, uncertain edge localization (`edgeSure < 1.5`), and hidden/faint/out-of-view corners (`hiddenCorners`).

## Verified test results and visual checks
- **Browser self-test suite (`grid-studio/tests.html`):** **120 / 120 PASS** in headless Chrome (0 console/page errors). Covers:
  - Chip table integrity and exact drawn well/pitch ratios in fit and tiled modes across all 12 presets.
  - GPU vs. software (`?renderer=cpu`) pixel parity across 7 states including fine mesh.
  - Synthetic tilt + fisheye recovery, local bulge fine-mesh correction, and `Auto-fix distortion` recovery/refusal (half-well and one-whole-well offset refusals).
  - Tiled-layout and state-object identity (`S.img`, `S.lens`, `S.warp`, `S.grid`, `S.chip`) preservation when `autoFitNow()` refuses.
  - Synthetic biological tissue + glare across all 12 chip presets (`V9.0` cleanly refused at `< 5 px` per well; all other 11 presets fit with `< 0.16` pitch corner error and `0.00°` rotation error), plus hard tissue (`80%` coverage, `15%` opaque, `0.15` contrast) on `V11`, `V12`, and small-circle `V9.2` (cleanly refused when side residual exceeds threshold).
  - Both local real microscope photos (gitignored under `grid-studio/samples/`):
    - **Real V12 photo:** `ok: true`, reference-corner error `0.23` well, typical error `0.6 px` (`3.0%` of a well; `6.1%` before fine mesh), worst side `4.0%`, `97.8%` inliers, tilt `-2.14°`.
    - **Real V11 tissue-covered photo:** `ok: true`, reference-corner error `0.00` well, typical error `0.4 px` (`2.5%` of a well; `4.0%` before fine mesh), worst side `6.9%`, `99.2%` inliers, wells clearly seen in `84.0%` of the array (`edgeSure`: `[8.09, 8.57]`).
- **48-case synthetic stress harness:** **45 / 48** within the strict `< 0.35` pitch corner-error threshold across plain, tissue, dark-tissue, and hard-tissue variants for all 12 presets (`V9.0` 4/4 expected refusals; `V9.2_hard` 1.09-pitch slip cleanly refused by the `AF.maxSideError` guard; remaining two borderline cases are `V1-Square_tissue` at `0.35` pitch on the top-right corner where tissue rim and dark glare band coincide, and `V15.1_hard` at `0.38` pitch on the bottom-left corner at `9.6 px` pitch under 80% tissue).
- **Visual overlay inspection:** Rendered full-canvas overlays and app screenshots for both real `V11` and `V12` photos confirm that the static grid aligns cleanly with visible wells around the tissue boundary and across the array, with no console errors.

## Unavoidable limitations
- **Obscured geometry is inferred, not observed:** Where opaque tissue, glare, or framing completely hides an array edge or corner, the model extrapolates from visible patches using the chip's nominal well count (`wide × long`) and smooth mesh regularization. If an outer edge has weak cross-wall signal (`edgeSure < 1.5`) or a corner has `< 15%` visible wells, the app warns the user to check alignment by eye and nudge with the arrow keys if needed.
- **Minimum well resolution (`≥ ~5 px` per period):** Full-array photos of very dense presets at standard camera resolutions (e.g., `V9.0` with `333 × 300` wells at `~4.3 px/pitch` in a 2000 px frame) fall below the Nyquist/demodulation limit and are refused rather than guessed. Small circular wells (`V9.2`, `166 × 150` wells at `~8.5 px/pitch`) under heavy opaque tissue (`80%+` coverage) can suffer phase-unwrap or boundary ambiguity and will be refused when edge residuals exceed `AF.maxSideError`.

## Crop on a rotated image (2026-11-13, lead: Claude Fable 5.2)

- Bug reported by the user: after rotating the image, an applied crop came out as a slanted box.
  Cause: `S.img.crop` stored the bounding box of the selection in the unrotated image.
- Fix: `S.img.crop` is now an oriented rectangle `{x, y, w, h, rot}` in image px (`rot` = turn about its centre, missing = 0).
  `canvasRectToImageRect()` sets `rot = −image rotation` (and undoes the distortion handles first); both renderers mask through
  `cropFrame()` (crop.js). Files: `grid-studio/js/crop.js`, `gl.js`, `cpu.js`, `state.js` (comment), `panels.js` (hint text),
  `tests.html` (+1 crop test, +2 GPU-vs-software cases), `ARCHITECTURE.md`, `README.md`.
- Verified: `tests.html` 123 / 123 in headless Chrome with a fresh profile (title `PASS`); a 400 × 300 selection on a 20°-rotated
  image exports as an exact level rectangle.
- Gotcha: reuse of a headless-Chrome `--user-data-dir` served cached old `.js` and produced a false failure; use a new one per run.
- Not done: nothing committed or pushed; the SurveyApps vendored copy of Grid Studio was not re-synced.
