"""The accuracy rules behind the platform.

Generate is single-shot, so it must never tell the model to "ask a
clarifying question" — there is no follow-up to ask in — and must
instead turn missing details into stated assumptions. Chat is
multi-turn, so its default system prompt may ask one focused
question, but both surfaces forbid the same failure: bracketed
placeholders like [Client/Project Name] and invented facts. No live
provider is called: httpx is stubbed where a call is made.
"""

import asyncio
import json

from app.llm import providers
from app.llm.providers import _effective_system, _messages
from app.models import GenerateRequest
from app.prompt_engine import build_engineered_prompt
from app.prompt_rules import DEFAULT_CHAT_SYSTEM_PROMPT


def _generate(**kwargs):
    params = {
        "idea": "write an email to my business partner about the recent loss",
        "task_type": "write",
        "length": "short",
        "audience": "businessman",
        "tone": "clear and helpful",
    }
    params.update(kwargs)
    engineered, concise, _tips = build_engineered_prompt(GenerateRequest(**params))
    return engineered, concise


def test_generate_has_accuracy_rules_and_no_ask_instruction():
    engineered, _concise = _generate()
    assert "## Accuracy rules (always apply)" in engineered
    assert "Never use bracketed placeholders" in engineered
    assert "state the assumption" in engineered
    # Single-shot: the model cannot ask a question and get an answer,
    # so the old instruction must be gone, not just softened.
    assert "Ask a focused clarifying question" not in engineered


def test_generate_quality_check_covers_placeholders_and_assumptions():
    engineered, _concise = _generate()
    quality = engineered.split("## Quality check", 1)[1]
    assert "no bracketed placeholders" in quality
    assert "states every assumption" in quality
    assert "no invented facts" in quality


def test_concise_prompt_carries_the_guardrail():
    _engineered, concise = _generate()
    assert "No bracketed placeholders" in concise
    assert "state assumptions first" in concise


def test_chat_default_system_prompt_sent_when_none_given():
    msgs = _messages("Say hi", "")
    assert msgs[0] == {"role": "system", "content": DEFAULT_CHAT_SYSTEM_PROMPT}
    assert msgs[1] == {"role": "user", "content": "Say hi"}


def test_chat_custom_system_prompt_wins_over_default():
    assert _effective_system("Be terse.") == "Be terse."
    assert _effective_system("  ") == DEFAULT_CHAT_SYSTEM_PROMPT
    assert _messages("Say hi", "Be terse.")[0] == {
        "role": "system",
        "content": "Be terse.",
    }


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


def _make_client(script, calls):
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

    return FakeClient


def _run(monkeypatch, provider, script, calls, **kwargs):
    monkeypatch.setattr(providers.httpx, "AsyncClient", _make_client(script, calls))
    params = dict(
        provider=provider, model="", prompt="Say hi", system="",
        temperature=0.7, max_tokens=1024, api_key="sk-test", base_url="",
        timeout_s=60.0, messages=[],
    )
    params.update(kwargs)
    return asyncio.run(providers.run_chat(**params))


def test_google_receives_default_system_instruction(monkeypatch):
    calls = []
    script = [FakeResp(200, {"candidates": [{"content": {"parts": [{"text": "ok"}]}}], "usageMetadata": {}})]
    _reply, _usage, _used = _run(
        monkeypatch, "google", script, calls, api_key="AIzaSyFakeFakeFakeFakeFakeFakeFakeFake12"
    )
    instruction = calls[0][2]["systemInstruction"]["parts"][0]["text"]
    assert instruction == DEFAULT_CHAT_SYSTEM_PROMPT


def test_anthropic_receives_default_system(monkeypatch):
    calls = []
    script = [FakeResp(200, {"content": [{"text": "ok"}], "usage": {}})]
    _reply, _usage, _used = _run(
        monkeypatch, "anthropic", script, calls, api_key="sk-ant-test"
    )
    assert calls[0][2]["system"] == DEFAULT_CHAT_SYSTEM_PROMPT
