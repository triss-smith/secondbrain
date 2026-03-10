import json
import logging
import os
import shutil
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

_DATA_DIR = Path(
    os.environ.get("SECOND_BRAIN_DATA")
    or Path(os.environ.get("APPDATA", Path.home())) / "SecondBrain" / "data"
)
CONFIG_PATH = _DATA_DIR / "config.json"
BACKUP_PATH = _DATA_DIR / "config.json.bak"

PROVIDERS = {
    "minimax": {
        "base_url": "https://api.minimax.io/v1",
        "sdk": "openai",
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
    "custom": {
        "base_url": "",
        "sdk": "openai",
        "models": [],
    },
}


@dataclass(frozen=True)
class AISettings:
    provider: str
    model: str
    api_key: str
    organize_mode: str = "category"
    similarity_threshold: float = 0.3
    enable_thinking: bool = False
    custom_base_url: str = ""
    theme_mode: str = "dark"
    theme_id: str = "violet"


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
                    organize_mode=data.get("organize_mode", "category"),
                    similarity_threshold=float(data.get("similarity_threshold", 0.3)),
                    enable_thinking=bool(data.get("enable_thinking", False)),
                    custom_base_url=data.get("custom_base_url", ""),
                    theme_mode=data.get("theme_mode", "dark"),
                    theme_id=data.get("theme_id", "violet"),
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

    def save(self, provider: str, model: str, api_key: str, organize_mode: str = "category", similarity_threshold: float = 0.3, enable_thinking: bool = False, custom_base_url: str = "") -> None:
        if provider not in PROVIDERS:
            raise ValueError(f"Unknown provider '{provider}'. Valid: {list(PROVIDERS)}")
        if organize_mode not in ("category", "similarity"):
            raise ValueError(f"Invalid organize_mode '{organize_mode}'. Must be 'category' or 'similarity'.")
        if not (0.0 <= similarity_threshold <= 1.0):
            raise ValueError(f"Invalid similarity_threshold '{similarity_threshold}'. Must be between 0.0 and 1.0.")
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        if CONFIG_PATH.exists():
            shutil.copy2(CONFIG_PATH, BACKUP_PATH)
        tmp = CONFIG_PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps({
            "provider": provider,
            "model": model,
            "api_key": api_key,
            "organize_mode": organize_mode,
            "similarity_threshold": similarity_threshold,
            "enable_thinking": enable_thinking,
            "custom_base_url": custom_base_url,
            "theme_mode": self._settings.theme_mode,
            "theme_id": self._settings.theme_id,
        }, indent=2))
        tmp.replace(CONFIG_PATH)
        self._settings = AISettings(
            provider=provider, model=model, api_key=api_key,
            organize_mode=organize_mode, similarity_threshold=similarity_threshold,
            enable_thinking=enable_thinking, custom_base_url=custom_base_url,
            theme_mode=self._settings.theme_mode, theme_id=self._settings.theme_id,
        )

    def _write(self) -> None:
        s = self._settings
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        if CONFIG_PATH.exists():
            shutil.copy2(CONFIG_PATH, BACKUP_PATH)
        tmp = CONFIG_PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps({
            "provider": s.provider,
            "model": s.model,
            "api_key": s.api_key,
            "organize_mode": s.organize_mode,
            "similarity_threshold": s.similarity_threshold,
            "enable_thinking": s.enable_thinking,
            "custom_base_url": s.custom_base_url,
            "theme_mode": s.theme_mode,
            "theme_id": s.theme_id,
        }, indent=2))
        tmp.replace(CONFIG_PATH)

    def save_theme(self, theme_mode: str, theme_id: str) -> None:
        if theme_mode not in ("dark", "light"):
            raise ValueError(f"theme_mode must be 'dark' or 'light', got '{theme_mode}'")
        s = self._settings
        self._settings = AISettings(
            provider=s.provider, model=s.model, api_key=s.api_key,
            organize_mode=s.organize_mode, similarity_threshold=s.similarity_threshold,
            enable_thinking=s.enable_thinking, custom_base_url=s.custom_base_url,
            theme_mode=theme_mode, theme_id=theme_id,
        )
        self._write()


settings_manager = SettingsManager()
