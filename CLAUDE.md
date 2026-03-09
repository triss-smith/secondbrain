# Second Brain — Project Notes for Claude

## Installer

### Upgrade behavior
Re-running `SecondBrain-Setup.exe` on a machine that already has the app installed performs an in-place upgrade:

- **AppId GUID** in `SecondBrain.iss` lets Inno Setup detect the existing installation and treat the run as an upgrade, not a parallel install.
- **`ignoreversion` flag** on all `[Files]` entries means every app file (backend, frontend build, embedded Python + packages) is always overwritten, regardless of file version metadata.
- **User data is preserved** — the `{app}\data` directory (SQLite DB, ChromaDB vectors, uploaded files) is never touched during install. It is only offered for deletion during *uninstall*.
- **No migration step** — the installer itself performs no database schema migrations. If a new version changes the SQLite schema, the launcher or backend must handle migration on first run, otherwise the app may error on startup.
