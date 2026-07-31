"""SmartGuard Agent API package.

Loads environment variables into the OS environment before any Pixeltable
imports (the Memory class uses Pixeltable internally).
"""
import os
from pathlib import Path

from dotenv import load_dotenv

_env_path = Path(__file__).resolve().parents[3] / "smartguard-api" / ".env"
load_dotenv(_env_path, override=False)

from smartguard_api.opik_utils import configure  # noqa: E402

configure()
