"""Multi-turn history: the conversation is re-sent to the provider so
follow-ups have context, in each provider's own message format, capped
to the most recent turns. No live provider is called: httpx is stubbed.
"""

import asyncio
import json

from fastapi.testclient import TestClient

from app.llm import providers
from app.main import app
from app.prompt_rules import DEFAULT_CHAT_SYSTEM_PROMPT

client = TestClient(app)
KEY = "AIzaSyFakeFakeFakeFakeFakeFakeFakeFake12"
HISTORY = [
    {"role": "user", "content": "What is 2+2?"},
    {"role": "assistant", "content": "4"},
    {"role": "user", "content": "And 3+3?"},
]


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
    """httpx.AsyncClient stub that records (method, url, json) per call."""

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, url, params=None, json=None, headers=None):
            calls.append(("post", url, json))
            return script.pop(0)

        def stream(self, method, url, params=None, json=None, headers=None):
            calls.append(("stream", url, json))
            return FakeStreamCtx(script.pop(0))

    return FakeClient


def run(monkeypatch, provider, script, calls, **kwargs):
    monkeypatch.setattr(providers.httpx, "AsyncClient", make_client(script, calls))
    params = dict(
        provider=provider, model="", prompt="And 3+3?", system="",
        temperature=0.7, max_tokens=1024, api_key=KEY, base_url="", timeout_s=60.0,
        messages=HISTORY,
    )
    params.update(kwargs)
    return asyncio.run(providers.run_chat(**params))


def test_openai_history_sent_in_order(monkeypatch):
    calls = []
    script = [FakeResp(200, {"choices": [{"message": {"content": "6"}}], "usage": {}})]
    reply, _usage, _used = run(monkeypatch, "openai", script, calls, api_key="sk-test")
    assert reply == "6"
    sent = calls[0][2]["messages"]
    # The platform default system prompt is always sent first, then the
    # history in order — chat no longer runs with no system prompt.
    assert sent[0] == {"role": "system", "content": DEFAULT_CHAT_SYSTEM_PROMPT}
    assert sent[1:] == HISTORY


def test_google_history_uses_model_role(monkeypatch):
    calls = []
    script = [FakeResp(200, {"candidates": [{"content": {"parts": [{"text": "6"}]}}], "usageMetadata": {}})]
    reply, _usage, _used = run(monkeypatch, "google", script, calls)
    assert reply == "6"
    contents = calls[0][2]["contents"]
    assert [(c.get("role", "user"), c["parts"][0]["text"]) for c in contents] == [
        ("user", "What is 2+2?"),
        ("model", "4"),
        ("user", "And 3+3?"),
    ]


def test_anthropic_history_sent_with_system_separate(monkeypatch):
    calls = []
    script = [FakeResp(200, {"content": [{"text": "6"}], "usage": {}})]
    reply, _usage, _used = run(
        monkeypatch, "anthropic", script, calls, api_key="sk-ant-test", system="Be brief."
    )
    assert reply == "6"
    sent = calls[0][2]
    assert sent["system"] == "Be brief."
    assert sent["messages"] == HISTORY


def test_history_capped_at_most_recent_20(monkeypatch):
    calls = []
    many = [
        {"role": "user" if i % 2 == 0 else "assistant", "content": f"m{i}"}
        for i in range(25)
    ]
    script = [FakeResp(200, {"choices": [{"message": {"content": "ok"}}], "usage": {}})]
    _reply, _usage, _used = run(
        monkeypatch, "openai", script, calls, api_key="sk-test",
        messages=many, prompt="m24",
    )
    sent = calls[0][2]["messages"]
    # 20 history turns plus the default system message on top.
    assert len(sent) == 21
    assert sent[0] == {"role": "system", "content": DEFAULT_CHAT_SYSTEM_PROMPT}
    assert sent[1]["content"] == "m5"
    assert sent[-1]["content"] == "m24"


def test_prompt_only_stays_single_turn(monkeypatch):
    calls = []
    script = [FakeResp(200, {"choices": [{"message": {"content": "hi"}}], "usage": {}})]
    _reply, _usage, _used = run(monkeypatch, "openai", script, calls, api_key="sk-test", prompt="Hello", messages=[])
    assert calls[0][2]["messages"] == [
        {"role": "system", "content": DEFAULT_CHAT_SYSTEM_PROMPT},
        {"role": "user", "content": "Hello"},
    ]


def test_stream_history_sent_to_google(monkeypatch):
    calls = []
    monkeypatch.setattr(
        providers.httpx, "AsyncClient", make_client([FakeResp(200, {})], calls)
    )

    async def collect():
        used: dict = {}
        chunks = []
        async for chunk in providers.run_chat_stream(
            provider="google", model="", prompt="And 3+3?", system="",
            temperature=0.7, max_tokens=1024, api_key=KEY, base_url="", timeout_s=60.0,
            messages=HISTORY, used=used,
        ):
            chunks.append(chunk)
        return chunks, used.get("model")

    chunks, used = asyncio.run(collect())
    assert chunks == ["ok"]
    assert used == "gemini-3.8-flash"
    contents = calls[0][2]["contents"]
    assert [c.get("role", "user") for c in contents] == ["user", "model", "user"]


def test_endpoint_passes_messages_through(monkeypatch):
    captured: dict = {}

    async def fake(**kwargs):
        captured.update(kwargs)
        return ("6", None, "gpt-4o-mini")

    monkeypatch.setattr(providers, "run_chat", fake)
    r = client.post(
        "/api/chat/run",
        json={"provider": "openai", "prompt": "And 3+3?", "messages": HISTORY},
        headers={"X-LLM-API-Key": "sk-testkey"},
    )
    assert r.status_code == 200
    assert r.json()["reply"] == "6"
    assert captured["messages"] == HISTORY
    assert captured["prompt"] == "And 3+3?"
