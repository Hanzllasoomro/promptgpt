"""Configuration, read only from the environment.

No API key is ever hard-coded here. Server-side provider keys are optional
fallbacks (``OPENAI_API_KEY`` etc.); the normal path is bring-your-own-key:
the browser sends the user's key per request in the ``X-LLM-API-Key``
header and the backend forwards it once and discards it.
"""

from __future__ import annotations

import os
from functools import lru_cache


def _origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
    return [o.strip() for o in raw.split(",") if o.strip()]


class Settings:
    app_name: str = "PromptGPT API"
    version: str = "2.0.0"
    cors_origins: list[str] = _origins()
    # Optional server-side fallbacks. Empty = BYO key required for that provider.
    openai_api_key: str = os.environ.get("OPENAI_API_KEY", "")
    anthropic_api_key: str = os.environ.get("ANTHROPIC_API_KEY", "")
    google_api_key: str = os.environ.get("GOOGLE_API_KEY", "")
    huggingface_api_key: str = os.environ.get("HF_API_KEY", "") or os.environ.get(
        "HUGGINGFACE_API_KEY", ""
    )
    request_timeout_s: float = float(os.environ.get("LLM_TIMEOUT_S", "60"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
