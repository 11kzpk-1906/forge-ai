from fastapi import APIRouter

from app.api.v1.chat import router as chat_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.health import router as health_router
from app.api.v1.memory import router as memory_router
from app.api.v1.memory_suggestions import router as memory_suggestions_router


api_router = APIRouter()

api_router.include_router(
    health_router,
    prefix="/v1",
)

api_router.include_router(
    chat_router,
    prefix="/v1",
)

api_router.include_router(
    conversations_router,
    prefix="/v1",
)

api_router.include_router(
    memory_router,
    prefix="/v1",
)

api_router.include_router(
    memory_suggestions_router,
    prefix="/v1",
)
