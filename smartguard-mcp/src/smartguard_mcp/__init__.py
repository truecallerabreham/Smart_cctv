"""SmartGuard MCP Server package.

Loads environment variables into the OS environment BEFORE any Pixeltable
imports so that Pixeltable's built-in OpenAI functions (embeddings, vision)
pick up the Gemini-compatible base URL and API key.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env into OS environment variables (non-destructive: existing env vars win).
_env_path = Path(__file__).resolve().parents[3] / "smartguard-mcp" / ".env"
load_dotenv(_env_path, override=False)

# Ensure OPENAI_API_KEY and OPENAI_BASE_URL are present in OS env for Pixeltable.
if not os.environ.get("OPENAI_API_KEY"):
    from smartguard_mcp.config import get_settings as _get_settings
    _s = _get_settings()
    os.environ.setdefault("OPENAI_API_KEY", _s.OPENAI_API_KEY)
    os.environ.setdefault("OPENAI_BASE_URL", _s.OPENAI_BASE_URL)

from smartguard_mcp.opik_utils import configure  # noqa: E402

configure()
