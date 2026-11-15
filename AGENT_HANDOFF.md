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

## Crop to array + chip list from a file (2026-11-14, lead: Claude Fable 5.2)

User requests: (1) a preset that crops/exports exactly the array's outer edge (wells + half a wall, no dead room); (2) chip versions
read from a file instead of being hard-coded.

- (1) DONE by the lead in the main checkout, uncommitted: `S.chip.arrayOnly`, `arrayRect()` / `arrayCropRect()` / `updateArrayMask()` /
  `setArrayOnly()` in `grid-studio/js/grid.js`; `export.js` cuts the PNG to the array; controls in `panels.js` (Crop panel) and
  `index.html` + `main.js` ("array only" by Export); `state.js`; one new test in `tests.html`; notes in ARCHITECTURE.md / README.md.
  Verified: tests.html 124 / 124 (headless Chrome, fresh profile); on the real V11 photo the export is 1732 × 1732 px = the array.
- (2) DONE: implemented by Gemini 4 Argon (Antigravity) in an isolated worktree (branch `t3/import-editable-chip-lists`, commit
  `3f539ad`, local only), merged by the lead into the main checkout as uncommitted changes: packaged editable
  `grid-studio/chips.js` (`var BUILTIN_CHIPS`), `validateChips` / `parseChipFile` / `setChipList` and the remembered list
  (`localStorage` key `gridStudio.chipList`) in `presets.js`, Load / Save / Use built-in buttons in the Chip version panel.
- Independent review by Claude Opus 5.5 (Antigravity): geometry and export correct; 1 high + 4 medium + 7 low findings. Fixed by the
  lead: a typo in chips.js is reported with its line number (was: empty list, no message); µ in CSV headers; decimal commas and
  thousands separators; `well < pitch` and a well-count limit; the remembered list says when chips.js changed since; tests run the app
  with `index.html?nostore` so they never read or delete a remembered list and no longer assume 12 chips; "Crop to array" switches off
  when the chip or "Fit canvas to array" is unticked; the canvas border is never less than half a wall; the Crop panel text follows
  Offset X/Y; loading a list keeps the image's µm per pixel. Left as is on purpose: the picture outside the array is hidden, not dimmed.
- Verified after the fixes: tests.html 132 / 132 (headless Chrome, fresh profile, both real photos present); a chips.js with
  `shape: square` (quotes missing) starts the app and shows "mistake at line 35". Not verified: clicking the real file picker /
  download prompt in a visible browser; Firefox / Safari; Excel UTF-16 CSV files.
- Per the user (2026-11-14): work locally only. Nothing from this section is committed or pushed; SurveyApps' vendored copy is not
  updated for it.

## Refactor (2026-11-14, lead: Claude Fable 5.2) — local only, uncommitted

Behaviour-preserving reorganisation after the last three features; no logic changed.
- `presets.js` split: it keeps the scale / tick / fit code; the chip LIST (validate, JSON/CSV import, remembered list, start-up) is
  the new `js/chiplist.js`, loaded right after presets.js (it calls `initChipList()` at its end).
- `autofit.js` split: it keeps the pure analysis; apply / undo / buttons / messages are the new `js/autofit-app.js`.
- "Crop to array" UI (`updateArrayMask`, `arrayCropText`, `setArrayOnly`) moved from grid.js to crop.js; the geometry
  (`arrayRect`, `arrayCropRect`) stays in grid.js. `escHtml` moved to state.js next to `clamp`.
- File headers rewritten where stale (autofit.js described the old edge-only algorithm). ARCHITECTURE.md file map, README, AGENTS updated.
- Not done: `afComputeOnce()` in autofit.js is still one ~350-line function with numbered stages; splitting it means threading a lot
  of shared fit state and was left for a session that can re-validate it on the stress photos.
- SurveyApps note: its `vendor/grid-studio` must be re-copied (two new script files + chips.js) when this is released.

## SurveyApps local working-tree integration (2026-11-14)

Synced 25 public Grid Studio files from the current working tree, excluding samples. Added `surveyapps/scripts/sync_grid_studio.py` (explicit public allowlist and byte verification). Provenance records e6ba1c4 plus uncommitted upstream files. New features include crop-to-array, chips.js, chiplist.js and autofit-app.js. No upstream source was edited.

