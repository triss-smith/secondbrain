import chromadb
from chromadb.config import Settings as ChromaSettings

from backend.config import settings

_client = None
_collection = None


def _get_collection():
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(
            path=settings.chroma_path,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        _collection = _client.get_or_create_collection(
            name="brain_chunks",
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def upsert_chunks(item_id: str, chunks: list[dict]):
    """chunks: list of {id, content, embedding, chunk_index}"""
    col = _get_collection()
    col.upsert(
        ids=[c["id"] for c in chunks],
        documents=[c["content"] for c in chunks],
        embeddings=[c["embedding"] for c in chunks],
        metadatas=[{"item_id": item_id, "chunk_index": c.get("chunk_index", 0)} for c in chunks],
    )


def search(
    query_embedding: list[float],
    n_results: int = 10,
    item_ids: list[str] | None = None,
) -> list[dict]:
    col = _get_collection()
    where = {"item_id": {"$in": item_ids}} if item_ids else None
    results = col.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        where=where,
        include=["documents", "metadatas", "distances"],
    )
    return [
        {
            "content": doc,
            "item_id": results["metadatas"][0][i]["item_id"],
            "chunk_index": results["metadatas"][0][i]["chunk_index"],
            "score": 1 - results["distances"][0][i],
        }
        for i, doc in enumerate(results["documents"][0])
    ]


def get_item_embedding(item_id: str) -> list[float] | None:
    """Return the embedding of the first chunk of an item (for similarity graph)."""
    col = _get_collection()
    results = col.get(
        where={"item_id": item_id},
        include=["embeddings"],
        limit=1,
    )
    if results["embeddings"]:
        return results["embeddings"][0]
    return None


def delete_item(item_id: str):
    col = _get_collection()
    results = col.get(where={"item_id": item_id})
    if results["ids"]:
        col.delete(ids=results["ids"])
