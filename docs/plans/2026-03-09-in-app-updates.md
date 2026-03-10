# In-App Update Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show a dismissible in-app banner when a newer version is available on GitHub releases, with a one-click link to download the new installer.

**Architecture:** The launcher starts a background thread that checks the GitHub releases API and writes `update.json` to the app root if a newer version is found. The FastAPI backend exposes `GET /api/update` which reads that file. The React frontend polls this endpoint on mount and every 10 minutes, showing a banner when an update is available.

**Tech Stack:** Python threading + urllib (launcher), FastAPI (backend), React + axios (frontend), Inno Setup ISPP (version injection)

---

### Task 1: Create the VERSION file

**Files:**
- Create: `VERSION`

**Step 1: Create the file**

Create a file named `VERSION` at the repo root containing exactly:
```
1.0.0
```
No trailing newline issues matter — the code will strip whitespace.

**Step 2: Commit**

```bash
git add VERSION
git commit -m "feat: add VERSION file as single source of truth"
```

---

### Task 2: Write failing tests for check_for_update

**Files:**
- Modify: `tests/test_launcher.py`

**Context:** `check_for_update(current_version)` will hit the GitHub releases API and return `(latest_version, download_url)` if a newer version exists, or `None` otherwise. We test it by monkeypatching `urllib.request.urlopen`.

**Step 1: Add these tests to the end of `tests/test_launcher.py`**

```python
import json
from io import BytesIO
from unittest.mock import patch, MagicMock


def _mock_response(data: dict):
    """Return a mock urllib response with JSON body."""
    body = json.dumps(data).encode()
    mock = MagicMock()
    mock.read.return_value = body
    mock.__enter__ = lambda s: s
    mock.__exit__ = MagicMock(return_value=False)
    return mock


def test_check_for_update_returns_none_when_up_to_date():
    from installer.launcher import check_for_update
    resp = _mock_response({
        "tag_name": "v1.0.0",
        "assets": [{"name": "SecondBrain-Setup.exe", "browser_download_url": "https://example.com/setup.exe"}],
    })
    with patch("urllib.request.urlopen", return_value=resp):
        result = check_for_update("1.0.0")
    assert result is None


def test_check_for_update_returns_tuple_when_newer():
    from installer.launcher import check_for_update
    resp = _mock_response({
        "tag_name": "v1.1.0",
        "assets": [{"name": "SecondBrain-Setup.exe", "browser_download_url": "https://example.com/setup.exe"}],
    })
    with patch("urllib.request.urlopen", return_value=resp):
        result = check_for_update("1.0.0")
    assert result == ("1.1.0", "https://example.com/setup.exe")


def test_check_for_update_returns_none_on_network_error():
    from installer.launcher import check_for_update
    with patch("urllib.request.urlopen", side_effect=Exception("network error")):
        result = check_for_update("1.0.0")
    assert result is None


def test_check_for_update_returns_none_when_no_exe_asset():
    from installer.launcher import check_for_update
    resp = _mock_response({
        "tag_name": "v1.1.0",
        "assets": [{"name": "checksums.txt", "browser_download_url": "https://example.com/checksums.txt"}],
    })
    with patch("urllib.request.urlopen", return_value=resp):
        result = check_for_update("1.0.0")
    assert result is None
```

**Step 2: Run to confirm they fail**

```bash
python -m pytest tests/test_launcher.py::test_check_for_update_returns_none_when_up_to_date -v
```
Expected: `ImportError` — `check_for_update` not defined yet.

---

### Task 3: Implement check_for_update and background update thread in launcher.py

**Files:**
- Modify: `installer/launcher.py`

**Context:** The launcher writes `update.json` to the app root if an update is found. The backend reads this file. We do the check in a daemon thread so it doesn't delay startup.

**Step 1: Add these functions to `installer/launcher.py` (after `_python_exe`, before `start_server`)**

