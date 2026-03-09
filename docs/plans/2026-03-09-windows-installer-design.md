# Windows Installer Design

**Date:** 2026-03-09
**Issue:** SEC-6
**Status:** Approved

## Goal

Package Second Brain as a Windows installer `.exe` that non-technical users can run to install and launch the application without needing a terminal, Python, or Node.js knowledge.

## Approach

Embedded Python runtime + Inno Setup installer. The app's Python backend runs using a bundled Python 3.12 embeddable distribution, keeping it isolated from any system Python. The React frontend is pre-built as static files and served by FastAPI. No PyInstaller — packages install normally via pip into the embedded Python, making native extensions (chromadb, PyMuPDF, whisper) reliable.

## Architecture

### Build-time (developer)
1. Developer runs `installer/build.bat`
2. Script builds the frontend: `npm run build` → `frontend/dist/`
3. Script downloads Python 3.12 embeddable zip (if not cached)
4. Inno Setup compiles everything into `SecondBrain-Setup.exe`

### Install-time (end user)
1. User runs `SecondBrain-Setup.exe`
2. Installer extracts embedded Python + app files to `C:\Program Files\SecondBrain\`
3. Installer runs `pip install -r requirements.txt` into embedded Python (visible progress)
4. Installer creates Start Menu and desktop shortcuts → both point to `pythonw.exe launcher.py`
5. Installer registers app in Add/Remove Programs with a working uninstaller
6. Installer creates a default `.env` file with a `MINIMAX_API_KEY` placeholder and opens it for the user to fill in

### Launch-time (end user)
1. User clicks shortcut → `pythonw.exe launcher.py` (no terminal window)
2. Launcher finds a free port via socket
3. Launcher starts uvicorn in a background thread on that port
4. Launcher polls `http://localhost:{port}/api/health` until ready
5. Launcher opens `http://localhost:{port}` in the default browser
6. Launcher shows a system tray icon with menu:
   - **Open Second Brain** → opens browser to the app
   - **Quit** → shuts down the server and exits tray

### Developer workflow (unchanged)
Developers continue to use `start.bat` as before. No changes to that file.

## Key Files

| File | Purpose |
|------|---------|
| `installer/SecondBrain.iss` | Inno Setup script defining installer behaviour |
| `installer/build.bat` | Developer build script (frontend build + Inno Setup compile) |
| `installer/launcher.py` | Tray app: finds free port, starts uvicorn, opens browser, shows tray icon |
| `installer/icon.ico` | App icon for shortcuts and tray |
| `docs/windows-installer.md` | End-user and developer documentation |

## Dependencies Added

`pystray` and `Pillow` added to `requirements.txt` for the system tray icon.

## Constraints & Decisions

- **No fixed port** — dynamic port assignment eliminates all port conflict errors
- **No hosts file modification** — browser is always opened by the launcher, users never type a URL
- **No terminal for end users** — launcher invoked via `pythonw.exe` (windowless)
- **Internet required at install-time** — pip installs heavy deps; pre-bundling is not feasible
- **First-run model downloads** — sentence-transformers and Whisper models (~500MB) download automatically on first use; a message in the UI will explain this
- **Frontend pre-built by developer** — Node.js is not required on the end user's machine
- **Port 8000 no longer assumed** — any code that hardcodes port 8000 will need to be updated to use the dynamic port passed via environment variable

## Out of Scope

- macOS or Linux packaging
- Automatic updates
- Code signing / Authenticode (can be added later)
- Offline installer (would require bundling all pip wheels + model weights)
