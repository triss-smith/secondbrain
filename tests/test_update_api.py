import json
import pytest
from fastapi.testclient import TestClient


def _make_client():
    from fastapi import FastAPI
    from backend.api.update import router as update_router
    app = FastAPI()
    app.include_router(update_router)
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
