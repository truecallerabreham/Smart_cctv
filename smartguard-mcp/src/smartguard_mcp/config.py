from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="smartguard-mcp/.env", extra="ignore", env_file_encoding="utf-8")

    # --- OPIK Configuration ---
    OPIK_API_KEY: str
    OPIK_WORKSPACE: str = "default"
    OPIK_PROJECT: str = "smartguard-mcp"

    # --- OpenAI-compatible Configuration (defaults to Google Gemini) ---
    OPENAI_API_KEY: str
    OPENAI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    # Gemini has no Whisper-compat endpoint; transcription uses the native Gemini audio API.
    AUDIO_TRANSCRIPT_MODEL: str = "gemini-2.0-flash"
    IMAGE_CAPTION_MODEL: str = "gemini-2.0-flash"

    # --- Video Ingestion Configuration ---
    SPLIT_FRAMES_COUNT: int = 2
    AUDIO_CHUNK_LENGTH: int = 10
    AUDIO_OVERLAP_SECONDS: int = 1
    AUDIO_MIN_CHUNK_DURATION_SECONDS: int = 1

    # --- Transcription Similarity Search Configuration ---
    TRANSCRIPT_SIMILARITY_EMBD_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    # --- Image Similarity Search Configuration ---
    IMAGE_SIMILARITY_EMBD_MODEL: str = "openai/clip-vit-base-patch32"

    # --- Image Captioning Configuration ---
    IMAGE_RESIZE_WIDTH: int = 1024
    IMAGE_RESIZE_HEIGHT: int = 768
    CAPTION_SIMILARITY_EMBD_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    # --- Caption Similarity Search Configuration ---
    CAPTION_MODEL_PROMPT: str = (
        "You are a CCTV surveillance analyst for public transit (subways, trains, buses). "
        "Describe what is happening in this frame in one concise sentence. "
        "If you observe any of the following, mention it explicitly: "
        "fights or physical altercations, falls or medical emergencies, "
        "unattended or abandoned bags, crowd crush or overcrowding, "
        "vandalism or property damage, loitering or trespassing in restricted areas, "
        "fare evasion or gate jumping, slip-and-fall hazards. "
        "Otherwise, describe the scene neutrally."
    )
    DELTA_SECONDS_FRAME_INTERVAL: float = 5.0

    # --- Video Search Engine Configuration ---
    VIDEO_CLIP_SPEECH_SEARCH_TOP_K: int = 1
    VIDEO_CLIP_CAPTION_SEARCH_TOP_K: int = 1
    VIDEO_CLIP_IMAGE_SEARCH_TOP_K: int = 1
    QUESTION_ANSWER_TOP_K: int = 3


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Get the application settings.

    Returns:
        Settings: The application settings.
    """
    return Settings()
