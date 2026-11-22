# Installing SUGAR (Super Ultra Gridding Arrays Repo)

SUGAR is a standalone desktop application for **macOS (14.0+)** and **Windows (10/11 64-bit)**.
End users do **not** need to install Python, Node.js, or any command-line tools.

Local builds use the name **SUGAR** (on macOS, `SUGAR.app`). The steps below describe the published 1.0.3 installers, which use the original name **SurveyApps!**.

Download the installer for your operating system from the **[GitHub Releases](https://github.com/zcays/SurveyApps/releases)** page.

---

## 1. Choose the Right Download

| Your Computer | Installer (Recommended) | Portable Archive |
|---|---|---|
| **Mac with Apple Silicon** (M1 / M2 / M3 / M4) | `SurveyApps-1.0.3-mac-arm64.dmg` | `SurveyApps-1.0.3-mac-arm64.zip` |
| **Mac with Intel processor** | `SurveyApps-1.0.3-mac-x64.dmg` | `SurveyApps-1.0.3-mac-x64.zip` |
| **Windows PC (64-bit x64)** | `SurveyApps-1.0.3-win-x64.exe` | `SurveyApps-1.0.3-win-x64.zip` |

> **Not sure which Mac you have?** Click the Apple menu () → **About This Mac**.  
> If **Chip** says *Apple M1/M2/M3/M4*, choose **arm64**. If **Processor** says *Intel*, choose **x64**.

---

## 2. macOS Installation

### Option A: DMG Installer (Recommended)

1. Download `SurveyApps-1.0.3-mac-arm64.dmg` (Apple Silicon) or `SurveyApps-1.0.3-mac-x64.dmg` (Intel).
2. Double-click the `.dmg` file to mount it.
3. Drag **SurveyApps!.app** onto the **Applications** folder shortcut inside the window.
4. Eject the mounted disk image from Finder.
5. Open **SurveyApps!** from `/Applications` or Spotlight.

### Option B: Portable ZIP

1. Download `SurveyApps-1.0.3-mac-arm64.zip` or `SurveyApps-1.0.3-mac-x64.zip`.
2. Double-click the `.zip` in Finder to extract **SurveyApps!.app**.
3. Move **SurveyApps!.app** into `/Applications` (recommended) and launch it.

### First Launch on macOS (Unsigned Build Approval)

The macOS application bundles carry a verified ad-hoc integrity signature, **not** an Apple Developer ID signature or notarization. On macOS 14+, Gatekeeper may block the first launch of a downloaded app with a notice such as *"SurveyApps! cannot be opened because Apple cannot verify it is free of malware."*

To approve a copy you downloaded from the official release and verified:

1. Attempt to open **SurveyApps!** once and click **Done** / **OK** on the prompt.
2. Open **System Settings → Privacy & Security**.
3. Scroll down to the **Security** section — you will see a message about **SurveyApps!** being blocked.
4. Click **Open Anyway** and confirm with your Mac password or Touch ID.

*(Do **not** disable Gatekeeper globally or disable System Integrity Protection.)*

---

## 3. Windows Installation

### Option A: EXE Installer (Recommended)

1. Download `SurveyApps-1.0.3-win-x64.exe`.
2. Double-click the installer.
3. If **Windows Defender SmartScreen** shows *"Windows protected your PC"*, click **More info** → **Run anyway** (only for verified official downloads).
4. Follow the setup wizard to choose an install directory (per-user install, no admin rights required) and optionally create a Desktop shortcut.
5. Launch **SurveyApps!** from the Start Menu or Desktop shortcut.

### Option B: Portable ZIP

1. Download `SurveyApps-1.0.3-win-x64.zip`.
2. Right-click the `.zip` → **Extract All…** into a permanent folder (for example, `C:\Users\<You>\Apps\SurveyApps`).  
   *(Do not run the `.exe` directly from inside the compressed `.zip` preview in File Explorer.)*
3. Double-click `SurveyApps!.exe` inside the extracted folder.

---

## 4. Verify Download Integrity (Optional)

Compare your downloaded file's SHA-256 hash against `SHA256SUMS.txt` on the Release page:

- **macOS (Terminal):**
  ```sh
  shasum -a 256 SurveyApps-1.0.3-mac-arm64.dmg
  ```
- **Windows (PowerShell):**
  ```powershell
  Get-FileHash .\SurveyApps-1.0.3-win-x64.exe -Algorithm SHA256
  ```

---

## 5. Quick First-Run Check

When **SurveyApps!** opens:
1. **Grid Studio** is ready immediately on launch (runs locally in Electron).
2. **Fluorescence Lab** starts its bundled local Python engine automatically in the background; within a few seconds the top-right pill changes to **All Tools Ready**.
3. If **Fluorescence Lab** shows a startup error, click **Retry Lab** in the top bar or sidebar. **Grid Studio** remains fully usable while retrying.
4. Images and measurements never leave your computer. Remember to export your images, CSV matrices, and JSON grid settings before closing the app.

---

## 6. Update an Existing Installation

1. Quit SurveyApps! before replacing it.
2. Download the new installer for the same platform and architecture as your current copy.
3. On macOS, drag **SurveyApps!.app** into **Applications** and choose **Replace**. On Windows, run the new installer using the existing installation directory. For a portable ZIP, extract the new version into its own folder and launch that copy.
4. Open the app and check that the version beside its name is **1.0.3**.

There is no automatic updater; install a new release manually. Before quitting, save your settings and exports. In Grid Studio, **Save settings…** (⌘/Ctrl+S) exports an alignment JSON file; **Load settings…** restores it. Keep the original image and any custom chip list alongside it. Open the image and settings in either order. The loaded image filename appears in the studio's top bar. Fluorescence Lab has its own JSON configuration controls; the two settings formats belong to their respective tools.

## 7. Uninstall

- **macOS:** Quit **SurveyApps!** and move `/Applications/SurveyApps!.app` to Trash.
- **Windows (Installer):** Open **Settings → Apps → Installed apps → SurveyApps! → Uninstall**.
- **Windows (Portable ZIP):** Delete the extracted folder.
