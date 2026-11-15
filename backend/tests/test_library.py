"""Tests for the domain prompt library."""

from fastapi.testclient import TestClient

from app.library import TEMPLATES
from app.main import app
from app.prompt_engine import LENGTH_GUIDANCE, TASK_ROLES

client = TestClient(app)

REQUIRED = {
    "id", "domain", "title", "description", "task_type", "audience",
    "tone", "output_format", "length", "context", "example_idea",
}


def test_list_returns_all_templates():
    r = client.get("/api/library")
    assert r.status_code == 200
    templates = r.json()["templates"]
    assert len(templates) == len(TEMPLATES) == 6
    ids = [t["id"] for t in templates]
    assert len(set(ids)) == len(ids), "template ids must be unique"


def test_every_template_is_complete_and_valid():
    for t in TEMPLATES:
        assert set(t.model_dump()) == REQUIRED, t.id
        assert t.task_type in TASK_ROLES, t.id
        assert t.length in LENGTH_GUIDANCE, t.id
        assert t.example_idea.strip(), t.id
        assert t.context.strip(), t.id
        # The domain context must carry a rule, not just a description.
        assert len(t.context) > 40, t.id


def test_detail_round_trips():
    for t in TEMPLATES:
        r = client.get(f"/api/library/{t.id}")
        assert r.status_code == 200
        assert r.json()["id"] == t.id
        assert r.json()["example_idea"] == t.example_idea


def test_unknown_template_is_404():
    assert client.get("/api/library/no-such-template").status_code == 404