Extracted protocol resource serving unchanged to `surveyapps/desktop/protocol.cjs`; main retains session security, IPC and lifecycle. Added explicit packaging exclusion for samples and ignored dist-local. Updated SurveyApps architecture/upstream documentation. Extended desktop tests for script MIME types, custom-origin localStorage, chip-list file import/download and array PNG download, including filenames. Existing scientific backend code was not changed by this integration.

Observed validation:
- `node tests/original-grid.cjs --vendor`: PASS, 132 / 132 passed, errors []. Real-photo tests skipped without samples.
- `.venv/bin/python -u -m unittest discover -s tests -p "test_*.py" -v`: 8 tests, OK.
- `node tests/backend-lifecycle.cjs`: PASS missing executable error and idempotent cleanup.
- `diff -rq grid-studio surveyapps/vendor/grid-studio`: only samples missing (expected exit 1).
- electron-builder ARM64 with `--publish never -c.directories.output=dist-local`: completed, app/DMG/ZIP created. Version remains 1.0.1. Existing dist and backend builds retained.
- ASAR listing: 47 entries, no samples path; unpacked app recursive scan: zero files in samples directories. `codesign --verify --deep --strict` succeeded.
- First desktop run passed functional groups but failed orphan-process assertion because a second test run was concurrent. Second expanded packaged run passed all 8 groups and zero orphans. Final standalone run with explicit chips.json and array-V12.png filename assertions also passed all 8 groups (exit 0).

Local outputs (relative to workspace): `surveyapps/dist-local/mac-arm64/SurveyApps!.app`, `surveyapps/dist-local/SurveyApps-1.0.1-mac-arm64.dmg`, and corresponding ZIP. No commits, pushes, releases or CI runs. Intel/Windows builds and physical native-dialog interaction were not verified. File-input automation and native download events exercise the integration.

## Grid Studio liquid glass styling
- CSS-only presentation update in `grid-studio/css/style.css`: prefixed glass tokens, floating rounded chrome, blue selection/focus, inset fields, responsive toolbar, reduced-transparency/motion fallbacks. No app logic changed.
- Inspected sample + selected chip + crop at 800×600, help at 1440×900, and forced CPU crop at 1440×900. Screenshots in `/var/folders/nt/30k1z6td5cdd9g384c96wg8h0000gn/T/grid-glass-h4bigl0i/`.
- Native range controls retain browser accent-filled tracks. No external assets. Automated self-test result recorded separately by final report; no console instrumentation performed.
- Required fresh-profile headless self-tests completed: title PASS; 132 / 132 passed. Local verification server stopped.

## Grid Studio instrument finish and press feedback
- CSS-only follow-up: numbered section rails replace nested panel cards, chip presets form a compact specimen table, and an etched crosshair identifies the app. Added control-only depression/highlight feedback and slider thumb response; reduced-motion mode suppresses movement.
- Native checkbox semantics remain intact; custom appearance is a solid white rounded box when checked and a transparent outlined box when unchecked. Forced-colors mode restores native appearance.
- Inspected screenshots at 1440×900, 1200×800, and 800×600 with sample/chip/crop, plus settings. CDP mouse presses confirmed .97 scale + 1px depression, no movement under reduced motion, and checkbox toggling. Final interaction run reported zero runtime exceptions; CPU sample rendered.
- Fresh-profile self-tests: first remained Self-tests; required rerun returned PASS, 132 / 132 passed. A transient script-load failure occurred during an intermediate browser check; final check on a higher-backlog local server completed without runtime exceptions. No app JS changes.
- Evidence: `/var/folders/nt/30k1z6td5cdd9g384c96wg8h0000gn/T/grid-instrument-nu2zud9_/` (desktop.png, 1200.png, 800.png, settings.png, help.png, pressed.png, cpu.png, verification.json, tests-rerun.html).


