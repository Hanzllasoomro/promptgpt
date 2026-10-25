import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/api/health").json()["status"] == "ok"


def test_generate_validates_short_idea():
    assert client.post("/api/prompts/generate", json={"idea": "ab"}).status_code == 422


def test_generate_returns_prompt():
    r = client.post("/api/prompts/generate", json={"idea": "Plan a weekend trip to Hunza", "task_type": "plan"})
    assert r.status_code == 200
    body = r.json()
    assert "Hunza" in body["engineered_prompt"]
    assert body["concise_prompt"]


def test_providers_never_leak_keys():
    r = client.get("/api/providers")
    assert r.status_code == 200
    # No provider object may carry a key field; key_help may legitimately
    # describe a key prefix (e.g. "starts with sk-"), which is not a key.
    for p in r.json()["providers"]:
        assert "api_key" not in p
        assert set(p) == {"id", "name", "default_model", "models", "needs_key", "key_help", "supports_base_url"}


def test_chat_without_key_is_rejected_without_calling_provider():
    r = client.post("/api/chat/run", json={"provider": "openai", "prompt": "hi"})
    assert r.status_code == 400
    assert "API key" in r.json()["detail"]


def test_chat_unknown_provider():
    r = client.post(
        "/api/chat/run",
        json={"provider": "nope", "prompt": "hi"},
        headers={"X-LLM-API-Key": "sk-test-12345678"},
    )
    assert r.status_code == 400


def test_key_check_does_not_store():
    r = client.post("/api/keys/check?provider=openai", headers={"X-LLM-API-Key": "sk-test-12345678"})
    assert r.json()["stored"] is False
    assert "sk-test" not in r.text
