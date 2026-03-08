import math

from backend.store import vectors as vec_store
from backend.store.db import SessionLocal, Item


def compute_mind_map(threshold: float = 0.55) -> dict:
    """
    Build a similarity graph over all items.
    Returns { nodes: [...], edges: [...] } ready for React Flow.
    """
    db = SessionLocal()
    try:
        items = db.query(Item).all()
    finally:
        db.close()

    if not items:
        return {"nodes": [], "edges": []}

    # Collect embeddings (first chunk per item)
    item_embeddings: dict[str, list[float]] = {}
    for item in items:
        emb = vec_store.get_item_embedding(item.id)
        if emb is not None and len(emb) > 0:
            item_embeddings[item.id] = emb

    # Build nodes
    def _snippet(item: Item) -> str:
        raw = (item.content or "").strip()
        lines = [l for l in raw.splitlines() if l.strip() and not l.startswith(
            ("Title:", "Channel:", "Author:", "URL:", "Transcript:", "Creator:", "Podcast:", "Caption:")
        )]
        return " ".join(" ".join(lines).split())[:120]

    nodes = [
        {
            "id": f"mm-{item.id}",
            "type": "mindMapItem",
            "data": {
                "item_id": item.id,
                "label": item.title,
                "content_type": item.content_type,
                "thumbnail": item.thumbnail,
                "summary": item.summary or "",
                "snippet": _snippet(item),
            },
            "position": _circle_position(i, len(items)),
        }
        for i, item in enumerate(items)
        if item.id in item_embeddings
    ]

    # Build edges from cosine similarity
    item_ids = list(item_embeddings.keys())
    edges = []
    for i in range(len(item_ids)):
        for j in range(i + 1, len(item_ids)):
            sim = _cosine(item_embeddings[item_ids[i]], item_embeddings[item_ids[j]])
            if sim >= threshold:
                edges.append(
                    {
                        "id": f"mm-edge-{item_ids[i]}-{item_ids[j]}",
                        "source": f"mm-{item_ids[i]}",
                        "target": f"mm-{item_ids[j]}",
                        "type": "semantic",
                        "data": {"similarity": round(sim, 3)},
                        "style": {"opacity": _opacity(sim)},
                    }
                )

    # Build category hub nodes and item→hub edges
    category_items: dict[str, list[str]] = {}
    for item in items:
        if item.id not in item_embeddings:
            continue
        cat = (item.category or "").strip()
        if cat:
            category_items.setdefault(cat, []).append(item.id)

    for cat, member_ids in category_items.items():
        hub_id = f"cat-{cat.lower().replace(' ', '_')}"
        nodes.append({
            "id": hub_id,
            "type": "categoryHub",
            "data": {
                "node_type": "category",
                "label": cat,
                "member_count": len(member_ids),
            },
            "position": {"x": 0, "y": 0},
        })
        for item_id in member_ids:
            edges.append({
                "id": f"cat-edge-{hub_id}-{item_id}",
                "source": hub_id,
                "target": f"mm-{item_id}",
                "type": "categoryLink",
                "data": {"similarity": 0.0},
                "style": {},
            })

    return {"nodes": nodes, "edges": edges}


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _opacity(sim: float) -> float:
    return round(0.2 + (sim - 0.55) * (0.8 / 0.45), 2)


def _circle_position(i: int, total: int) -> dict:
    angle = (2 * math.pi * i) / max(total, 1)
    radius = max(300, total * 50)
    return {
        "x": radius * math.cos(angle),
        "y": radius * math.sin(angle),
    }
