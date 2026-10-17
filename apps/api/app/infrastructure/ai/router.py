from __future__ import annotations

from collections.abc import AsyncIterator

from app.infrastructure.ai.base import (
    AIModelRouter,
    AIProvider,
    AIProviderError,
    AIRequest,
    AIResponse,
    AIStreamChunk,
)
from app.infrastructure.ai.groq.client import GroqProvider


class DefaultAIModelRouter(AIModelRouter):
    """ForgeAI's provider-independent router, currently backed by Groq."""

    def __init__(self, *, groq_provider: AIProvider | None = None) -> None:
        # Lazy initialization allows health checks and API tests to import the
        # app without requiring a live AI credential.
        self.groq: AIProvider | None = groq_provider

    def _select_provider(self, request: AIRequest) -> AIProvider:
        if self.groq is None:
            self.groq = GroqProvider()

        if self.groq is None:
            raise AIProviderError("No AI provider is available.")

        return self.groq

    async def generate(self, request: AIRequest) -> AIResponse:
        return await self._select_provider(request).generate(request)

    async def stream(self, request: AIRequest) -> AsyncIterator[AIStreamChunk]:
        provider = self._select_provider(request)
        async for chunk in provider.stream(request):
            yield chunk

    async def health_check(self) -> dict[str, bool]:
        provider = self._select_provider(
            AIRequest(messages=[], mode="explain", personality="senior_engineer")
        )
        return {"groq": await provider.health_check()}


ai_router = DefaultAIModelRouter()