## Monochrome typography and slider refinement
- Consolidated layered CSS overrides into a single stylesheet organized by tokens, layout, components, work surface, and accessibility. Grayscale chrome with white actions/selection; image and grid color choices remain available. Removed monospaced UI labels in favor of the system SF stack, refined weight/spacing, retained tabular measurements. Chrome confirmed native `.SF NS` font on this Mac.
- `ui.js` now sets the live slider progress CSS variable on synchronization and keyboard changes, and gives range/number controls accessible names. Slider values/stepping/render algorithms are unchanged. Range pointer target is 28px tall; native dragging remains immediate.
- Verified native mouse slider drag (8→21), arrow step (21→22), numeric input (12, track 30%), white/clear checkbox states, press feedback and reduced-motion override. Final interaction check recorded zero runtime exceptions and CPU sample rendering. Visually inspected desktop, settings and compact screenshots at 1440×900, 1200×800, and 800×600. Fresh-profile self-tests returned PASS, 132 / 132 passed.
- Evidence: /var/folders/nt/30k1z6td5cdd9g384c96wg8h0000gn/T/grid-monochrome-svsz94qs (desktop.png, 1200.png, 800.png, settings.png, help.png, pressed.png, cpu.png, verification.json, tests.html). Changes remain local and uncommitted.

## SurveyApps shell and Fluorescence Lab Liquid Glass restyle (2026-11-15)
- Restyled the SurveyApps Electron shell (`surveyapps/renderer/index.html`, `surveyapps/renderer/styles.css`) and Fluorescence Lab (`surveyapps/backend/assets/desktop.css`, presentational style dicts/classes in `surveyapps/backend/microscopy_app.py`) to the shared Apple Liquid Glass design system (`--lg-*` tokens, `backdrop-filter: blur(24px) saturate(170%)`, 1px hairline border, top inner highlight, soft shadow, ambient colour-field background on the dashboard, floating pill navigation bar, quiet glass capsule buttons, filled `#0A84FF` primary actions, inset translucent inputs, tabular numerals, and `@supports not (backdrop-filter: blur(1px))` + `prefers-reduced-transparency` / `prefers-reduced-motion` fallbacks).
- Overrode Dash 4.5.0 CSS custom properties (`--Dash-*`) and component classes (`.dash-dropdown`, `.dash-slider-*`, `.dash-checklist`, `.js-plotly-plot .modebar`) in `surveyapps/backend/assets/desktop.css`. Scientific logic, callbacks, component IDs, `surveyapps/vendor/**`, `grid-studio/**`, `desktop/**`, `scripts/**`, and `surveyapps/dist/**` were not modified.
- Re-froze the local Python backend (`surveyapps/build/backend`) via `.venv/bin/python scripts/build_backend.py` so unpackaged Electron launches serve the updated Fluorescence Lab assets.
- Verified:
  - `.venv/bin/python -u -m unittest discover -s tests -p "test_*.py" -v`: **8 / 8 PASS**.
  - `node tests/desktop.cjs` (unpackaged dev mode): **8 / 8 check groups PASS** (`surveyapps/test-results/desktop-dev.json`), zero orphan processes.
  - Visually inspected `surveyapps/test-results/home-wide-dev.png` (1440×960), `home-800px-dev.png` (800×600), `help-dev.png`, `grid-studio-dev.png`, and `fluorescence-lab-dev.png`.



## Desktop shell navigation overlap fix
- User screenshot showed shell navigation intruding into Session Active. Replaced header flex shrinking with explicit grid tracks in renderer/styles.css; <=1360px navigation gets a dedicated row, <=600px status gets its own row. Header height follows content and the iframe remains below it.
- Embedded vendor Grid Studio had stale CSS/ui.js. Copied the two current presentation files from root Grid Studio; no other vendor files or app logic changed.
- Verified browser shell with a mocked desktop bridge at 1440, 1361, 1360, 1200, 1101, 961, 960, 800, and 600px: navigation/status rectangles do not overlap, nav labels remain within viewport, and iframe starts below header. Final runtime exception count zero. Inspected 1440/1200/800 screenshots and loaded sample in embedded app. Vendor self-tests: PASS, 132 / 132 passed.
- Evidence: /var/folders/nt/30k1z6td5cdd9g384c96wg8h0000gn/T/grid-shell-overlap-2ydf7bmn (width-named screenshots, verification.json, tests.html). Verification used source renderer; installed/packaged Electron app was not rebuilt.

