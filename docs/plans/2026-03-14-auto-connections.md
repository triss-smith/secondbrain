# Auto-Connection Detection Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After ingesting a new item, automatically detect and create typed connections (related, supports, contradicts, duplicate) to existing items in the brain using semantic search + a local NLI model — with no extra AI API calls.

**Architecture:** ChromaDB semantic search narrows candidates to the top 10 most similar items. A locally-running CrossEncoder NLI model (cross-encoder/nli-deberta-v3-xsmall, ~88MB) scores each candidate pair and classifies the relationship. Auto-generated connections are flagged with `auto_generated=True` so the UI can render them distinctly and users can dismiss them.

**Tech Stack:** sentence-transformers `CrossEncoder`, ChromaDB, SQLite/SQLAlchemy, React Flow, TypeScript

---

## Chunk 1: Backend — Schema, Types, and NLI Pipeline

### Task 1: Add new connection types and `auto_generated` flag

**Files:**
- Modify: `backend/store/db.py`
- Modify: `backend/api/connections.py`

- [ ] **Step 1: Add `auto_generated` column to Connection model in `db.py`**

In `db.py`, add the column to the `Connection` class:

```python
class Connection(Base):
    __tablename__ = "connections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_item_id = Column(String, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    target_item_id = Column(String, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, nullable=False, default="related")
    auto_generated = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (
        UniqueConstraint('source_item_id', 'target_item_id', name='uq_connection_pair'),
    )
```

Add `Boolean` to the SQLAlchemy imports at the top of `db.py`:
```python
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey, UniqueConstraint, Boolean
```

- [ ] **Step 2: Add migration for `auto_generated` column**

In the migration block at the bottom of `db.py`, add alongside the existing `category` migration:

```python
if "auto_generated" not in existing:
    conn.execute(__import__('sqlalchemy').text(
        "ALTER TABLE connections ADD COLUMN auto_generated INTEGER NOT NULL DEFAULT 0"
    ))
    conn.commit()
```

Note: SQLite uses INTEGER for booleans (0/1). SQLAlchemy's `Boolean` maps correctly.

- [ ] **Step 3: Add new types to `VALID_TYPES` in `connections.py`**

```python
VALID_TYPES = {"related", "source", "inspired_by", "contradicts", "supports", "duplicate"}
```

- [ ] **Step 4: Expose `auto_generated` in `_serialize`**

```python
def _serialize(c: Connection) -> dict:
    return {
        "id": c.id,
        "source_item_id": c.source_item_id,
        "target_item_id": c.target_item_id,
        "type": c.type,
        "auto_generated": bool(c.auto_generated),
        "created_at": c.created_at.isoformat(),
    }
```

- [ ] **Step 5: Verify migration runs cleanly**

Start the backend and confirm no errors:
```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
Expected: no SQLAlchemy errors. Check `GET /api/connections` returns `auto_generated` field.

- [ ] **Step 6: Commit**
```bash
git add backend/store/db.py backend/api/connections.py
git commit -m "feat: add auto_generated flag and supports/duplicate connection types"
```

---

### Task 2: NLI model + connection detection pipeline

**Files:**
- Create: `backend/ai/relations.py`

The NLI model takes `(premise, hypothesis)` text pairs and returns logit scores for three labels: `[contradiction, entailment, neutral]` (index 0, 1, 2 for `nli-deberta-v3-xsmall`). Softmax converts logits to probabilities.

Decision logic per candidate pair:
| Condition | Connection type |
|-----------|----------------|
| similarity ≥ 0.93 | `duplicate` |
| contradiction prob ≥ 0.50 | `contradicts` |
| entailment prob ≥ 0.55 AND similarity ≥ 0.50 | `supports` |
| similarity ≥ 0.50 | `related` |
| otherwise | none |

Direction: the new item is always the premise (source). If NLI says the new item *entails* the existing item, the new item *supports* the existing item (new → existing).

- [ ] **Step 1: Install the NLI model dependency**

The `CrossEncoder` class is already in `sentence-transformers`. No new pip install needed — just a one-time model download on first use (~88MB).

- [ ] **Step 2: Create `backend/ai/relations.py`**

```python
import math
import logging
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
RELATED_FLOOR = 0.50
MAX_CANDIDATES = 10

_nli_model = None


def _get_nli_model():
    global _nli_model
    if _nli_model is None:
        from sentence_transformers import CrossEncoder
        logger.info("[relations] loading NLI model %s", NLI_MODEL_NAME)
        _nli_model = CrossEncoder(NLI_MODEL_NAME)
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
    if entailment >= SUPPORT_THRESHOLD and similarity >= RELATED_FLOOR:
        return "supports"
    if similarity >= RELATED_FLOOR:
        return "related"
    return None


