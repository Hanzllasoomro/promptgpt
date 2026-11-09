"""The optional LangChain path (/api/chat/run-langchain).

The provider LLMs are stubbed with a fake that records the messages it
receives, so these tests prove the wiring — provider class, model, key,
history — without a real key or a live provider call.
"""

from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.llm import langchain_client
from app.main import app

client = TestClient(app)
OPENAI_KEY = "sk-testkey"
GOOGLE_KEY = "AIzaSyFakeFakeFakeFakeFakeFakeFakeFake12"
HISTORY = [
    {"role": "user", "content": "What is 2+2?"},
    {"role": "assistant", "content": "4"},
    {"role": "user", "content": "And 3+3?"},
]


class FakeLLM:
    """Stands in for ChatOpenAI / ChatGoogleGenerativeAI / ..."""

    last_kwargs: dict | None = None
    last_messages: list | None = None

    def __init__(self, **kwargs):
        FakeLLM.last_kwargs = kwargs

    async def ainvoke(self, messages):
        FakeLLM.last_messages = list(messages)
        return SimpleNamespace(content="fake reply")


def message_summary():
    assert FakeLLM.last_messages is not None
    return [(m.type, m.content) for m in FakeLLM.last_messages]


def test_run_langchain_openai_replies_with_history(monkeypatch):
    monkeypatch.setattr("langchain_openai.ChatOpenAI", FakeLLM)
    r = client.post(
        "/api/chat/run-langchain",
        json={"provider": "openai", "prompt": "And 3+3?", "messages": HISTORY},
        headers={"X-LLM-API-Key": OPENAI_KEY},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["reply"] == "fake reply"
    assert body["via"] == "langchain"
    assert body["model"] == "gpt-4o-mini"
    assert FakeLLM.last_kwargs is not None
    assert FakeLLM.last_kwargs["model"] == "gpt-4o-mini"
    assert FakeLLM.last_kwargs["api_key"] == OPENAI_KEY
    assert message_summary() == [
        ("system", "You are a helpful assistant."),
        ("human", "What is 2+2?"),
        ("ai", "4"),
        ("human", "And 3+3?"),
    ]


def test_run_langchain_google_single_prompt(monkeypatch):
    monkeypatch.setattr("langchain_google_genai.ChatGoogleGenerativeAI", FakeLLM)
    r = client.post(
        "/api/chat/run-langchain",
        json={"provider": "google", "prompt": "Say hi"},
        headers={"X-LLM-API-Key": GOOGLE_KEY},
    )
    assert r.status_code == 200
    assert r.json()["reply"] == "fake reply"
    assert FakeLLM.last_kwargs is not None
    assert FakeLLM.last_kwargs["model"] == "gemini-3.8-flash"
    assert FakeLLM.last_kwargs["google_api_key"] == GOOGLE_KEY
    assert message_summary() == [
        ("system", "You are a helpful assistant."),
        ("human", "Say hi"),
    ]


def test_run_langchain_unknown_provider_is_400(monkeypatch):
    r = client.post(
        "/api/chat/run-langchain",
        json={"provider": "nope", "prompt": "hi"},
        headers={"X-LLM-API-Key": OPENAI_KEY},
    )
    assert r.status_code == 400


def test_run_langchain_unavailable_returns_501(monkeypatch):
    monkeypatch.setattr(langchain_client, "available", lambda: False)
    r = client.post(
        "/api/chat/run-langchain",
        json={"provider": "openai", "prompt": "hi"},
        headers={"X-LLM-API-Key": OPENAI_KEY},
    )
    assert r.status_code == 501
    assert "not installed" in r.json()["detail"]
