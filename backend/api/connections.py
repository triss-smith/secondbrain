from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.store.db import get_db, Connection

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
