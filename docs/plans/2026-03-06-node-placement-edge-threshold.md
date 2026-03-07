# Node Placement Fix + Similarity Threshold Setting — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix same-category node placement so new canvas nodes land next to related items, and add a user-configurable similarity threshold that controls which edges are drawn between nodes.

**Architecture:** Two independent changes. (1) Fix a broken placement formula in `computePlacement` in `Board.tsx`. (2) Add `similarity_threshold` as a persisted setting through the full stack: `backend/store/settings.py` → `backend/api/settings.py` → `frontend/src/api.ts` → `SettingsModal.tsx` → consumed in `Board.tsx`'s auto-edge `useEffect`. Uses the same patterns already established by `organize_mode`.

**Tech Stack:** FastAPI + Python (backend), React + TypeScript + ReactFlow (frontend), existing settings infrastructure

---

### Task 1: Add `similarity_threshold` to backend settings store

**Files:**
- Modify: `backend/store/settings.py`

**Context:**
`AISettings` is a frozen dataclass. `_load()` reads from `data/config.json`. `save()` writes atomically via a `.tmp` file. Follow the exact same pattern used for `organize_mode`.

**Step 1: Update `AISettings` dataclass**

In `backend/store/settings.py`, add `similarity_threshold` field after `organize_mode`:

```python
@dataclass(frozen=True)
class AISettings:
    provider: str
    model: str
    api_key: str
    organize_mode: str = "category"
    similarity_threshold: float = 0.3
```

**Step 2: Update `_load()` to read the new field**

In `_load()`, add `similarity_threshold` to both the `CONFIG_PATH` branch and the fallback branch:

```python
def _load(self) -> AISettings:
    if CONFIG_PATH.exists():
        try:
            data = json.loads(CONFIG_PATH.read_text())
            return AISettings(
                provider=data.get("provider", "minimax"),
                model=data.get("model", "MiniMax-M2.5"),
                api_key=data.get("api_key", ""),
                organize_mode=data.get("organize_mode", "category"),
                similarity_threshold=float(data.get("similarity_threshold", 0.3)),
            )
        except Exception as exc:
            logger.warning("Failed to load %s, falling back to env defaults: %s", CONFIG_PATH, exc)
    return AISettings(
        provider="minimax",
        model=os.getenv("MINIMAX_MODEL", "MiniMax-M2.5"),
        api_key=os.getenv("MINIMAX_API_KEY", ""),
    )
```

**Step 3: Update `save()` signature and body**

```python
def save(self, provider: str, model: str, api_key: str, organize_mode: str = "category", similarity_threshold: float = 0.3) -> None:
    if provider not in PROVIDERS:
        raise ValueError(f"Unknown provider '{provider}'. Valid: {list(PROVIDERS)}")
    if organize_mode not in ("category", "similarity"):
        raise ValueError(f"Invalid organize_mode '{organize_mode}'. Must be 'category' or 'similarity'.")
    if not (0.0 <= similarity_threshold <= 1.0):
        raise ValueError(f"similarity_threshold must be between 0.0 and 1.0, got {similarity_threshold}")
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    if CONFIG_PATH.exists():
        shutil.copy2(CONFIG_PATH, BACKUP_PATH)
    tmp = CONFIG_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps({
        "provider": provider,
        "model": model,
        "api_key": api_key,
        "organize_mode": organize_mode,
        "similarity_threshold": similarity_threshold,
    }, indent=2))
    tmp.replace(CONFIG_PATH)
    self._settings = AISettings(
        provider=provider,
        model=model,
        api_key=api_key,
        organize_mode=organize_mode,
        similarity_threshold=similarity_threshold,
    )
```

**Step 4: Verify manually**

Start the Python REPL in the project root:
```bash
python -c "
from backend.store.settings import settings_manager
s = settings_manager.get()
print('threshold:', s.similarity_threshold)
settings_manager.save(s.provider, s.model, s.api_key, s.organize_mode, 0.4)
print('saved 0.4:', settings_manager.get().similarity_threshold)
settings_manager.save(s.provider, s.model, s.api_key, s.organize_mode, 0.3)
"
```
Expected output:
```
threshold: 0.3
saved 0.4: 0.4
```

