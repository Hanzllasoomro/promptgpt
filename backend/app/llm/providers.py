"""Provider registry and httpx adapters.

The adapters speak each provider's HTTP API directly, so the core
backend has no heavy dependency. LangChain (``langchain_client.py``) is
an optional layer on top for teams that already standardise on it.

A provider call needs exactly one key: the per-request header key, or
the server-side environment fallback. The key is passed to httpx and
never stored, logged or returned.
"""

from __future__ import annotations

import httpx

from ..config import get_settings
from ..models import ProviderInfo

PROVIDERS: dict[str, ProviderInfo] = {
    "openai": ProviderInfo(
        id="openai",
        name="OpenAI",
        default_model="gpt-4o-mini",
        models=["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
        key_help="Create one at platform.openai.com → API keys. It starts with sk-.",
    ),
    "anthropic": ProviderInfo(
        id="anthropic",
        name="Anthropic (Claude)",
        default_model="claude-3-5-sonnet-latest",
        models=["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
        key_help="Create one at console.anthropic.com → API keys. It starts with sk-ant-.",
    ),
    "google": ProviderInfo(
        id="google",
        name="Google (Gemini)",
        default_model="gemini-2.0-flash",
        models=["gemini-2.0-flash", "gemini-1.5-pro"],
        key_help="Create one at aistudio.google.com → Get API key.",
    ),
    "huggingface": ProviderInfo(
        id="huggingface",
        name="Hugging Face",
        default_model="meta-llama/Meta-Llama-3.1-8B-Instruct",
        models=[
            "meta-llama/Meta-Llama-3.1-8B-Instruct",
            "mistralai/Mistral-7B-Instruct-v0.3",
            "Qwen/Qwen2.5-7B-Instruct",
        ],
        key_help="Create one at huggingface.co → Settings → Access Tokens. Some models are gated and need access approval first.",
    ),
    "openai-compatible": ProviderInfo(
        id="openai-compatible",
        name="OpenAI-compatible (Ollama, LM Studio, Groq, DeepSeek …)",
        default_model="llama3.1",
        models=["llama3.1"],
        key_help="For local servers the key can be anything non-empty; remote ones need their real key. Set Base URL, e.g. http://localhost:11434/v1 for Ollama.",
        supports_base_url=True,
    ),
}

_ENV_FALLBACK = {
    "openai": lambda s: s.openai_api_key,
    "anthropic": lambda s: s.anthropic_api_key,
    "google": lambda s: s.google_api_key,
    "huggingface": lambda s: s.huggingface_api_key,
}


def resolve_key(provider: str, header_key: str | None) -> str | None:
    if header_key and header_key.strip():
        return header_key.strip()
    fn = _ENV_FALLBACK.get(provider)
    if fn:
        value = fn(get_settings())
        return value or None
    return None


def _messages(prompt: str, system: str) -> list[dict]:
    msgs: list[dict] = []
    if system.strip():
        msgs.append({"role": "system", "content": system.strip()})
    msgs.append({"role": "user", "content": prompt})
    return msgs


async def run_chat(
    provider: str,
    model: str,
    prompt: str,
    system: str,
    temperature: float,
    max_tokens: int,
    api_key: str,
    base_url: str,
    timeout_s: float,
) -> tuple[str, dict | None]:
    """Return (reply_text, usage_or_None). Raises ValueError / httpx errors."""
    info = PROVIDERS.get(provider)
    if info is None:
        raise ValueError(f"Unknown provider: {provider}")
    model = model or info.default_model
    timeout = httpx.Timeout(timeout_s)
    async with httpx.AsyncClient(timeout=timeout) as client:
        if provider in ("openai", "huggingface", "openai-compatible"):
            url = _openai_url(provider, base_url)
            payload = {
                "model": model,
                "messages": _messages(prompt, system),
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            headers = {"Authorization": f"Bearer {api_key}"}
            if provider == "huggingface":
                # HF Inference router accepts OpenAI-compatible chat completions.
                headers["Content-Type"] = "application/json"
            resp = await client.post(url, json=payload, headers=headers)
            _raise(resp, provider)
            data = resp.json()
            choice = data["choices"][0]["message"]["content"]
            return choice, data.get("usage")

        if provider == "anthropic":
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                json={
                    "model": model,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "system": system or "You are a helpful assistant.",
                    "messages": [{"role": "user", "content": prompt}],
                },
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
            )
            _raise(resp, provider)
            data = resp.json()
            text = "".join(b.get("text", "") for b in data.get("content", []))
            return text, data.get("usage")

        if provider == "google":
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                params={"key": api_key},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "systemInstruction": {"parts": [{"text": system}]} if system.strip() else None,
                    "generationConfig": {
                        "temperature": temperature,
                        "maxOutputTokens": max_tokens,
                    },
                },
            )
            _raise(resp, provider)
            data = resp.json()
            parts = data["candidates"][0]["content"]["parts"]
            return "".join(p.get("text", "") for p in parts), data.get("usageMetadata")

    raise ValueError(f"Unknown provider: {provider}")


def _openai_url(provider: str, base_url: str) -> str:
    if provider == "huggingface":
        return "https://router.huggingface.co/v1/chat/completions"
    if provider == "openai-compatible":
        if not base_url.strip():
            raise ValueError("openai-compatible requires a base_url (e.g. http://localhost:11434/v1)")
        return base_url.rstrip("/") + "/chat/completions"
    return "https://api.openai.com/v1/chat/completions"


def _raise(resp: httpx.Response, provider: str) -> None:
    if resp.status_code < 400:
        return
    # Surface the provider's message, but never echo request headers/keys.
    try:
        detail = resp.json()
        msg = detail.get("error", {}).get("message") or detail.get("error") or resp.text
    except Exception:
        msg = resp.text
    raise ValueError(f"{provider} returned {resp.status_code}: {str(msg)[:500]}")
