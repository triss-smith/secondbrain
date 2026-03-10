import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.store.settings import settings_manager, PROVIDERS

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SaveSettingsRequest(BaseModel):
    provider: str
    model: str
    api_key: str
    organize_mode: str = "category"
    similarity_threshold: float = 0.3
    enable_thinking: bool = False
    custom_base_url: str = ""


class SaveThemeRequest(BaseModel):
    theme_mode: str = "dark"
    theme_id: str = "violet"


@router.get("")
def get_settings():
    s = settings_manager.get()
    return {
        "provider": s.provider,
        "model": s.model,
        "api_key_set": bool(s.api_key),
        "organize_mode": s.organize_mode,
        "similarity_threshold": s.similarity_threshold,
        "enable_thinking": s.enable_thinking,
        "providers": PROVIDERS,
        "custom_base_url": s.custom_base_url,
        "theme_mode": s.theme_mode,
        "theme_id": s.theme_id,
    }


@router.get("/models")
async def fetch_provider_models(base_url: str):
    if not base_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="base_url must start with http:// or https://")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{base_url}/v1/models")
            response.raise_for_status()
            data = response.json()
            models = [m["id"] for m in data.get("data", [])]
            return {"models": models}
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail=f"Request timed out connecting to {base_url}")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Endpoint returned {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not connect to {base_url}: {str(e)}")


@router.put("")
def save_settings(req: SaveSettingsRequest):
    if req.provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {req.provider}")
    if req.provider == "custom":
        if not req.custom_base_url:
            raise HTTPException(status_code=400, detail="custom_base_url is required when using custom provider")
        if not req.model:
            raise HTTPException(status_code=400, detail="model is required when using custom provider")
    else:
        valid_models = PROVIDERS[req.provider]["models"]
        if req.model not in valid_models:
            raise HTTPException(status_code=400, detail=f"Invalid model '{req.model}' for provider '{req.provider}'. Valid: {valid_models}")
    if req.organize_mode not in ("category", "similarity"):
        raise HTTPException(status_code=400, detail="organize_mode must be 'category' or 'similarity'")
    if not (0.0 <= req.similarity_threshold <= 1.0):
        raise HTTPException(status_code=400, detail="similarity_threshold must be between 0.0 and 1.0")
    # Preserve existing key if client sends empty string (user didn't re-enter it)
    api_key = req.api_key if req.api_key else settings_manager.get().api_key
    settings_manager.save(req.provider, req.model, api_key, req.organize_mode, req.similarity_threshold, req.enable_thinking, req.custom_base_url)
    s = settings_manager.get()
    return {"provider": s.provider, "model": s.model, "api_key_set": bool(s.api_key), "organize_mode": s.organize_mode, "similarity_threshold": s.similarity_threshold, "enable_thinking": s.enable_thinking, "theme_mode": s.theme_mode, "theme_id": s.theme_id}


@router.patch("")
def save_theme(req: SaveThemeRequest):
    if req.theme_mode not in ("dark", "light"):
        raise HTTPException(status_code=400, detail="theme_mode must be 'dark' or 'light'")
    settings_manager.save_theme(req.theme_mode, req.theme_id)
    s = settings_manager.get()
    return {"theme_mode": s.theme_mode, "theme_id": s.theme_id}


@router.post("/test")
async def test_connection():
    from backend.ai.client import chat
    try:
        result = await chat([{"role": "user", "content": "Reply with one word: OK"}])
        return {"ok": bool(result), "response": result[:50]}
    except Exception as e:
        return {"ok": False, "error": str(e)}
