"""
parser/embedder.py — Embedding Engine using fastembed (ONNX-based)

Replaced sentence-transformers + torch (~3GB, ~400MB RAM) with fastembed
(~200MB install, ~50MB RAM). Uses the SAME all-MiniLM-L6-v2 model via
ONNX Runtime — produces identical 384-dim vectors, fully compatible with
existing ChromaDB and Qdrant collections. No data migration needed.
"""

from __future__ import annotations

import logging
from typing import List

logger = logging.getLogger(__name__)

# Lazy-loaded to avoid import-time overhead
_model = None
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
VECTOR_SIZE = 384


def _get_model():
    """Load model on first call; cached for the process lifetime."""
    global _model
    if _model is None:
        try:
            from fastembed import TextEmbedding  # type: ignore
            logger.info("Loading fastembed model: %s (first load downloads ONNX weights)", MODEL_NAME)
            _model = TextEmbedding(model_name=MODEL_NAME)
            logger.info("Model %s loaded. Vector size: %d", MODEL_NAME, VECTOR_SIZE)
        except ImportError:
            logger.error("fastembed not installed. Run: pip install fastembed")
            raise
    return _model


class Embedder:
    """
    Wrapper around fastembed TextEmbedding (all-MiniLM-L6-v2, ONNX).
    Produces 384-dimensional dense vectors for code and natural language.
    API is identical to the old sentence-transformers wrapper — no callers change.
    """

    def __init__(self) -> None:
        pass

    def warm_up(self) -> None:
        """Force model download/load. Call once at startup for fast first request."""
        _get_model()
        logger.info("Embedder warmed up (fastembed).")

    def embed(self, text: str) -> List[float]:
        """
        Embed a single text string.
        Returns a list of 384 floats.
        """
        MAX_CHARS = 8_000
        truncated = text[:MAX_CHARS] if len(text) > MAX_CHARS else text
        model = _get_model()
        # fastembed returns a generator of numpy arrays
        vectors = list(model.embed([truncated]))
        return vectors[0].tolist()

    def embed_batch(self, texts: List[str], batch_size: int = 64) -> List[List[float]]:
        """
        Embed a list of texts efficiently.
        Returns a list of embedding lists, same order as input.
        """
        MAX_CHARS = 8_000
        truncated = [t[:MAX_CHARS] for t in texts]
        model = _get_model()
        # fastembed.embed() accepts an iterable and returns a generator
        vectors = list(model.embed(truncated))
        return [v.tolist() for v in vectors]

    def embed_query(self, query: str) -> List[float]:
        """
        Embed a user search query.
        Identical to embed() but named separately for clarity in retrieval pipelines.
        """
        return self.embed(query)


# ── Module-level singleton ────────────────────────────────────────────────────
embedder = Embedder()
