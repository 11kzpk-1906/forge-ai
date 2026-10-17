from __future__ import annotations

from functools import lru_cache

from fastapi import Header, HTTPException, status
from supabase import Client, create_client

from app.core.config import settings


@lru_cache(maxsize=1)
def _auth_client() -> Client:
    if not settings.supabase_url or not settings.supabase_secret_key:
        raise RuntimeError("Supabase server credentials are not configured.")

    return create_client(settings.supabase_url, settings.supabase_secret_key)


def _get_auth_user(token: str):
    return _auth_client().auth.get_user(token)


async def get_current_user(
    authorization: str | None = Header(default=None),
):
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not settings.supabase_url or not settings.supabase_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is not configured on the server.",
        )

    try:
        response = _get_auth_user(token.strip())
    except Exception as exc:
        # Don't leak upstream SDK/network details to clients.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user = getattr(response, "user", None)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
