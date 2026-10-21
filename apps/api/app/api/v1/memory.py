from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.security import get_current_user
from app.infrastructure.database.client import database

router = APIRouter(prefix="/memory", tags=["memory"])


def _user_id(current_user) -> str:
    return str(current_user.id)


class MemoryInput(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    content: str = Field(min_length=1, max_length=12_000)
    tags: list[str] = Field(default_factory=list, max_length=20)
    source_conversation_id: str | None = Field(default=None, max_length=100)


class MemoryUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    content: str | None = Field(default=None, min_length=1, max_length=12_000)
    tags: list[str] | None = Field(default=None, max_length=20)


def _normalize_tags(tags: list[str]) -> list[str]:
    normalized = []
    seen = set()
    for tag in tags:
        value = " ".join(tag.strip().split())[:40]
        key = value.casefold()
        if value and key not in seen:
            normalized.append(value)
            seen.add(key)
    return normalized


@router.get("")
async def list_memories(
    query: str | None = Query(default=None, min_length=2, max_length=200),
    limit: int = Query(default=20, ge=1, le=100),
    current_user=Depends(get_current_user),
):
    user_id = _user_id(current_user)
    base = (
        database.table("memory_items")
        .select(
            "id, title, content, tags, source_conversation_id, created_at, updated_at"
        )
        .eq("user_id", user_id)
    )

    if query and query.strip():
        term = query.strip()
        columns = (
            database.table("memory_items")
            .select(
                "id, title, content, tags, source_conversation_id, created_at, updated_at"
            )
            .eq("user_id", user_id)
        )
        title_rows = (
            columns.ilike("title", f"%{term}%")
            .order("updated_at", desc=True)
            .limit(limit)
            .execute()
        )
        content_rows = (
            database.table("memory_items")
            .select(
                "id, title, content, tags, source_conversation_id, created_at, updated_at"
            )
            .eq("user_id", user_id)
            .ilike("content", f"%{term}%")
            .order("updated_at", desc=True)
            .limit(limit)
            .execute()
        )
        unique = {}
        for item in [*(title_rows.data or []), *(content_rows.data or [])]:
            unique[item["id"]] = item
        items = sorted(
            unique.values(),
            key=lambda item: item.get("updated_at") or "",
            reverse=True,
        )[:limit]
    else:
        response = base.order("updated_at", desc=True).limit(limit).execute()
        items = response.data or []

    return {"memories": items}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_memory(
    request: MemoryInput,
    current_user=Depends(get_current_user),
):
    user_id = _user_id(current_user)
    title = request.title.strip()
    content = request.content.strip()
    if not title or not content:
        raise HTTPException(status_code=422, detail="Title and content cannot be blank.")

    if request.source_conversation_id:
        source = (
            database.table("conversations")
            .select("id")
            .eq("id", request.source_conversation_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not source.data:
            raise HTTPException(
                status_code=404,
                detail="Source conversation not found.",
            )

    payload = {
        "user_id": user_id,
        "title": title,
        "content": content,
        "tags": _normalize_tags(request.tags),
        "source_conversation_id": request.source_conversation_id,
    }
    response = (
        database.table("memory_items")
        .insert(payload)
        .select(
            "id, title, content, tags, source_conversation_id, created_at, updated_at"
        )
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=500, detail="Could not save memory.")
    return {"memory": response.data[0]}


@router.patch("/{memory_id}")
async def update_memory(
    memory_id: str,
    request: MemoryUpdate,
    current_user=Depends(get_current_user),
):
    payload = request.model_dump(exclude_unset=True)
    if not payload:
        raise HTTPException(status_code=422, detail="Provide at least one field to update.")
    if "title" in payload:
        payload["title"] = payload["title"].strip()
        if not payload["title"]:
            raise HTTPException(status_code=422, detail="Title cannot be blank.")
    if "content" in payload:
        payload["content"] = payload["content"].strip()
        if not payload["content"]:
            raise HTTPException(status_code=422, detail="Content cannot be blank.")
    if "tags" in payload:
        if payload["tags"] is None:
            raise HTTPException(status_code=422, detail="Tags must be a list.")
        payload["tags"] = _normalize_tags(payload["tags"])
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()

    response = (
        database.table("memory_items")
        .update(payload)
        .eq("id", memory_id)
        .eq("user_id", _user_id(current_user))
        .select(
            "id, title, content, tags, source_conversation_id, created_at, updated_at"
        )
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Memory not found.")
    return {"memory": response.data[0]}


@router.delete("/{memory_id}")
async def delete_memory(
    memory_id: str,
    current_user=Depends(get_current_user),
):
    response = (
        database.table("memory_items")
        .delete()
        .eq("id", memory_id)
        .eq("user_id", _user_id(current_user))
        .select("id")
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Memory not found.")
    return {"deleted": True, "memory_id": memory_id}
