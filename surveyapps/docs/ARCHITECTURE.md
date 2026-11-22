# SUGAR desktop architecture

Electron hosts an isolated local dashboard and both scientific tools. The bundled Grid Studio files match the upstream revision in `vendor/provenance.json`. Microscopy retains Dash/Plotly/Pillow/NumPy scientific algorithms. A PyInstaller standalone backend serves Dash on an OS-assigned loopback port, authenticated per launch. Electron owns startup, health, errors, resource paths and cleanup. No development runtimes required by downloads.

## Alternatives evaluated
| Option | Compatibility/offline/runtime | Reliability/security/maintenance | Size |
|---|---|---|---|
| Electron + frozen Python (selected) | Bundled Chromium supports existing WebGL/canvas and Dash consistently; bundled Python; fully offline | Single managed backend; isolated renderers, no renderer Node, restricted navigation; upstream dependency updates required | Largest, includes Chromium and Python |
| Tauri + frozen Python | Same Python bundle needed; system WebKit/WebView2 differences must be qualified | Rust + Python + JS maintenance; Windows WebView2 offline provisioning adds a prerequisite/bundle | Smaller shell; Python dominates remaining size |
| Python + Qt WebEngine | Bundles browser and Python but adds Qt packaging/licensing surface | More native wheel and GUI integration complexity; similar isolation needed | Often comparable to Electron |
| pywebview / browser launcher | OS-specific browser behavior; browser launcher is not a unified desktop app | Extra runtime provisioning and inconsistent WebGL behavior | Smallest shell, weaker reproducibility |

## Ownership
Lead Astra: desktop/, backend/, package.json, build configuration, assets/, scripts/, docs/, integration and final packaging.
Argon frontend delegate: renderer/ only, consumes the bridge contract below. Do not edit vendors or original repository.

## Renderer bridge contract
window.surveyapps.getStatus() -> Promise<{state: 'starting'|'ready'|'error', message: string, microscopyUrl?: string, gridUrl: string, version: string}>
window.surveyapps.onStatus(callback) -> unsubscribe function
window.surveyapps.retryBackend() -> Promise<void>
Dashboard files are loaded from renderer/index.html. Logo path ../assets/icon.svg. Grid Studio URL supplied by bridge; load lazily in persistent iframe. Microscopy URL supplied only after authenticated local backend is ready; retain iframe when navigating. No external URLs, fonts or CDN. Renderer has no Node access.

## Implemented lifecycle and security
SUGAR retains the SurveyApps! profile and origin so existing chip lists load after an upgrade. The `surveyapps://app` protocol serves only packaged renderer/assets/Grid Studio files. The dashboard preload exposes status/retry/subscription only, verifies main-frame IPC senders, and never grants renderer Node access. Electron allows network requests only to its current authenticated backend origin. Python receives a random credential over stdin, binds loopback port zero atomically, prints readiness only after binding, verifies the Host, header and Origin, and stops when stdin closes. User-facing startup errors leave Grid Studio available.

One window and one backend preserve the original Python module's session-global image/cache semantics. Server callbacks are serialized. Both tools use persistent iframe elements, so changing navigation does not unload their state. All required Dash/Plotly assets are bundled locally.

Official references checked during implementation: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [PyInstaller packaging](https://pyinstaller.org/en/stable/usage.html), [GitHub native runner architectures](https://docs.github.com/en/actions/reference/runners/github-hosted-runners). Distribution bundles are ad-hoc sealed, not Developer ID signed/notarized. Native Windows and Intel CI freeze Python on their corresponding OS/architecture.

## Local working-tree integration
Grid Studio now includes portable alignment settings save/load (`js/settings.js`), loaded image filename display (`#imgName`), crop-to-array, editable `chips.js`, chip list import/export and persistence, `chiplist.js` and `autofit-app.js`. This is `a784c4d` plus uncommitted upstream changes, listed in `vendor/provenance.json`. Run `python3 scripts/sync_grid_studio.py` from this checkout to sync and byte-verify the public allowlist; samples are never traversed. `desktop/protocol.cjs` owns protocol resource handling; `main.cjs` retains session security and lifecycle. `desktop/**` and `vendor/grid-studio/**` package the new scripts; samples are explicitly excluded. Local builds use `dist-local`.

## Presentation

The shell (`renderer/styles.css`), embedded Grid Studio and Fluorescence Lab (`backend/assets/desktop.css`, layout styles/classes in `backend/microscopy_app.py`) share layered dark surfaces and cyan `#58D8F5` actions/selections/focus. Green `#63DB8C` is reserved for ready/OK status. Dashboard and Help use static, subtle gradients; tool chrome is opaque, without backdrop blur or running animations. The scientific image/grid layers retain their original rendering and colors. Re-freeze the backend after Lab presentation changes, sync public Grid Studio files with `scripts/sync_grid_studio.py`, and rebuild the local app from inside `surveyapps/`.
