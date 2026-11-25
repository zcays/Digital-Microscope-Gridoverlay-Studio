# Installing SUGAR (Super Ultra Gridding Arrays Repo)

SUGAR is a standalone desktop application for **macOS (14.0+)** and **Windows (10/11 64-bit)**.
End users do **not** need to install Python, Node.js, or any command-line tools.

Download the installer for your operating system from the **[GitHub Releases](https://github.com/zcays/sugar/releases/tag/v1.1.1)** page.

---

## 1. Choose the Right Download

| Your Computer | Installer (Recommended) | Portable Archive |
|---|---|---|
| **Mac with Apple Silicon** (M1 / M2 / M3 / M4) | `SUGAR-1.1.1-mac-arm64.dmg` | `SUGAR-1.1.1-mac-arm64.zip` |
| **Mac with Intel processor** | `SUGAR-1.1.1-mac-x64.dmg` | `SUGAR-1.1.1-mac-x64.zip` |
| **Windows PC (64-bit x64)** | `SUGAR-1.1.1-win-x64.exe` | `SUGAR-1.1.1-win-x64.zip` |

> **Not sure which Mac you have?** Click the Apple menu () → **About This Mac**.  
> If **Chip** says *Apple M1/M2/M3/M4*, choose **arm64**. If **Processor** says *Intel*, choose **x64**.

---

## 2. macOS Installation

### Option A: DMG Installer (Recommended)

1. Download `SUGAR-1.1.1-mac-arm64.dmg` (Apple Silicon) or `SUGAR-1.1.1-mac-x64.dmg` (Intel).
2. Double-click the `.dmg` file to mount it.
3. Drag **SUGAR.app** onto the **Applications** folder shortcut inside the window.
4. Eject the mounted disk image from Finder.
5. Open **SUGAR** from `/Applications` or Spotlight.

### Option B: Portable ZIP

1. Download `SUGAR-1.1.1-mac-arm64.zip` or `SUGAR-1.1.1-mac-x64.zip`.
2. Double-click the `.zip` in Finder to extract **SUGAR.app**.
3. Move **SUGAR.app** into `/Applications` (recommended) and launch it.

### First Launch on macOS (Unsigned Build Approval)

The macOS application bundles carry a verified ad-hoc integrity signature, **not** an Apple Developer ID signature or notarization. On macOS 14+, Gatekeeper may block the first launch of a downloaded app with a notice such as *"SUGAR cannot be opened because Apple cannot verify it is free of malware."*

To approve a copy you downloaded from the official release and verified:

1. Attempt to open **SUGAR** once and click **Done** / **OK** on the prompt.
2. Open **System Settings → Privacy & Security**.
3. Scroll down to the **Security** section — you will see a message about **SUGAR** being blocked.
4. Click **Open Anyway** and confirm with your Mac password or Touch ID.

*(Do **not** disable Gatekeeper globally or disable System Integrity Protection.)*

---

## 3. Windows Installation

### Option A: EXE Installer (Recommended)

1. Download `SUGAR-1.1.1-win-x64.exe`.
2. Double-click the installer.
3. If **Windows Defender SmartScreen** shows *"Windows protected your PC"*, click **More info** → **Run anyway** (only for verified official downloads).
4. Follow the setup wizard to choose an install directory (per-user install, no admin rights required) and optionally create a Desktop shortcut.
5. Launch **SUGAR** from the Start Menu or Desktop shortcut.

### Option B: Portable ZIP

1. Download `SUGAR-1.1.1-win-x64.zip`.
2. Right-click the `.zip` → **Extract All…** into a permanent folder (for example, `C:\Users\<You>\Apps\SUGAR`).  
   *(Do not run the `.exe` directly from inside the compressed `.zip` preview in File Explorer.)*
3. Double-click `SUGAR.exe` inside the extracted folder.

---

## 4. Verify Download Integrity (Optional)

Compare your downloaded file's SHA-256 hash against `SHA256SUMS.txt` on the Release page:

- **macOS (Terminal):**
  ```sh
  shasum -a 256 SUGAR-1.1.1-mac-arm64.dmg
  ```
- **Windows (PowerShell):**
  ```powershell
  Get-FileHash .\SUGAR-1.1.1-win-x64.exe -Algorithm SHA256
  ```

---

## 5. Quick First-Run Check

When **SUGAR** opens:
1. **Chocolate Bar** and **Sugar Pebbles** are ready immediately on launch (both run locally in Electron).
2. **Gummy Bears** starts its bundled local Python engine automatically in the background; within a few seconds the top-right pill changes to **All Tools Ready**.
3. If **Gummy Bears** shows a startup error, click **Retry Gummy Bears** in the top bar or sidebar. **Chocolate Bar** and **Sugar Pebbles** remain fully usable while retrying.
4. Images, cell tables, ROIs, and measurements never leave your computer. Remember to export your images, CSV files, and JSON settings/sessions before closing the app.

---

## 6. Update an Existing Installation

1. Quit **SUGAR** (or **SurveyApps!** if upgrading from `1.0.3` or earlier) before replacing it.
2. Download the new installer for the same platform and architecture as your current copy.
3. On macOS, drag **SUGAR.app** into **Applications** (choose **Replace** when updating an existing `SUGAR.app`; if upgrading from `SurveyApps!.app`, you may move the old `SurveyApps!.app` to Trash once you confirm **SUGAR** opens cleanly). On Windows, run the new installer. For a portable ZIP, extract the new version into its own folder and launch that copy.
4. Open the app and check that the version beside its name is **v1.1.1**.

**Upgrading from SurveyApps! 1.0.x:** SUGAR automatically preserves your existing profile and remembered custom chip lists from SurveyApps!. There is no automatic updater; install future releases manually. Before quitting, save your settings and exports:
- **Chocolate Bar:** **Save settings…** (`⌘/Ctrl+S`) exports an alignment JSON file; **Load settings…** restores it (keep the original image and any custom chip list separately).
- **Gummy Bears:** uses its own JSON grid configuration controls.
- **Sugar Pebbles:** **Save session** exports a resumable `.segment-session.json` file, and **Export CSV** / **Summary CSV** export standard RFC 4180 CSV tables.

---

## 7. Uninstall

- **macOS:** Quit **SUGAR** and move `/Applications/SUGAR.app` to Trash.
- **Windows (Installer):** Open **Settings → Apps → Installed apps → SUGAR → Uninstall**.
- **Windows (Portable ZIP):** Delete the extracted folder.
