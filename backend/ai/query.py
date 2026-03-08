from typing import AsyncIterator

from backend.ai.embed import embed_text
from backend.ai.client import chat_stream, strip_think_tags
from backend.store import vectors
from backend.store.db import SessionLocal, Connection


SYSTEM_PROMPT = """You are the user's Second Brain — an AI assistant with access to their personal knowledge base.

Answer questions using ONLY the context provided below. If the context doesn't contain enough information to answer, say so clearly.
Always cite your sources by referencing the item title in brackets, e.g. [How to Build a Startup].
Be concise, insightful, and direct. Use plain text only — no markdown, no bullet points with asterisks, no bold or italic markers."""


async def query_stream(
    question: str,
    item_ids: list[str] | None = None,
    history: list[dict] | None = None,
    n_chunks: int = 8,
) -> AsyncIterator[str]:
    query_embedding = embed_text(question)
    chunks = vectors.search(query_embedding, n_results=n_chunks, item_ids=item_ids)

    if not chunks:
        yield "I couldn't find any relevant information in your knowledge base for that question."
        return

    context = _format_context(chunks)

    # Fetch explicit connections for retrieved items
    retrieved_ids = list({c["item_id"] for c in chunks})
    connection_context = _format_connections(retrieved_ids)

    messages = (history or []) + [{"role": "user", "content": question}]

    connection_block = f"\n\nEXPLICIT RELATIONSHIPS:\n{connection_context}" if connection_context else ""
    system = f"{SYSTEM_PROMPT}\n\n---\nKNOWLEDGE BASE CONTEXT:\n{context}{connection_block}\n---"

    async for token in strip_think_tags(chat_stream(messages, system=system)):
        yield token


def _format_connections(item_ids: list[str]) -> str:
    if not item_ids:
        return ""
    db = SessionLocal()
    try:
        from sqlalchemy import or_
        connections = db.query(Connection).filter(
            or_(
                Connection.source_item_id.in_(item_ids),
                Connection.target_item_id.in_(item_ids),
            )
        ).all()
    finally:
        db.close()

    if not connections:
        return ""

    TYPE_LABELS = {
        "related": "is related to",
        "source": "is a source for",
        "inspired_by": "was inspired by",
        "contradicts": "contradicts",
    }

    lines = []
    for c in connections:
        label = TYPE_LABELS.get(c.type, c.type)
        lines.append(f'- Item "{c.source_item_id}" {label} item "{c.target_item_id}"')
    return "\n".join(lines)


def _format_context(chunks: list[dict]) -> str:
    seen_items: dict[str, list[str]] = {}
    for chunk in chunks:
        item_id = chunk["item_id"]
        seen_items.setdefault(item_id, []).append(chunk["content"])

    parts = []
    for item_id, texts in seen_items.items():
        parts.append(f"[Item: {item_id}]\n" + "\n".join(texts))
    return "\n\n".join(parts)
