import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.api.items import router as items_router
from backend.api.boards import router as boards_router
from backend.api.chat import router as chat_router
from backend.api.search import router as search_router
from backend.api.settings import router as settings_router
from backend.api.connections import router as connections_router
from backend.api.update import router as update_router
from backend.ai.mindmap import compute_mind_map

app = FastAPI(title="Second Brain API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(items_router)
app.include_router(boards_router)
app.include_router(chat_router)
app.include_router(search_router)
app.include_router(settings_router)
app.include_router(connections_router)
app.include_router(update_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/mind-map")
def get_mind_map(threshold: float = 0.40):
    return compute_mind_map(threshold=threshold)


# Serve built frontend in production
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static")
