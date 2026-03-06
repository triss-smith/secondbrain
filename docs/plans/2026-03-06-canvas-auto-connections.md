# Canvas Auto-Connections Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the standalone Mind Map node with automatic semantic edges between SourceNodes on the canvas.

**Architecture:** When canvas SourceNodes change, the frontend calls a new `POST /api/items/similarities` endpoint with the item IDs. The backend computes pairwise cosine similarity from ChromaDB embeddings and returns pairs above threshold 0.55. The canvas renders these as SemanticEdges automatically.

**Tech Stack:** FastAPI, ChromaDB (cosine similarity), React Flow, TypeScript

---

### Task 1: Add backend similarities endpoint

**Files:**
- Modify: `backend/api/items.py`
- Modify: `backend/store/vectors.py`

**Step 1: Add `get_embeddings_for_items` to vectors.py**

```python
def get_embeddings_for_items(item_ids: list[str]) -> dict[str, list[float]]:
    """Return a map of item_id -> embedding for each item that has one."""
    col = _get_collection()
    result = {}
    for item_id in item_ids:
        results = col.get(
            where={"item_id": item_id},
            include=["embeddings"],
            limit=1,
        )
        if results["embeddings"] and len(results["embeddings"]) > 0:
            emb = results["embeddings"][0]
            if emb is not None and len(emb) > 0:
                result[item_id] = emb
    return result
```

**Step 2: Add the endpoint to items.py**

Add this after the existing imports and models:

```python
class SimilaritiesRequest(BaseModel):
    item_ids: list[str]
    threshold: float = 0.55
```

Add this endpoint before `_save_item`:

```python
@router.post("/similarities")
def get_similarities(req: SimilaritiesRequest):
    import math

    embeddings = vectors.get_embeddings_for_items(req.item_ids)

    def cosine(a, b):
        dot = sum(x * y for x, y in zip(a, b))
        na = math.sqrt(sum(x * x for x in a))
        nb = math.sqrt(sum(x * x for x in b))
        return dot / (na * nb) if na and nb else 0.0

    ids = list(embeddings.keys())
    edges = []
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            sim = cosine(embeddings[ids[i]], embeddings[ids[j]])
            if sim >= req.threshold:
                edges.append({
                    "source": ids[i],
                    "target": ids[j],
                    "similarity": round(sim, 3),
                })
    return edges
```

**Step 3: Verify backend starts without errors**

Run: `py -3.12 -m uvicorn backend.main:app --reload`
Expected: No import errors, server starts.

**Step 4: Commit**

```bash
git add backend/store/vectors.py backend/api/items.py
git commit -m "feat: add items/similarities endpoint for pairwise cosine similarity"
```

---

### Task 2: Add API call in frontend

**Files:**
- Modify: `frontend/src/api.ts`

**Step 1: Add the similarities function**

```typescript
export const getItemSimilarities = (item_ids: string[], threshold = 0.55) =>
  api.post<{ source: string; target: string; similarity: number }[]>(
    '/items/similarities',
    { item_ids, threshold }
  ).then(r => r.data)
```

**Step 2: Verify no TypeScript errors**

Run: `cd frontend && npm run build`
Expected: No errors.

**Step 3: Commit**

```bash
git add frontend/src/api.ts
git commit -m "feat: add getItemSimilarities API call"
```

---

### Task 3: Auto-draw edges in Board.tsx

**Files:**
- Modify: `frontend/src/canvas/Board.tsx`

**Context:** Board.tsx maintains `nodes` and `edges` state. SourceNodes have `data.item` with an `id` field. SemanticEdge is already registered as an edge type. The goal is: whenever the set of SourceNodes changes, recompute semantic edges.

**Step 1: Add import**

```typescript
import { getItemSimilarities } from '../api'
```

**Step 2: Add a useEffect that watches SourceNodes**

Find where `nodes` state is defined. Add this effect after the existing useEffects:

```typescript
useEffect(() => {
  const sourceNodes = nodes.filter(n => n.type === 'source')
  const itemIds = sourceNodes.map(n => (n.data as SourceNodeData).item.id)

  if (itemIds.length < 2) {
    // Remove any existing semantic edges if fewer than 2 source nodes
    setEdges(prev => prev.filter(e => e.type !== 'semantic'))
    return
  }

  getItemSimilarities(itemIds).then(pairs => {
    const semanticEdges = pairs.map(p => ({
      id: `sem-${p.source}-${p.target}`,
      source: sourceNodes.find(n => (n.data as SourceNodeData).item.id === p.source)!.id,
      target: sourceNodes.find(n => (n.data as SourceNodeData).item.id === p.target)!.id,
      type: 'semantic',
      data: { similarity: p.similarity },
    }))
    setEdges(prev => [
      ...prev.filter(e => e.type !== 'semantic'),
      ...semanticEdges,
    ])
  })
}, [nodes.filter(n => n.type === 'source').map(n => n.id).join(',')])
```

**Note:** The dependency array uses a derived string so React only re-runs when the set of SourceNode IDs actually changes — not on every node move/resize.

**Step 3: Verify edges appear**

Start the app, add 2+ items to the canvas that are on the same topic. Semantic edges should appear automatically.

**Step 4: Commit**

```bash
git add frontend/src/canvas/Board.tsx
git commit -m "feat: auto-draw semantic edges between canvas SourceNodes"
```

---

### Task 4: Remove Mind Map button and MindMapNode

**Files:**
- Modify: `frontend/src/App.tsx` — remove mind map button
- Modify: `frontend/src/canvas/Board.tsx` — remove mindMap node type, remove getMindMap call
- Delete: `frontend/src/canvas/nodes/MindMapNode.tsx`
- Modify: `frontend/src/types.ts` — remove MindMapNodeData, MindMapItem, MindMapEdge
- Modify: `backend/api/boards.py` — remove mindmap endpoint

**Step 1: Remove the mind map button from App.tsx**

Find and remove the button that calls `getMindMap` and dispatches a `add-mind-map` event.

**Step 2: Remove mindMap from Board.tsx**

- Remove the `mindMap: MindMapNode` entry from the `nodeTypes` object
- Remove the `getMindMap` import from `../api`
- Remove the `add-mind-map` event listener and handler
- Remove the `remove-page-node` event handler (only used by MindMapNode)

**Step 3: Remove the mindmap endpoint from boards.py**

Delete the `@router.get("/{board_id}/mindmap")` route and its handler.

**Step 4: Remove getMindMap from api.ts**

Delete the `getMindMap` export.

**Step 5: Clean up types.ts**

Remove: `MindMapNodeData`, `MindMapItem`, `MindMapEdge` interfaces.
Update: `CanvasNode` type union to remove `'mindMap'`.

**Step 6: Delete MindMapNode.tsx**

```bash
rm frontend/src/canvas/nodes/MindMapNode.tsx
```

**Step 7: Verify no TypeScript errors**

Run: `cd frontend && npm run build`
Expected: Clean build.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: remove standalone mind map, replaced by canvas auto-connections"
```

---

### Task 5: Smoke test

**Step 1: Start full app**

Run backend: `py -3.12 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload`
Run frontend: `cd frontend && npm run dev`

**Step 2: Verify auto-connections**
1. Add 2 items from the same topic to the canvas
2. Confirm a dashed purple edge appears between them automatically
3. Add an unrelated item — confirm no edge (or a faint one) appears
4. Remove one of the connected items — confirm the edge disappears

**Step 3: Verify Mind Map is gone**
- Mind Map button should not appear in the toolbar
- No errors in console related to mindMap node type
