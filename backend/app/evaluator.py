"""Deterministic prompt evaluation against the CLEAR framework.

CLEAR: Concise, Logical, Explicit, Adaptive, Reflective. Each dimension
is scored 0-10 from concrete, explainable checks on the prompt text —
no LLM call, no invented judgement. The checks are the same qualities
the deterministic engine (``prompt_engine``) builds into its output,
so a prompt the engine produced should score high, and a bare
one-liner should score low. Every deduction carries a finding that
says what was missing and where, so the score is auditable.
"""

from __future__ import annotations

import re
from collections import Counter

from .models import DimensionScore, EvaluateResponse

MAX_SCORE = 10

_DIMENSION_NAMES = {
    "concise": "Concise",
    "logical": "Logical",
    "explicit": "Explicit",
    "adaptive": "Adaptive",
    "reflective": "Reflective",
}

FILLER_WORDS = {
    "very", "really", "just", "simply", "basically", "actually",
    "literally", "quite", "rather", "somewhat",
}

PLACEHOLDER_RE = re.compile(r"\[[^\]\n]{1,40}\]")
NUMBERED_STEP_RE = re.compile(r"(?m)^\s*\d+[.)]\s+\S")
HEADING_RE = re.compile(r"(?m)^#{1,3}\s+\S")
HEADER_LINE_RE = re.compile(r"(?m)^[A-Z][A-Za-z ]{2,40}:$")


def _words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z0-9']+", text)


def _has(text: str, *needles: str) -> bool:
    low = text.lower()
    return any(n.lower() in low for n in needles)


def _repeated_phrases(text: str) -> list[str]:
    """Five-word sequences that appear more than once (case-insensitive)."""
    words = [w.lower() for w in _words(text)]
    grams = [" ".join(words[i:i + 5]) for i in range(len(words) - 4)]
    return [g for g, c in Counter(grams).items() if c > 1][:3]


def _score_concise(text: str, words: list[str]) -> DimensionScore:
    score = MAX_SCORE
    findings: list[str] = []
    n = len(words)
    if n < 25:
        score -= 4
        findings.append(f"Only {n} words — too thin to carry a role, an objective and an output format.")
    elif n > 900:
        score -= 3
        findings.append(f"{n} words — over 900. Trim repetition and state the brief once.")
    elif n > 600:
        score -= 1
        findings.append(f"{n} words — long for a prompt. Cut anything stated twice.")
    repeats = _repeated_phrases(text)
    if repeats:
        score -= 2
        findings.append(f"Repeated phrasing: “{repeats[0]}” appears more than once.")
    filler = sum(1 for w in words if w.lower() in FILLER_WORDS)
    density = filler / max(n, 1)
    if density > 0.03:
        score -= 2
        findings.append(f"Filler words (very, really, just…) are {density:.0%} of the text — cut them.")
    if not findings:
        findings.append("Tight: no padding, no repeated phrasing, no filler worth cutting.")
    return _dimension("concise", score, findings,
                      "Cut repetition and filler; aim for 80–600 words with each section stated once.")


def _score_logical(text: str) -> DimensionScore:
    score = MAX_SCORE
    findings: list[str] = []
    if not _has(text, "act as", "## role", "role:"):
        score -= 3
        findings.append("No role — the model does not know whose shoes to stand in.")
    if not _has(text, "objective", "## objective", "goal:", "task:"):
        score -= 2
        findings.append("No stated objective — the goal is implied, not named.")
    if not NUMBERED_STEP_RE.search(text) and not _has(text, "## steps", "steps:"):
        score -= 3
        findings.append("No steps — the work is one block instead of an ordered sequence.")
    if not HEADING_RE.search(text) and len(HEADER_LINE_RE.findall(text)) < 2:
        score -= 2
        findings.append("No section headings — the model has no skeleton to follow.")
    if not findings:
        findings.append("Ordered: role, objective, steps and headings, in a sequence the model can follow.")
    return _dimension("logical", score, findings,
                      "Give it a skeleton in this order: Role, Objective, Steps, Output format.")