## Integration continuation (2026-11-15, incomplete validation)
- Updated shell and Lab CSS accents to neutral white, with dark text on primary actions; preserved responsive navigation tracks and scientific plot colors. No algorithm changes.
- Python science tests: 8/8 OK (`/tmp/survey-python.log`). Backend refreeze completed (`/tmp/survey-freeze.log`).
- ARM64 local packaging started with publish never into dist-local (`/tmp/survey-build.log`); completion and packaged validation remain required.
- Standalone source/vendor Playwright selftests remained waiting with no result; root cause unresolved. Do not claim PASS or attribute this to backlog. Dev E2E reached dashboard + Grid interactions; final result pending (`/tmp/survey-dev.log`).
- Outstanding: startup diagnostics, final sequential selftests/E2E, visual inspection, ASAR/source comparison, signature/sample checks. This continuation does not establish release readiness.

Follow-up results: source and vendor standalone selftests both completed PASS 132/132, errors []; earlier 'stalled' observation was premature, not a demonstrated startup failure. ARM64 DMG/ZIP build completed; codesign --verify --deep --strict succeeded; unpacked app scan found zero sample-directory files. Dev E2E still pending at Grid custom-protocol selftests. Packaged E2E, ASAR byte comparison and final visual QA remain outstanding. The initial relative-path CSS edit failed, then was corrected successfully; neutral accent and dark action-label declarations verified in both stylesheets.

Further verification: dev E2E completed 8/8 PASS, zero orphans. ASAR byte comparison matched 32 desktop/renderer/vendor files and no samples entries. Packaged E2E launched sequentially after dev exited, log /tmp/survey-packaged.log. Inspected home-wide-dev.png: navigation and readiness capsules separated, primary action contrast correct; decorative blue artwork/badge/icon remain (further monochrome polish may be wanted). Packaged test result remains pending.


## Final local monochrome integration verification (2026-11-15)
- Source and vendor Chromium self-tests completed: 132/132 PASS, no page errors. The preceding report of stalled runs was premature: those same processes finished successfully. Earlier virtual-time/dump-DOM incomplete runs were not reproduced or conclusively diagnosed; no claim of a startup bug fix.
- Python science 8/8 PASS; backend refrozen. Dev E2E 8/8 PASS and rebuilt ARM64 packaged E2E 8/8 PASS, zero unexpected page/console/HTTP500 errors, zero orphan backend processes. Packaged evidence: test-results/desktop-glass-final.json; screenshots use glass-final suffix.
- Independently inspected desktop/compact dashboard, embedded Grid Studio and Fluorescence Lab screenshots. White primary actions and neutral controls are readable; navigation/status are separate. Scientific colors, status indicators and decorative artwork retain color.
- 32 packaged renderer/desktop/Grid Studio files byte-match source; packaged Lab CSS byte-matches source. No samples in ASAR or ZIP. Strict recursive ad-hoc signature verification, DMG checksum verification and full ZIP CRC test passed.
- Current artifacts: surveyapps/dist-local/mac-arm64/SurveyApps!.app, surveyapps/dist-local/SurveyApps-1.0.1-mac-arm64.dmg and .zip. Version retained at 1.0.1; local build only, no commit/push/publication/CI. Intel/Windows not rebuilt for this UI update; no Developer ID signing/notarization. This final record supersedes the preceding incomplete-validation checkpoint.

