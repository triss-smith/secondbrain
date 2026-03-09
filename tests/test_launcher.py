# tests/test_launcher.py
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest


def test_find_free_port_returns_valid_port():
    from installer.launcher import find_free_port
    port = find_free_port()
    assert isinstance(port, int)
    assert 1024 <= port <= 65535


def test_find_free_port_is_actually_free():
    from installer.launcher import find_free_port
    port = find_free_port()
    # Should be able to bind to it immediately after
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", port))


def test_wait_for_server_returns_true_when_server_responds():
    from installer.launcher import wait_for_server

    class OKHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')

        def log_message(self, *args):
            pass  # suppress output

    server = HTTPServer(("127.0.0.1", 0), OKHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    result = wait_for_server(f"http://127.0.0.1:{port}", timeout=5)
    server.shutdown()
    assert result is True


def test_wait_for_server_returns_false_on_timeout():
    from installer.launcher import wait_for_server
    # Port 1 is never listening
    result = wait_for_server("http://127.0.0.1:1", timeout=1)
    assert result is False
