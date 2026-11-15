"""Tests for the auto-refine loop (evaluator feedback as a gradient)."""

from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.llm import providers
from app.llm.providers import ProviderError
from app.main import app

client = TestClient(app)

KEY = "sk-fake-key-for-refine-tests-123"

BODY = {
    "idea": "Explain quantum physics to a 5-year-old using simple analogies",
    "task_type": "explain",
    "audience": "a curious 5-year-old",
    "context": "For a bedtime chat, not a lesson.",
    "length": "short",
    "provider": "openai",
    "rounds": 3,
}

HEADERS = {"X-LLM-API-Key": KEY}

# The engine's own guardrails name bracketed placeholders as examples,
# which the evaluator deducts for. A rewrite that drops the brackets
# scores higher — that is the improvement the loop is meant to find.
PLACEHOLDER_EXAMPLES = "[Name], [Client], [Date] or [Amount]"


def _base_prompt():
    r = client.post("/api/prompts/generate", json={k: v for k, v in BODY.items() if k not in {"provider", "rounds"}})
    assert r.status_code == 200
    return r.json()["engineered_prompt"]


def _patch_run_chat(monkeypatch, fake):
    monkeypatch.setattr(providers, "run_chat", fake)


def test_refine_improves_and_keeps_best(monkeypatch):
    base = _base_prompt()
    improved = base.replace(PLACEHOLDER_EXAMPLES, "a name, a client, a date or an amount")
    assert improved != base
    seen = []

    async def fake_run_chat(**kwargs):
        seen.append(kwargs)
        return improved, None, "gpt-4o-mini"

    _patch_run_chat(monkeypatch, fake_run_chat)
    r = client.post("/api/prompts/refine", json=BODY, headers=HEADERS)
    assert r.status_code == 200
    body = r.json()
    assert body["best_overall"] > body["base_overall"]
    assert body["improved_by"] > 0
    assert body["best_round"] == 1
    assert body["rounds"][0]["round"] == 0
    assert len(body["rounds"]) == 4  # round 0 + 3 rewrite rounds
    assert body["rounds"][1]["improved"] is True
    assert body["rounds"][2]["improved"] is False  # same reply again: no gain
    assert body["stopped_early"] is False
    assert body["best_prompt"] == improved.strip()  # the loop strips the model's reply
    # The rewrite call carried the evaluator's feedback, not just the prompt.
    assert "Explicit" in seen[0]["prompt"]
    assert "placeholder" in seen[0]["prompt"].lower()
    assert "expert prompt engineer" in seen[0]["system"].lower()


def test_refine_without_key_is_rejected(monkeypatch):
    async def fail(**kwargs):
        raise AssertionError("provider must not be called without a key")

    _patch_run_chat(monkeypatch, fail)
    assert client.post("/api/prompts/refine", json=BODY).status_code == 400


def test_refine_unknown_provider_is_rejected(monkeypatch):
    async def fail(**kwargs):
        raise AssertionError("provider must not be called")

    _patch_run_chat(monkeypatch, fail)
    body = {**BODY, "provider": "nope"}
    assert client.post("/api/prompts/refine", json=body, headers=HEADERS).status_code == 400


def test_refine_rounds_are_clamped_by_validation():
    assert client.post("/api/prompts/refine", json={**BODY, "rounds": 0}, headers=HEADERS).status_code == 422
    assert client.post("/api/prompts/refine", json={**BODY, "rounds": 9}, headers=HEADERS).status_code == 422


def test_refine_stops_early_on_provider_failure_and_keeps_best(monkeypatch):
    async def fail(**kwargs):
        raise ProviderError(503, "overloaded")

    _patch_run_chat(monkeypatch, fail)
    r = client.post("/api/prompts/refine", json=BODY, headers=HEADERS)
    assert r.status_code == 200
    body = r.json()
    assert body["stopped_early"] is True
    assert body["note"]
    assert len(body["rounds"]) == 1  # only the starting prompt
    assert body["best_prompt"] == body["rounds"][0]["prompt"]
    assert body["improved_by"] == 0


def test_refine_stops_early_on_empty_rewrite(monkeypatch):
    async def empty(**kwargs):
        return "", None, "gpt-4o-mini"

    _patch_run_chat(monkeypatch, empty)
    r = client.post("/api/prompts/refine", json=BODY, headers=HEADERS)
    assert r.status_code == 200
    assert r.json()["stopped_early"] is True
    assert len(r.json()["rounds"]) == 1


def test_refine_loop_unit(monkeypatch):
    """Direct loop test: the mock is the only LLM call."""
    import asyncio

    from app.models import RefineRequest
    from app.refine import refine_loop

    async def fake(**kwargs):
        return "Act as a teacher. Objective: explain gravity. Audience: a child. Output format: a short story. Steps: 1. Tell the story. 2. Ask a question. ## Quality check\nBefore finishing, verify the answer directly addresses the objective.", None, "model"

    monkeypatch.setattr(providers, "run_chat", fake)
    result = asyncio.run(
        refine_loop(RefineRequest(**{**BODY, "rounds": 1}), model="gpt-4o-mini", api_key=KEY, timeout_s=30.0)
    )
    assert len(result.rounds) == 2
    assert result.best_prompt
