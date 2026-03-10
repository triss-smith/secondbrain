# installer/launcher.py
import os
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path


def find_free_port() -> int:
    """Bind to port 0 — OS assigns a free port — then release it."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(("", 0))
        return s.getsockname()[1]


def wait_for_server(url: str, timeout: int = 60) -> bool:
    """Poll url until it returns 200 or timeout expires."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=1)
            return True
        except Exception:
            time.sleep(0.5)
    return False


def _app_root() -> Path:
    return Path(__file__).parent.parent


def _user_data_dir() -> Path:
    """User-writable data directory — never inside Program Files."""
    appdata = os.environ.get("APPDATA") or str(Path.home())
    d = Path(appdata) / "SecondBrain"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _python_exe() -> Path:
    """Use embedded Python if available (installed), otherwise current interpreter."""
    embedded = _app_root() / "python" / "python.exe"
    return embedded if embedded.exists() else Path(sys.executable)


GITHUB_RELEASES_URL = "https://api.github.com/repos/triss-smith/secondbrain/releases/latest"


def _parse_version(v: str) -> tuple:
    return tuple(int(x) for x in v.lstrip("v").strip().split("."))


def check_for_update(current_version: str):
    """Return (latest_version, download_url) if newer, else None."""
    import json as _json
    try:
        req = urllib.request.Request(
            GITHUB_RELEASES_URL,
            headers={"Accept": "application/vnd.github+json", "User-Agent": "SecondBrain"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = _json.loads(resp.read())
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
    import json as _json
    current = _read_current_version()
    result = check_for_update(current)
    update_file = _user_data_dir() / "update.json"
    if result:
        version, url = result
        update_file.write_text(
            _json.dumps({"available": True, "version": version, "url": url}),
            encoding="utf-8",
        )
    else:
        if update_file.exists():
            update_file.unlink()

def _msgbox(title: str, message: str) -> None:
    """Show a Windows message box without requiring tkinter."""
    import ctypes
    ctypes.windll.user32.MessageBoxW(0, message, title, 0x10)


def start_server(port: int) -> subprocess.Popen:
    log = _user_data_dir() / "server.log"
    env = os.environ.copy()
    env["SECOND_BRAIN_DATA"] = str(_user_data_dir() / "data")
    cmd = (
        f"import uvicorn; "
        f"uvicorn.run('backend.main:app', host='127.0.0.1', port={port})"
    )
    return subprocess.Popen(
        [str(_python_exe()), "-c", cmd],
        cwd=str(_app_root()),
        env=env,
        stdout=open(log, "w", encoding="utf-8"),
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )


def _load_icon():
    from PIL import Image
    icon_path = Path(__file__).parent / "icon.ico"
    if icon_path.exists():
        return Image.open(icon_path)
    # Fallback: indigo square
    return Image.new("RGB", (64, 64), color=(99, 102, 241))


def run_tray(url: str, server_proc: subprocess.Popen) -> None:
    import pystray

    def on_open(icon, item):
        webbrowser.open(url)

    def on_quit(icon, item):
        server_proc.terminate()
        icon.stop()

    menu = pystray.Menu(
        pystray.MenuItem("Open Second Brain", on_open, default=True),
        pystray.MenuItem("Quit", on_quit),
    )
    icon = pystray.Icon("SecondBrain", _load_icon(), "Second Brain", menu)
    icon.run()


def main() -> None:
    port = find_free_port()
    import threading
    threading.Thread(target=_run_update_check, daemon=True).start()
    server_proc = start_server(port)
    url = f"http://127.0.0.1:{port}"

    if not wait_for_server(f"{url}/api/health", timeout=60):
        server_proc.terminate()
        log = _user_data_dir() / "server.log"
        _msgbox(
            "Second Brain",
            f"Second Brain failed to start.\n\nSee log for details:\n{log}",
        )
        sys.exit(1)

    webbrowser.open(url)
    run_tray(url, server_proc)


if __name__ == "__main__":
    log = _user_data_dir() / "launcher.log"
    try:
        main()
    except Exception as exc:
        import traceback
        log.write_text(traceback.format_exc(), encoding="utf-8")
        _msgbox(
            "Second Brain",
            f"Second Brain failed to start.\n\nError: {exc}\n\nDetails written to:\n{log}",
        )
        sys.exit(1)
