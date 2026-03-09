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


import json
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