```python
GITHUB_RELEASES_URL = "https://api.github.com/repos/triss-smith/secondbrain/releases/latest"


def _parse_version(v: str) -> tuple:
    return tuple(int(x) for x in v.lstrip("v").strip().split("."))


def check_for_update(current_version: str):
    """Return (latest_version, download_url) if newer, else None."""
    import json
    try:
        req = urllib.request.Request(
            GITHUB_RELEASES_URL,
            headers={"Accept": "application/vnd.github+json", "User-Agent": "SecondBrain"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
        tag = data.get("tag_name", "")
        latest = tag.lstrip("v").strip()
        if not latest or _parse_version(latest) <= _parse_version(current_version):
            return None
        for asset in data.get("assets", []):
            if asset.get("name", "").endswith(".exe"):
                return (latest, asset["browser_download_url"])
        return None
    except Exception:
        return None


def _read_current_version() -> str:
    version_file = _app_root() / "VERSION"
    if version_file.exists():
        return version_file.read_text(encoding="utf-8").strip()
    return "0.0.0"


def _run_update_check() -> None:
    """Background thread: check GitHub, write update.json if newer version found."""
    import json
    current = _read_current_version()
    result = check_for_update(current)
    update_file = _app_root() / "update.json"
    if result:
        version, url = result
        update_file.write_text(
            json.dumps({"available": True, "version": version, "url": url}),
            encoding="utf-8",
        )
    else:
        # Clear any stale update.json from a previous session
        if update_file.exists():
            update_file.unlink()
```

**Step 2: Start the background thread in `main()`, before `start_server`**

Add after `port = find_free_port()`:

```python
import threading
threading.Thread(target=_run_update_check, daemon=True).start()
```

**Step 3: Run all launcher tests**

```bash
python -m pytest tests/test_launcher.py -v
```
Expected: all 8 tests PASS.

**Step 4: Commit**

```bash
git add installer/launcher.py tests/test_launcher.py
git commit -m "feat: add update check background thread to launcher"
```

---

### Task 4: Create backend/api/update.py

**Files:**
- Create: `backend/api/update.py`

**Context:** Reads `update.json` from the working directory (which is `{app_root}` in production, the repo root in dev). Returns `{"available": false}` when the file is absent — safe for dev mode.

**Step 1: Write the failing test**

Add to `tests/test_update_api.py` (create new file):

```python
import json
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, mock_open


def _make_client():
    from backend.main import app
    return TestClient(app)


def test_update_endpoint_returns_not_available_when_no_file(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)  # no update.json here
    client = _make_client()
    resp = client.get("/api/update")
    assert resp.status_code == 200
    assert resp.json() == {"available": False}


def test_update_endpoint_returns_update_when_file_exists(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "update.json").write_text(
        json.dumps({"available": True, "version": "1.1.0", "url": "https://example.com/setup.exe"})
    )
    client = _make_client()
    resp = client.get("/api/update")
    assert resp.status_code == 200
    data = resp.json()
    assert data["available"] is True
    assert data["version"] == "1.1.0"
    assert data["url"] == "https://example.com/setup.exe"
```

**Step 2: Run to confirm it fails**

```bash
python -m pytest tests/test_update_api.py -v
```
Expected: 404 on `/api/update` — route not registered yet.

**Step 3: Create `backend/api/update.py`**

```python
import json
from pathlib import Path
from fastapi import APIRouter

router = APIRouter()


@router.get("/api/update")
def get_update_status():
    update_file = Path("update.json")
    if update_file.exists():
        try:
            return json.loads(update_file.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"available": False}
```

**Step 4: Run tests to confirm they pass**

```bash
python -m pytest tests/test_update_api.py -v
```
Expected: 2 PASS.

---

### Task 5: Register update router in backend/main.py

**Files:**
- Modify: `backend/main.py`

**Step 1: Add the import and include_router call**

Add after the connections import:
```python
from backend.api.update import router as update_router
```

Add after `app.include_router(connections_router)`:
```python
app.include_router(update_router)
```

**Step 2: Run all backend tests**

```bash
python -m pytest tests/test_update_api.py tests/test_launcher.py -v
```
Expected: all 10 tests PASS.

**Step 3: Commit**

```bash
git add backend/api/update.py backend/main.py tests/test_update_api.py
git commit -m "feat: add GET /api/update endpoint"
```

