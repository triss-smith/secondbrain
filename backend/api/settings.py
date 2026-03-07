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
    valid_models = PROVIDERS[req.provider]["models"]
    if req.model not in valid_models:
        raise HTTPException(status_code=400, detail=f"Invalid model '{req.model}' for provider '{req.provider}'. Valid: {valid_models}")
    # Preserve existing key if client sends empty string (user didn't re-enter it)
    api_key = req.api_key if req.api_key else settings_manager.get().api_key
    settings_manager.save(req.provider, req.model, api_key)
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
