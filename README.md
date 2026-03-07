<div align="center">

# Second Brain

**A self-hosted, AI-powered knowledge base with an infinite canvas interface.**

Save anything. Find anything. Think in connections.

[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Canvas](https://img.shields.io/badge/Canvas-React%20Flow-7c6af7?style=flat-square)](https://reactflow.dev)
[![Storage](https://img.shields.io/badge/Storage-SQLite%20%2B%20ChromaDB-003B57?style=flat-square)](https://www.trychroma.com)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](LICENSE)

</div>

---

## What is Second Brain?

Second Brain is a local knowledge management tool that lets you ingest content from anywhere — YouTube, TikTok, articles, PDFs, podcasts, GitHub repos — and interact with it through AI-powered chat, semantic search, and an infinite spatial canvas.

Everything runs on your machine. Your data stays yours.

---

## Features

### Knowledge Capture
- **10 content types** — paste a URL or upload a file; the right extractor runs automatically
- **TikTok & Instagram** — captions extracted via yt-dlp; falls back to Whisper transcription when captions aren't available
- **Podcast transcription** — local Whisper model, no cloud required
- **PDF, GitHub, Google Docs** — full text extraction and indexing

### AI-Powered Understanding
- **Auto-tagging & categorization** — every item is automatically tagged, categorized, and summarized on ingest
- **Resummarize** — refresh any item's summary and tags on demand
- **Multi-provider AI** — bring your own key for MiniMax, Anthropic, OpenAI, or Gemini; switch providers without restarting
- **Streaming chat** — ask questions across your entire knowledge base with real-time streamed answers
- **RAG pipeline** — responses grounded in your actual content via ChromaDB semantic retrieval

### Infinite Canvas
- **Spatial thinking** — drag source nodes, chat windows, and pages onto an infinite board
- **Automatic semantic edges** — canvas items connect to each other automatically based on embedding similarity; no manual linking required
- **Chat nodes** — floating chat windows you can pin to specific source nodes to scope the AI's context
- **Page nodes** — save any conversation as a persistent, editable note on the canvas

### Library & Navigation
- **Grouped library** — items organized into AI-generated categories, collapsed by default for a clean view
- **Semantic search** — find content by meaning, not just keywords
- **Inline tag editing** — add or remove tags on any item directly from the detail panel

### Settings & Configuration
- **In-app settings** — configure your AI provider, model, and API key from the UI; no `.env` editing required
- **Automatic backup** — settings are saved to `data/config.json` with automatic `.bak` backup before every write
- **Connection testing** — test your API credentials before saving

---

## Supported Content Types

| Type | Extraction Method |
|---|---|
| YouTube | Transcript via `youtube-transcript-api` · metadata via `yt-dlp` |
| TikTok | Captions via `yt-dlp` · Whisper audio fallback |
| Instagram Reels | Caption + metadata via `yt-dlp` |
| Podcasts | Audio download via `yt-dlp` · local Whisper transcription |
| Articles & Web Pages | Clean text extraction via `trafilatura` |
| PDFs | Text extraction via `PyMuPDF` |
| GitHub Repositories | Clones repo, indexes README + source files |
| Google Docs | Google Drive API (one-time OAuth setup) |
| LinkedIn Posts | Paste content directly (scraping blocked by LinkedIn) |
| Plain Notes | Type or paste any text |

---

## Supported AI Providers

Configure your preferred provider from the in-app settings panel. No restart required.

| Provider | Models | SDK |
|---|---|---|
| **MiniMax** | MiniMax-M2.5, MiniMax-M2.5-highspeed | Anthropic-compatible |
| **Anthropic** | claude-opus-4-6, claude-sonnet-4-6 | Anthropic SDK |
| **OpenAI** | gpt-4o, gpt-4o-mini | OpenAI-compatible |
| **Gemini** | gemini-2.0-flash, gemini-1.5-pro | OpenAI-compatible |

---

## Getting Started

### Prerequisites

| Requirement | Notes |
|---|---|
| Python 3.12 | Earlier versions untested |
| Node.js 18+ | For the frontend |
| ffmpeg | Required for podcast and TikTok audio transcription |
| An AI API key | Any supported provider — configure in-app after setup |

### 1. Clone & configure

```bash
git clone https://github.com/triss-smith/mysecondbrain.git
cd mysecondbrain

cp .env.example .env
```

`.env` is only needed for first-run fallback. Once you save settings in the UI, `data/config.json` takes over and `.env` is no longer read.

### 2. Install dependencies

```bash
# Backend
pip install -r requirements.txt

# Frontend
cd frontend && npm install && cd ..
```

### 3. Run

**Windows (recommended):**
```
start.bat
```

**Manual (two terminals):**
```bash
# Terminal 1 — backend
py -3.12 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open **http://localhost:5173** in your browser.

### 4. Configure your AI provider

Click the **⚙ gear icon** next to "Second Brain" in the sidebar. Select your provider, choose a model, paste your API key, and click **Test Connection** to verify — then **Save**.

> **First run:** the local embedding model (~90 MB) downloads automatically and is cached. Whisper (~150 MB) downloads on first podcast or TikTok ingest.

### Access from other devices

Find your machine's local IP (`ipconfig` on Windows, `ifconfig` on Mac/Linux) and open `http://192.168.x.x:5173` from any device on the same network.

---

## Docker

```bash
cp .env.example .env   # add a fallback API key if desired

docker-compose up
```

| Service | URL |
|---|---|
| App | http://localhost:5173 |
| Backend API | http://localhost:8000 |

---

## How It Works

```
1. Paste a URL or upload a file
         ↓
2. Backend detects content type → routes to the correct ingestor
   (yt-dlp, Whisper, trafilatura, PyMuPDF, gitpython, etc.)
         ↓
3. Raw content extracted (transcript, article text, PDF pages, etc.)
         ↓
4. AI generates tags, a category, and a summary
   sentence-transformers embeds chunked text → stored in ChromaDB
   Metadata + content saved to SQLite
         ↓
5. Item appears in the Library sidebar, grouped by category
   Drag it onto the infinite canvas as a Source node
         ↓
6. Semantic edges appear automatically between related Source nodes
         ↓
7. Open a Chat node, optionally pin Source nodes to scope context
         ↓
8. Ask a question → top-K chunks retrieved from ChromaDB
   → AI synthesises a grounded answer, streamed back live
         ↓
9. Save the conversation as a Page node on the canvas
```

---

## Canvas Node Types

| Node | Description |
|---|---|
| **Source** | A saved knowledge item — thumbnail, type badge, tags, summary, and a resummarize button |
| **Chat** | Floating chat window; pin Source nodes to scope the AI's knowledge to specific items |
| **Page** | Editable rich-text note; created automatically when you save a conversation |

Semantic edges between Source nodes are drawn automatically — no configuration needed. Edge weight reflects embedding similarity; unrelated items stay disconnected.

---

## Project Structure

```
second-brain/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Pydantic settings (reads .env)
│   ├── api/
│   │   ├── items.py         # Ingest + CRUD + auto-tag/summarize
│   │   ├── boards.py        # Canvas board + pages CRUD
│   │   ├── chat.py          # WebSocket streaming chat
│   │   ├── search.py        # Semantic search
│   │   └── settings.py      # AI provider settings (GET / PUT / test)
│   ├── ai/
│   │   ├── client.py        # Unified AI client (Anthropic SDK + httpx)
│   │   ├── embed.py         # Local sentence-transformers embeddings
│   │   └── query.py         # RAG pipeline
│   ├── ingest/
│   │   ├── base.py          # URL type detection + routing
│   │   ├── youtube.py
│   │   ├── tiktok.py        # yt-dlp + Whisper fallback
│   │   ├── instagram.py
│   │   ├── podcast.py       # yt-dlp + Whisper
│   │   ├── article.py       # trafilatura
│   │   ├── pdf.py           # PyMuPDF
│   │   ├── github.py        # git clone + file indexing
│   │   ├── gdocs.py         # Google Drive API
│   │   └── linkedin.py      # Paste-based
│   └── store/
│       ├── db.py            # SQLite models (Items, Boards, Pages)
│       ├── vectors.py       # ChromaDB operations
│       └── settings.py      # SettingsManager — config.json persistence
│
├── frontend/
│   └── src/
│       ├── App.tsx              # Root layout + settings gear icon
│       ├── api.ts               # All API calls
│       ├── types.ts             # Shared TypeScript types
│       ├── canvas/
│       │   ├── Board.tsx        # React Flow canvas + auto semantic edges
│       │   ├── nodes/           # SourceNode, ChatNode, PageNode
│       │   └── edges/           # SemanticEdge
│       ├── sidebar/
│       │   ├── Library.tsx      # Category-grouped item list
│       │   └── CaptureBar.tsx   # URL / note / file input
│       ├── components/
│       │   ├── SettingsModal.tsx # Provider / model / API key config
│       │   ├── NoteModal.tsx     # Full-screen note input
│       │   ├── GlobalChat.tsx    # Sidebar-docked global chat
│       │   └── ItemDetailModal.tsx # Item detail + tag editing
│       └── hooks/
│           ├── useChat.ts       # WebSocket chat state
│           ├── useIngest.ts     # Ingest submission + status
│           └── useBoard.ts      # Board load/save
│
├── data/                    # Runtime data (gitignored)
│   ├── brain.db             # SQLite database
│   ├── chroma/              # ChromaDB vector store
│   ├── uploads/             # Uploaded files
│   └── config.json          # AI provider settings
│
├── .env.example
├── requirements.txt
├── docker-compose.yml
└── start.bat
```

---

## Google Docs Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the **Google Docs API** and **Google Drive API**
3. Create OAuth 2.0 credentials (Desktop app type)
4. Download the credentials JSON → save as `data/google_credentials.json`
5. On first use, visit `/api/auth/google` to complete the OAuth flow — the token is saved to `data/google_token.json` automatically

---

## Environment Variables

`.env` values serve as fallback defaults. Settings saved via the UI always take precedence.

| Variable | Required | Default | Description |
|---|---|---|---|
| `MINIMAX_API_KEY` | No¹ | — | Fallback API key (any provider key works here) |
| `MINIMAX_MODEL` | No | `MiniMax-M2.5` | Fallback model name |
| `EMBED_MODEL` | No | `all-MiniLM-L6-v2` | Local sentence-transformers model |
| `DB_PATH` | No | `data/brain.db` | SQLite database path |
| `CHROMA_PATH` | No | `data/chroma` | ChromaDB storage path |
| `UPLOADS_PATH` | No | `data/uploads` | Uploaded file storage |
| `HOST` | No | `0.0.0.0` | Backend bind host |
| `PORT` | No | `8000` | Backend port |
| `GOOGLE_CLIENT_ID` | No | — | Google Docs ingestion |
| `GOOGLE_CLIENT_SECRET` | No | — | Google Docs ingestion |

¹ Required only before you configure a provider via the in-app settings panel.

---

## Data & Privacy

- **All storage is local** — SQLite database and ChromaDB vector store live in `data/` on your machine
- **Embeddings run locally** — sentence-transformers never sends data to an external service
- **AI API calls** — only the text you submit for chat or tagging is sent to your chosen AI provider
- **No telemetry** — no analytics, no tracking, no phone-home

---

## Notes

- **LinkedIn** — automated ingestion is blocked by LinkedIn's anti-scraping measures; paste post content directly as a note instead
- **Whisper models** — the `base` model is used by default (~150 MB, downloads on first use); larger models give better accuracy but are slower
- **Google Docs** — requires a one-time OAuth browser flow; subsequent ingests use a cached token
