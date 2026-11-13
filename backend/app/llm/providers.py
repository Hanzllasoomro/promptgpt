"""Provider registry and httpx adapters.

The adapters speak each provider's HTTP API directly, so the core
backend has no heavy dependency. LangChain (``langchain_client.py``) is
an optional layer on top for teams that already standardise on it.

A provider call needs exactly one key: the per-request header key, or
the server-side environment fallback. The key is passed to httpx and
never stored, logged or returned.
"""

from __future__ import annotations

import asyncio

import httpx

from ..config import get_settings
from ..models import ProviderInfo
from ..prompt_rules import DEFAULT_CHAT_SYSTEM_PROMPT

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
        default_model="gemini-3.8-flash",
        # Verified live 2026-11-10 against the Gemini models endpoint:
        # gemini-2.0-flash and gemini-1.5-pro are retired (404), and
        # gemini-2.5-flash answers 404 "no longer available to new
        # users". Only the two Flash models below are offered.
        models=["gemini-3.8-flash", "gemini-3.5-flash"],
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


# Conversation history is capped so a long chat cannot silently blow
# past the provider's context window or the request size limit: the
# most recent 10 turns (20 messages) are sent, older turns dropped.
MAX_HISTORY_MESSAGES = 20


def _turns(prompt: str, messages: list[dict] | None) -> list[dict]:
    """The turns to send: the supplied history, guaranteed to end with
    ``prompt`` as a user turn, capped to the most recent turns. With
    no history this is just the single prompt, so one-shot callers are
    unaffected."""
    turns = [
        {"role": m["role"], "content": m["content"]}
        for m in (messages or [])
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]
    if not turns or turns[-1]["role"] != "user" or turns[-1]["content"] != prompt:
        turns.append({"role": "user", "content": prompt})
    return turns[-MAX_HISTORY_MESSAGES:]


def _google_payload(
    prompt: str,
    system: str,
    temperature: float,
    max_tokens: int,
    turns: list[dict] | None = None,
) -> dict:
    """generateContent body. ``systemInstruction`` is omitted entirely
    when no system instruction was given: sending it as ``null`` is
    not a valid Content and some Google API surfaces reject the request
    for it, so the field must not be present at all. With history, the
    turns become the contents (assistant turns use Google's ``model``
    role); without it, the single prompt is the only content."""
    if turns:
        contents = [
            {
                "role": "user" if t["role"] == "user" else "model",
                "parts": [{"text": t["content"]}],
            }
            for t in turns
        ]
    else:
        contents = [{"parts": [{"text": prompt}]}]
    payload: dict = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        },
    }
    if system.strip():
        payload["systemInstruction"] = {"parts": [{"text": system}]}
    return payload


class ProviderError(ValueError):
    """A provider call failed. Carries the provider's HTTP status so the
    API can report a 503 as a 503 instead of flattening every provider
    failure to a 400."""

    def __init__(self, provider: str, status: int, message: str):
        super().__init__(message)
        self.provider = provider
        self.status = status
        self.message = message


# Retry policy for transient overloads (notably Gemini 503s, which are
# Google-side capacity errors, not quota or key problems):
# up to 3 attempts per model, waiting 2s then 4s between attempts.
_RETRY_DELAYS_S = (2.0, 4.0)
# 503: same model is worth retrying. 404: the model is unavailable for
# this key/project (retired or never enabled), so try the next model.
# 429: this model's quota/rate limit is exhausted — retrying the same
# model cannot help (a free-tier daily quota does not come back in
# seconds), so try the next model, which has its own quota. 429 is
# deliberately NOT retried on the same model.
_RETRYABLE_STATUSES = {503}
_FALLBACK_STATUSES = {503, 404, 429}


def _candidate_models(info: ProviderInfo, requested: str) -> list[str]:
    """Requested model first, then the provider's other models in list
    order. Fallback only ever runs within one provider and one tier
    family (for Google, the Flash models), never across providers."""
    return [requested] + [m for m in info.models if m != requested]


