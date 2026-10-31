from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ResponsePolicy:
    """Controls response shape and generation budget."""

    name: str
    instructions: str
    max_tokens: int


_SIMPLE_MARKERS = (
    "what is ",
    "what are ",
    "who is ",
    "define ",
    "explain ",
    "meaning of ",
    "difference between ",
)


def choose_response_policy(
    user_message: str,
    *,
    mode: str = "explain",
) -> ResponsePolicy:
    """Choose a conservative response shape before model generation."""
    text = " ".join(user_message.strip().lower().split())

    explicitly_detailed = any(
        marker in text
        for marker in (
            "in detail",
            "detailed",
            "comprehensive",
            "deep dive",
            "step by step",
            "full tutorial",
            "complete guide",
            "thoroughly",
        )
    )

    if mode == "research":
        return ResponsePolicy(
            name="research",
            max_tokens=4096,
            instructions=(
                "Produce a research brief, not a casual answer. Organize findings "
                "around the question, synthesize evidence from multiple sources, "
                "include dates and context where relevant, cite factual claims "
                "with exact URLs, and call out uncertainty or conflicting evidence. "
                "Do not fabricate sources or details."
            ),
        )

    complex_mode = mode in {
        "debug",
        "architect",
        "implement",
        "test",
        "security",
        "devops",
        "optimize",
        "review",
    }

    if explicitly_detailed:
        return ResponsePolicy(
            name="explicitly_detailed",
            max_tokens=4096,
            instructions=(
                "The user explicitly requested depth. A structured, detailed "
                "answer is appropriate. Include only sections that help solve "
                "the request."
            ),
        )

    if complex_mode:
        return ResponsePolicy(
            name="complex",
            max_tokens=2800,
            instructions=(
                "This is an engineering task that benefits from structure. "
                "Solve the actual problem first, then include only the relevant "
                "reasoning, code, trade-offs, or verification steps."
            ),
        )

    if any(text.startswith(marker) for marker in _SIMPLE_MARKERS):
        return ResponsePolicy(
            name="simple",
            max_tokens=900,
            instructions=(
                "Treat this as a simple question. Answer conversationally in "
                "roughly 1-5 short paragraphs. Use at most one small example "
                "when useful. Do not use tables, multiple headings, long code, "
                "TL;DR sections, checklists, or broad related-topic coverage. "
                "Do not turn the answer into a tutorial unless requested."
            ),
        )

    return ResponsePolicy(
        name="normal",
        max_tokens=1800,
        instructions=(
            "Give a focused answer with moderate detail. Use light structure "
            "only when it improves clarity. Avoid exhaustive documentation."
        ),
    )
