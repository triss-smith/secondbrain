# Node Placement Fix + Similarity Threshold Setting — Design

**Goal:** Fix same-category node placement so new nodes land next to related items, and add a user-configurable similarity threshold that controls which canvas edges are drawn.

**Architecture:** Two independent fixes. Placement is pure frontend (fix a formula in `computePlacement`). Threshold is a full-stack setting — stored in `data/config.json`, exposed via the existing settings API, controlled via a slider in `SettingsModal`, and consumed in `Board.tsx`'s auto-edge effect.

**Tech Stack:** React + TypeScript (frontend), FastAPI + Python (backend), existing settings infrastructure

---

## Problem 1: Broken same-category placement

`computePlacement` in `Board.tsx` computes the centroid of same-category nodes then adds `(sourceNodes.length % 3) * (NODE_W + PAD)` as extra offset. For a second node this evaluates to 350px of extra offset on top of the centroid, placing same-category nodes far apart.

**Fix:** When same-category nodes exist, find the rightmost one and place the new node directly to its right (`x + NODE_W + PAD`). When the row has reached 4 nodes (`NODES_PER_ROW`), wrap to a new row below the group (`y + NODE_H + GAP_Y`). Falls back to the existing centroid logic when no same-category nodes exist yet.

## Problem 2: Hardcoded edge threshold too high

The auto-edge `useEffect` in `Board.tsx` calls `getItemSimilarities(itemIds)` with the default threshold of `0.55`. Two different recipes (e.g., potato soup vs. Korean beef rice bowl) may score 0.35–0.5 with sentence-transformers, so no edge is drawn.

**Fix:** Add `similarity_threshold: float = 0.3` as a persisted user setting. Read it in `Board.tsx` on mount and on `settings-changed` events; pass it to `getItemSimilarities`. Expose a slider (0.1–0.9, step 0.05) in `SettingsModal` under the Canvas section.

---

## Files to change

| File | Change |
|------|--------|
| `backend/store/settings.py` | Add `similarity_threshold: float = 0.3` to `AISettings`; update `_load()` and `save()` |
| `backend/api/settings.py` | Add to GET response; add to `SaveSettingsRequest`; validate 0.0–1.0 in PUT |
| `frontend/src/api.ts` | Add `similarity_threshold: number` to `SettingsResponse` |
| `frontend/src/components/SettingsModal.tsx` | Add threshold slider in Canvas section; include in save/settings-changed payload |
| `frontend/src/canvas/Board.tsx` | Fix `computePlacement`; add `thresholdRef` + read settings; pass to `getItemSimilarities` |

No new files, no new API routes, no new edge types.
