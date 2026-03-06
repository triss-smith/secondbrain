from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.ai.embed import embed_text
from backend.store import vectors
from backend.store.db import Item, get_db

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
def semantic_search(
    q: str = Query(..., min_length=1),
    n: int = Query(default=10, le=50),
    item_ids: list[str] = Query(default=[]),
    db: Session = Depends(get_db),
):
    query_embedding = embed_text(q)
    chunks = vectors.search(
        query_embedding,
        n_results=n,
        item_ids=item_ids if item_ids else None,
    )

    # Attach item metadata
    item_cache: dict[str, Item] = {}
    results = []
    for chunk in chunks:
        iid = chunk["item_id"]
        if iid not in item_cache:
            item = db.query(Item).filter(Item.id == iid).first()
            if item:
                item_cache[iid] = item
        item = item_cache.get(iid)
        if item:
            results.append(
                {
                    "item": {
                        "id": item.id,
                        "title": item.title,
                        "content_type": item.content_type,
                        "thumbnail": item.thumbnail,
                        "source_url": item.source_url,
                        "tags": item.tags or [],
                    },
                    "chunk": chunk["content"],
                    "score": chunk["score"],
                }
            )

    # Deduplicate by item, keeping best score
    seen: dict[str, dict] = {}
    for r in results:
        iid = r["item"]["id"]
        if iid not in seen or r["score"] > seen[iid]["score"]:
            seen[iid] = r

    return sorted(seen.values(), key=lambda x: x["score"], reverse=True)