**Step 5: Commit**
```bash
git add backend/store/settings.py
git commit -m "feat: add similarity_threshold to settings store"
```

---

### Task 2: Expose `similarity_threshold` in the settings API

**Files:**
- Modify: `backend/api/settings.py`

**Context:**
`SaveSettingsRequest` is a Pydantic model. The GET handler returns a dict from `settings_manager.get()`. The PUT handler validates fields then calls `settings_manager.save()`. Follow the exact same pattern used for `organize_mode`.

**Step 1: Update `SaveSettingsRequest`**

Add `similarity_threshold` after `organize_mode`:

```python
class SaveSettingsRequest(BaseModel):
    provider: str
    model: str
    api_key: str
    organize_mode: str = "category"
    similarity_threshold: float = 0.3
```

**Step 2: Update GET handler to return `similarity_threshold`**

```python
@router.get("")
def get_settings():
    s = settings_manager.get()
    return {
        "provider": s.provider,
        "model": s.model,
        "api_key_set": bool(s.api_key),
        "organize_mode": s.organize_mode,
        "similarity_threshold": s.similarity_threshold,
        "providers": PROVIDERS,
    }
```

**Step 3: Update PUT handler to validate and save `similarity_threshold`**

```python
@router.put("")
def save_settings(req: SaveSettingsRequest):
    if req.provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {req.provider}")
    valid_models = PROVIDERS[req.provider]["models"]
    if req.model not in valid_models:
        raise HTTPException(status_code=400, detail=f"Invalid model '{req.model}' for provider '{req.provider}'. Valid: {valid_models}")
    if req.organize_mode not in ("category", "similarity"):
        raise HTTPException(status_code=400, detail="organize_mode must be 'category' or 'similarity'")
    if not (0.0 <= req.similarity_threshold <= 1.0):
        raise HTTPException(status_code=400, detail="similarity_threshold must be between 0.0 and 1.0")
    api_key = req.api_key if req.api_key else settings_manager.get().api_key
    settings_manager.save(req.provider, req.model, api_key, req.organize_mode, req.similarity_threshold)
    s = settings_manager.get()
    return {
        "provider": s.provider,
        "model": s.model,
        "api_key_set": bool(s.api_key),
        "organize_mode": s.organize_mode,
        "similarity_threshold": s.similarity_threshold,
    }
```

**Step 4: Verify manually**

With the backend running (`uvicorn backend.main:app --reload`):
```bash
curl http://localhost:8000/api/settings
```
Expected: JSON with `"similarity_threshold": 0.3`

```bash
curl -X PUT http://localhost:8000/api/settings \
  -H "Content-Type: application/json" \
  -d '{"provider":"minimax","model":"MiniMax-M2.5","api_key":"","organize_mode":"category","similarity_threshold":0.45}'
```
Expected: JSON with `"similarity_threshold": 0.45`

**Step 5: Commit**
```bash
git add backend/api/settings.py
git commit -m "feat: expose similarity_threshold in settings API"
```

---

### Task 3: Add `similarity_threshold` to frontend API type and SettingsModal

**Files:**
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/components/SettingsModal.tsx`

**Context:**
`SettingsResponse` in `api.ts` is the TypeScript type for the GET `/api/settings` response. `SettingsModal.tsx` already has an `organizeMode` state + toggle UI. The slider goes in the same Canvas section, below the Node placement toggle. On save, fire `settings-changed` with `{ organize_mode, similarity_threshold }` so `Board.tsx` can react.

**Step 1: Add `similarity_threshold` to `SettingsResponse` in `api.ts`**

In `frontend/src/api.ts`, update `SettingsResponse`:

```typescript
export interface SettingsResponse {
  provider: string
  model: string
  api_key_set: boolean
  organize_mode: string
  similarity_threshold: number
  providers: Record<string, ProviderInfo>
}
```

Also update `saveSettings` to include `similarity_threshold`:

```typescript
export const saveSettings = (data: { provider: string; model: string; api_key: string; organize_mode: string; similarity_threshold: number }) =>
  api.put<{ provider: string; model: string; api_key_set: boolean; organize_mode: string; similarity_threshold: number }>('/settings', data).then(r => r.data)
