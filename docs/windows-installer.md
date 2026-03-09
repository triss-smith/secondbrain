# Windows Installer

## For End Users

### Installing

1. Download `SecondBrain-Setup.exe` from the releases page.
2. Run it and follow the prompts.
3. During installation, a Notepad window will open — paste your `MINIMAX_API_KEY` value and save the file.
4. Click the **Second Brain** shortcut on your desktop or Start Menu to launch.

Your browser will open automatically. A tray icon appears in the bottom-right of your taskbar — click it to reopen the app if you close the browser tab.

> **First launch note:** The app downloads AI models (~500 MB) the first time it starts. This is a one-time download and may take a few minutes depending on your internet speed.

### Getting your API key

Second Brain uses the MiniMax API. Get a key at https://www.minimax.chat and paste it into the `.env` file that opened during installation.

### Quitting

Right-click the tray icon and choose **Quit**.

### Troubleshooting

| Problem | Fix |
|---------|-----|
| Browser doesn't open | Wait 30 seconds, then right-click the tray icon and choose **Open Second Brain** |
| "Dependencies failed to install" during setup | Check your internet connection and re-run the installer |
| App won't start after install | Open `C:\Program Files\SecondBrain\.env` in Notepad and confirm your API key is set |
| Tray icon doesn't appear | Check your Windows notification area settings — tray icons may be hidden |

---

## For Developers

### Prerequisites

- Python 3.12
- Node.js 18+
- [Inno Setup 6](https://jrsoftware.org/isdl.php) (installed to default location)

### Building the installer

```bat
installer\build.bat
```

This will:
1. Build the React frontend (`npm run build`)
2. Download and set up Python 3.12 embeddable (cached after first run)
3. Compile `dist\SecondBrain-Setup.exe` via Inno Setup

The build takes ~5 minutes on first run (downloading Python embeddable); subsequent runs are faster.

### Running locally (development)

Use `start.bat` as normal — the installer workflow is separate and does not affect local development.

### Icon

To regenerate the app icon:

```bash
python installer/create_icon.py
```

Commit the resulting `installer/icon.ico`.
