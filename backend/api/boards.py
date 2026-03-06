from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.store.db import Board, Page, get_db

router = APIRouter(prefix="/api/boards", tags=["boards"])


class CreateBoardRequest(BaseModel):
    name: str = "My Brain"


class SaveBoardStateRequest(BaseModel):
    state: dict  # { nodes: [...], edges: [...] }


class CreatePageRequest(BaseModel):
    title: str = "Untitled Page"
    content: str = ""
    board_id: str | None = None


class UpdatePageRequest(BaseModel):
    title: str | None = None
    content: str | None = None


# --- Boards ---

@router.get("")
def list_boards(db: Session = Depends(get_db)):
    boards = db.query(Board).order_by(Board.updated_at.desc()).all()
    return [_serialize_board(b) for b in boards]


@router.post("")
def create_board(req: CreateBoardRequest, db: Session = Depends(get_db)):
    board = Board(name=req.name)
    db.add(board)
    db.commit()
    return _serialize_board(board)


@router.get("/{board_id}")
def get_board(board_id: str, db: Session = Depends(get_db)):
    board = _get_or_404(board_id, db)
    return _serialize_board(board)


@router.put("/{board_id}/state")
def save_board_state(board_id: str, req: SaveBoardStateRequest, db: Session = Depends(get_db)):
    board = _get_or_404(board_id, db)
    board.state = req.state
    db.commit()
    return {"ok": True}


@router.delete("/{board_id}")
def delete_board(board_id: str, db: Session = Depends(get_db)):
    board = _get_or_404(board_id, db)
    db.delete(board)
    db.commit()
    return {"ok": True}


# --- Pages ---

@router.get("/{board_id}/pages")
def list_pages(board_id: str, db: Session = Depends(get_db)):
    pages = db.query(Page).filter(Page.board_id == board_id).order_by(Page.updated_at.desc()).all()
    return [_serialize_page(p) for p in pages]


@router.post("/{board_id}/pages")
def create_page(board_id: str, req: CreatePageRequest, db: Session = Depends(get_db)):
    _get_or_404(board_id, db)
    page = Page(title=req.title, content=req.content, board_id=board_id)
    db.add(page)
    db.commit()
    return _serialize_page(page)


@router.put("/{board_id}/pages/{page_id}")
def update_page(board_id: str, page_id: str, req: UpdatePageRequest, db: Session = Depends(get_db)):
    page = db.query(Page).filter(Page.id == page_id, Page.board_id == board_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    if req.title is not None:
        page.title = req.title
    if req.content is not None:
        page.content = req.content
    db.commit()
    return _serialize_page(page)


@router.delete("/{board_id}/pages/{page_id}")
def delete_page(board_id: str, page_id: str, db: Session = Depends(get_db)):
    page = db.query(Page).filter(Page.id == page_id, Page.board_id == board_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    db.delete(page)
    db.commit()
    return {"ok": True}


def _get_or_404(board_id: str, db: Session) -> Board:
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


def _serialize_board(board: Board) -> dict:
    return {
        "id": board.id,
        "name": board.name,
        "state": board.state,
        "created_at": board.created_at.isoformat() if board.created_at else None,
        "updated_at": board.updated_at.isoformat() if board.updated_at else None,
    }


def _serialize_page(page: Page) -> dict:
    return {
        "id": page.id,
        "title": page.title,
        "content": page.content,
        "board_id": page.board_id,
        "created_at": page.created_at.isoformat() if page.created_at else None,
        "updated_at": page.updated_at.isoformat() if page.updated_at else None,
    }
