from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application
    app_name: str = "ForgeAI API"
    app_version: str = "0.1.0"
    environment: str = "development"

    # Groq
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"

    # Optional live web search (Tavily)
    tavily_api_key: str = ""

    # Supabase (server-side secret; never expose to the web app)
    supabase_url: str = ""
    supabase_secret_key: str = ""

    # Comma-separated, exact origins. Keep the default for local development.
    cors_origins: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://localhost:4173,"
        "http://127.0.0.1:4173,"
        "forgeai://app"
    )

    @property
    def parsed_cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )


settings = Settings()
