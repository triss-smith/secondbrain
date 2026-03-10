import json
from pathlib import Path
from fastapi import APIRouter

router = APIRouter()


@router.get("/api/update")
def get_update_status():
    update_file = Path("update.json")
    if update_file.exists():
        try:
            return json.loads(update_file.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"available": False}