```

**Step 2: Add `similarityThreshold` state to `SettingsModal.tsx`**

Add state after the existing `organizeMode` state:

```typescript
const [similarityThreshold, setSimilarityThreshold] = useState(0.3)
```

In the `useEffect` that loads settings, set it:

```typescript
useEffect(() => {
  getSettings().then(d => {
    setData(d)
    setProvider(d.provider)
    setModel(d.model)
    setOrganizeMode(d.organize_mode)
    setSimilarityThreshold(d.similarity_threshold)
  })
}, [])
```

**Step 3: Add the slider UI in the Canvas section**

After the closing `</div>` of the "Node placement" block (after the `<p>` description), add:

```tsx
<div>
  <label className="block text-xs font-medium text-slate-400 mb-1.5">
    Connection threshold
    <span className="ml-2 text-slate-500 font-normal">{similarityThreshold.toFixed(2)}</span>
  </label>
  <input
    type="range"
    min={0.1}
    max={0.9}
    step={0.05}
    value={similarityThreshold}
    onChange={e => setSimilarityThreshold(parseFloat(e.target.value))}
    className="w-full accent-accent"
  />
  <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
    <span>More connections</span>
    <span>Fewer connections</span>
  </div>
</div>
```

**Step 4: Update `handleTest` and `handleSave` to include `similarity_threshold`**

`handleTest`:
```typescript
await saveSettings({ provider, model, api_key: apiKey, organize_mode: organizeMode, similarity_threshold: similarityThreshold })
```

`handleSave`:
```typescript
await saveSettings({ provider, model, api_key: apiKey, organize_mode: organizeMode, similarity_threshold: similarityThreshold })
window.dispatchEvent(new CustomEvent('settings-changed', { detail: { organize_mode: organizeMode, similarity_threshold: similarityThreshold } }))
```

**Step 5: Verify manually**

Open the app, go to Settings. The Canvas section should show:
- "Node placement" toggle (category / similarity)
- "Connection threshold" slider showing "0.30", draggable from 0.10 to 0.90
- Moving the slider updates the displayed value live
- Saving persists the value (reopen Settings and the slider is at the saved position)

**Step 6: Commit**
```bash
git add frontend/src/api.ts frontend/src/components/SettingsModal.tsx
git commit -m "feat: add similarity_threshold slider to settings UI"
```

---

### Task 4: Fix `computePlacement` in `Board.tsx`

**Files:**
- Modify: `frontend/src/canvas/Board.tsx` (lines 208–253)

**Context:**
The current formula for same-category placement adds a huge extra offset (`(sourceNodes.length % 3) * (NODE_W + PAD)`) that places new same-category nodes far away. The fix: place the new node to the right of the rightmost same-category node, wrapping to a new row after `NODES_PER_ROW` (4) nodes in that category.

**Step 1: Replace the `computePlacement` function body**

The constants at the top stay the same. Replace the category placement block (the section after the similarity block, from `// Category placement` to the end of the function):

```typescript
async function computePlacement(
  item: Item,
  sourceNodes: Node[],
  mode: string
): Promise<{ x: number; y: number }> {
  const NODE_W = 300
  const NODE_H = 220
  const PAD = 50

  if (sourceNodes.length === 0) {
    return { x: 200, y: 200 }
  }

  if (mode === 'similarity' && sourceNodes.length >= 1) {
    try {
      const existingIds = sourceNodes.map(n => (n.data as SourceNodeData).item.id)
      const pairs = await getItemSimilarities([item.id, ...existingIds], 0)
      const relevant = pairs.filter(p => p.source === item.id || p.target === item.id)
      if (relevant.length > 0) {
        const best = relevant.reduce((a, b) => a.similarity > b.similarity ? a : b)
        const neighborItemId = best.source === item.id ? best.target : best.source
        const neighborNode = sourceNodes.find(
          n => (n.data as SourceNodeData).item.id === neighborItemId
        )
        if (neighborNode) {
          return { x: neighborNode.position.x + NODE_W + PAD, y: neighborNode.position.y }
        }
      }
    } catch {
      // fall through to category placement
    }
  }

  // Category placement: place next to the rightmost same-category node,
  // wrapping to a new row after NODES_PER_ROW nodes in the group.
  const NODES_PER_ROW = 4
  const category = item.category ?? ''
  const sameCategory = category
    ? sourceNodes.filter(n => (n.data as SourceNodeData).item.category === category)
    : []

  if (sameCategory.length > 0) {
    // Sort by x position to find placement position in grid
    const sorted = [...sameCategory].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)
    const col = sameCategory.length % NODES_PER_ROW
    const row = Math.floor(sameCategory.length / NODES_PER_ROW)
    // Anchor to top-left of the group
    const minX = Math.min(...sameCategory.map(n => n.position.x))
    const minY = Math.min(...sameCategory.map(n => n.position.y))
    // Suppress unused variable warning
    void sorted
    return {
      x: minX + col * (NODE_W + PAD),
      y: minY + row * (NODE_H + PAD),
    }
  }

  // No same-category nodes: place to the right of all existing nodes
  const maxX = Math.max(...sourceNodes.map(n => n.position.x))
  return { x: maxX + NODE_W + PAD, y: 200 }
}
```