## Empty workspaces and dimmed upload prompt (2026-11-15)
- Removed automatic Lab purple/green demo (`surveyapps/backend/microscopy_app.py`, `surveyapps/tests/test_empty.py`). Before upload the plot is neutral (`#181818`) with an `"Upload image to begin"` prompt; compute/crop/rotate/export cannot fabricate sample measurements. Uploaded-image workflows and `_uploaded_image` monkeypatching remain unchanged. Optional Grid Studio sample (`grid-studio/js/images.js`, synced to `surveyapps/vendor/grid-studio/`) is now grayscale.
- Grid Studio `#hint` (`grid-studio/css/style.css`, synced to `surveyapps/vendor/grid-studio/`) now sits above an 88% dark canvas overlay (`rgba(18,18,18,.88)`, `z-index: 10`, `pointer-events: none`). It does not intercept pointer/drop events; failed image decoding keeps it visible and successful `setImage()` removes both text and dimming. Toolbar/settings remain usable.
- Source and vendor self-tests: **132 / 132 PASS** (`test-results/original-grid.json`, `test-results/vendor-grid.json`); Python unit suite: **9 / 9 PASS** (includes `tests/test_empty.py`). Sequential dev E2E (`test-results/desktop-dev.json`) **8 / 8 PASS** and final rebuilt ARM64 packaged E2E (`test-results/desktop-empty-final.json`) **8 / 8 PASS**, zero unexpected page/console/HTTP500 errors and zero orphans. Inspected `grid-empty-empty-final.png`, `grid-studio-empty-final.png`, `lab-empty-empty-final.png`, and `fluorescence-lab-empty-final.png`.
- Corrected E2E startup predicate in `surveyapps/tests/desktop.cjs` that still required the removed synthetic-image axis range; now explicitly requires empty plot/no image plus upload prompt. Subsequent real uploads and six export types passed.
- 32 packaged host/renderer/Grid files match source, no ASAR sample entries, strict ad-hoc signature verification (`codesign --verify --deep --strict`), `hdiutil verify`, and `unzip -tq` passed. Updated app/DMG/ZIP in `dist-local`, version `1.0.1` retained. No commits/pushes/publication. Intel/Windows not rebuilt.

## Click-to-upload empty workspaces, refactor, and performance optimization (2026-11-15)
- **Click-to-upload in both empty upload workspaces:**
  - **Grid Studio (`grid-studio/css/style.css`, `grid-studio/js/main.js`, synced to `surveyapps/vendor/grid-studio/`):** Enabled `pointer-events: auto` and `cursor: pointer` on `#hint` when empty, and wired `dom.emptyHint.onclick` to open `#file` (`dom.file.click()`) when `e.button === 0 && !panMode && !S.img.el`. Once an image is loaded (`S.img.el` set), `#hint` is hidden (`display: none`) and clicking the stage does not trigger the file picker.
  - **Fluorescence Lab (`surveyapps/backend/microscopy_app.py`, `surveyapps/backend/assets/desktop.css`):** Wrapped `#image-graph` in `#image-graph-wrap` (`className='survey-image is-empty'` when `!imgData`, `'survey-image'` when loaded) with `cursor: pointer` styling on `.survey-image.is-empty`. Added capture-phase click handling in the global clientside listener to trigger `document.querySelector('#upload-image input[type="file"]').click()` when `#image-graph` is clicked while no image is loaded (`!hasImage`).
- **Performance optimizations & refactoring:**
  - **Electron Shell (`surveyapps/renderer/styles.css`):** Replaced continuous full-window `filter: blur(88px)` + infinite `ambientDrift` keyframe animations on `.ambient-blob` with pre-softened static radial gradients, and set `display: none` on `.ambient-canvas` when `data-view="grid"` or `data-view="microscopy"` so zero GPU compositing occurs behind tool iframes.
  - **Grid Studio (`grid-studio/js/state.js`, `main.js`, `ui.js`, `view.js`, `presets.js`, `gl.js`, `warp.js`, `panels.js`):** Coalesced `syncAll()` into `frame()` via `dirtyFlags.sync` / `flushSyncAll()`; cached slider range/number/progress values in `slider()` to skip redundant DOM/CSS writes; avoided reallocating `<canvas id="grid">` backing store in `layout()` when dimensions are unchanged; cached status bar and scale bar DOM values on `pointermove`; cached `el._lastHtml` in `updateChipInfo()`; cached WebGL `warpTexUniform` and reused `warpMeshBuf` (`Float32Array`); cached `.chip` row DOM references in `renderChipList()` / `buildChipPanel()`.
  - **Fluorescence Lab (`surveyapps/backend/microscopy_app.py`):** Converted `update_well_options` and `invalidate_fluorescence` Dash callbacks to clientside callbacks (retaining Python functions for unit tests) to eliminate HTTP POST round-trips during slider dragging; combined all vertical and horizontal Plotly grid lines into a single SVG `type: 'path'` shape; cached PIL fonts in `_get_mono_font(font_size)`.
