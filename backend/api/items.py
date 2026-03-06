import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.ai.embed import chunk_text, embed_batch
from backend.ai.minimax import chat
from backend.ingest.base import ingest_file, ingest_text, ingest_url
from backend.store.db import Chunk, Item, get_db
from backend.store import vectors
from backend.config import settings

router = APIRouter(prefix="/api/items", tags=["items"])


class IngestURLRequest(BaseModel):
    url: str
    title: Optional[str] = None


class IngestTextRequest(BaseModel):
    content: str
    title: Optional[str] = "Note"


class UpdateItemRequest(BaseModel):
    title: Optional[str] = None
    tags: Optional[list[str]] = None
    summary: Optional[str] = None


@router.get("")
def list_items(
    q: Optional[str] = None,
    content_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Item)
    if content_type:
        query = query.filter(Item.content_type == content_type)
    if q:
        query = query.filter(Item.title.ilike(f"%{q}%"))
    items = query.order_by(Item.created_at.desc()).all()
    return [_serialize(item) for item in items]


@router.get("/grouped")
def list_items_grouped(db: Session = Depends(get_db)):
    items = db.query(Item).order_by(Item.created_at.desc()).all()
    groups: dict[str, list] = {}
    for item in items:
        label = item.category or "Uncategorized"
        groups.setdefault(label, []).append(_serialize(item))
    return [
        {"label": label, "items": group_items}
        for label, group_items in sorted(groups.items(), key=lambda x: len(x[1]), reverse=True)
    ]


