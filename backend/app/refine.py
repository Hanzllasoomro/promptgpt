"""Auto-refine loop: evaluator feedback as a textual gradient.

Inspired by TextGrad / SPO / PE²: the deterministic CLEAR evaluator
scores each version of a prompt, and the model rewrites the prompt to
fix the weakest dimensions. The evaluator is the scorer, the model is
the editor, and the best-scoring version wins. Each round is one LLM
call; the loop stops early if the provider fails, and the best version
so far is still returned. The loop never invents facts — the rewrite
instructions carry the same accuracy rules as the engine.
"""

from __future__ import annotations

from .evaluator import evaluate
from .llm import providers
from .llm.providers import ProviderError
from .models import (
    DimensionScore,
    GenerateRequest,
    RefineRequest,
    RefineResponse,
    RefineRound,
)
from .prompt_engine import build_engineered_prompt

REFINE_SYSTEM = """You are an expert prompt engineer. You will be given a prompt and an evaluation of it.

Rewrite the prompt to fix the weakest dimensions named in the evaluation. Keep the same structure — Role, Objective, Context, Steps, Requirements, Output format, Accuracy rules, Quality check — and keep everything that already scores well. Fix only what the findings name.

Rules:
- Never invent names, dates, prices, figures or facts. If a detail is missing, state it as an assumption.
- Never use bracketed placeholders such as [Name] or [Date].
- Return ONLY the revised prompt. No commentary, no explanation, no markdown fences around it."""

MAX_ROUNDS = 5


def _weakest(dimensions: list[DimensionScore], count: int = 2) -> list[DimensionScore]:
    return sorted(dimensions, key=lambda d: d.score)[:count]


def _rewrite_message(current_prompt: str, dimensions: list[DimensionScore]) -> str:
    weak = _weakest(dimensions)
    lines = ["Here is the prompt to improve:", "", current_prompt, "", "Evaluation (CLEAR, out of 10):"]
    for d in dimensions:
        lines.append(f"- {d.name}: {d.score}/10")
    lines.append("")
    lines.append("Weakest dimensions — fix these first:")
    for d in weak:
        lines.append(f"- {d.name} ({d.score}/10):")
        for f in d.findings:
            lines.append(f"  - {f}")
        if d.suggestion:
            lines.append(f"  - Fix: {d.suggestion}")
    return "\n".join(lines)


async def refine_loop(
    req: RefineRequest,
    model: str,
    api_key: str,
    timeout_s: float,
) -> RefineResponse:
    """Run the refine loop. Returns the best version found, even when a
    provider call fails mid-loop (stopped_early is set, the rounds so
    far are kept)."""
    base_prompt, _, _ = build_engineered_prompt(
        GenerateRequest(**req.model_dump(exclude={"provider", "model", "rounds", "base_url"}))
    )
    base = evaluate(base_prompt)
    rounds = [
        RefineRound(
            round=0,
            prompt=base_prompt,
            overall=base.overall,
            dimensions=base.dimensions,
            improved=False,
            note="Starting prompt from the engine.",
        )
    ]
    best_prompt, best_overall, best_round = base_prompt, base.overall, 0
    current_prompt, current_overall = base_prompt, base.overall
    stopped_early = False
    note: str | None = None

    for n in range(1, min(req.rounds, MAX_ROUNDS) + 1):
        current_eval = evaluate(current_prompt)
        try:
            reply, _usage, _used = await providers.run_chat(
                provider=req.provider,
                model=model,
                prompt=_rewrite_message(current_prompt, current_eval.dimensions),
                system=REFINE_SYSTEM,
                temperature=0.7,
                max_tokens=2048,
                api_key=api_key,
                base_url=req.base_url,
                timeout_s=timeout_s,
            )
        except ProviderError as exc:
            stopped_early = True
            note = f"Stopped after round {n - 1}: the provider could not rewrite the prompt ({exc})."
            break
        except Exception as exc:  # network/provider failure, not a key leak
            stopped_early = True
            note = f"Stopped after round {n - 1}: the provider call failed ({exc.__class__.__name__})."
            break
        candidate = reply.strip()
        if not candidate:
            stopped_early = True
            note = f"Stopped after round {n - 1}: the provider returned an empty rewrite."
            break
        scored = evaluate(candidate)
        improved = scored.overall > current_overall
        rounds.append(
            RefineRound(
                round=n,
                prompt=candidate,
                overall=scored.overall,
                dimensions=scored.dimensions,
                improved=improved,
                note=(
                    f"Improved from {current_overall} to {scored.overall}."
                    if improved
                    else f"No improvement over {current_overall} — kept the previous version."
                ),
            )
        )
        if improved:
            current_prompt, current_overall = candidate, scored.overall
        if scored.overall > best_overall:
            best_prompt, best_overall, best_round = candidate, scored.overall, n

    return RefineResponse(
        rounds=rounds,
        best_prompt=best_prompt,
        best_overall=best_overall,
        best_round=best_round,
        base_overall=base.overall,
        improved_by=round(best_overall - base.overall, 1),
        stopped_early=stopped_early,
        note=note,
    )