**Step 2: Verify manually**

1. Clear the canvas (remove all nodes)
2. Add a Cooking item → it should land at `{x: 200, y: 200}`
3. Add a second Cooking item → it should land at `{x: 550, y: 200}` (200 + 300 + 50), right next to the first
4. Add a third Cooking item → `{x: 900, y: 200}`
5. Add a fifth Cooking item → it should wrap to `{x: 200, y: 270}` (new row: minY + 1 * (220 + 50))
6. Add a Home Improvement item → should land to the right of all existing nodes

**Step 3: Commit**
```bash
git add frontend/src/canvas/Board.tsx
git commit -m "fix: place same-category nodes in a tight grid instead of scattered"
```

---

### Task 5: Consume `similarity_threshold` in `Board.tsx` auto-edge effect

**Files:**
- Modify: `frontend/src/canvas/Board.tsx`

**Context:**
`Board.tsx` already has `organizeModeRef` (a `useRef`) and a `useEffect` that reads `organize_mode` from `getSettings()` and listens for `settings-changed` events. The `similarity_threshold` follows the exact same pattern. The auto-edge `useEffect` (lines 166–188) calls `getItemSimilarities(itemIds)` with no threshold argument — change it to pass the ref value.

**Step 1: Add `thresholdRef` alongside `organizeModeRef`**

After the existing `organizeModeRef` declaration:
```typescript
const thresholdRef = useRef<number>(0.3)
```

**Step 2: Update the settings `useEffect` to also read and track `similarity_threshold`**

Replace the existing settings `useEffect` (lines 59–73):

```typescript
useEffect(() => {
  getSettings().then(s => {
    const mode = s.organize_mode as 'category' | 'similarity'
    organizeModeRef.current = mode
    setOrganizeLabel(mode)
    thresholdRef.current = s.similarity_threshold
  })

  function onSettingsChanged(e: Event) {
    const detail = (e as CustomEvent<{ organize_mode: string; similarity_threshold: number }>).detail
    const mode = detail.organize_mode as 'category' | 'similarity'
    organizeModeRef.current = mode
    setOrganizeLabel(mode)
    thresholdRef.current = detail.similarity_threshold
  }
  window.addEventListener('settings-changed', onSettingsChanged)
  return () => window.removeEventListener('settings-changed', onSettingsChanged)
}, [])
```

**Step 3: Pass `thresholdRef.current` to `getItemSimilarities` in the auto-edge `useEffect`**

Find the auto-edge `useEffect` (it calls `getItemSimilarities(itemIds)` with no second argument). Change that call:

```typescript
getItemSimilarities(itemIds, thresholdRef.current).then(pairs => {
```

**Step 4: Verify manually**

1. Add two Cooking recipe nodes to the canvas
2. They should now appear connected by a dashed purple line (threshold 0.3 is low enough for two recipe videos)
3. Open Settings → drag Connection threshold slider to 0.9 → Save
4. The edge between the recipes should disappear (they're below 0.9 similarity)
5. Drag slider back to 0.3 → Save → edge reappears

**Step 5: Commit**
```bash
git add frontend/src/canvas/Board.tsx
git commit -m "feat: use configurable similarity_threshold for canvas auto-edges"
```