---

### Task 6: Add getUpdateStatus to frontend/src/api.ts

**Files:**
- Modify: `frontend/src/api.ts`

**Step 1: Append to the end of `frontend/src/api.ts`**

```typescript
// Update
export interface UpdateStatus {
  available: boolean
  version?: string
  url?: string
}

export const getUpdateStatus = () =>
  api.get<UpdateStatus>('/update').then(r => r.data)
```

**Step 2: No automated test needed** — this is a one-line axios call identical in pattern to every other function in the file.

**Step 3: Commit**

```bash
git add frontend/src/api.ts
git commit -m "feat: add getUpdateStatus API call"
```

---

### Task 7: Create UpdateBanner component

**Files:**
- Create: `frontend/src/components/UpdateBanner.tsx`

**Context:** The banner appears at the very top of the app (above everything). It polls `/api/update` on mount and every 10 minutes. Dismissed state is session-only (local component state). Uses existing Tailwind classes consistent with the rest of the app.

**Step 1: Create `frontend/src/components/UpdateBanner.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { X, Download } from 'lucide-react'
import { getUpdateStatus, type UpdateStatus } from '../api'

const POLL_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

export function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    function check() {
      getUpdateStatus()
        .then(status => { if (status.available) setUpdate(status) })
        .catch(() => {})
    }
    check()
    const id = setInterval(check, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  if (!update || dismissed) return null

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-accent text-white text-sm shrink-0">
      <span>
        Second Brain {update.version} is available.
      </span>
      <div className="flex items-center gap-2">
        <a
          href={update.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-white/20 hover:bg-white/30 transition-colors font-medium"
        >
          <Download size={13} />
          Download
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-white/20 transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

**Step 3: Commit**

```bash
git add frontend/src/components/UpdateBanner.tsx
git commit -m "feat: add UpdateBanner component"
```

---

### Task 8: Mount UpdateBanner in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: Add the import**

After the existing component imports, add:
```typescript
import { UpdateBanner } from './components/UpdateBanner'
```

**Step 2: Mount the banner**

The banner must render outside the `flex h-screen` container so it doesn't compete with the layout. Wrap the existing return in a column flex container:

Replace:
```tsx
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface">
```

With:
```tsx
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface">
      <UpdateBanner />
      <div className="flex flex-1 overflow-hidden">
```

And close the new inner div before the final closing `</div>`:

Add `</div>` before the last `</div>` of the return block, so the structure is:
```tsx
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface">
      <UpdateBanner />
      <div className="flex flex-1 overflow-hidden">
        {/* ... all existing content ... */}
      </div>
    </div>
```

**Step 3: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

**Step 4: Run all tests**

```bash
python -m pytest tests/test_launcher.py tests/test_update_api.py -v
```
Expected: 10 PASS.

**Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: mount UpdateBanner in App layout"
```

---

### Task 9: Inject VERSION into Inno Setup via build.bat

**Files:**
- Modify: `installer/SecondBrain.iss`
- Modify: `installer/build.bat`

**Context:** Remove the hardcoded `#define AppVersion "1.0.0"` from the .iss and instead pass it from `build.bat` via ISCC's `/D` flag, which reads from the `VERSION` file.

**Step 1: Remove the hardcoded AppVersion from `installer/SecondBrain.iss`**

Remove this line:
```
#define AppVersion "1.0.0"
```

The `{#AppVersion}` references in the file will now read from the command-line definition.

**Step 2: Update the ISCC call in `installer/build.bat`**

Replace:
```batch
%ISCC% installer\SecondBrain.iss
```

With:
```batch
set /p APP_VERSION=<VERSION
%ISCC% /DAppVersion=%APP_VERSION% installer\SecondBrain.iss
```

**Step 3: Commit**

```bash
git add installer/SecondBrain.iss installer/build.bat
git commit -m "feat: inject VERSION into installer from VERSION file"
```

---

### Task 10: Add update.json to .gitignore

**Files:**
- Modify: `.gitignore`

**Step 1: Append to `.gitignore`**

```
# Runtime update flag
update.json
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore runtime update.json"
```