def _score_explicit(text: str) -> DimensionScore:
    score = MAX_SCORE
    findings: list[str] = []
    if not _has(text, "audience"):
        score -= 3
        findings.append("No audience — the prompt never says who the answer is for.")
    if not _has(text, "output format", "format:", "return json", "return markdown"):
        score -= 3
        findings.append("No output format — the model gets to choose the shape of the answer.")
    if not _has(text, "constraint", "must", "do not", "never", "avoid"):
        score -= 2
        findings.append("No constraints — nothing says what the answer must or must not do.")
    placeholders = PLACEHOLDER_RE.findall(text)
    if placeholders:
        score -= 3
        findings.append(f"Bracketed placeholders like {placeholders[0]} leave blanks the model fills with invented facts.")
    if _has(text, "etc.", "and so on", "TBD"):
        score -= 1
        findings.append("Vague tails (“etc.”, “and so on”) — name the items or drop them.")
    if not findings:
        findings.append("Explicit: audience, constraints and output format are all named.")
    return _dimension("explicit", score, findings,
                      "Name the audience, state the constraints, and say exactly what the output should look like.")


def _score_adaptive(text: str) -> DimensionScore:
    score = MAX_SCORE
    findings: list[str] = []
    if not _has(text, "## context", "context:", "background"):
        score -= 3
        findings.append("No context — the model does not know what this is for.")
    if not _has(text, "example", "e.g.", "for instance"):
        score -= 2
        findings.append("No example — one example of good output is worth a paragraph of description.")
    if not _has(text, "assumption"):
        score -= 2
        findings.append("No assumption handling — when a detail is missing, the model will guess silently.")
    if not re.search(r"under \d+ words|concise|comprehensive|in depth", text, re.IGNORECASE):
        score -= 1
        findings.append("No length or scope guidance — the model does not know how thorough to be.")
    if not re.search(r"if .*missing|state the assumption", text, re.IGNORECASE):
        score -= 2
        findings.append("No fallback for missing details — say what to do when a fact is not given.")
    if not findings:
        findings.append("Adaptive: context, an example and a plan for missing details are all present.")
    return _dimension("adaptive", score, findings,
                      "Add one line of context, an example of good output, and what to do when a detail is missing.")


def _score_reflective(text: str) -> DimensionScore:
    score = MAX_SCORE
    findings: list[str] = []
    if not _has(text, "quality check", "verify", "before finishing", "self-check"):
        score -= 4
        findings.append("No quality check — the prompt never asks the model to review its own answer.")
    if not _has(text, "self-check", "recap", "summar"):
        score -= 2
        findings.append("No recap or self-check — the answer is never verified against the objective.")
    if not _has(text, "invent"):
        score -= 2
        findings.append("No accuracy rule — nothing forbids inventing names, dates or figures.")
    if not re.search(r"addresses the objective|directly addresses", text, re.IGNORECASE):
        score -= 2
        findings.append("Nothing asks whether the answer actually addresses the objective.")
    if not findings:
        findings.append("Reflective: the prompt ends by checking the answer against the brief.")
    return _dimension("reflective", score, findings,
                      "End with a quality check: verify the answer addresses the objective, has no invented facts and no placeholders.")


def _dimension(dim_id: str, score: int, findings: list[str], suggestion: str) -> DimensionScore:
    score = max(0, min(MAX_SCORE, score))
    return DimensionScore(
        id=dim_id,
        name=_DIMENSION_NAMES[dim_id],
        score=float(score),
        findings=findings,
        suggestion=suggestion if score < 8 else None,
    )


def _verdict(overall: float) -> str:
    if overall >= 8:
        return "Strong — ready to send"
    if overall >= 6:
        return "Good — a few fixes would help"
    if overall >= 4:
        return "Needs work — the structure is thin"
    return "Weak — rewrite it with the engine"


def evaluate(prompt: str) -> EvaluateResponse:
    """Score a prompt on CLEAR. Pure function of the text: no I/O, no key."""
    text = prompt.strip()
    words = _words(text)
    dimensions = [
        _score_concise(text, words),
        _score_logical(text),
        _score_explicit(text),
        _score_adaptive(text),
        _score_reflective(text),
    ]
    overall = round(sum(d.score for d in dimensions) / len(dimensions), 1)
    return EvaluateResponse(overall=overall, verdict=_verdict(overall), dimensions=dimensions)
