"""Streaming endpoint and provider chunk parsers.

The live provider streams are not called here: chunk parsers are tested
on recorded-shaped payloads, and the endpoint is tested with a stubbed
run_chat_stream. A real key is never needed.
"""

from fastapi.testclient import TestClient

from app.llm import providers
from app.main import app

client = TestClient(app)
KEY = "sk-test-12345678"


def test_google_chunk_text():
    data = {"candidates": [{"content": {"parts": [{"text": "Hel"}, {"text": "lo"}]}}]}
    assert providers._google_chunk_text(data) == "Hello"
    assert providers._google_chunk_text({}) == ""
    assert providers._google_chunk_text({"candidates": []}) == ""


def test_openai_chunk_text():
    data = {"choices": [{"delta": {"content": "Hi"}}]}
    assert providers._openai_chunk_text(data) == "Hi"
    assert providers._openai_chunk_text({"choices": [{"delta": {}}]}) == ""
    assert providers._openai_chunk_text({}) == ""


def test_anthropic_chunk_text_only_delta_events():
    assert providers._anthropic_chunk_text("content_block_delta", {"delta": {"text": "Yo"}}) == "Yo"
    assert providers._anthropic_chunk_text("message_start", {"delta": {"text": "Yo"}}) == ""


def test_stream_without_key_is_rejected_before_streaming():
    r = client.post("/api/chat/run-stream", json={"provider": "google", "prompt": "hi"})
    assert r.status_code == 400


def test_stream_unknown_provider():
    r = client.post(
        "/api/chat/run-stream",
        json={"provider": "nope", "prompt": "hi"},
        headers={"X-LLM-API-Key": KEY},
    )
    assert r.status_code == 400


def test_stream_yields_deltas_then_done(monkeypatch):
    async def fake_stream(**kwargs):
        yield "Hel"
        yield "lo"

    monkeypatch.setattr(providers, "run_chat_stream", fake_stream)
    r = client.post(
        "/api/chat/run-stream",
        json={"provider": "google", "prompt": "hi"},
        headers={"X-LLM-API-Key": KEY},
    )
    assert r.status_code == 200
    assert "text/event-stream" in r.headers["content-type"]
    assert '"type": "delta", "text": "Hel"' in r.text
    assert '"type": "delta", "text": "lo"' in r.text
    assert '"type": "done"' in r.text
    assert KEY not in r.text


def test_stream_provider_error_becomes_error_event(monkeypatch):
    async def failing_stream(**kwargs):
        yield "part"
        raise ValueError("google returned 404: model not found")

    monkeypatch.setattr(providers, "run_chat_stream", failing_stream)
    r = client.post(
        "/api/chat/run-stream",
        json={"provider": "google", "prompt": "hi"},
        headers={"X-LLM-API-Key": KEY},
    )
    assert r.status_code == 200
    assert '"type": "delta", "text": "part"' in r.text
    assert '"type": "error"' in r.text
    assert "model not found" in r.text
