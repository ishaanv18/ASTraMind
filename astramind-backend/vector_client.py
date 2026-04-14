"""
vector_client.py — Astramind Vector Store Client
DB_ENV=development → ChromaDB (local, in-process, free forever)
DB_ENV=production  → Qdrant Cloud (free 1GB tier)

Uniform interface — routers never touch ChromaDB or Qdrant directly.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional

from config import settings

logger = logging.getLogger(__name__)

VECTOR_SIZE = 384  # all-MiniLM-L6-v2 output dimension


class VectorClient:
    """
    Abstraction over ChromaDB (dev) and Qdrant (prod).
    All methods share identical signatures regardless of the backend.
    """

    def __init__(self) -> None:
        self._env = settings.DB_ENV.lower()
        self._chroma_client = None
        self._qdrant_client = None

        if self._env == "production":
            self._init_qdrant()
        else:
            self._init_chroma()

    def _init_chroma(self) -> None:
        try:
            import chromadb  # type: ignore
            self._chroma_client = chromadb.PersistentClient(path=settings.CHROMADB_PATH)
            logger.info("VectorClient: DEVELOPMENT mode (ChromaDB at %s)", settings.CHROMADB_PATH)
        except ImportError:
            logger.error("chromadb not installed. Run: pip install chromadb")
            raise

    def _init_qdrant(self) -> None:
        try:
            from qdrant_client import QdrantClient  # type: ignore
            self._qdrant_client = QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY,
                timeout=30,
            )
            logger.info("VectorClient: PRODUCTION mode (Qdrant at %s)", settings.QDRANT_URL)
        except ImportError:
            logger.error("qdrant-client not installed. Run: pip install qdrant-client")
            raise

    async def init(self) -> None:
        """Called from main.py startup hook. No-op for now — clients init in __init__."""
        logger.info("VectorClient initialised (env=%s)", self._env)

    # ══════════════════════════════════════════════════════════════════════════
    # Collection management
    # ══════════════════════════════════════════════════════════════════════════

    def create_collection(self, repo_id: str) -> None:
        """Create or ensure a collection exists for the given repo_id."""
        collection_name = f"repo_{repo_id}"
        if self._env == "production":
            from qdrant_client.models import Distance, VectorParams  # type: ignore
            try:
                self._qdrant_client.get_collection(collection_name)
                logger.info("Qdrant collection already exists: %s", collection_name)
            except Exception:
                self._qdrant_client.create_collection(
                    collection_name=collection_name,
                    vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
                )
                logger.info("Created Qdrant collection: %s", collection_name)
        else:
            self._chroma_client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"},
            )
            logger.info("ChromaDB collection ready: %s", collection_name)

    def collection_exists(self, repo_id: str) -> bool:
        """Return True if a collection for this repo already exists."""
        collection_name = f"repo_{repo_id}"
        if self._env == "production":
            try:
                self._qdrant_client.get_collection(collection_name)
                return True
            except Exception:
                return False
        else:
            # ChromaDB v0.6+ returns plain strings from list_collections()
            existing = self._chroma_client.list_collections()
            # Handle both old (objects with .name) and new (plain strings) API
            names = [c if isinstance(c, str) else c.name for c in existing]
            return collection_name in names

    def delete_collection(self, repo_id: str) -> None:
        """Delete the collection and all stored embeddings for this repo."""
        collection_name = f"repo_{repo_id}"
        if self._env == "production":
            try:
                self._qdrant_client.delete_collection(collection_name)
                logger.info("Deleted Qdrant collection: %s", collection_name)
            except Exception as exc:
                logger.warning("Could not delete Qdrant collection %s: %s", collection_name, exc)
        else:
            try:
                self._chroma_client.delete_collection(collection_name)
                logger.info("Deleted ChromaDB collection: %s", collection_name)
            except Exception as exc:
                logger.warning("Could not delete ChromaDB collection %s: %s", collection_name, exc)

    # ══════════════════════════════════════════════════════════════════════════
    # Upsert
    # ══════════════════════════════════════════════════════════════════════════

    def upsert_chunks(self, repo_id: str, chunks: List[Dict[str, Any]]) -> None:
        """
        Store embeddings + metadata for a list of code chunks.
        Each chunk dict must contain:
            id, embedding (list[float]), content, file_path,
            language, function_name, chunk_index
        """
        if not chunks:
            return
        collection_name = f"repo_{repo_id}"

        if self._env == "production":
            from qdrant_client.models import PointStruct  # type: ignore
            points = [
                PointStruct(
                    id=chunk["id"] if self._is_valid_uuid(chunk["id"]) else str(uuid.uuid5(uuid.NAMESPACE_DNS, chunk["id"])),
                    vector=chunk["embedding"],
                    payload={
                        "content": chunk["content"],
                        "file_path": chunk["file_path"],
                        "language": chunk.get("language", ""),
                        "function_name": chunk.get("function_name", ""),
                        "chunk_index": chunk.get("chunk_index", 0),
                        "repo_id": repo_id,
                    },
                )
                for chunk in chunks
            ]
            # Upsert in batches of 100 to avoid request size limits
            batch_size = 100
            for i in range(0, len(points), batch_size):
                batch = points[i : i + batch_size]
                self._qdrant_client.upsert(
                    collection_name=collection_name,
                    points=batch,
                )
        else:
            collection = self._chroma_client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"},
            )
            ids = [str(chunk["id"]) for chunk in chunks]
            embeddings = [chunk["embedding"] for chunk in chunks]
            documents = [chunk["content"] for chunk in chunks]
            metadatas = [
                {
                    "file_path": chunk["file_path"],
                    "language": chunk.get("language", ""),
                    "function_name": chunk.get("function_name", ""),
                    "chunk_index": chunk.get("chunk_index", 0),
                    "repo_id": repo_id,
                }
                for chunk in chunks
            ]
            collection.upsert(
                ids=ids,
                embeddings=embeddings,
                documents=documents,
                metadatas=metadatas,
            )

        logger.debug("Upserted %d chunks into %s", len(chunks), collection_name)

    # ══════════════════════════════════════════════════════════════════════════
    # Query / Search
    # ══════════════════════════════════════════════════════════════════════════

    def query(
        self,
        repo_id: str,
        query_embedding: List[float],
        top_k: int = 10,
        filter_language: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve the top_k most similar code chunks to query_embedding.
        Returns normalised dicts: {id, content, file_path, language, function_name, score}
        """
        collection_name = f"repo_{repo_id}"

        if self._env == "production":
            from qdrant_client.models import Filter, FieldCondition, MatchValue  # type: ignore
            query_filter = None
            if filter_language:
                query_filter = Filter(
                    must=[
                        FieldCondition(
                            key="language",
                            match=MatchValue(value=filter_language),
                        )
                    ]
                )
            results = self._qdrant_client.search(
                collection_name=collection_name,
                query_vector=query_embedding,
                limit=top_k,
                query_filter=query_filter,
                with_payload=True,
            )
            return [
                {
                    "id": str(r.id),
                    "content": r.payload.get("content", ""),
                    "file_path": r.payload.get("file_path", ""),
                    "language": r.payload.get("language", ""),
                    "function_name": r.payload.get("function_name", ""),
                    "score": float(r.score),
                }
                for r in results
            ]
        else:
            try:
                collection = self._chroma_client.get_collection(collection_name)
            except Exception:
                logger.warning("ChromaDB collection not found: %s", collection_name)
                return []

            where_filter = {"language": filter_language} if filter_language else None
            chroma_results = collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, collection.count()),
                where=where_filter,
                include=["documents", "metadatas", "distances"],
            )

            items: List[Dict[str, Any]] = []
            ids = chroma_results.get("ids", [[]])[0]
            docs = chroma_results.get("documents", [[]])[0]
            metas = chroma_results.get("metadatas", [[]])[0]
            dists = chroma_results.get("distances", [[]])[0]

            for chunk_id, doc, meta, dist in zip(ids, docs, metas, dists):
                # ChromaDB returns L2/cosine distance → convert to similarity score
                score = max(0.0, 1.0 - float(dist))
                items.append(
                    {
                        "id": chunk_id,
                        "content": doc,
                        "file_path": meta.get("file_path", ""),
                        "language": meta.get("language", ""),
                        "function_name": meta.get("function_name", ""),
                        "score": score,
                    }
                )
            return items

    # ── Utility ───────────────────────────────────────────────────────────────

    @staticmethod
    def _is_valid_uuid(val: str) -> bool:
        try:
            uuid.UUID(str(val))
            return True
        except ValueError:
            return False


# ══════════════════════════════════════════════════════════════════════════════
# Singleton
# ══════════════════════════════════════════════════════════════════════════════

vector = VectorClient()
