# installer/launcher.py
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


def _python_exe() -> Path:
    """Use embedded Python if available (installed), otherwise current interpreter."""
    embedded = _app_root() / "python" / "python.exe"
    return embedded if embedded.exists() else Path(sys.executable)


def start_server(port: int) -> subprocess.Popen:
    return subprocess.Popen(
        [str(_python_exe()), "-m", "uvicorn", "backend.main:app",
         "--host", "127.0.0.1", "--port", str(port)],
        cwd=str(_app_root()),
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
        import tkinter as tk
        from tkinter import messagebox
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror(
            "Second Brain",
            "Second Brain failed to start.\n\n"
            "Please check that your API key is set in:\n"
            r"C:\Program Files\SecondBrain\.env",
        )
        root.destroy()
        sys.exit(1)

    webbrowser.open(url)
    run_tray(url, server_proc)


if __name__ == "__main__":
    log = _app_root() / "launcher.log"
    try:
        main()
    except Exception as exc:
        import traceback
        log.write_text(traceback.format_exc(), encoding="utf-8")
        import tkinter as tk
        from tkinter import messagebox
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror(
            "Second Brain",
            f"Second Brain failed to start.\n\nError: {exc}\n\nDetails written to:\n{log}",
        )
        root.destroy()
        sys.exit(1)
