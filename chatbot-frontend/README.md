# My Chatbot

A minimal, streaming AI chat app with per-conversation document Q&A (RAG).
React + Vite frontend, FastAPI backend, PostgreSQL for chats, Chroma for vectors, Groq for the LLM.

## Features

- **Streaming chat** with Markdown, tables and copyable code blocks, plus a Stop button
- **Document Q&A** — attach PDF, DOCX or TXT files (click or drag & drop); answers cite their sources as `[1]`, `[2]` with source chips under the reply
- **Per-chat knowledge** — documents belong to one conversation; deleting the chat deletes its vectors
- **Long-term memory** — older messages are summarised into a compact memory
- **Auto titles** — an LLM-written title replaces the placeholder after the first reply
- **Premium minimal UI** — dark/light via system preference, date-grouped sidebar, mobile drawer, toasts instead of alerts

## Project structure

```
backend/
  app/
    main.py         API routes, prompt building, streaming, memory, titles
    rag.py          extraction, chunking, embeddings, retrieval
    config.py       all settings (env-driven)
    models.py       SQLAlchemy models
    schemas.py      request models
    database.py     (yours, unchanged) engine, SessionLocal, Base, get_db
  requirements.txt
  .env.example
frontend/
  src/
    App.jsx
    App.css
```

## Quick start

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                  # add your GROQ_API_KEY
uvicorn app.main:app --reload
```

API runs on http://127.0.0.1:8000 (interactive docs at `/docs`).
The first start downloads the embedding model (~90 MB) and warms it up.

### Frontend

```bash
cd frontend
npm install react-markdown remark-gfm     # if not already installed
npm run dev
```

Open http://localhost:5173. To point at a different API, set `VITE_API_URL` in `frontend/.env`.

## Upgrading from the previous version

1. **New columns** (`chat_messages.sources`, `documents.chunk_count`, `documents.size_bytes`) are added automatically on startup.
2. **Re-upload your documents.** Vectors now use a cosine index and normalised embeddings, stored in new `*_v2` collections. Old collections are ignored; you can delete `app/chroma_db` to reclaim space.
3. `pip install -r requirements.txt` — `python-docx` was missing before, which broke DOCX uploads.

## Configuration

All optional except `GROQ_API_KEY`. See `.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `GROQ_API_KEY` | – | Groq credentials |
| `GROQ_MODEL` | `openai/gpt-oss-20b` | Chat model |
| `LLM_TEMPERATURE` | `0.2` | Sampling temperature |
| `CORS_ORIGINS` | localhost:5173 | Comma-separated allowed origins |
| `MAX_UPLOAD_MB` | `20` | Upload size cap |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Any sentence-transformers model |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `900` / `150` | Chunking |
| `RAG_TOP_K` | `5` | Passages given to the LLM |
| `RAG_MIN_SCORE` | `0.22` | Minimum cosine similarity to count as relevant |
| `RAG_REWRITE_QUERIES` | `true` | Rewrite follow-ups into standalone search queries |
| `HISTORY_WINDOW` | `10` | Recent messages sent verbatim |

## API at a glance

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness + model name |
| GET / POST | `/conversations` | List / create |
| DELETE | `/conversations/{id}` | Delete chat, messages, documents, vectors |
| GET | `/conversations/{id}/messages` | Messages with sources |
| GET / POST | `/conversations/{id}/documents` | List / upload |
| DELETE | `/conversations/{id}/documents/{doc_id}` | Remove one document |
| POST | `/chat` | Stream a reply (`X-Sources` header carries citations) |

Full details in [DOCS.md](DOCS.md).

## Troubleshooting

- **"Can't reach the server"** — backend not running, or its origin isn't in `CORS_ORIGINS`.
- **DOCX upload fails** — run `pip install python-docx`.
- **"No text found in this PDF"** — it's a scanned image; OCR isn't supported.
- **Answers ignore the document** — lower `RAG_MIN_SCORE` (e.g. `0.15`) or raise `RAG_TOP_K`.
- **Garbled streaming behind a proxy** — disable proxy buffering (the API already sends `X-Accel-Buffering: no`).