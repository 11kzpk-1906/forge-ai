from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass

from app.application.chat.context_manager import build_chat_context
from app.application.chat.memory_context import retrieve_memory_context
from app.application.chat.prompt_engine import build_prompt
from app.application.chat.response_policy import choose_response_policy
from app.infrastructure.ai.base import (
    AIMessage,
    AIRequest,
    AIStreamChunk,
)
from app.infrastructure.ai.router import ai_router


@dataclass(slots=True, frozen=True)
class SendMessageCommand:
    """Input required to send a message to ForgeAI."""

    messages: Sequence[AIMessage]
    mode: str = "explain"
    personality: str = "senior_engineer"
    model: str | None = None
    temperature: float = 0.2
    max_tokens: int = 4096

    user_id: str | None = None
    conversation_id: str | None = None


@dataclass(slots=True, frozen=True)
class SendMessageResult:
    """Metadata returned when a message request is created."""

    mode: str
    personality: str
    model: str
    conversation_id: str | None = None


class SendMessageService:
    """
    Application service responsible for orchestrating a ForgeAI message.

    Flow:

        API request
            ↓
        Context Manager + Saved Memory Retrieval
            ↓
        Prompt Engine
            ↓
        AI Request
            ↓
        AI Model Router
            ↓
        Groq
            ↓
        streamed AI chunks
    """

    def _build_request(
        self,
        command: SendMessageCommand,
        *,
        stream: bool,
    ) -> AIRequest:
        context_messages = build_chat_context(command.messages)

        last_user_message = next(
            (
                message.content
                for message in reversed(command.messages)
                if message.role == "user"
            ),
            "",
        )
        policy = choose_response_policy(
            last_user_message,
            mode=command.mode,
        )

        system_prompt = build_prompt(
            mode=command.mode,
            personality=command.personality,
        )
        system_prompt = (
            f"{system_prompt}\n\n"
            f"RESPONSE POLICY ({policy.name.upper()}):\n"
            f"{policy.instructions}"
        )

        memory_context = retrieve_memory_context(
            command.user_id,
            last_user_message,
        )
        if memory_context:
            system_prompt = f"{system_prompt}\n\n{memory_context}"

        ai_messages = [
            AIMessage(
                role="system",
                content=system_prompt,
            ),
            *context_messages,
        ]

        return AIRequest(
            messages=ai_messages,
            model=command.model or "",
            temperature=command.temperature,
            max_tokens=min(command.max_tokens, policy.max_tokens),
            mode=command.mode,
            personality=command.personality,
            stream=stream,
            metadata={
                "user_id": command.user_id,
                "conversation_id": command.conversation_id,
            },
        )

    async def stream(
        self,
        command: SendMessageCommand,
    ) -> AsyncIterator[AIStreamChunk]:
        """Stream ForgeAI's response."""

        request = self._build_request(
            command,
            stream=True,
        )

        async for chunk in ai_router.stream(request):
            yield chunk

    async def execute(
        self,
        command: SendMessageCommand,
    ) -> SendMessageResult:
        """
        Execute a non-streaming request.

        Useful for internal services, testing, title generation,
        summaries, and background jobs.
        """

        request = self._build_request(
            command,
            stream=False,
        )

        response = await ai_router.generate(request)

        return SendMessageResult(
            mode=command.mode,
            personality=command.personality,
            model=response.model,
            conversation_id=command.conversation_id,
        )


send_message_service = SendMessageService()
