"""Embedding service with VolcEngine support and a local offline fallback."""
from __future__ import annotations

import hashlib
import logging
import math
import random
from typing import Any

import httpx

from core.config import settings
from core.http_client import get_http_client
from core.resilience import retry_async, with_timeout

logger = logging.getLogger(__name__)


EMBEDDING_DIMENSIONS: dict[str, int] = {
    "doubao-embedding-vision-251215": 2048,
    "local-hash-embedding": 384,
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
}


class _LocalHashEmbeddings:
    """Deterministic embeddings for demo/testing without external API keys."""

    def __init__(self, dimension: int):
        self.dimension = dimension

    def _embed(self, text: str) -> list[float]:
        seed = int.from_bytes(hashlib.sha256(text.encode("utf-8")).digest()[:8], "big")
        rng = random.Random(seed)
        values = [rng.uniform(-1.0, 1.0) for _ in range(self.dimension)]
        norm = math.sqrt(sum(value * value for value in values)) or 1.0
        return [round(value / norm, 8) for value in values]

    async def aembed_query(self, text: str) -> list[float]:
        return self._embed(text)

    async def aembed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(text) for text in texts]


class _VolcEngineEmbeddings:
    """Direct VolcEngine multimodal embedding API client."""

    def __init__(self, api_key: str, api_base: str, model: str):
        self.api_key = api_key
        self.model = model
        self._base_url = f"{api_base.rstrip('/')}/embeddings/multimodal"

    @retry_async(
        max_attempts=3,
        base_delay=1.0,
        max_delay=10.0,
        retriable_exceptions=(httpx.HTTPStatusError, httpx.ConnectError, TimeoutError),
        service_name="VolcEngine-Embedding",
    )
    async def aembed_query(self, text: str) -> list[float]:
        client = get_http_client()
        resp = await client.post(
            self._base_url,
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={"model": self.model, "input": [{"type": "text", "text": text}]},
            timeout=120.0,
        )
        resp.raise_for_status()
        return resp.json()["data"]["embedding"]

    async def aembed_documents(self, texts: list[str]) -> list[list[float]]:
        return [await self.aembed_query(text) for text in texts]


class EmbeddingService:
    """Text embedding service."""

    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
        self.provider = settings.embedding_provider
        self.model = settings.embedding_model or "local-hash-embedding"
        self.dimension = settings.embedding_dimension

        if self.provider == "local" or not settings.volcengine_api_key:
            self.provider = "local"
            if self.model not in EMBEDDING_DIMENSIONS:
                self.model = "local-hash-embedding"
            self.embeddings = _LocalHashEmbeddings(self.get_dimension())
            return

        if self.provider != "volcengine":
            raise ValueError(f"Unsupported embedding provider: {self.provider}. Use 'volcengine' or 'local'.")

        self.embeddings = _VolcEngineEmbeddings(
            api_key=settings.volcengine_api_key,
            api_base=settings.volcengine_api_base,
            model=self.model,
        )

    async def embed_text(self, text: str) -> list[float]:
        try:
            return await with_timeout(
                self.embeddings.aembed_query(text),
                timeout=120.0,
                service_name="Embedding",
            )
        except Exception as exc:
            logger.error("[Embedding] embed_text failed (tenant=%s): %s", self.tenant_id, exc)
            raise

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        try:
            return await with_timeout(
                self.embeddings.aembed_documents(texts),
                timeout=300.0,
                service_name="Embedding",
            )
        except Exception as exc:
            logger.error("[Embedding] embed_documents failed (tenant=%s, count=%d): %s", self.tenant_id, len(texts), exc)
            raise

    async def get_dimension_from_model(self) -> int:
        return len(await self.embed_text("test"))

    def get_dimension(self) -> int:
        return EMBEDDING_DIMENSIONS.get(self.model, self.dimension or 384)

    def get_model_name(self) -> str:
        return self.model

    def get_model_info(self) -> dict[str, Any]:
        return {
            "model": self.model,
            "dimension": self.get_dimension(),
            "provider": self.provider,
            "tenant_id": self.tenant_id,
        }
