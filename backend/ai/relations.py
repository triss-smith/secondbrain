import math
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

NLI_MODEL_NAME = "cross-encoder/nli-deberta-v3-xsmall"
# Label order for nli-deberta-v3-xsmall: contradiction=0, entailment=1, neutral=2
_CONTRADICTION = 0
_ENTAILMENT = 1

SIMILARITY_FLOOR = 0.45
DUPLICATE_THRESHOLD = 0.93
CONTRADICTION_THRESHOLD = 0.50
SUPPORT_THRESHOLD = 0.55
RELATED_FLOOR = 0.45
MAX_CANDIDATES = 10
NLI_CONTENT_LIMIT = 512   # chars fed to the NLI model per item
EMBED_CONTENT_LIMIT = 1000  # chars embedded for candidate retrieval

_nli_model = None


def _get_nli_model():
    global _nli_model
    if _nli_model is None:
        from sentence_transformers import CrossEncoder
        model_path = os.environ.get("NLI_MODEL_PATH") or NLI_MODEL_NAME
        logger.info("[relations] loading NLI model from %s", model_path)
        _nli_model = CrossEncoder(model_path)
    return _nli_model


def _softmax(scores: list[float]) -> list[float]:
    exps = [math.exp(s) for s in scores]
    total = sum(exps)
    return [e / total for e in exps]


def _classify_pair(similarity: float, nli_probs: list[float]) -> Optional[str]:
    """Return connection type string or None."""
    if similarity < SIMILARITY_FLOOR:
        return None
    if similarity >= DUPLICATE_THRESHOLD:
        return "duplicate"
    contradiction, entailment, _ = nli_probs
    if contradiction >= CONTRADICTION_THRESHOLD:
        return "contradicts"
    if entailment >= SUPPORT_THRESHOLD:
        return "supports"
    if similarity >= RELATED_FLOOR:
        return "related"
    return None


def detect_connections(item_id: str, item_content: str, db) -> list[dict]:
    """
    Find auto-generated connections for a newly ingested item.

    Returns a list of dicts: {"target_id": str, "type": str}
    Returns [] if the NLI model is unavailable.
    """
    from backend.store.vectors import search
    from backend.ai.embed import embed_text
    from backend.store.db import Item, Connection

    if not item_content or not item_content.strip():
        return []

    # Embed a representative snippet of the new item
    query_embedding = embed_text(item_content[:EMBED_CONTENT_LIMIT])

    raw_candidates = search(query_embedding, n_results=MAX_CANDIDATES + 5)

    # Deduplicate by item_id (multiple chunks per item), take max score, exclude self
    seen: dict[str, float] = {}
    for c in raw_candidates:
        cid = c["item_id"]
        if cid == item_id:
            continue
        if cid not in seen or c["score"] > seen[cid]:
            seen[cid] = c["score"]

    candidates = sorted(seen.items(), key=lambda x: x[1], reverse=True)[:MAX_CANDIDATES]
    if not candidates:
        return []

    candidate_ids = [cid for cid, _ in candidates]
    items_by_id = {
        i.id: i
        for i in db.query(Item).filter(Item.id.in_(candidate_ids)).all()
    }

    try:
        nli = _get_nli_model()
    except Exception:
        logger.warning("[relations] NLI model unavailable, skipping auto-detection")
        return []
    pairs = []
    valid_candidates = []
    for cand_id, similarity in candidates:
        cand_item = items_by_id.get(cand_id)
        if not cand_item or not cand_item.content:
            continue
        pairs.append((item_content[:NLI_CONTENT_LIMIT], cand_item.content[:NLI_CONTENT_LIMIT]))
        valid_candidates.append((cand_id, similarity))

    if not pairs:
        return []

    # Batch predict — faster than one-by-one
    raw_scores = nli.predict(pairs)  # shape: (n_pairs, 3)

    results = []
    for i, (cand_id, similarity) in enumerate(valid_candidates):
        nli_probs = _softmax(raw_scores[i].tolist())
        conn_type = _classify_pair(similarity, nli_probs)
        if conn_type is None:
            continue

        # Skip if any connection already exists between these two items (either direction)
        existing = db.query(Connection).filter(
            (
                (Connection.source_item_id == item_id) &
                (Connection.target_item_id == cand_id)
            ) | (
                (Connection.source_item_id == cand_id) &
                (Connection.target_item_id == item_id)
            )
        ).first()
        if existing:
            continue

        results.append({
            "target_id": cand_id,
            "type": conn_type,
        })

    logger.info("[relations] detected %d connections for item %s", len(results), item_id)
    return results