def detect_connections(item_id: str, item_content: str, db) -> list[dict]:
    """
    Find auto-generated connections for a newly ingested item.

    Returns a list of connection dicts ready to insert:
      {source_item_id, target_item_id, type, auto_generated: True}

    The new item is always the source (premise). If NLI returns entailment,
    the new item supports the candidate (new → candidate).
    """
    from backend.store.vectors import search
    from backend.ai.embed import embed_text
    from backend.store.db import Item, Connection

    # Embed a representative snippet of the new item
    query_embedding = embed_text(item_content[:1000])

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

    nli = _get_nli_model()
    pairs = []
    valid_candidates = []
    for cand_id, similarity in candidates:
        cand_item = items_by_id.get(cand_id)
        if not cand_item or not cand_item.content:
            continue
        pairs.append((item_content[:512], cand_item.content[:512]))
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
            "source_item_id": item_id,
            "target_item_id": cand_id,
            "type": conn_type,
            "auto_generated": True,
        })

    logger.info("[relations] detected %d connections for item %s", len(results), item_id)
    return results
```

- [ ] **Step 3: Write a quick smoke test**

Create `tests/test_relations_smoke.py`:

```python
"""Smoke test — verifies classify logic without loading the NLI model."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from backend.ai.relations import _classify_pair, _softmax

def test_duplicate():
    assert _classify_pair(0.95, [0.1, 0.1, 0.8]) == "duplicate"

def test_contradiction():
    probs = _softmax([2.0, -1.0, 0.0])   # high contradiction logit
    assert _classify_pair(0.6, probs) == "contradicts"

def test_supports():
    probs = _softmax([-1.0, 2.5, 0.0])   # high entailment logit
    assert _classify_pair(0.65, probs) == "supports"

def test_related():
    probs = _softmax([0.0, 0.0, 2.0])    # neutral
    assert _classify_pair(0.55, probs) == "related"

def test_below_floor():
    assert _classify_pair(0.30, [0.33, 0.33, 0.34]) is None

if __name__ == "__main__":
    tests = [test_duplicate, test_contradiction, test_supports, test_related, test_below_floor]
    for t in tests:
        t()
        print(f"  ✓ {t.__name__}")
    print("All smoke tests passed.")
```

- [ ] **Step 4: Run smoke tests**
```bash
py -3.12 tests/test_relations_smoke.py
```
Expected:
```
  ✓ test_duplicate
  ✓ test_contradiction
  ✓ test_supports
  ✓ test_related
  ✓ test_below_floor
All smoke tests passed.
```

- [ ] **Step 5: Commit**
```bash
git add backend/ai/relations.py tests/test_relations_smoke.py
git commit -m "feat: add NLI-based connection detection pipeline"
```

---

### Task 3: Wire auto-detection into ingest + add retroactive endpoint

**Files:**
- Modify: `backend/api/items.py`
- Modify: `backend/api/connections.py`

- [ ] **Step 1: Call `detect_connections` at the end of `_save_item`**

In `backend/api/items.py`, at the end of `_save_item`, after `db.commit()` and `vectors.upsert_chunks(...)`:

```python
    # Auto-detect connections to existing brain items
    try:
        from backend.ai.relations import detect_connections
        from backend.store.db import Connection as ConnectionModel
        found = detect_connections(item.id, result.content, db)
        for c in found:
            db.add(ConnectionModel(
                source_item_id=c["source_item_id"],
                target_item_id=c["target_item_id"],
                type=c["type"],
                auto_generated=True,
            ))
        if found:
            db.commit()
    except Exception:
        logger.exception("[auto_connections] failed for item %s — skipping", item.id)

    return _serialize(item)
```

The broad `except` ensures a failure in connection detection never breaks ingest.

- [ ] **Step 2: Add `POST /api/connections/auto-generate` retroactive endpoint**

In `backend/api/connections.py`:

```python
@router.post("/auto-generate", status_code=200)
def auto_generate_connections(db: Session = Depends(get_db)):
    """
    Retroactively detect auto-generated connections across all items.
    Destructive: clears all existing auto-generated connections first,
    then re-runs detection for every item in the brain.
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
                    source_item_id=c["source_item_id"],
                    target_item_id=c["target_item_id"],
                    type=c["type"],
                    auto_generated=True,
                ))
            if found:
                db.commit()
                total_created += len(found)
        except Exception:
            import logging
            logging.getLogger(__name__).exception(
                "[auto_generate] failed for item %s — skipping", item.id
            )

    return {"connections_created": total_created}
```

- [ ] **Step 3: Test ingest triggers auto-connections**

Ingest a URL you know relates to something already in your brain. Check:
```bash
curl http://localhost:8000/api/connections
```
Expected: new auto-generated connections appear with `"auto_generated": true`.

- [ ] **Step 4: Commit**
```bash
git add backend/api/items.py backend/api/connections.py
git commit -m "feat: trigger auto-connection detection on ingest and add retroactive endpoint"
```

---

## Chunk 2: Frontend — New Types, Edge Styling, and Retroactive Trigger

### Task 4: Add new connection types to frontend config

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/connectionConfig.ts`

