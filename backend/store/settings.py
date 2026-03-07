import json
import logging
import os
import shutil
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = _PROJECT_ROOT / "data" / "config.json"
BACKUP_PATH = _PROJECT_ROOT / "data" / "config.json.bak"

PROVIDERS = {
    "minimax": {
        "base_url": "https://api.minimax.io/anthropic",
        "sdk": "anthropic",
        "models": ["MiniMax-M2.5", "MiniMax-M2.5-highspeed"],
    },
    "anthropic": {
        "base_url": "https://api.anthropic.com",
        "sdk": "anthropic",
        "models": ["claude-opus-4-6", "claude-sonnet-4-6"],
    },
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "sdk": "openai",
        "models": ["gpt-4o", "gpt-4o-mini"],
    },
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "sdk": "openai",
        "models": ["gemini-2.0-flash", "gemini-1.5-pro"],
    },
}


@dataclass(frozen=True)
class AISettings:
    provider: str
    model: str
    api_key: str


class SettingsManager:
    def __init__(self):
        self._settings = self._load()

    def _load(self) -> AISettings:
        if CONFIG_PATH.exists():
            try:
                data = json.loads(CONFIG_PATH.read_text())
                return AISettings(
                    provider=data.get("provider", "minimax"),
                    model=data.get("model", "MiniMax-M2.5"),
                    api_key=data.get("api_key", ""),
                )
            except Exception as exc:
                logger.warning("Failed to load %s, falling back to env defaults: %s", CONFIG_PATH, exc)
        # Fall back to .env
        return AISettings(
            provider="minimax",
            model=os.getenv("MINIMAX_MODEL", "MiniMax-M2.5"),
            api_key=os.getenv("MINIMAX_API_KEY", ""),
        )

    def get(self) -> AISettings:
        return self._settings

    def save(self, provider: str, model: str, api_key: str) -> None:
        if provider not in PROVIDERS:
            raise ValueError(f"Unknown provider '{provider}'. Valid: {list(PROVIDERS)}")
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        if CONFIG_PATH.exists():
            shutil.copy2(CONFIG_PATH, BACKUP_PATH)
        tmp = CONFIG_PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps({"provider": provider, "model": model, "api_key": api_key}, indent=2))
        tmp.replace(CONFIG_PATH)
        self._settings = AISettings(provider=provider, model=model, api_key=api_key)


settings_manager = SettingsManager()
