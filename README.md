# Second Brain

A local, self-hosted knowledge base with an infinite canvas interface. Save anything — YouTube videos, TikToks, articles, PDFs, podcasts, GitHub repos — then chat with your knowledge using AI.

![Stack](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)
![Stack](https://img.shields.io/badge/Frontend-React%20%2B%20React%20Flow-61DAFB?style=flat-square&logo=react)
![Stack](https://img.shields.io/badge/AI-MiniMax-7c6af7?style=flat-square)
![Stack](https://img.shields.io/badge/Storage-SQLite%20%2B%20ChromaDB-003B57?style=flat-square)

---

## Features

- **Infinite Canvas** — drag, arrange, and connect knowledge nodes on a spatial board powered by React Flow
- **Multi-source Ingestion** — paste a URL or upload a file; the app handles the rest
- **AI Chat** — ask questions across your entire knowledge base or scoped to specific items, with streaming responses
- **Semantic Search** — find content by meaning, not just keywords
- **Auto-tagging & Summaries** — every item is automatically tagged and summarised on ingest
- **Mind Map** — auto-generated graph of semantically related items
- **Saved Pages** — convert any chat conversation into a persistent note on the canvas
- **Fully Local** — your data never leaves your machine (except AI API calls)
- **Mobile Accessible** — runs on your local network, accessible from any device on the same Wi-Fi

---

## Supported Content Types

| Type | How |
|---|---|
| YouTube | Transcript via `youtube-transcript-api` + metadata via `yt-dlp` |
| TikTok | Captions + metadata via `yt-dlp` |
| Instagram Reels | Caption + metadata via `yt-dlp` |
| Podcasts | Audio download + local Whisper transcription |
| Articles / Web pages | Clean text extraction via `trafilatura` |
| PDFs | Text extraction via `PyMuPDF` |
| GitHub Repositories | Clones repo, indexes README + source files |
| Google Docs | Google Drive API (requires one-time OAuth setup) |
| LinkedIn Posts | Paste content directly (scraping blocked by LinkedIn) |
| Plain Notes | Type or paste any text |

---

## Tech Stack

```
Backend          Python · FastAPI · SQLAlchemy · SQLite
Vector Store     ChromaDB
Embeddings       sentence-transformers (all-MiniLM-L6-v2, runs locally)
AI               MiniMax API (chat completions + streaming)
Frontend         React 18 · TypeScript · Vite · Tailwind CSS
Canvas           React Flow
Transcription    OpenAI Whisper (local)
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- [ffmpeg](https://ffmpeg.org/download.html) (required for podcast audio)
- A [MiniMax API key](https://www.minimaxi.com)

### 1. Clone & configure

```bash
git clone https://github.com/triss-smith/mysecondbrain.git
cd mysecondbrain

cp .env.example .env
# Open .env and add your MINIMAX_API_KEY
```

### 2. Install dependencies

```bash
# Backend
pip install -r requirements.txt

# Frontend
cd frontend && npm install && cd ..
```

### 3. Run

**Windows:**
```
start.bat
```

**Manual (two terminals):**
```bash
# Terminal 1 — backend
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open `http://localhost:5173` in your browser.

**From your phone:** find your machine's local IP (`ipconfig` on Windows, `ifconfig` on Mac/Linux) and open `http://192.168.x.x:5173`.

---

## Docker

```bash
cp .env.example .env   # add your MINIMAX_API_KEY

docker-compose up
```

Frontend → `http://localhost:5173`
Backend API → `http://localhost:8000`

---

## Project Structure

```
second-brain/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Settings (reads .env)
│   ├── api/
│   │   ├── items.py         # Ingest + CRUD for knowledge items
│   │   ├── boards.py        # Canvas board + pages CRUD, mind map
│   │   ├── chat.py          # WebSocket streaming chat
│   │   └── search.py        # Semantic search
│   ├── ai/
│   │   ├── embed.py         # Local sentence-transformers embeddings
│   │   ├── minimax.py       # MiniMax API client (chat + streaming)
│   │   ├── query.py         # RAG pipeline
│   │   └── mindmap.py       # Cosine similarity graph
│   ├── ingest/
│   │   ├── base.py          # URL type detection + routing
│   │   ├── youtube.py
│   │   ├── tiktok.py
│   │   ├── instagram.py
│   │   ├── podcast.py       # yt-dlp + Whisper
│   │   ├── article.py       # trafilatura
│   │   ├── pdf.py           # PyMuPDF
│   │   ├── github.py        # git clone + file indexing
│   │   ├── gdocs.py         # Google Drive API
│   │   └── linkedin.py      # Paste-based
│   └── store/
│       ├── db.py            # SQLite models (Items, Chunks, Boards, Pages)
│       └── vectors.py       # ChromaDB operations
│
├── frontend/
│   └── src/
│       ├── App.tsx          # Root layout
│       ├── api.ts           # All API calls
│       ├── types.ts         # Shared TypeScript types
│       ├── canvas/
│       │   ├── Board.tsx    # React Flow infinite canvas
│       │   ├── Toolbar.tsx  # Canvas action buttons
│       │   ├── nodes/       # SourceNode, ChatNode, PageNode, MindMapNode
│       │   └── edges/       # SemanticEdge
│       ├── sidebar/
│       │   ├── Library.tsx  # Searchable item list
│       │   └── CaptureBar.tsx  # URL / note / file input
│       └── hooks/
│           ├── useChat.ts   # WebSocket chat state
│           ├── useIngest.ts # Ingest submission + status
│           └── useBoard.ts  # Board load/save
│
├── .env.example
├── requirements.txt
├── docker-compose.yml
└── start.bat
```

---

## How It Works

```
1. You paste a URL or upload a file
         ↓
2. Backend detects content type → routes to correct ingestor
         ↓
3. Content extracted (transcript, article text, PDF pages, etc.)
         ↓
4. MiniMax generates tags + summary
   sentence-transformers embeds chunked text → stored in ChromaDB
   Metadata saved to SQLite
         ↓
5. Source node appears in your Library sidebar
   Drag it onto the infinite canvas
         ↓
6. Open a Chat node, pin source nodes to it
         ↓
7. Ask a question → top-K relevant chunks retrieved from ChromaDB
   → MiniMax synthesises a grounded answer, streamed back live
         ↓
8. Save the conversation as a Page node on the canvas
```

---

## Canvas Node Types

| Node | Description |
|---|---|
| **Source** | A saved knowledge item — shows thumbnail, type, tags, summary |
| **Chat** | Floating chat window; pin sources to scope the AI's knowledge |
| **Page** | Editable text note; auto-created from saved chat conversations |
| **Mind Map** | SVG graph of all items connected by semantic similarity |

---

## Google Docs Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the **Google Docs API** and **Google Drive API**
3. Create OAuth 2.0 credentials (Desktop app)
4. Download the credentials JSON to `data/google_credentials.json`
5. On first use, visit `/api/auth/google` to complete the OAuth flow — this saves a token to `data/google_token.json`

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MINIMAX_API_KEY` | Yes | — | MiniMax API key |
| `MINIMAX_BASE_URL` | No | `https://api.minimax.chat/v1` | MiniMax base URL |
| `MINIMAX_MODEL` | No | `MiniMax-Text-01` | Model to use |
| `EMBED_MODEL` | No | `all-MiniLM-L6-v2` | sentence-transformers model |
| `DB_PATH` | No | `data/brain.db` | SQLite database path |
| `CHROMA_PATH` | No | `data/chroma` | ChromaDB storage path |
| `UPLOADS_PATH` | No | `data/uploads` | Uploaded file storage |
| `HOST` | No | `0.0.0.0` | Backend bind host |
| `PORT` | No | `8000` | Backend port |
| `GOOGLE_CLIENT_ID` | No | — | For Google Docs ingestion |
| `GOOGLE_CLIENT_SECRET` | No | — | For Google Docs ingestion |

---

## Notes

- **First run**: the embedding model (~90 MB) downloads automatically and is cached locally
- **Whisper**: the `base` model (~150 MB) downloads on first podcast ingest
- **Data privacy**: all embeddings and storage are local; only the text sent to MiniMax for chat/tagging leaves your machine
- **LinkedIn**: automated ingestion is not possible due to anti-scraping measures — paste post content directly as a note
