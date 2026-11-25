# SUGAR desktop architecture

Electron hosts an isolated local dashboard and three scientific tools: Chocolate Bar, Gummy Bears, and Sugar Pebbles. Chocolate Bar uses the upstream Grid Studio revision pinned in `vendor/provenance.json` with the SUGAR title and toolbar label. Microscopy retains Dash/Plotly/Pillow/NumPy scientific algorithms behind a PyInstaller standalone backend on an OS-assigned loopback port, authenticated per launch. Sugar Pebbles (`segment/`) is a pure-JavaScript offline port of Survey Genomics' `survey.spatial.segment` with no build step, no external dependencies, and full `file://` + `surveyapps://app` support. Electron owns startup, health, errors, resource paths and cleanup. No development runtimes required by downloads.

## Alternatives evaluated
| Option | Compatibility/offline/runtime | Reliability/security/maintenance | Size |
|---|---|---|---|
| Electron + frozen Python (selected) | Bundled Chromium supports existing WebGL/canvas and Dash consistently; bundled Python; fully offline | Single managed backend; isolated renderers, no renderer Node, restricted navigation; upstream dependency updates required | Largest, includes Chromium and Python |
| Tauri + frozen Python | Same Python bundle needed; system WebKit/WebView2 differences must be qualified | Rust + Python + JS maintenance; Windows WebView2 offline provisioning adds a prerequisite/bundle | Smaller shell; Python dominates remaining size |
| Python + Qt WebEngine | Bundles browser and Python but adds Qt packaging/licensing surface | More native wheel and GUI integration complexity; similar isolation needed | Often comparable to Electron |
| pywebview / browser launcher | OS-specific browser behavior; browser launcher is not a unified desktop app | Extra runtime provisioning and inconsistent WebGL behavior | Smallest shell, weaker reproducibility |

## Ownership
- `desktop/main.cjs` wires Electron startup, permissions, menus, the dashboard bridge and window lifecycle. `desktop/protocol.cjs` serves the local asset directories. `desktop/backend.cjs` manages the frozen backend process.
- `renderer/` owns dashboard navigation and the persistent tool frames. It consumes the bridge contract below.
- `backend/` owns Gummy Bears. `segment/` owns table and metadata import, well geometry, ROI editing and exports. The upstream Grid Studio source for Chocolate Bar lives in the repository's top-level `grid-studio/`. Sync edits into the desktop vendor directory with `scripts/sync_grid_studio.py`.

## Renderer bridge contract
window.surveyapps.getStatus() -> Promise<{state: 'starting'|'ready'|'error', message: string, microscopyUrl?: string, gridUrl: string, segmentUrl: string, version: string}>
window.surveyapps.onStatus(callback) -> unsubscribe function
window.surveyapps.retryBackend() -> Promise<void>
Dashboard files are loaded from renderer/index.html. Logo path ../assets/icon.svg. Chocolate Bar and Sugar Pebbles URLs are supplied by the bridge and loaded lazily in persistent iframes. Microscopy URL is supplied only after the authenticated local backend is ready; retain all tool iframes when navigating. No external URLs, fonts or CDN. Renderer has no Node access.

## Implemented lifecycle and security
SUGAR retains the SurveyApps! profile and origin so existing chip lists load after an upgrade. The `surveyapps://app` protocol serves only packaged `renderer/`, `assets/`, `vendor/grid-studio/`, and `segment/` files. The dashboard preload exposes status/retry/subscription only, verifies main-frame IPC senders, and never grants renderer Node access. Electron allows network requests only to its current authenticated backend origin. Python receives a random credential over stdin, binds loopback port zero atomically, prints readiness only after binding, verifies the Host, header and Origin, and stops when stdin closes. User-facing startup errors leave Chocolate Bar and Sugar Pebbles available.

One window and one backend preserve the original Python module's session-global image/cache semantics. Server callbacks are serialized. All three tools use persistent iframe elements, so changing navigation does not unload their state. All required Dash/Plotly assets are bundled locally.

## Sugar Pebbles tool (`segment/`)
Pure static HTML/CSS/classic-JS (no bundler, works both via `surveyapps://app/segment/index.html` and directly via `file://`). Uses chunked streaming RFC 4180 parsing into typed arrays (`Float32Array`, `Uint16Array`, `Int32Array`), uniform-grid spatial indexes (`UniformGridIndex`) for exact Euclidean nearest-well lookup (`closestWells`), 4-connected BFS flood fill/convert/erase (`computeFloodWells`) matching `survey.spatial.segment`, WebGL point-sprite cell rendering with automatic Canvas 2D `ImageData` `Uint32Array` fallback (`?renderer=cpu`), batched/offscreen ROI overlay rendering, and chunked Blob CSV/JSON exports handled by Electron's `will-download` listener. Self-tests and a 1,000,000-cell benchmark live in `segment/tests.html`; synthetic demo data lives in `segment/sample/`.

Official references checked during implementation: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [PyInstaller packaging](https://pyinstaller.org/en/stable/usage.html), [GitHub native runner architectures](https://docs.github.com/en/actions/reference/runners/github-hosted-runners). Distribution bundles are ad-hoc sealed, not Developer ID signed/notarized. Native Windows and Intel CI freeze Python on their corresponding OS/architecture.

## Chocolate Bar synchronization
Chocolate Bar includes portable alignment settings save/load (`js/settings.js`), loaded image filename display (`#imgName`), Pick 4 corners (`js/corners.js`), automatic crop-to-array, editable `chips.js`, chip list import/export and persistence, `chiplist.js`, `autofit-app.js`, and shared warp evaluation. The upstream revision and the local branding change are recorded in `vendor/provenance.json`. Run `python3 scripts/sync_grid_studio.py` from the parent checkout to sync and verify the public allowlist with the SUGAR branding applied; samples are never traversed. `desktop/protocol.cjs` owns protocol resource handling; `main.cjs` retains session security and lifecycle. `desktop/**`, `segment/**`, and `vendor/grid-studio/**` package the static tool scripts; samples are explicitly excluded. Local builds use `dist-local`.

## Presentation

The shell (`renderer/styles.css`), embedded Chocolate Bar and Gummy Bears (`backend/assets/desktop.css`, layout styles/classes in `backend/microscopy_app.py`) share layered dark surfaces and cyan `#58D8F5` actions/selections/focus. Green `#63DB8C` is reserved for ready/OK status. Dashboard and Help use static, subtle gradients; tool chrome is opaque, without backdrop blur or running animations. The scientific image/grid layers retain their original rendering and colors. Re-freeze the backend after Lab presentation changes, sync public Chocolate Bar files with `scripts/sync_grid_studio.py`, and rebuild the local app from inside `surveyapps/`.