def _error_from_body(status: int, body: bytes, provider: str) -> ProviderError:
    """Provider error from a response body, without headers or keys."""
    try:
        import json as _json

        detail = _json.loads(body.decode("utf-8", "replace"))
        msg = detail.get("error", {}).get("message") or detail.get("error") or body.decode("utf-8", "replace")
    except Exception:
        msg = body.decode("utf-8", "replace")
    return ProviderError(provider, status, f"{provider} returned {status}: {str(msg)[:500]}")


def _effective_system(system: str) -> str:
    """The system prompt actually sent: the caller's own system prompt
    when one was given, otherwise the platform default, which carries
    the accuracy rules (no placeholders, no invented facts, state
    assumptions). Chat used to run with no system prompt at all, which
    left the model free to answer with bracketed templates."""
    return system.strip() or DEFAULT_CHAT_SYSTEM_PROMPT


def _messages(prompt: str, system: str, turns: list[dict] | None = None) -> list[dict]:
    """OpenAI-style message list: the system message first (the
    caller's own, or the platform default), then the conversation
    turns (which already end with the latest user prompt), or just the
    single prompt when there is no history."""
    msgs: list[dict] = [{"role": "system", "content": _effective_system(system)}]
    if turns:
        msgs.extend({"role": t["role"], "content": t["content"]} for t in turns)
    else:
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
    messages: list[dict] | None = None,
) -> tuple[str, dict | None, str]:
    """Return (reply_text, usage_or_None, model_actually_used).

    ``messages`` is the conversation history (user/assistant turns);
    it is sent to the provider so follow-ups have context, capped to
    the most recent turns by :func:`_turns`. A 503 (transient overload)
    is retried on the same model, then the next model in the provider's
    list is tried (Google only in practice: the Flash models are one
    tier, so a fallback costs the user nothing extra). A 404 also moves
    to the next model, since it means that model is unavailable for
    this key/project. Any other error — a bad key (400/401/403), a bad
    request — is raised immediately: retrying it cannot help. Raises
    ProviderError / httpx errors.
    """
    info = PROVIDERS.get(provider)
    if info is None:
        raise ValueError(f"Unknown provider: {provider}")
    model = model or info.default_model
    turns = _turns(prompt, messages)
    timeout = httpx.Timeout(timeout_s)
    async with httpx.AsyncClient(timeout=timeout) as client:
        if provider in ("openai", "huggingface", "openai-compatible"):
            url = _openai_url(provider, base_url)
            payload = {
                "model": model,
                "messages": _messages(prompt, system, turns),
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            headers = {"Authorization": f"Bearer {api_key}"}
            if provider == "huggingface":
                # HF Inference router accepts OpenAI-compatible chat completions.
                headers["Content-Type"] = "application/json"
            resp = await _post_with_retry(client, url, provider, json=payload, headers=headers)
            data = resp.json()
            choice = data["choices"][0]["message"]["content"]
            return choice, data.get("usage"), model

        if provider == "anthropic":
            resp = await _post_with_retry(
                client,
                "https://api.anthropic.com/v1/messages",
                provider,
                json={
                    "model": model,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "system": _effective_system(system),
                    "messages": [{"role": t["role"], "content": t["content"]} for t in turns],
                },
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
            )
            data = resp.json()
            text = "".join(b.get("text", "") for b in data.get("content", []))
            return text, data.get("usage"), model

        if provider == "google":
            last_error: ProviderError | None = None
            for candidate in _candidate_models(info, model):
                for attempt in range(len(_RETRY_DELAYS_S) + 1):
                    resp = await client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{candidate}:generateContent",
                        params={"key": api_key},
                        json=_google_payload(prompt, _effective_system(system), temperature, max_tokens, turns),
                    )
                    if resp.status_code < 400:
                        data = resp.json()
                        parts = data["candidates"][0]["content"]["parts"]
                        return "".join(p.get("text", "") for p in parts), data.get("usageMetadata"), candidate
                    err = _provider_error(resp, provider)
                    if err.status in _RETRYABLE_STATUSES and attempt < len(_RETRY_DELAYS_S):
                        last_error = err
                        await asyncio.sleep(_RETRY_DELAYS_S[attempt])
                        continue
                    if err.status in _FALLBACK_STATUSES:
                        last_error = err
                        break  # try the next model in the list
                    raise err
            assert last_error is not None  # candidates is never empty
            tried = ", ".join(_candidate_models(info, model))
            raise ProviderError(
                provider,
                last_error.status,
                f"{last_error.message} (tried models: {tried})",
            )

    raise ValueError(f"Unknown provider: {provider}")


