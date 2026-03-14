import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.store.db import get_db, Connection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/connections", tags=["connections"])

VALID_TYPES = {"related", "source", "inspired_by", "contradicts", "supports", "duplicate"}


class ConnectionCreate(BaseModel):
    source_item_id: str
    target_item_id: str
    type: str = "related"


class ConnectionUpdate(BaseModel):
    type: str


def _serialize(c: Connection) -> dict:
    return {
        "id": c.id,
        "source_item_id": c.source_item_id,
        "target_item_id": c.target_item_id,
        "type": c.type,
        "is_semantic": bool(c.is_semantic),
        "dismissed": bool(c.dismissed),
        "similarity": c.similarity,
        "auto_generated": bool(c.auto_generated),
        "created_at": c.created_at.isoformat(),
    }


@router.get("")
def list_connections(db: Session = Depends(get_db)):
    return [_serialize(c) for c in db.query(Connection).all()]


@router.post("", status_code=201)
def create_connection(body: ConnectionCreate, db: Session = Depends(get_db)):
    if body.type not in VALID_TYPES:
        raise HTTPException(400, f"Invalid type. Must be one of: {VALID_TYPES}")
    existing = db.query(Connection).filter_by(
        source_item_id=body.source_item_id,
        target_item_id=body.target_item_id
    ).first()
    if existing:
        return JSONResponse(status_code=200, content=_serialize(existing))
    conn = Connection(
        source_item_id=body.source_item_id,
        target_item_id=body.target_item_id,
        type=body.type,
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return _serialize(conn)


@router.patch("/{conn_id}")
def update_connection(conn_id: int, body: ConnectionUpdate, db: Session = Depends(get_db)):
    if body.type not in VALID_TYPES:
        raise HTTPException(400, f"Invalid type. Must be one of: {VALID_TYPES}")
    conn = db.query(Connection).filter_by(id=conn_id).first()
    if not conn:
        raise HTTPException(404, "Connection not found")
    conn.type = body.type
    db.commit()
    db.refresh(conn)
    return _serialize(conn)


@router.delete("/{conn_id}", status_code=204)
def delete_connection(conn_id: int, db: Session = Depends(get_db)):
    conn = db.query(Connection).filter_by(id=conn_id).first()
    if not conn:
        raise HTTPException(404, "Connection not found")
    db.delete(conn)
    db.commit()


@router.post("/auto-generate", status_code=200)
def auto_generate_connections(db: Session = Depends(get_db)):
    """
    Retroactively detect auto-generated connections across all items.
    Clears all existing auto-generated connections first, then re-runs detection for every item.
    """
    from backend.store.db import Item
    from backend.ai.relations import detect_connections

    # Clear existing auto-generated connections
    db.query(Connection).filter_by(auto_generated=True).delete()
    db.commit()

    items = db.query(Item).all()
    total_created = 0

    for item in items:
        if not item.content:
            continue
        try:
            found = detect_connections(item.id, item.content, db)
            for c in found:
                db.add(Connection(
                    source_item_id=item.id,
                    target_item_id=c["target_id"],
                    type=c["type"],
                    auto_generated=True,
                ))
            if found:
                db.commit()
                total_created += len(found)
        except Exception:
            logger.exception("[auto_generate] failed for item %s — skipping", item.id)

    return {"connections_created": total_created}


class SemanticConnectionCreate(BaseModel):
    source_item_id: str
    target_item_id: str
    similarity: float


@router.post("/semantic", status_code=200)
def upsert_semantic_connection(body: SemanticConnectionCreate, db: Session = Depends(get_db)):
    """
    Upsert a semantic connection (from item similarity).
    Creates or updates the connection with is_semantic=True and the similarity score.
    """
    # Normalize: smaller ID first for consistent lookup
    src, tgt = (body.source_item_id, body.target_item_id) if body.source_item_id < body.target_item_id else (body.target_item_id, body.source_item_id)

    conn = db.query(Connection).filter_by(
        source_item_id=src,
        target_item_id=tgt,
        is_semantic=True,
    ).first()

    if conn:
        conn.similarity = body.similarity
        conn.dismissed = False  # Re-create if it was dismissed
    else:
        conn = Connection(
            source_item_id=src,
            target_item_id=tgt,
            type="related",
            is_semantic=True,
            similarity=body.similarity,
            dismissed=False,
        )
        db.add(conn)

    db.commit()
    db.refresh(conn)
    return _serialize(conn)


@router.post("/semantic/dismiss")
def dismiss_semantic_connection(body: SemanticConnectionCreate, db: Session = Depends(get_db)):
    """
    Dismiss a semantic connection so it won't be shown on the canvas.
    """
    src, tgt = (body.source_item_id, body.target_item_id) if body.source_item_id < body.target_item_id else (body.target_item_id, body.source_item_id)

    conn = db.query(Connection).filter_by(
        source_item_id=src,
        target_item_id=tgt,
        is_semantic=True,
    ).first()

    if conn:
        conn.dismissed = True
        db.commit()
        db.refresh(conn)
        return _serialize(conn)

    # If not found, create as dismissed
    conn = Connection(
        source_item_id=src,
        target_item_id=tgt,
        type="related",
        is_semantic=True,
        similarity=body.similarity,
        dismissed=True,
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return _serialize(conn)
