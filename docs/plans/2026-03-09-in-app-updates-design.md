# In-App Update Notifications Design

**Date:** 2026-03-09
**Status:** Approved

## Goal

Show a dismissible in-app banner when a newer version of Second Brain is available on GitHub releases, with a one-click download and install flow.

## Architecture

**Version tracking:** A `VERSION` file at the repo root (e.g. `1.0.0`) is the single source of truth. The launcher reads it at startup; `SecondBrain.iss` reads it for `AppVersion`.

**Update check:** On launcher startup, a background thread hits the GitHub releases API (`https://api.github.com/repos/triss-smith/secondbrain/releases/latest`), parses the `tag_name`, and compares it to the current `VERSION` using semver ordering. If a newer version exists, the thread stores the download URL in a module-level variable that the FastAPI app can read.

**Backend endpoint:** `GET /api/update` returns `{"available": false}` or `{"available": true, "version": "1.1.0", "url": "https://...SecondBrain-Setup.exe"}`. The launcher injects the update state into the backend process via an environment variable (`SB_UPDATE_VERSION`, `SB_UPDATE_URL`) set before uvicorn starts.

**In-app banner:** The React frontend polls `GET /api/update` once on mount and every 10 minutes after. When `available: true`, a dismissible banner appears at the top of the app. Clicking **Download & Install** opens the download URL in the default browser (simplest approach — avoids downloading in-process). Dismissing hides the banner for the session.

## Key Files

| File | Change |
|------|---------|
| `VERSION` | Create — single source of truth (e.g. `1.0.0`) |
| `installer/launcher.py` | Background thread checks GitHub, sets env vars before starting uvicorn |
| `backend/api/update.py` | New router — `GET /api/update` reads env vars |
| `backend/main.py` | Register update router |
| `frontend/src/components/UpdateBanner.tsx` | New — dismissible banner |
| `frontend/src/App.tsx` | Mount UpdateBanner |
| `installer/SecondBrain.iss` | Read `AppVersion` from `VERSION` file |

## Constraints & Decisions

- **No in-process download** — clicking opens the browser to the GitHub release asset URL; simpler and avoids partial-download edge cases
- **Silent failure** — if the update check fails (no internet, API rate limit), nothing is shown; no error
- **Session-only dismiss** — banner stays hidden until next launch if dismissed; no persistent storage needed
- **Dev mode safe** — `GET /api/update` returns `{"available": false}` when env vars are absent (i.e. running via `start.bat`)
- **10-minute poll interval** — low enough to catch an update within a session, not so frequent it hammers the API
