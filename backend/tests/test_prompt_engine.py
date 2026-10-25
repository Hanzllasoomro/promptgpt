from app.models import GenerateRequest
from app.prompt_engine import build_engineered_prompt


def test_engineered_prompt_contains_all_sections():
    eng, concise, tips = build_engineered_prompt(
        GenerateRequest(
            idea="Explain photosynthesis",
            task_type="explain",
            audience="high-school students",
            constraints=["no invented facts"],
        )
    )
    for section in ("## Role", "## Objective", "## Context", "## Steps",
                    "## Requirements", "## Output format", "## Quality check"):
        assert section in eng
    assert "photosynthesis" in eng
    assert "high-school students" in eng
    assert "no invented facts" in eng
    assert "photosynthesis" in concise
    assert tips


def test_unknown_task_type_falls_back_to_general():
    eng, _, _ = build_engineered_prompt(GenerateRequest(idea="Do a thing", task_type="bogus"))
    assert "thoughtful expert" in eng


def test_code_task_adds_code_specific_guidance():
    eng, _, tips = build_engineered_prompt(GenerateRequest(idea="Build a todo API", task_type="code"))
    assert "senior software engineer" in eng
    assert any("language" in t for t in tips)
