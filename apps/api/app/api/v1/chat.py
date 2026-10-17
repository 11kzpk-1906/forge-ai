from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.v1.conversations import (
    _get_owned_conversation,
    create_conversation,
    save_message,
    touch_conversation,
)
from app.application.chat.send_message import (
    SendMessageCommand,
    send_message_service,
)
from app.core.security import get_current_user
from app.infrastructure.ai.base import AIMessage, AIRequest
from app.infrastructure.ai.router import ai_router

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=100_000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=100)
    mode: str = Field(default="explain", min_length=1, max_length=40)
    personality: str = Field(default="friendly_engineer", min_length=1, max_length=80)
    model: str | None = Field(default=None, max_length=120)
    conversation_id: str | None = Field(default=None, max_length=100)


def _conversation_title(message: str) -> str:
    cleaned = " ".join(message.strip().split())
    if not cleaned:
        return "New conversation"
    words = cleaned.split(" ")
    return cleaned if len(words) <= 7 else f"{' '.join(words[:7])}…"


def _clean_ai_title(title: str) -> str:
    cleaned = " ".join(title.strip().split())
    cleaned = cleaned.strip().strip('"').strip("'")
    if not cleaned:
        return "New conversation"
    words = cleaned.split(" ")
    return cleaned if len(words) <= 8 else " ".join(words[:8])


async def _generate_ai_title(messages: list[ChatMessage], model: str | None) -> str:
    recent_messages = messages[-8:]
    conversation_text = "\n".join(
        f"{message.role.upper()}: {message.content.strip()}"
        for message in recent_messages
        if message.content.strip()
    )

    if not conversation_text:
        return "New conversation"

    request = AIRequest(
        messages=[
            AIMessage(
                role="system",
                content=(
                    "Create a concise chat-history title for the conversation. "
                    "Return ONLY the title, with no quotes, punctuation, emoji, "
                    "prefix, explanation, or markdown. Use 2-8 words. "
                    "Capture the main topic or task, not the user's wording verbatim."
                ),
            ),
            AIMessage(role="user", content=conversation_text),
        ],
        model=model or "",
        temperature=0.2,
        max_tokens=32,
        mode="explain",
        personality="senior_engineer",
        stream=False,
    )

    response = await ai_router.generate(request)
    return _clean_ai_title(response.content)


async def generate_stream(request: ChatRequest, user_id: str) -> AsyncIterator[str]:
    last_user_message = next(
        (
            message.content.strip()
            for message in reversed(request.messages)
            if message.role == "user"
        ),
        "",
    )

    if not last_user_message:
        yield 'data: {"type":"error","message":"A user message is required."}\n\n'
        return

    conversation_id = request.conversation_id
    is_new_conversation = conversation_id is None

    try:
        if conversation_id:
            _get_owned_conversation(conversation_id, user_id)
        else:
            conversation = create_conversation(
                user_id=user_id,
                title="New conversation",
                mode=request.mode,
                personality=request.personality,
                model=request.model,
            )
            conversation_id = str(conversation["id"])
            yield "data: " + json.dumps(
                {"type": "conversation", "conversation": conversation}
            ) + "\n\n"

        save_message(
            conversation_id=conversation_id,
            role="user",
            content=last_user_message,
            model=request.model,
            mode=request.mode,
            personality=request.personality,
        )

        command = SendMessageCommand(
            messages=[
                AIMessage(role=message.role, content=message.content)
                for message in request.messages
            ],
            mode=request.mode,
            personality=request.personality,
            model=request.model,
            user_id=user_id,
            conversation_id=conversation_id,
        )

        assistant_content: list[str] = []
        async for chunk in send_message_service.stream(command):
            if chunk.content:
                assistant_content.append(chunk.content)
                yield "data: " + json.dumps(
                    {"type": "token", "content": chunk.content}
                ) + "\n\n"

        complete_assistant_message = "".join(assistant_content)
        if complete_assistant_message:
            save_message(
                conversation_id=conversation_id,
                role="assistant",
                content=complete_assistant_message,
                model=request.model,
                mode=request.mode,
                personality=request.personality,
            )

        if is_new_conversation:
            try:
                ai_title = await _generate_ai_title(request.messages, request.model)
            except Exception:
                logger.exception("AI conversation title generation failed")
                ai_title = _conversation_title(last_user_message)

            touch_conversation(
                conversation_id=conversation_id,
                user_id=user_id,
                title=ai_title,
            )
            yield "data: " + json.dumps(
                {
                    "type": "conversation_title",
                    "conversation_id": conversation_id,
                    "title": ai_title,
                }
            ) + "\n\n"

        yield "data: " + json.dumps(
            {"type": "done", "conversation_id": conversation_id}
        ) + "\n\n"

    except Exception:
        logger.exception("Chat stream failed")
        yield "data: " + json.dumps(
            {
                "type": "error",
                "message": "The chat request failed. Check your API configuration and try again.",
            }
        ) + "\n\n"


@router.post("")
async def chat(
    request: ChatRequest,
    current_user=Depends(get_current_user),
):
    if not any(message.role == "user" for message in request.messages):
        raise HTTPException(
            status_code=400,
            detail="At least one user message is required.",
        )

    return StreamingResponse(
        generate_stream(request, str(current_user.id)),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