- **Verified results:**
  - `node surveyapps/tests/original-grid.cjs`: **134 / 134 PASS** (includes 2 new `#hint` click-to-upload tests and both real V11/V12 photos).
  - `node surveyapps/tests/original-grid.cjs --vendor`: **134 / 134 PASS**.
  - `surveyapps/.venv/bin/python -u -m unittest discover -s surveyapps/tests -p "test_*.py" -v`: **9 / 9 PASS**.
  - Re-froze backend (`surveyapps/scripts/build_backend.py`) and ran `node surveyapps/tests/desktop.cjs` (dev): **8 / 8 PASS** (`surveyapps/test-results/desktop-dev.json`).
  - Rebuilt ARM64 macOS package and ran `node surveyapps/tests/desktop.cjs --packaged`: **8 / 8 PASS** (`surveyapps/test-results/desktop-click-upload-final.json`), `codesign --verify --deep --strict`, `hdiutil verify`, `unzip -tq`, and zero private sample files verified. No commits or pushes.

## Grid Studio portable settings and image filename (2026-11-15; local only)

- Added `grid-studio/js/settings.js` (193 lines): detached `settingsSnapshot()`, pretty `settingsToText(obj)`, pure `parseSettings(text)` → `{settings}`, and `applySettings(settings)` → `{ok, warnings}` / `{ok:false, reason}`. Validation precedes all state changes; existing state objects stay in place. Chip selection/fit/margin run through `keepingImageScale()` before restoring the exact saved canvas, transform, lens, distortion and crop. Array masking is updated immediately as well as on the next frame.
- Version 1 JSON has `app`, `kind: "grid-studio-settings"`, `version`, ISO `savedAt`, `image: {name,width,height}` (or null), `canvas`, `chip` (including the live definition and `savedDoc` to preserve the canvas restored on untick), `img`, `lens`, `warp` (including fine mesh), all `grid`, `ratio`, and `export: {image,grid}`. No pixels, view zoom, tool, cursor, unfinished crop selection or undo history. A short metadata excerpt: `{"kind":"grid-studio-settings","version":1,"image":{"name":"photo.tiff","width":1200,"height":800},"canvas":{"w":1200,"h":800}}` (the real file includes every field above).
- Top bar: **Save settings…**, **Load settings…**, JSON picker, `⌘/Ctrl+S` with browser save prevented. Downloads `<image stem>.gridstudio.json`, or `grid-studio-settings.json` without a named image. Workspace drop/paste routes JSON by extension/type and retains the existing first-image behavior. FileReader/Blob URLs support double-click `file://`; no local fetch or dependencies.
- Missing chip IDs refuse with the chip name and **Load chip list…** instructions. Changed drawing measurements, different picture sizes, and different names warn. A file opened without an image applies its layout and waits for one `setImage()` after the normal image resets; opening in either order gives the same result. Loading clears crop and auto-fit undo, clears any unfinished crop selection, and synchronises grid-style/aspect selects as well as all sliders/checkboxes. A persistent panel-top line and toast report the filename, saved time, outcome and warnings.
- `S.img.name` is assigned in `setImage()` and the loaders. `#imgName` uses textContent, a middle ellipsis, and a full-name/pixel-size title. Built-in sample = **Sample image**, clipboard picture = **Pasted image**. Toolbar height follows wrapped rows; export choices wrap together at 800px.
- Changed/added files: `grid-studio/js/settings.js` (new); `grid-studio/js/state.js`, `images.js`, `main.js`, `keyboard.js`, `panels.js`; `grid-studio/index.html`, `css/style.css`, `tests.html`; root `README.md`, `ARCHITECTURE.md`, `AGENT_HANDOFF.md`. No renderer/image maths, auto-fit, crop implementation or chip list edits; no tracked SurveyApps/vendor edits. All work remains uncommitted, with no staging, commits, pushes, stash/reset/checkout/clean or GitHub calls.

Observed verification:

