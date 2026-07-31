from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="smartguard-api/.env", extra="ignore", env_file_encoding="utf-8")

    # --- LLM Configuration (OpenAI-compatible — defaults to Google Gemini) ---
    LLM_API_KEY: str
    LLM_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    LLM_ROUTING_MODEL: str = "gemini-2.0-flash"
    LLM_TOOL_USE_MODEL: str = "gemini-2.0-flash"
    LLM_IMAGE_MODEL: str = "gemini-2.0-flash"
    LLM_GENERAL_MODEL: str = "gemini-2.0-flash"

    # --- Comet ML & Opik Configuration ---
    OPIK_API_KEY: str | None = Field(default=None, description="API key for Comet ML and Opik services.")
    OPIK_WORKSPACE: str = "default"
    OPIK_PROJECT: str = Field(
        default="smartguard-api",
        description="Project name for Comet ML and Opik tracking.",
    )

    # --- Memory Configuration ---
    AGENT_MEMORY_SIZE: int = 20

    # --- MCP Configuration ---
    MCP_SERVER: str = "http://localhost:9090/mcp"

    # --- Disable Nest Asyncio ---
    DISABLE_NEST_ASYNCIO: bool = True


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Get the application settings.

    Returns:
        Settings: The application settings.
    """
    return Settings()
