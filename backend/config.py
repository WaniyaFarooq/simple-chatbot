"""Central configuration. Everything is read once from the environment (.env supported)."""

import os

from dotenv import load_dotenv

load_dotenv()


def _int(name: str, default: int) -> int:
    return int(os.getenv(name, default))


def _float(name: str, default: float) -> float:
    return float(os.getenv(name, default))


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


# ---------------------------------------------------------------- LLM
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
LLM_TEMPERATURE = _float("LLM_TEMPERATURE", 0.2)

# ---------------------------------------------------------------- API
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]
MAX_UPLOAD_MB = _int("MAX_UPLOAD_MB", 20)

# ---------------------------------------------------------------- Memory
HISTORY_WINDOW = _int("HISTORY_WINDOW", 10)      # recent messages sent verbatim
SUMMARY_TRIGGER = _int("SUMMARY_TRIGGER", 20)    # total messages before summarising starts
SUMMARY_BATCH = _int("SUMMARY_BATCH", 6)         # new unsummarised messages needed per update

# ---------------------------------------------------------------- RAG
CHROMA_PATH = os.getenv(
    "CHROMA_PATH", os.path.join(os.path.dirname(__file__), "chroma_db")
)
EMBEDDING_MODEL = os.getenv(
    "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
)
CHUNK_SIZE = _int("CHUNK_SIZE", 900)
CHUNK_OVERLAP = _int("CHUNK_OVERLAP", 150)
RAG_TOP_K = _int("RAG_TOP_K", 5)                 # passages sent to the LLM
RAG_FETCH_K = _int("RAG_FETCH_K", 15)            # candidates pulled from the vector store
RAG_MIN_SCORE = _float("RAG_MIN_SCORE", 0.22)    # cosine similarity floor (0-1)
RAG_REWRITE_QUERIES = _bool("RAG_REWRITE_QUERIES", True)