- Required runner, `PATH="$HOME/.cache/surveyapps-tools/node/bin:$PATH" node surveyapps/tests/original-grid.cjs`, baseline: title **PASS**, **134 / 134 passed**, `errors: []`; both private real-photo tests active (only the runner read them; no photo copying or embedding).
- First expanded run completed, title **FAIL (2)**, **156 / 158 passed**, `errors: []`. A new CPU test referred to a nonexistent renderer variable (fixed to `rendererName()`); restoring settings left an old CSS array mask until a frame, exposing an existing-test failure (fixed with immediate `updateArrayMask()`). No existing tests were changed or weakened.
- Required runner rerun: title **PASS**, **158 / 158 passed**, `errors: []`, including all 134 old tests, both real-photo tests, and 24 new tests in one contiguous block after chip-list tests and before crop tests. New tests cover exact normalised state/object identity and export-pixel round trips, oriented crop/chip/array/lens/handles/17×17 mesh, load ordering/one-use waiting, invalid files with unchanged state, chip and image warnings, ignored keys, text-only names/ellipsis, and both shortcut modifiers. Dedicated fresh `?nostore&renderer=cpu` iframe passes exact state + export-pixel restoration too. Test state is restored before later tests.
- Fresh-profile headless Chrome over `file://`: actual JSON download, picker import via setInputFiles, settings drop, image drop and clipboard-image paste all **PASS**; zero page or console errors. A new Chrome user-data-dir was used at each viewport. Measured no horizontal toolbar overflow and no controls outside its bounds at **1440×900**, **1200×800**, **800×600**. Independently looked at screenshots at all three widths, including long names; final compact layout keeps export choices together.
- Evidence folder: `/tmp/grid-settings-HlyzoA/`. Final screenshots: `1440x900-sample.png`, `1200x800-sample.png`, `800x600-sample.png`, and corresponding `*-long-name.png`. `verification.json` contains viewport/profile/bounds/error details; `browser-check.log` the browser result; `verify.cjs` the standalone headless check. `Sample image.gridstudio.json` is a full working example containing only settings and public synthetic-sample metadata. `self-tests.json` contains the successful runner result.
- Shared preview was attempted first but rejected file URLs: “Invalid preview URL (unsupported-protocol: file:)”; verification used requested headless Chrome directly. No self-test run ended without a result.

Known limits / unverified:

- Version 1 only. Keep the original image and any custom chip list separately. Image identity uses the working dimensions after any existing size reduction, not an image hash. A same-name/same-size replacement cannot be identified as different pixels.
- Validation uses the declared slider ranges (including existing setter minima of scale 1%, well size 1px and line width .25px); canvas values round/clamp to 16…8192 and dead room to 0…40, matching existing setters. Warp/crop positions have no UI bounds and must be finite; crop dimensions must be positive. Fine mesh dimensions are whole numbers 2…33 and offsets must number exactly 2·n·n. Existing typed/drag values outside the declared slider ranges are refused on load; this change does not restrict those existing controls themselves.
- No Firefox/Safari run, physical OS file-picker clicking or visible-browser test. Automated Chrome file-input selection and native browser download events were observed. All requested Chrome viewports and software core path were verified.

## SurveyApps! integration of Grid Studio portable settings & image filename (2026-11-15; local only)

