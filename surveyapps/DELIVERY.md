# SUGAR 1.1.1

Build the installer from source locally or check [GitHub Releases](https://github.com/zcays/sugar/releases/tag/v1.1.1) for published macOS and Windows installers. No Python, Node, browser, or terminal setup is needed. All three tools — **Chocolate Bar**, **Gummy Bears**, and **Sugar Pebbles** — work completely offline.

- **macOS (Apple Silicon):** `SUGAR-1.1.1-mac-arm64.dmg` · `SUGAR-1.1.1-mac-arm64.zip`
- **macOS (Intel x64):** `SUGAR-1.1.1-mac-x64.dmg` · `SUGAR-1.1.1-mac-x64.zip`
- **Windows (64-bit x64):** `SUGAR-1.1.1-win-x64.exe` (NSIS installer) · `SUGAR-1.1.1-win-x64.zip` (portable archive)
- **Source & Checksums:** `SUGAR-1.1.1-source.zip` · [build/use instructions](README.md) · [install guide](INSTALL.md) · `SHA256SUMS.txt`
- **Artwork:** [2048px PNG](assets/icon-2048.png) · [SVG master](assets/icon.svg) · [macOS ICNS](assets/icon.icns) · [Windows ICO](assets/icon.ico)
- **Evidence:** [validation record](docs/VALIDATION.md) · [source changes](docs/UPSTREAM_CHANGES.md)

Version **1.1.1** introduces the Chocolate Bar, Gummy Bears, and Sugar Pebbles workspace names.

## SUGAR 1.1.0 release record

Version **1.1.0** is the first release shipped under the **SUGAR (Super Ultra Gridding Arrays Repo)** brand and icon, adding the **Segment** spatial ROI segmentation tool alongside updated **Grid Studio** and **Fluorescence Lab** workspaces:

- **Segment:** Offline JavaScript port of Survey Genomics' spatial ROI segmentation workflow (`survey.spatial.segment`). Streams CSV/TSV/TXT cell tables into typed arrays (verified at 1,000,000 cells), supports JSON and `value,color` metadata, well-granularity brush paint (`1×1`–`15×15`), dedicated erase, 4-connected flood fill & same-ROI flood erase, WebGL point sprites with Canvas 2D fallback, undo/redo, and RFC 4180 per-cell CSV, summary CSV, and resumable session JSON exports.
- **Grid Studio:** Pick 4 corners (`P`) corner-assisted Auto-fit with Preserve shape option, automatic Crop to array with selectable half-well / half-wall / none margin, per-axis polarity calibration for bent/oblique-lit chips, shared distortion math with Auto-fit, full undo restoration, and the refreshed dark cyan interface.
- **Fluorescence Lab & Shell:** Shared grid-geometry calculation across analysis, well selection, cropping, and export; unified 3-tool dashboard and persistent iframes; modular Electron startup; existing SurveyApps! user profiles and custom chip lists are preserved automatically on upgrade.

All three platforms passed [GitHub Actions run 45092398213](https://github.com/zcays/sugar/actions/runs/45092398213) at commit `ade714d22828f062af31d50c395e31b4592b8986`: Python 9/9 and Segment parser 5/5 on each platform, packaged desktop 10/10 groups on both Macs and 9/9 on Windows, Grid Studio 197/197 (189/189 with Intel software rendering), and Segment 21/21 + 4 geometry regressions + 1M-cell benchmark on every platform with zero unexpected errors. Full evidence is recorded in [docs/VALIDATION.md](docs/VALIDATION.md). The release contains installers for Apple Silicon, Intel Mac, and Windows x64, plus source and SHA-256 checksums.

macOS bundles carry valid ad-hoc integrity signatures (`codesign --verify --deep --strict`), and Windows binaries are unsigned (no Developer ID/Apple notarization or Windows Authenticode certificate). Minimum configured macOS is 14.0; older macOS versions and interactive NSIS/SmartScreen GUI flows on physical Windows hardware were not separately exercised outside CI. See [INSTALL.md](INSTALL.md) for unsigned-app first-launch approval steps after verifying `SHA256SUMS.txt`.

**1.1.0 (2026-11-22):** first SUGAR-branded release; adds the offline Segment spatial ROI tool, Pick 4 corners, automatic Crop to array, per-axis polarity Auto-fit improvements, refreshed interface and icon, and shared geometry/warp/shell refactoring across all three tools.

**1.0.3 (2026-11-15):** shipped as SurveyApps! 1.0.3; added portable Grid Studio alignment settings and image filename display, retaining click-to-upload workspaces, chip-list import/export, Crop to array, UI and performance improvements from 1.0.2.
