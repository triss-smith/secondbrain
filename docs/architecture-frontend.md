## Frontend architecture – SEC-5 refactor notes

### New UI primitives

- **Modals** (`frontend/src/components/ui/Modal.tsx`): `Modal`, `ModalHeader`, `ModalBody`, `ModalFooter` power `NoteModal`, `SettingsModal` and can be reused for any future overlays.
- **Buttons** (`frontend/src/components/ui/Button.tsx`): `Button` with `variant` (`primary`, `secondary`, `ghost`, `danger`) and `size` (`sm`, `md`, `icon`) replaces ad-hoc button Tailwind chains.
- **Inputs & toggles**:
  - `TextInput` in `components/ui/TextInput.tsx` for labeled inputs with error/helper text.
  - `Toggle` in `components/ui/Toggle.tsx` for pill-style boolean switches (used in Settings).

### Item presentation components

- `components/items/ItemBadge.tsx`: renders a content-type badge using `CONTENT_TYPE_*` helpers.
- `components/items/TagChip.tsx`: reusable tag pill with optional remove icon.
- `components/items/ItemCard.tsx`: shared card for items, used in:
  - `SourceNode` (type badge + tags via `ItemBadge` / `TagChip`).
  - `Library` (`LibraryItem` uses `ItemCard` with `compact` + `showThumbnail` + `categoryLabel`).
  - `ItemDetailModal` header uses `ItemBadge` for the type.

### Chat components

- `hooks/useChat.ts`: single hook for WebSocket chat (used by both global chat and canvas chat).
- `components/chat/ChatMessages.tsx`: shared rendering for chat bubbles, AI avatar, markdown, typing indicator, and error banner.
- `components/chat/ChatInput.tsx`: shared textarea + send button, handling Enter / Shift+Enter and loading state.
- These are consumed by:
  - `components/GlobalChat.tsx` (right-side panel).
  - `canvas/nodes/ChatNode.tsx` (in-canvas chat nodes and their expanded modal).

### Canvas nodes and edges

- `canvas/nodes/SourceNode.tsx`:
  - Uses `ItemBadge` + `TagChip` for type and tags.
  - Thumbnail now falls back gracefully to the icon if the image fails to load.
- `canvas/nodes/ChatNode.tsx`:
  - Uses shared `ChatMessages` / `ChatInput`.
  - Still emits the same custom events (`save-as-page`, `remove-chat-node`).
- `canvas/edges/ManualEdge.tsx` and `canvas/ConnectionTypePicker.tsx`:
  - Continue to own their connection-type color/label config locally; these can be centralized later if needed.

### Patterns for future work

- **Add a new modal**: create a component that composes `Modal` + `ModalHeader` + `ModalBody` + `ModalFooter` instead of rolling its own overlay.
- **Add a new item surface** (list, card, or node): start from `ItemCard`, `ItemBadge`, and `TagChip` for visual consistency.
- **Add another chat surface**: use `useChat`, `ChatMessages`, and `ChatInput`, and wrap them in a domain-specific shell (header, suggestions, etc.).