- Synced `grid-studio/` (`a784c4d` plus uncommitted working-tree changes) into `surveyapps/vendor/grid-studio/` via `surveyapps/scripts/sync_grid_studio.py` (`Verified 26 public Grid Studio files`; `js` allowlist already covered `js/settings.js`). `diff -rq grid-studio surveyapps/vendor/grid-studio` reported only `samples` missing.
- Updated `surveyapps/vendor/provenance.json`, `surveyapps/docs/UPSTREAM_CHANGES.md`, `surveyapps/docs/ARCHITECTURE.md`, `surveyapps/README.md`, `surveyapps/renderer/index.html` (Dashboard card, Help guide, shortcut table), and `surveyapps/docs/VALIDATION.md`. Kept `package.json` at `1.0.2`. Checked `surveyapps/desktop/main.cjs` menus: no `CmdOrCtrl+S` menu accelerator conflict exists.
- Extended `surveyapps/tests/desktop.cjs` (keeping all existing checks) to verify `js/settings.js` protocol delivery, `#imgName` visibility and filename display (`Sample image` and `fixture_rgb.png`), **Save settings…** download (`fixture_rgb.gridstudio.json`, `kind: "grid-studio-settings"`), **Load settings…** restoration (`V3.1`, rotation `12.5` after mutating to `V12`, `-42`), `⌘/Ctrl+S` shortcut saving without menu collision or page reload, and no-overlap shell + Grid Studio topbar layout at 1440×960 and 800×600.
- Observed verification:
  - `node tests/original-grid.cjs --vendor`: `title: "PASS"`, `158 / 158 passed`, `errors: []`; skipped: `samples/v12-example.jpg` and `samples/v11-tissue-example.jpg` real-photo tests.
  - `.venv/bin/python -u -m unittest discover -s tests -p "test_*.py" -v`: `9 / 9` OK.
  - `node tests/backend-lifecycle.cjs`: `PASS`.
  - `node tests/desktop.cjs` (dev): `DEV SUITE PASSED (9 checks)` (`test-results/desktop-dev.json`), `158 / 158 passed` in embedded `tests.html`, zero unexpected errors/HTTP 500s, zero orphan processes; inspected `home-wide-dev.png`, `home-800px-dev.png`, `grid-studio-dev.png`, `grid-studio-800px-dev.png`, `help-dev.png`.
  - Rebuilt macOS ARM64 app into `surveyapps/dist-local/` (`SurveyApps!.app`, `SurveyApps-1.0.2-mac-arm64.dmg`, `SurveyApps-1.0.2-mac-arm64.zip`). `npx asar list` confirmed `/vendor/grid-studio/js/settings.js` is packaged and zero `samples` paths exist; `codesign --verify --deep --strict` passed.
  - Packaged E2E (`tests/desktop.cjs --packaged` against `dist-local/mac-arm64/SurveyApps!.app/Contents/MacOS/SurveyApps!`): `PACKAGED-LOCAL SUITE PASSED (9 checks)` (`test-results/desktop-packaged-local.json`), `158 / 158 passed` in embedded `tests.html`, zero unexpected errors/HTTP 500s, zero orphan processes; inspected `grid-studio-packaged-local.png` and `grid-studio-800px-packaged-local.png`.
- Not verified / not touched: Intel (`x64`) and Windows (`x64`) builds require CI and were not triggered; `surveyapps/dist/` and `surveyapps/build/backend*` were left untouched; all changes remain uncommitted locally.

## Release preparation (2026-11-15)

The user authorized committing, pushing both repositories, and updating installation artifacts. SurveyApps is being bumped to 1.0.3 to distinguish the new settings/filename features from the published 1.0.2. The preceding local-only entries are historical. Settings validation uses the wider sanity bounds in settings.js, rather than slider travel, so Auto-fit values outside slider ranges can round-trip.

## SurveyApps 1.0.3 release validation (2026-11-15)

Studio settings/filename changes were committed as 5082a2c, with the SurveyApps vendor snapshot pinned to that full SHA. Both repositories were pushed to main. SurveyApps 1.0.3 updates app/lockfile version metadata, shell labels, README, INSTALL (including upgrade and settings workflows), DELIVERY and validation docs. A broad initial lockfile substitution also changed transitive dependency strings; CI caught it before publication. Follow-up commits restore every dependency entry byte-for-byte to the prior release while retaining the app version bump.

Source tests passed 158/158 (both private photos active); Python 9/9; local ARM64 packaged 9/9 groups, 158/158 embedded self-tests, zero unexpected errors/orphan processes. All 33 packaged runtime files match source; no samples are shipped. Strict ad-hoc signature, DMG checksum and ZIP CRC checks passed. Local app and installer: surveyapps/dist-local/mac-arm64/SurveyApps!.app and SurveyApps-1.0.3-mac-arm64.dmg/.zip.

CI run https://github.com/zcays/SurveyApps/actions/runs/43771893801 passed all three platforms at standalone SurveyApps commit 9b6e77a541f0d4fd26873caae633a60228a3bdd2: Python 9/9 each; desktop 9/9 Mac, 8/8 Windows; Grid Studio 158/158 ARM64/Windows, 150/150 Intel software fallback. Six CI-built installers/archives plus the source ZIP are collected in surveyapps/dist; SHA256SUMS.txt covers all seven. Release v1.0.3 is staged as a draft while upload completion and remote digest checks finish; publish only after all eight assets are uploaded and verified.
