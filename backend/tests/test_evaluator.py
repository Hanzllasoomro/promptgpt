"""Tests for the deterministic CLEAR prompt evaluator."""

from fastapi.testclient import TestClient

from app.evaluator import evaluate
from app.main import app
from app.models import GenerateRequest
from app.prompt_engine import build_engineered_prompt

client = TestClient(app)

BARE = "write a poem"

ENGINEERED = build_engineered_prompt(
    GenerateRequest(
        idea="Explain quantum physics to a 5-year-old using simple analogies",
        task_type="explain",
        audience="a curious 5-year-old",
        context="For a bedtime chat, not a lesson.",
    )
)[0]


def _dim(result, dim_id):
    return next(d for d in result.dimensions if d.id == dim_id)


def test_bare_prompt_scores_low():
    r = evaluate(BARE)
    assert r.overall < 5
    assert r.verdict in ("Weak — rewrite it with the engine", "Needs work — the structure is thin")
    assert _dim(r, "logical").score <= 5
    assert _dim(r, "reflective").score <= 5


def test_engine_output_scores_high():
    r = evaluate(ENGINEERED)
    assert r.overall >= 7.5, r
    for d in r.dimensions:
        assert d.score >= 6, (d.id, d.score, d.findings)
    assert r.verdict in ("Strong — ready to send", "Good — a few fixes would help")


def test_placeholder_is_caught_by_explicit():
    r = evaluate(
        "Act as a writer. Objective: draft a letter for [Client Name] about [Project]. "
        "Audience: the client. Output format: a formal letter. Steps: 1. Draft it. 2. Check it."
    )
    dim = _dim(r, "explicit")
    assert dim.score < 10
    assert any("placeholder" in f.lower() for f in dim.findings)


def test_quality_check_lifts_reflective():
    r = evaluate(
        "Act as an editor. Objective: tighten this paragraph. Audience: a general reader. "
        "Output format: the revised paragraph. Steps: 1. Cut filler. 2. Keep the strongest phrasing. "
        "## Quality check\nBefore finishing, verify the answer directly addresses the objective, "
        "has no invented facts, contains no bracketed placeholders, and states every assumption."
    )
    assert _dim(r, "reflective").score >= 8


def test_suggestions_only_below_eight():
    r = evaluate(ENGINEERED)
    for d in r.dimensions:
        if d.score >= 8:
            assert d.suggestion is None
        else:
            assert d.suggestion
    r2 = evaluate(BARE)
    assert any(d.suggestion for d in r2.dimensions)


def test_api_evaluate_shape():
    r = client.post("/api/prompts/evaluate", json={"prompt": BARE})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"overall", "verdict", "dimensions"}
    assert len(body["dimensions"]) == 5
    assert [d["id"] for d in body["dimensions"]] == [
        "concise", "logical", "explicit", "adaptive", "reflective",
    ]
    for d in body["dimensions"]:
        assert set(d) == {"id", "name", "score", "findings", "suggestion"}
        assert 0 <= d["score"] <= 10


def test_api_evaluate_validates():
    assert client.post("/api/prompts/evaluate", json={"prompt": ""}).status_code == 422
    assert client.post("/api/prompts/evaluate", json={"prompt": "x" * 20001}).status_code == 422
    assert client.post("/api/prompts/evaluate", json={}).status_code == 422
