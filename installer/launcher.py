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



def _msgbox(title: str, message: str) -> None:
    """Show a Windows message box without requiring tkinter."""
    import ctypes
    ctypes.windll.user32.MessageBoxW(0, message, title, 0x10)


def start_server(port: int) -> subprocess.Popen:
    log = _user_data_dir() / "server.log"
    env = os.environ.copy()
    env["SECOND_BRAIN_DATA"] = str(_user_data_dir() / "data")
    return subprocess.Popen(
        [str(_python_exe()), "-m", "uvicorn", "backend.main:app",
         "--host", "127.0.0.1", "--port", str(port)],
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
