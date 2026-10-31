from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.application.repositories.codebase_intelligence import analyze_github_repository
from app.core.security import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/repositories", tags=["repositories"])


class RepositoryAnalyzeRequest(BaseModel):
    repository_url: str = Field(min_length=1, max_length=300)


@router.post("/analyze")
async def analyze_repository(
    request: RepositoryAnalyzeRequest,
    current_user=Depends(get_current_user),
):
    """Build a bounded structure and symbol index for a public GitHub repository."""
    try:
        return await analyze_github_repository(request.repository_url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=504,
            detail="GitHub took too long to respond. Try again.",
        ) from exc
    except httpx.HTTPStatusError as exc:
        logger.warning("GitHub repository analysis failed: %s", exc.response.status_code)
        raise HTTPException(
            status_code=502,
            detail="GitHub could not provide repository data right now.",
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        logger.warning("GitHub repository request failed", exc_info=True)
        raise HTTPException(
            status_code=502,
            detail="Could not connect to GitHub. Try again later.",
        ) from exc