async def _post_with_retry(client: httpx.AsyncClient, url: str, provider: str, **kwargs) -> httpx.Response:
    """POST once, retrying only a 503 with backoff. Other failures are
    raised via :func:`_raise` (a bad key or bad request cannot be
    retried into working)."""
    resp: httpx.Response | None = None
    for attempt in range(len(_RETRY_DELAYS_S) + 1):
        resp = await client.post(url, **kwargs)
        if resp.status_code != 503 or attempt == len(_RETRY_DELAYS_S):
            break
        await asyncio.sleep(_RETRY_DELAYS_S[attempt])
    assert resp is not None
    _raise(resp, provider)
    return resp


def _google_chunk_text(data: dict) -> str:
    """Text carried by one Gemini streamGenerateContent chunk, or ""."""
    try:
        parts = data["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError, TypeError):
        return ""
    return "".join(p.get("text", "") for p in parts if isinstance(p, dict))


def _openai_chunk_text(data: dict) -> str:
    """Text carried by one OpenAI-compatible stream chunk, or ""."""
    try:
        delta = data["choices"][0]["delta"]
    except (KeyError, IndexError, TypeError):
        return ""
    return delta.get("content") or "" if isinstance(delta, dict) else ""


def _anthropic_chunk_text(event: str, data: dict) -> str:
    """Text carried by one Anthropic stream event, or ""."""
    if event != "content_block_delta":
        return ""
    delta = data.get("delta") or {}
    return delta.get("text", "") if isinstance(delta, dict) else ""


async def run_chat_stream(
    provider: str,
    model: str,
    prompt: str,
    system: str,
    temperature: float,
    max_tokens: int,
    api_key: str,
    base_url: str,
    timeout_s: float,
    used: dict | None = None,
    messages: list[dict] | None = None,
):
    """Yield reply text as it arrives. When the stream finishes, the
    model actually used is recorded in ``used["model"]`` when ``used``
    is given (relevant when a fallback model answered) — async
    generators cannot return a value, so a state dict carries it.

    Unlike :func:`run_chat`, this never waits for the whole reply: each
    provider chunk is yielded as soon as it is parsed. The httpx read
    timeout applies per chunk, not to the whole generation, so a long
    reply does not hit the timeout just for being long — only a stall
    between chunks does. A 503 before the first chunk is retried with
    backoff, and for Google the next model in the list is then tried,
    exactly as in :func:`run_chat`. Raises ProviderError / httpx errors.
    """
    info = PROVIDERS.get(provider)
    if info is None:
        raise ValueError(f"Unknown provider: {provider}")
    model = model or info.default_model
    turns = _turns(prompt, messages)
    timeout = httpx.Timeout(timeout_s)
    async with httpx.AsyncClient(timeout=timeout) as client:
        if provider in ("openai", "huggingface", "openai-compatible"):
            url = _openai_url(provider, base_url)
            payload = {
                "model": model,
                "messages": _messages(prompt, system, turns),
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": True,
            }
            headers = {"Authorization": f"Bearer {api_key}"}
            if provider == "huggingface":
                headers["Content-Type"] = "application/json"
            for attempt in range(len(_RETRY_DELAYS_S) + 1):
                retry = False
                async with client.stream("POST", url, json=payload, headers=headers) as resp:
                    if resp.status_code >= 400:
                        err = _error_from_body(resp.status_code, await resp.aread(), provider)
                        if err.status in _RETRYABLE_STATUSES and attempt < len(_RETRY_DELAYS_S):
                            await asyncio.sleep(_RETRY_DELAYS_S[attempt])
                            retry = True
                        else:
                            raise err
                    else:
                        async for line in resp.aiter_lines():
                            line = line.strip()
                            if not line.startswith("data:"):
                                continue
                            data_text = line[5:].strip()
                            if data_text == "[DONE]":
                                break
                            try:
                                import json as _json

                                data = _json.loads(data_text)
                            except Exception:
                                continue
                            text = _openai_chunk_text(data)
                            if text:
                                yield text
                        if used is not None:
                            used["model"] = model
                        return
                if not retry:
                    return

        if provider == "anthropic":
            for attempt in range(len(_RETRY_DELAYS_S) + 1):
                retry = False
                async with client.stream(
                    "POST",
                    "https://api.anthropic.com/v1/messages",
                    json={
                        "model": model,
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                        "system": _effective_system(system),
                        "messages": [{"role": t["role"], "content": t["content"]} for t in turns],
                        "stream": True,
                    },
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                ) as resp:
                    if resp.status_code >= 400:
                        err = _error_from_body(resp.status_code, await resp.aread(), provider)
                        if err.status in _RETRYABLE_STATUSES and attempt < len(_RETRY_DELAYS_S):
                            await asyncio.sleep(_RETRY_DELAYS_S[attempt])
                            retry = True
                        else:
                            raise err
                    else:
                        event = ""
                        async for line in resp.aiter_lines():
                            line = line.strip()
                            if line.startswith("event:"):
                                event = line[6:].strip()
                            elif line.startswith("data:"):
                                try:
                                    import json as _json

                                    data = _json.loads(line[5:].strip())
                                except Exception:
                                    continue
                                text = _anthropic_chunk_text(event, data)
                                if text:
                                    yield text
                        if used is not None:
                            used["model"] = model
                        return
                if not retry:
                    return

        if provider == "google":
            last_error: ProviderError | None = None
            for candidate in _candidate_models(info, model):
                for attempt in range(len(_RETRY_DELAYS_S) + 1):
                    retry = False
                    async with client.stream(
                        "POST",
                        f"https://generativelanguage.googleapis.com/v1beta/models/{candidate}:streamGenerateContent",
                        params={"key": api_key, "alt": "sse"},
                        json=_google_payload(prompt, _effective_system(system), temperature, max_tokens, turns),
                    ) as resp:
                        if resp.status_code >= 400:
                            err = _error_from_body(resp.status_code, await resp.aread(), provider)
                            if err.status in _RETRYABLE_STATUSES and attempt < len(_RETRY_DELAYS_S):
                                last_error = err
                                await asyncio.sleep(_RETRY_DELAYS_S[attempt])
                                retry = True
                            elif err.status in _FALLBACK_STATUSES:
                                last_error = err
                            else:
                                raise err
                        else:
                            async for line in resp.aiter_lines():
                                line = line.strip()
                                if not line.startswith("data:"):
                                    continue
                                try:
                                    import json as _json

                                    data = _json.loads(line[5:].strip())
                                except Exception:
                                    continue
                                text = _google_chunk_text(data)
                                if text:
                                    yield text
                            if used is not None:
                                used["model"] = candidate
                            return
                    if retry:
                        continue
                    break  # fall through to the next model in the list
            assert last_error is not None  # candidates is never empty
            tried = ", ".join(_candidate_models(info, model))
            raise ProviderError(
                provider,
                last_error.status,
                f"{last_error.message} (tried models: {tried})",
            )

    raise ValueError(f"Unknown provider: {provider}")


def _openai_url(provider: str, base_url: str) -> str:
    if provider == "huggingface":
        return "https://router.huggingface.co/v1/chat/completions"
    if provider == "openai-compatible":
        if not base_url.strip():
            raise ValueError("openai-compatible requires a base_url (e.g. http://localhost:11434/v1)")
        return base_url.rstrip("/") + "/chat/completions"
    return "https://api.openai.com/v1/chat/completions"


def _provider_error(resp: httpx.Response, provider: str) -> ProviderError:
    """ProviderError for a failed non-streaming response."""
    return _error_from_body(resp.status_code, resp.content, provider)


def _raise(resp: httpx.Response, provider: str) -> None:
    if resp.status_code < 400:
        return
    # Surface the provider's message, but never echo request headers/keys.
    raise _provider_error(resp, provider)
