# SurveyApps! 1.0.3

Download the installer for macOS or Windows from [GitHub Releases (`v1.0.3`)](https://github.com/zcays/SurveyApps/releases/tag/v1.0.3) (or build from source locally). No Python, Node, browser, or terminal setup is needed. Both tools work completely offline.

- **macOS (Apple silicon):** `SurveyApps-1.0.3-mac-arm64.dmg` · `SurveyApps-1.0.3-mac-arm64.zip`
- **macOS (Intel x64):** `SurveyApps-1.0.3-mac-x64.dmg` · `SurveyApps-1.0.3-mac-x64.zip`
- **Windows (64-bit x64):** `SurveyApps-1.0.3-win-x64.exe` (NSIS installer) · `SurveyApps-1.0.3-win-x64.zip` (portable archive)
- **Source & Checksums:** `SurveyApps-1.0.3-source.zip` · [build/use instructions](README.md) · [install guide](INSTALL.md) · `SHA256SUMS.txt`
- **Artwork:** [2048px PNG](assets/icon-2048.png) · [SVG master](assets/icon.svg) · [macOS ICNS](assets/icon.icns) · [Windows ICO](assets/icon.ico)
- **Evidence:** [validation record](docs/VALIDATION.md) · [source changes](docs/UPSTREAM_CHANGES.md)

Version 1.0.3 adds Grid Studio alignment settings JSON save/load, ⌘/Ctrl+S, settings-file drop, and the loaded image filename in the top bar. The settings contain alignment data; keep the original image and any custom chip list separately. The Help page explains the workflow.

Builds and validation for each release are recorded in [docs/VALIDATION.md](docs/VALIDATION.md) and the linked GitHub Actions run on the release page. The release contains installers for Apple Silicon, Intel Mac, and Windows x64, plus source and SHA-256 checksums.

macOS bundles carry valid ad-hoc integrity signatures (`codesign --verify --deep --strict`), and Windows binaries are unsigned (no Developer ID/Apple notarization or Windows Authenticode certificate). Minimum configured macOS is 14.0; older macOS versions and interactive NSIS/SmartScreen GUI flows on physical Windows hardware were not separately exercised outside CI. See [INSTALL.md](INSTALL.md) for unsigned-app first-launch approval steps after verifying `SHA256SUMS.txt`.

**1.0.3 (2026-11-15):** adds portable Grid Studio alignment settings and image filename display, with round-trip and packaged desktop regression checks. Retains the click-to-upload workspaces, chip-list import/export, Crop to array, desktop UI and performance improvements from 1.0.2.
