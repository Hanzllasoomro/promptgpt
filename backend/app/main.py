"""PromptGPT API — FastAPI entrypoint.

Run:  uvicorn app.main:app --reload --port 8000   (from backend/)
Docs: http://localhost:8000/docs

Stateless by design: prompts are engineered in memory, chat calls are
proxied once to the provider, and history lives in the browser. That
keeps deployment to a single container with no database to operate.
"""

from __future__ import annotations

import json
import time

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .chatbots import chatbot_links
from .config import get_settings
from .llm import langchain_client, providers
from .models import (
    ChatRequest,
    ChatResponse,
    GenerateRequest,
    GenerateResponse,
)
from .prompt_engine import build_engineered_prompt
from .security import is_plausible_key

settings = get_settings()

app = FastAPI(title=settings.app_name, version=settings.version)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-LLM-API-Key"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": settings.version, "langchain_available": langchain_client.available()}


@app.get("/api/providers")
def list_providers():
    """Provider catalogue. Note: no key is ever included in this response."""
    return {"providers": list(providers.PROVIDERS.values())}


@app.post("/api/prompts/generate", response_model=GenerateResponse)
def generate_prompt(req: GenerateRequest):
    engineered, concise, tips = build_engineered_prompt(req)
    return GenerateResponse(
        original_idea=req.idea.strip(),
        engineered_prompt=engineered,
        concise_prompt=concise,
        tips=tips,
        task_type=req.task_type,
    )


@app.get("/api/chatbots")
def list_chatbots(prompt: str = Query(..., min_length=1, max_length=20000)):
    """Prefilled / copy-first links for an engineered prompt.

    The prompt travels in the query string here only because the
    resulting chatbot links themselves need it URL-encoded; do not
    send API keys to this endpoint.
    """
    return {"chatbots": chatbot_links(prompt)}


@app.post("/api/chat/run", response_model=ChatResponse)
async def run_chat(
    req: ChatRequest,
    x_llm_api_key: str | None = Header(default=None, alias="X-LLM-API-Key"),
):
    info = providers.PROVIDERS.get(req.provider)
    if info is None:
        raise HTTPException(400, f"Unknown provider: {req.provider}")
    model = req.model or info.default_model
    key = providers.resolve_key(req.provider, x_llm_api_key)
    if not key or not is_plausible_key(key):
        raise HTTPException(
            400,
            "No API key supplied. Add your key in the Keys tab (it stays in "
            "your browser and is sent only with this request), or set the "
            f"server-side {req.provider.upper()} key environment variable.",
        )
    started = time.monotonic()
    try:
        # httpx adapters are the default path (dependency-light and
        # deterministic). LangChain is opt-in via /api/chat/run-langchain.
        reply, usage = await providers.run_chat(
            provider=req.provider,
            model=model,
            prompt=req.prompt,
            system=req.system,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
            api_key=key,
            base_url=req.base_url,
            timeout_s=settings.request_timeout_s,
        )
        via = "httpx"
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:  # provider/network failure, not a key leak
        raise HTTPException(502, f"Provider call failed: {exc.__class__.__name__}") from exc
    return ChatResponse(
        provider=req.provider,
        model=model,
        reply=reply,
        via=via,
        latency_ms=int((time.monotonic() - started) * 1000),
        usage=usage,
    )


@app.post("/api/chat/run-stream")
async def run_chat_stream(
    req: ChatRequest,
    x_llm_api_key: str | None = Header(default=None, alias="X-LLM-API-Key"),
):
    """Stream a chat reply as server-sent events.

    Events are ``data: {"type": "delta", "text": "..."}`` per chunk,
    then ``data: {"type": "done", "latency_ms": N}``. A provider error
    mid-stream is ``data: {"type": "error", "detail": "..."}`` — the
    HTTP status stays 200 because headers are already sent, so clients
    must handle the error event. Key validation happens before the
    stream starts, so a missing key or unknown provider still returns
    a plain 400 like /api/chat/run. The LangChain path has no stream
    equivalent and stays on /api/chat/run-langchain.
    """
    info = providers.PROVIDERS.get(req.provider)
    if info is None:
        raise HTTPException(400, f"Unknown provider: {req.provider}")
    key = providers.resolve_key(req.provider, x_llm_api_key)
    if not key or not is_plausible_key(key):
        raise HTTPException(
            400,
            "No API key supplied. Add your key in the Keys tab (it stays in "
            "your browser and is sent only with this request), or set the "
            f"server-side {req.provider.upper()} key environment variable.",
        )
    started = time.monotonic()

    async def event_source():
        try:
            async for chunk in providers.run_chat_stream(
                provider=req.provider,
                model=req.model or info.default_model,
                prompt=req.prompt,
                system=req.system,
                temperature=req.temperature,
                max_tokens=req.max_tokens,
                api_key=key,
                base_url=req.base_url,
                timeout_s=settings.request_timeout_s,
            ):
                yield f"data: {json.dumps({'type': 'delta', 'text': chunk})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'latency_ms': int((time.monotonic() - started) * 1000)})}\n\n"
        except Exception as exc:  # provider/network failure, not a key leak
            detail = str(exc) if isinstance(exc, ValueError) else f"Provider call failed: {exc.__class__.__name__}"
            yield f"data: {json.dumps({'type': 'error', 'detail': detail})}\n\n"

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/chat/run-langchain", response_model=ChatResponse)
async def run_chat_langchain(
    req: ChatRequest,
    x_llm_api_key: str | None = Header(default=None, alias="X-LLM-API-Key"),
):
    """Same as /api/chat/run, via LangChain when installed.

    Returns 501 with a clear message when the optional LangChain
    packages are not installed, instead of failing mysteriously.
    """
    if not langchain_client.available():
        raise HTTPException(
            501,
            "LangChain is not installed on this server. Install it with "
            "pip install -r requirements-langchain.txt, or use /api/chat/run.",
        )
    info = providers.PROVIDERS.get(req.provider)
    if info is None:
        raise HTTPException(400, f"Unknown provider: {req.provider}")
    key = providers.resolve_key(req.provider, x_llm_api_key)
    if not key or not is_plausible_key(key):
        raise HTTPException(400, "No API key supplied. Add your key in the Keys tab first.")
    started = time.monotonic()
    try:
        reply = await langchain_client.run_with_langchain(
            provider=req.provider,
            model=req.model or info.default_model,
            prompt=req.prompt,
            system=req.system,
            api_key=key,
            base_url=req.base_url,
        )
    except Exception as exc:
        raise HTTPException(502, f"LangChain provider call failed: {exc.__class__.__name__}") from exc
    return ChatResponse(
        provider=req.provider,
        model=req.model or info.default_model,
        reply=reply,
        via="langchain",
        latency_ms=int((time.monotonic() - started) * 1000),
    )


@app.post("/api/keys/check")
def check_key(
    provider: str = Query(...),
    x_llm_api_key: str | None = Header(default=None, alias="X-LLM-API-Key"),
):
    """Format-only check. It never calls the provider and never stores
    the key — a real provider call is the only true validity test, and
    that happens in /api/chat/run when the user actually chats."""
    if provider not in providers.PROVIDERS:
        raise HTTPException(400, f"Unknown provider: {provider}")
    ok = is_plausible_key(x_llm_api_key)
    return {
        "provider": provider,
        "format_ok": ok,
        "stored": False,
        "note": "Keys are never stored server-side. This checks format only.",
    }
