from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TAVILY_ENDPOINT = "https://api.tavily.com/search"
MAX_RESULTS = 5
RESEARCH_MAX_RESULTS = 8
MAX_CONTENT_CHARS = 1200
RESEARCH_MAX_CONTENT_CHARS = 1800


def should_search_web(query: str) -> bool:
    """Detect questions that benefit from fresh information."""
    text = query.casefold()
    signals = (
        "search the web", "search online", "look up", "latest", "current",
        "today", "right now", "this week", "recent", "breaking", "news",
        "2026", "2025", "price", "pricing", "release date", "new version",
        "latest version", "documentation", "is it still", "who is the",
        "what happened", "weather", "exchange rate", "currency", "stock price",
        "who won", "score", "standings", "schedule", "election results",
    )
    return any(signal in text for signal in signals)


async def search_web(
    query: str,
    *,
    research_mode: bool = False,
) -> list[dict[str, str]]:
    """Search the live web through Tavily. Missing configuration is non-fatal."""
    api_key = settings.tavily_api_key
    if not api_key or not query.strip():
        return []

    result_limit = RESEARCH_MAX_RESULTS if research_mode else MAX_RESULTS
    content_limit = RESEARCH_MAX_CONTENT_CHARS if research_mode else MAX_CONTENT_CHARS
    payload: dict[str, Any] = {
        "api_key": api_key,
        "query": query[:500],
        "search_depth": "advanced" if research_mode else "basic",
        "topic": "news" if any(
            signal in query.casefold()
            for signal in ("news", "breaking", "this week", "today", "what happened")
        ) else "general",
        "max_results": result_limit,
        "include_answer": False,
        "include_raw_content": False,
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(12.0, connect=5.0)) as client:
            response = await client.post(TAVILY_ENDPOINT, json=payload)
            response.raise_for_status()
            data = response.json()

        results: list[dict[str, str]] = []
        for item in data.get("results", [])[:result_limit]:
            title = str(item.get("title") or "Untitled result").strip()
            url = str(item.get("url") or "").strip()
            content = " ".join(str(item.get("content") or "").split())
            if not url.startswith(("https://", "http://")):
                continue
            results.append({
                "title": title[:240],
                "url": url[:1000],
                "content": content[:content_limit],
                "score": str(item.get("score", "")),
                "published_date": str(item.get("published_date") or item.get("published") or ""),
            })
        return results
    except Exception:
        logger.warning("Live web search failed; continuing without search context", exc_info=True)
        return []