- [ ] **Step 1: Add `supports` and `duplicate` to `ConnectionType` in `types.ts`**

```typescript
export type ConnectionType = 'related' | 'source' | 'inspired_by' | 'contradicts' | 'supports' | 'duplicate'

export interface Connection {
  id: number
  source_item_id: string
  target_item_id: string
  type: ConnectionType
  auto_generated: boolean
  created_at: string
}
```

- [ ] **Step 2: Add new types to `connectionConfig.ts`**

```typescript
export const CONNECTION_TYPES: ConnectionType[] = [
  'related',
  'source',
  'inspired_by',
  'contradicts',
  'supports',
  'duplicate',
]

export const CONNECTION_TYPE_CONFIG: Record<ConnectionType, ConnectionTypeConfig> = {
  related:     { label: 'Related',     color: '#60a5fa' },
  source:      { label: 'Source',      color: '#34d399' },
  inspired_by: { label: 'Inspired by', color: '#f59e0b' },
  contradicts: { label: 'Contradicts', color: '#f87171' },
  supports:    { label: 'Supports',    color: '#a78bfa' },
  duplicate:   { label: 'Duplicate',   color: '#94a3b8' },
}
```

- [ ] **Step 3: Commit**
```bash
git add frontend/src/types.ts frontend/src/connectionConfig.ts
git commit -m "feat: add supports and duplicate connection types to frontend config"
```

---

### Task 5: Visual distinction for auto-generated edges

Auto-generated edges render dashed with reduced opacity to distinguish them from manually created connections. On hover, the label says "auto" and offers a dismiss action.

**Files:**
- Modify: `frontend/src/canvas/edges/ManualEdge.tsx`
- Modify: `frontend/src/canvas/Board.tsx`

- [ ] **Step 1: Pass `auto_generated` through Board edge data**

In `Board.tsx`, find where manual edges are constructed from the connections API response (look for `type: 'manual'` edge creation). Ensure `auto_generated` is passed into `data`:

```typescript
// In the connections-loading useEffect, where edges are built:
{
  id: `manual-${c.id}`,
  source: `source-${c.source_item_id}`,
  target: `source-${c.target_item_id}`,
  type: 'manual',
  data: { conn_id: c.id, type: c.type, auto_generated: c.auto_generated },
}
```

- [ ] **Step 2: Update `ManualEdge` to render differently for auto-generated edges**

In `ManualEdge.tsx`, read `auto_generated` from `data` and apply a dashed stroke + dimmed opacity:

```typescript
const autoGenerated = data?.auto_generated as boolean ?? false

// In the visible path:
<path
  d={edgePath}
  stroke={color}
  strokeOpacity={autoGenerated ? 0.45 : 0.75}
  strokeWidth={autoGenerated ? 1.5 : 2}
  strokeDasharray={autoGenerated ? "5 3" : undefined}
  fill="none"
/>
```

Also update the type badge to append "(auto)" when auto-generated:
```typescript
<span ...>
  {cfg.label}{autoGenerated ? ' (auto)' : ''}
</span>
```

- [ ] **Step 3: Verify visually**

Load the canvas. Auto-generated edges should appear dashed and slightly dimmer than manual ones.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/canvas/edges/ManualEdge.tsx frontend/src/canvas/Board.tsx
git commit -m "feat: render auto-generated edges as dashed with reduced opacity"
```

---

### Task 6: Retroactive auto-generate button

A "Re-generate connections" button in the Settings modal with a confirmation step (destructive action).

**Files:**
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/components/SettingsModal.tsx` (or wherever settings live — check the file)

- [ ] **Step 1: Add API call to `api.ts`**

```typescript
export async function autoGenerateConnections(): Promise<{ connections_created: number }> {
  const res = await fetch('/api/connections/auto-generate', { method: 'POST' })
  if (!res.ok) throw new Error('Auto-generate failed')
  return res.json()
}
```

- [ ] **Step 2: Locate the settings modal**

Check `frontend/src/components/SettingsModal.tsx` (or search for the settings entry point). Add a "Brain Connections" section.

- [ ] **Step 3: Add the button with confirmation**

