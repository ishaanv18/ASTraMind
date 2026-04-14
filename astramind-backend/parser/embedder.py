"""
parser/embedder.py — Sentence-Transformer Embedding Engine
Uses all-MiniLM-L6-v2 (22MB, runs locally, completely free).
Vector size: 384 dimensions — matched to ChromaDB/Qdrant collection config.
"""

from __future__ import annotations

import logging
from typing import List, Union

logger = logging.getLogger(__name__)

# Lazy-loaded to avoid import-time errors if sentence-transformers isn't installed yet
_model = None
MODEL_NAME = "all-MiniLM-L6-v2"
VECTOR_SIZE = 384


def _get_model():
    """Load model on first call; cached for the process lifetime."""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore
            logger.info("Loading sentence-transformer model: %s (first load may be slow)", MODEL_NAME)
            _model = SentenceTransformer(MODEL_NAME)
            logger.info("Model %s loaded. Vector size: %d", MODEL_NAME, VECTOR_SIZE)
        except ImportError:
            logger.error("sentence-transformers not installed. Run: pip install sentence-transformers")
            raise
    return _model


class Embedder:
    """
    Wrapper around sentence-transformers all-MiniLM-L6-v2.
    Produces 384-dimensional dense vectors for code and natural language.
    Designed for both single strings and batched lists for efficiency.
    """

    def __init__(self) -> None:
        # Pre-warm the model at construction time when called explicitly.
        # During import this is a no-op; the router's startup event triggers warming.
        pass

    def warm_up(self) -> None:
        """Force model download/load. Call once at startup for fast first request."""
        _get_model()
        logger.info("Embedder warmed up.")

    def embed(self, text: str) -> List[float]:
        """
        Embed a single text string.
        Returns a list of 384 floats.
        Strips text to MAX_CHARS to avoid OOM on huge inputs.
        """
        MAX_CHARS = 8_000  # ~2k tokens — well within MiniLM window
        truncated = text[:MAX_CHARS] if len(text) > MAX_CHARS else text
        model = _get_model()
        vector = model.encode(truncated, convert_to_numpy=True, normalize_embeddings=True)
        return vector.tolist()

    def embed_batch(self, texts: List[str], batch_size: int = 64) -> List[List[float]]:
        """
        Embed a list of texts efficiently in one forward pass.
        Returns a list of embedding lists, same order as input.
        Uses sentence-transformers' internal batching for GPU/CPU efficiency.
        """
        MAX_CHARS = 8_000
        truncated = [t[:MAX_CHARS] for t in texts]
        model = _get_model()
        vectors = model.encode(
            truncated,
            batch_size=batch_size,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return [v.tolist() for v in vectors]

    def embed_query(self, query: str) -> List[float]:
        """
        Embed a user search query.
        Identical to embed() but named separately for clarity in retrieval pipelines.
        """
        return self.embed(query)


# ── Module-level singleton ────────────────────────────────────────────────────
embedder = Embedder()