@router.get("/{item_id}")
def get_item(item_id: str, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return _serialize(item, include_content=True)


@router.post("/ingest/url")
async def ingest_url_endpoint(req: IngestURLRequest, db: Session = Depends(get_db)):
    try:
        result = await ingest_url(req.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")

    return await _save_item(result, db, override_title=req.title)


@router.post("/ingest/text")
async def ingest_text_endpoint(req: IngestTextRequest, db: Session = Depends(get_db)):
    result = await ingest_text(req.content, req.title or "Note")
    return await _save_item(result, db)


@router.post("/ingest/file")
async def ingest_file_endpoint(
    file: UploadFile = File(...),
    title: str = Form(None),
    db: Session = Depends(get_db),
):
    file_path = os.path.join(settings.uploads_path, f"{uuid.uuid4()}_{file.filename}")
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    try:
        result = await ingest_file(file_path, file.filename or "file")
    except Exception as e:
        os.unlink(file_path)
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")

    return await _save_item(result, db, override_title=title)


@router.patch("/{item_id}")
def update_item(item_id: str, req: UpdateItemRequest, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if req.title is not None:
        item.title = req.title
    if req.tags is not None:
        item.tags = req.tags
    if req.summary is not None:
        item.summary = req.summary
    db.commit()
    if req.tags is not None:
        vectors.update_item_metadata(item.id, content_type=item.content_type, tags=item.tags)
    return _serialize(item)


@router.post("/{item_id}/resummarize")
async def resummarize_item(item_id: str, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    tags, summary, category = await _auto_tag_summarize(item.content or "", item.title)
    if tags:
        item.tags = tags
    if summary:
        item.summary = summary
    if category:
        item.category = category
    db.commit()
    if tags:
        vectors.update_item_metadata(item.id, content_type=item.content_type, tags=item.tags)
    return _serialize(item)


@router.delete("/{item_id}")
def delete_item(item_id: str, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    vectors.delete_item(item_id)
    db.delete(item)
    db.commit()
    return {"ok": True}


async def _save_item(result, db: Session, override_title: str | None = None) -> dict:
    title = override_title or result.title

    # Auto-generate tags + summary via MiniMax
    tags, summary, category = await _auto_tag_summarize(result.content, title)

    item = Item(
        title=title,
        source_url=result.source_url,
        content_type=result.content_type,
        content=result.content,
        summary=summary,
        thumbnail=result.thumbnail,
        tags=tags,
        category=category,
        meta=result.meta,
    )
    db.add(item)
    db.flush()

    # Chunk + embed
    chunks_text = chunk_text(result.content)
    embeddings = embed_batch(chunks_text)

    chunk_records = []
    vector_chunks = []
    for i, (text, emb) in enumerate(zip(chunks_text, embeddings)):
        chunk_id = str(uuid.uuid4())
        chunk_records.append(Chunk(id=chunk_id, item_id=item.id, content=text, chunk_index=i))
        vector_chunks.append({"id": chunk_id, "content": text, "embedding": emb, "chunk_index": i})

    db.add_all(chunk_records)
    db.commit()
    vectors.upsert_chunks(item.id, vector_chunks, content_type=item.content_type, tags=tags)

    return _serialize(item)


async def _auto_tag_summarize(content: str, title: str) -> tuple[list[str], str, str]:
    import json, re
    snippet = content[:3000]
    try:
        response = await chat(
            [
                {
                    "role": "user",
                    "content": (
                        f"Title: {title}\n\nContent snippet:\n{snippet}\n\n"
                        "Return a JSON object with three keys:\n"
                        '- "category": a single broad domain in title case (e.g. "Cooking", "Fitness", "Personal Finance", "Software Engineering"). '
                        "This is a high-level grouping label — never a specific item or title (e.g. use 'Cooking', not 'Potato Soup').\n"
                        '- "tags": array of 3-5 specific lowercase tags describing the exact topic (e.g. "potato soup", "weight loss", "index funds"). '
                        "Never use vague phrases like 'this person', 'the author', 'content', or 'video'.\n"
                        '- "summary": 2-3 sentence summary written in third person about the content itself, not the author or creator. '
                        "Never use phrases like 'this person', 'the author', 'the creator', or 'the video'. Be specific and factual.\n"
                        "Return ONLY the JSON, no markdown fences."
                    ),
                }
            ]
        )
        cleaned = re.sub(r"^```[a-z]*\n?", "", response.strip(), flags=re.MULTILINE)
        cleaned = re.sub(r"```$", "", cleaned.strip())
        data = json.loads(cleaned.strip())
        tags = data.get("tags", [])
        summary = data.get("summary", "")
        category = data.get("category", "")
        if not tags:
            tags = _keyword_tags(title, content)
        return tags, summary, category
    except Exception as e:
        print(f"[auto_tag_summarize] failed: {e}")
        return _keyword_tags(title, content), "", ""


def _keyword_tags(title: str, content: str) -> list[str]:
    """Simple keyword fallback when AI tagging is unavailable."""
    import re
    text = f"{title} {content[:1000]}".lower()
    stopwords = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
                 "of", "with", "by", "from", "is", "it", "this", "that", "was", "are",
                 "be", "as", "i", "you", "he", "she", "we", "they", "not", "no", "so"}
    words = re.findall(r'\b[a-z]{4,}\b', text)
    freq: dict[str, int] = {}
    for w in words:
        if w not in stopwords:
            freq[w] = freq.get(w, 0) + 1
    top = sorted(freq, key=lambda w: freq[w], reverse=True)[:5]
    return top


def _serialize(item: Item, include_content: bool = False) -> dict:
    raw = (item.content or "").strip()
    # Strip header lines (e.g. "Title: ...\nChannel: ...") for notes/articles
    content_lines = [l for l in raw.splitlines() if l.strip() and not l.startswith(("Title:", "Channel:", "Author:", "URL:"))]
    snippet = " ".join(" ".join(content_lines).split())[:200] if content_lines else ""

    out = {
        "id": item.id,
        "title": item.title,
        "source_url": item.source_url,
        "content_type": item.content_type,
        "summary": item.summary,
        "snippet": snippet,
        "thumbnail": item.thumbnail,
        "tags": item.tags or [],
        "category": item.category or "",
        "meta": item.meta or {},
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }
    if include_content:
        out["content"] = item.content
    return out
