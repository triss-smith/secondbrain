import json
import os
import shutil
from pathlib import Path
from dataclasses import dataclass, asdict

CONFIG_PATH = Path("data/config.json")
BACKUP_PATH = Path("data/config.json.bak")

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


@dataclass
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
                    api_key=data.get("api_key", os.getenv("MINIMAX_API_KEY", "")),
                )
            except Exception:
                pass
        # Fall back to .env
        return AISettings(
            provider="minimax",
            model=os.getenv("MINIMAX_MODEL", "MiniMax-M2.5"),
            api_key=os.getenv("MINIMAX_API_KEY", ""),
        )

    def get(self) -> AISettings:
        return self._settings

    def save(self, provider: str, model: str, api_key: str) -> None:
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        if CONFIG_PATH.exists():
            shutil.copy2(CONFIG_PATH, BACKUP_PATH)
        data = {"provider": provider, "model": model, "api_key": api_key}
        CONFIG_PATH.write_text(json.dumps(data, indent=2))
        self._settings = AISettings(provider=provider, model=model, api_key=api_key)


settings_manager = SettingsManager()
