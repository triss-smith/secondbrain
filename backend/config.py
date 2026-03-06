from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    minimax_api_key: str = ""
    minimax_base_url: str = "https://api.minimax.chat/v1"
    minimax_model: str = "MiniMax-Text-01"

    embed_model: str = "all-MiniLM-L6-v2"

    db_path: str = "data/brain.db"
    chroma_path: str = "data/chroma"
    uploads_path: str = "data/uploads"

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