```typescript
const [confirmOpen, setConfirmOpen] = useState(false)
const [generating, setGenerating] = useState(false)
const [result, setResult] = useState<number | null>(null)

async function handleAutoGenerate() {
  setGenerating(true)
  setConfirmOpen(false)
  try {
    const r = await autoGenerateConnections()
    setResult(r.connections_created)
  } finally {
    setGenerating(false)
  }
}

// In the JSX — add a section:
<div className="...">
  <h3 className="...">Brain Connections</h3>
  <p className="text-xs text-slate-400 mb-3">
    Automatically detect related, supporting, contradicting, and duplicate connections
    across all items in your brain using semantic similarity.
  </p>

  {!confirmOpen && (
    <button
      onClick={() => setConfirmOpen(true)}
      disabled={generating}
      className="... text-amber-400 border-amber-500/30 ..."
    >
      {generating ? 'Generating…' : 'Re-generate all connections'}
    </button>
  )}

  {confirmOpen && (
    <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-3 text-xs">
      <p className="text-amber-300 mb-2">
        This will delete all auto-generated connections and rebuild them from scratch.
        Manually created connections are unaffected.
      </p>
      <div className="flex gap-2">
        <button onClick={handleAutoGenerate} className="... text-amber-400 ...">
          Confirm
        </button>
        <button onClick={() => setConfirmOpen(false)} className="... text-slate-400 ...">
          Cancel
        </button>
      </div>
    </div>
  )}

  {result !== null && (
    <p className="text-xs text-green-400 mt-2">
      Done — {result} connection{result !== 1 ? 's' : ''} created.
    </p>
  )}
</div>
```

- [ ] **Step 4: Test the full flow**

1. Open Settings → trigger "Re-generate all connections"
2. Confirm the modal appears
3. After completion, verify auto-generated edges appear on the canvas
4. Verify `GET /api/connections` shows the new connections with `auto_generated: true`

- [ ] **Step 5: Commit**
```bash
git add frontend/src/api.ts frontend/src/components/SettingsModal.tsx
git commit -m "feat: add retroactive auto-generate connections button to settings"
```

---

---

## Chunk 3: Bundle NLI Model into Installer

### Task 7: Bundle `cross-encoder/nli-deberta-v3-xsmall` with the installer

Same pattern as SEC-18 (embedding model bundling) — save the model to a local directory during build, ship it with the installer, point the app at it via an env var.

**Files:**
- Modify: `installer/build.bat`
- Modify: `installer/SecondBrain.iss`
- Modify: `installer/launcher.py`
- Modify: `backend/ai/relations.py`

- [ ] **Step 1: Download and save the NLI model during build**

In `installer/build.bat`, after the existing embedding model download step (or add both together), add:

```bat
echo Downloading NLI model...
%PYTHON% -c "from sentence_transformers import CrossEncoder; m = CrossEncoder('cross-encoder/nli-deberta-v3-xsmall'); m.save('installer\\models\\nli-deberta-v3-xsmall')"
```

- [ ] **Step 2: Add model files to the Inno Setup script**

In `installer/SecondBrain.iss`, add alongside the embedding model entry:

```
Source: "installer\models\nli-deberta-v3-xsmall\*"; DestDir: "{app}\models\nli-deberta-v3-xsmall"; Flags: ignoreversion recursesubdirs
```

- [ ] **Step 3: Set `NLI_MODEL_PATH` env var in launcher**

In `installer/launcher.py`, in the section where env vars are set before spawning the backend (alongside `EMBED_MODEL_PATH`):

```python
env["NLI_MODEL_PATH"] = str(app_dir / "models" / "nli-deberta-v3-xsmall")
```

- [ ] **Step 4: Use `NLI_MODEL_PATH` in `relations.py`**

Update `_get_nli_model()` to check the env var first:

```python
def _get_nli_model():
    global _nli_model
    if _nli_model is None:
        from sentence_transformers import CrossEncoder
        import os
        model_path = os.environ.get("NLI_MODEL_PATH") or NLI_MODEL_NAME
        logger.info("[relations] loading NLI model from %s", model_path)
        _nli_model = CrossEncoder(model_path)
    return _nli_model
```

- [ ] **Step 5: Verify dev mode still works**

Without `NLI_MODEL_PATH` set, the model should download from HuggingFace as normal. Start the backend and ingest an item — confirm no errors.

- [ ] **Step 6: Commit**
```bash
git add installer/build.bat installer/SecondBrain.iss installer/launcher.py backend/ai/relations.py
git commit -m "feat: bundle NLI model into installer for offline use"
```

---

## Notes for Future Work

**Job queue integration (when the queue is built):**
- `detect_connections` is a self-contained function. Move it to a job handler: `{ type: "auto_connect", item_id, item_content }`.
- Job results can surface discovered connections in a "discoveries" panel for soft review.
- The `auto_generated` flag is already in place for this.

**Threshold tuning:**
- The thresholds in `relations.py` (`CONTRADICTION_THRESHOLD`, `SUPPORT_THRESHOLD`, etc.) are starting points. Monitor false positives in real use and adjust. Making them constants at the top of the file makes this easy.

**`inspired_by` auto-detection:**
- Left as manual-only for now. Could be added later by detecting when one item explicitly references or builds on another (URL citation detection, or a more nuanced AI prompt).
