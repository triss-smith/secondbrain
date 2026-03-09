# Contributing

## Local Development Setup

For hot-reload and active development you'll run the backend and frontend separately.

### Prerequisites

| Requirement | Notes |
|---|---|
| Python 3.12 | Earlier versions untested |
| Node.js 18+ | For the frontend |
| ffmpeg | Required for podcast and TikTok audio transcription |

### 1. Clone & configure

```bash
git clone https://github.com/triss-smith/mysecondbrain.git
cd mysecondbrain
cp .env.example .env
```

`.env` is only needed as a fallback on first run. Once you configure a provider via the in-app settings panel, `data/config.json` takes over.

### 2. Install dependencies

```bash
pip install -r requirements.txt
cd frontend && npm install && cd ..
```

### 3. Run

**Windows:**
```
start.bat
```

**Manual (two terminals):**
```bash
# Terminal 1 — backend (with hot-reload)
py -3.12 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — frontend (with HMR)
cd frontend && npm run dev
```

Frontend: **http://localhost:5173** · Backend API: **http://localhost:8000**

### 4. Building the Windows installer

Requires [Inno Setup 6](https://jrsoftware.org/isdl.php).

```bat
installer\build.bat
```

Output: `dist\SecondBrain-Setup.exe`
