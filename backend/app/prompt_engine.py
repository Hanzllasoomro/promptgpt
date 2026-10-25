"""Deterministic prompt engineering.

This is deliberately *not* an LLM call: it works offline, it is fully
testable, and it never invents facts about the user. An LLM refinement
step (see ``llm/langchain_client.py``) is an optional layer on top of
this output, never a replacement for it.

Design: a good prompt answers, in order, role, objective, context,
constraints, steps and output format. Anything the user did not supply
becomes an explicit assumption, not a silently invented detail.
"""

from __future__ import annotations

from .models import GenerateRequest

TASK_ROLES = {
    "general": "a thoughtful expert who turns an idea into a clear, useful result",
    "write": "an experienced editor and writer",
    "code": "a senior software engineer who writes clean, tested, maintainable code",
    "explain": "a patient teacher who explains hard ideas with simple analogies",
    "marketing": "a senior marketer who writes copy people actually act on",
    "learn": "a study coach who builds a practical learning path",
    "plan": "a pragmatic project planner who breaks work into doable steps",
}

TASK_STEPS = {
    "general": [
        "Restate the goal in one sentence, then deliver the result.",
        "Work through the most important parts first.",
    ],
    "write": [
        "Draft, then tighten: cut filler, keep the strongest phrasing.",
        "Check the draft against the brief before finishing.",
    ],
    "code": [
        "Plan the approach in a few lines before writing code.",
        "Write the code, then show how to run and test it.",
        "Call out edge cases, errors and security notes.",
    ],
    "explain": [
        "Start with a simple analogy, then add detail gradually.",
        "Use a concrete example for every abstract idea.",
        "End with a one-paragraph recap and a self-check question.",
    ],
    "marketing": [
        "Lead with the benefit to the reader, not the feature list.",
        "Give one clear call to action.",
    ],
    "learn": [
        "Order topics from prerequisite to advanced.",
        "Pair every concept with a small hands-on exercise.",
    ],
    "plan": [
        "Break the goal into milestones with a definition of done each.",
        "Flag dependencies, risks and the first step to take today.",
    ],
}

LENGTH_GUIDANCE = {
    "short": "Keep the answer concise: aim for under 300 words unless detail is essential.",
    "medium": "Give a complete answer without padding: thorough, but no repetition.",
    "long": "Be comprehensive: cover the topic in depth, with examples and detail.",
}


def build_engineered_prompt(req: GenerateRequest) -> tuple[str, str, list[str]]:
    """Return (engineered_prompt, concise_prompt, tips)."""
    idea = req.idea.strip()
    task_type = req.task_type if req.task_type in TASK_ROLES else "general"
    role = TASK_ROLES[task_type]
    steps = TASK_STEPS[task_type]
    length = LENGTH_GUIDANCE.get(req.length, LENGTH_GUIDANCE["medium"])

    audience = req.audience.strip() or "a general reader"
    tone = req.tone.strip() or "clear and helpful"
    output_format = req.output_format.strip() or "structured answer with headings"
    context = req.context.strip()
    examples = req.examples.strip()
    constraints = [c.strip() for c in req.constraints if c.strip()]

    lines = [
        "# Engineered prompt",
        "",
        "## Role",
        f"Act as {role}.",
        "",
        "## Objective",
        idea,
        "",
        "## Context",
    ]
    if context:
        lines.append(context)
    lines.append(f"Audience: {audience}.")
    lines.append(f"Tone: {tone}.")
    lines.append(
        "Ask a focused clarifying question only when a missing detail would "
        "materially change the result; otherwise state your assumption and proceed."
    )
    lines += ["", "## Steps"]
    lines += [f"{i}. {s}" for i, s in enumerate(steps, 1)]
    lines += ["", "## Requirements"]
    lines.append(f"- {length}")
    lines.append("- Prefer concrete examples and actionable detail over generalities.")
    lines.append("- State important assumptions before acting on them.")
    for c in constraints:
        lines.append(f"- Constraint: {c}")
    if examples:
        lines += ["", "## Examples to follow", examples]
    lines += [
        "",
        "## Output format",
        output_format,
        "",
        "## Quality check",
        "Before finishing, verify the answer directly addresses the objective, "
        "respects every constraint above, and has no invented facts.",
    ]
    engineered = "\n".join(lines).strip() + "\n"

    concise = (
        f"Act as {role}. {idea} "
        f"For {audience}, in a {tone} tone. {length} "
        f"Output: {output_format}."
    )
    if constraints:
        concise += " Constraints: " + "; ".join(constraints) + "."

    tips = [
        "Specific beats long: one concrete audience and one desired output format improve results more than extra adjectives.",
        "If the answer invents a fact, add it as an explicit constraint ('do not invent dates, prices or names').",
        "Reuse this prompt as a template: swap only the Objective and the Constraints.",
    ]
    if task_type == "code":
        tips.append("Ask for the language, framework and how the code will be run — or state them in Context.")
    if not context:
        tips.append("Adding one line of Context (what this is for, what 'good' looks like) is the highest-value edit you can make.")

    return engineered, concise, tips
