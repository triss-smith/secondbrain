import os
from pydantic_settings import BaseSettings
from pathlib import Path

_data_dir = Path(
    os.environ.get("SECOND_BRAIN_DATA")
    or Path(os.environ.get("APPDATA", Path.home())) / "SecondBrain" / "data"
)


class Settings(BaseSettings):
    minimax_api_key: str = ""
    minimax_base_url: str = "https://api.minimax.io/anthropic"
    minimax_model: str = "MiniMax-M2.5"

    embed_model: str = "all-MiniLM-L6-v2"

    db_path: str = str(_data_dir / "brain.db")
    chroma_path: str = str(_data_dir / "chroma")
    uploads_path: str = str(_data_dir / "uploads")

    host: str = "0.0.0.0"
    port: int = 8000

    google_client_id: str = ""
    google_client_secret: str = ""

    class Config:
        env_file = ".env"


settings = Settings()

for p in [settings.db_path, settings.chroma_path, settings.uploads_path]:
    Path(p).parent.mkdir(parents=True, exist_ok=True)
Path(settings.uploads_path).mkdir(parents=True, exist_ok=True)
