"""Retry-on-503 and model fallback for Google (and retry for others).

A 503 is a transient overload, not a bad key: the same model is tried
again with backoff, then the next model in the provider's list answers
instead. A 400/401/403 is raised immediately — retrying a bad key
cannot help. No live provider is called here: httpx is stubbed.
"""

import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from app.llm import providers
from app.llm.providers import ProviderError
from app.main import app

client = TestClient(app)
KEY = "AIzaSyFakeFakeFakeFakeFakeFakeFakeFake12"
GOOGLE_OK = {"candidates": [{"content": {"parts": [{"text": "ok"}]}}], "usageMetadata": {}}
GOOGLE_503 = {"error": {"code": 503, "message": "This model is currently experiencing high demand."}}
GOOGLE_400 = {"error": {"code": 400, "message": "API key not valid. Please pass a valid API key."}}


class FakeResp:
    def __init__(self, status, payload):
        self.status_code = status
        self._payload = payload

    @property
    def content(self):
        return json.dumps(self._payload).encode()

    def json(self):
        return self._payload

    async def aread(self):
        return self.content

    async def aiter_lines(self):
        yield 'data: {"candidates": [{"content": {"parts": [{"text": "ok"}]}}]}'


class FakeStreamCtx:
    def __init__(self, resp):
        self._resp = resp

    async def __aenter__(self):
        return self._resp

    async def __aexit__(self, *args):
        return False


def make_client(script, calls):
    """httpx.AsyncClient stub: post()/stream() pop canned responses."""

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, url, params=None, json=None, headers=None):
            calls.append(("post", url))
            return script.pop(0)

        def stream(self, method, url, params=None, json=None, headers=None):
            calls.append(("stream", url))
            return FakeStreamCtx(script.pop(0))

    return FakeClient


def run_google(monkeypatch, script, calls, **kwargs):
    monkeypatch.setattr(providers, "_RETRY_DELAYS_S", (0.0, 0.0))
    monkeypatch.setattr(providers.httpx, "AsyncClient", make_client(script, calls))
    params = dict(
        provider="google", model="", prompt="Say hi", system="",
        temperature=0.7, max_tokens=1024, api_key=KEY, base_url="", timeout_s=60.0,
    )
    params.update(kwargs)
    return asyncio.run(providers.run_chat(**params))


def test_retry_503_then_success_same_model(monkeypatch):
    calls = []
    script = [FakeResp(503, GOOGLE_503), FakeResp(503, GOOGLE_503), FakeResp(200, GOOGLE_OK)]
    reply, _usage, used = run_google(monkeypatch, script, calls)
    assert reply == "ok"
    assert used == "gemini-3.8-flash"
    assert len(calls) == 3
    assert all("gemini-3.8-flash" in url for _, url in calls)


def test_fallback_to_next_model_after_503s(monkeypatch):
    calls = []
    script = [FakeResp(503, GOOGLE_503)] * 3 + [FakeResp(200, GOOGLE_OK)]
    reply, _usage, used = run_google(monkeypatch, script, calls)
    assert reply == "ok"
    assert used == "gemini-2.0-flash"
    assert [url.split("/models/")[1].split(":")[0] for _, url in calls] == [
        "gemini-3.8-flash", "gemini-3.8-flash", "gemini-3.8-flash", "gemini-2.0-flash",
    ]


def test_fallback_skips_404_model(monkeypatch):
    calls = []
    script = [FakeResp(404, {"error": {"code": 404, "message": "model not found"}}), FakeResp(200, GOOGLE_OK)]
    _reply, _usage, used = run_google(monkeypatch, script, calls)
    assert used == "gemini-2.0-flash"
    assert len(calls) == 2


def test_bad_key_is_not_retried(monkeypatch):
    calls = []
    script = [FakeResp(400, GOOGLE_400)]
    with pytest.raises(ProviderError) as excinfo:
        run_google(monkeypatch, script, calls)
    assert excinfo.value.status == 400
    assert "API key not valid" in str(excinfo.value)
    assert len(calls) == 1


def test_all_models_overloaded_reports_tried_models(monkeypatch):
    calls = []
    script = [FakeResp(503, GOOGLE_503)] * 12  # 4 models x 3 attempts
    with pytest.raises(ProviderError) as excinfo:
        run_google(monkeypatch, script, calls)
    assert excinfo.value.status == 503
    assert "tried models: gemini-3.8-flash, gemini-2.0-flash, gemini-3.5-flash, gemini-1.5-pro" in str(excinfo.value)
    assert len(calls) == 12


def test_openai_503_is_retried_same_model(monkeypatch):
    calls = []
    monkeypatch.setattr(providers, "_RETRY_DELAYS_S", (0.0, 0.0))
    script = [
        FakeResp(503, {"error": {"code": 503, "message": "overloaded"}}),
        FakeResp(200, {"choices": [{"message": {"content": "hi"}}], "usage": {}}),
    ]
    monkeypatch.setattr(providers.httpx, "AsyncClient", make_client(script, calls))
    reply, _usage, used = asyncio.run(
        providers.run_chat(
            provider="openai", model="", prompt="hi", system="", temperature=0.7,
            max_tokens=10, api_key="sk-test", base_url="", timeout_s=60.0,
        )
    )
    assert reply == "hi"
    assert used == "gpt-4o-mini"
    assert len(calls) == 2


def test_stream_fallback_returns_used_model(monkeypatch):
    calls = []
    monkeypatch.setattr(providers, "_RETRY_DELAYS_S", (0.0, 0.0))
    monkeypatch.setattr(
        providers.httpx,
        "AsyncClient",
        make_client([FakeResp(503, GOOGLE_503)] * 3 + [FakeResp(200, GOOGLE_OK)], calls),
    )

    async def collect():
        used: dict = {}
        chunks = []
        async for chunk in providers.run_chat_stream(
            provider="google", model="", prompt="Say hi", system="",
            temperature=0.7, max_tokens=1024, api_key=KEY, base_url="", timeout_s=60.0,
            used=used,
        ):
            chunks.append(chunk)
        return chunks, used.get("model")

    chunks, used = asyncio.run(collect())
    assert chunks == ["ok"]
    assert used == "gemini-2.0-flash"


def test_chat_run_reports_provider_503_as_503(monkeypatch):
    async def failing(**kwargs):
        raise ProviderError("google", 503, "google returned 503: high demand")

    monkeypatch.setattr(providers, "run_chat", failing)
    r = client.post(
        "/api/chat/run",
        json={"provider": "google", "prompt": "hi"},
        headers={"X-LLM-API-Key": KEY},
    )
    assert r.status_code == 503
    assert "high demand" in r.json()["detail"]


def test_stream_done_event_names_used_model(monkeypatch):
    async def fake_stream(**kwargs):
        yield "Hel"
        yield "lo"
        used = kwargs.get("used")
        if used is not None:
            used["model"] = "gemini-2.0-flash"

    monkeypatch.setattr(providers, "run_chat_stream", fake_stream)
    r = client.post(
        "/api/chat/run-stream",
        json={"provider": "google", "prompt": "hi"},
        headers={"X-LLM-API-Key": KEY},
    )
    assert r.status_code == 200
    assert '"type": "done"' in r.text
    assert '"model": "gemini-2.0-flash"' in r.text
    assert KEY not in r.text
