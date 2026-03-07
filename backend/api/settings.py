from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.store.settings import settings_manager, PROVIDERS

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SaveSettingsRequest(BaseModel):
    provider: str
    model: str
    api_key: str


@router.get("")
def get_settings():
    s = settings_manager.get()
    return {
        "provider": s.provider,
        "model": s.model,
        "api_key_set": bool(s.api_key),
        "providers": PROVIDERS,
    }


@router.put("")
def save_settings(req: SaveSettingsRequest):
    if req.provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {req.provider}")
    settings_manager.save(req.provider, req.model, req.api_key)
    s = settings_manager.get()
    return {"provider": s.provider, "model": s.model, "api_key_set": bool(s.api_key)}


@router.post("/test")
async def test_connection():
    from backend.ai.client import chat
    try:
        result = await chat([{"role": "user", "content": "Reply with one word: OK"}])
        return {"ok": bool(result), "response": result[:50]}
    except Exception as e:
        return {"ok": False, "error": str(e)}
