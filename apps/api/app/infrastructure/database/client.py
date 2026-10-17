from __future__ import annotations

from functools import cached_property
from typing import Any

from supabase import Client, create_client

from app.core.config import settings


class DatabaseClient:
    """Create the Supabase client on first database use, not at import time."""

    @cached_property
    def client(self) -> Client:
        if not settings.supabase_url:
            raise RuntimeError("SUPABASE_URL is not configured.")

        if not settings.supabase_secret_key:
            raise RuntimeError("SUPABASE_SECRET_KEY is not configured.")

        return create_client(
            settings.supabase_url,
            settings.supabase_secret_key,
        )

    def table(self, table_name: str) -> Any:
        return self.client.table(table_name)


database = DatabaseClient()
