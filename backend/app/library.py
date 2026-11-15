"""Domain prompt library: prefilled templates for real jobs.

Each template is a preset bundle for the existing generate endpoint —
task type, audience, tone, output format and, most importantly, a
domain context that enforces the field's rules (never invent findings,
quote the clause first, state every assumption). Nothing here is a
new engine: the library feeds the same deterministic generator, so a
template is a starting point the user can edit, not a black box.
"""

from __future__ import annotations

from .models import LibraryTemplate

TEMPLATES: list[LibraryTemplate] = [
    LibraryTemplate(
        id="research-design",
        domain="Academic research",
        title="Research design",
        description="Design a study and its instruments, then stress-test the design before collecting anything.",
        task_type="plan",
        audience="a graduate researcher",
        tone="rigorous and precise",
        output_format="a structured research plan with headings: question, hypotheses, method, instruments, analysis, limitations",
        length="long",
        context=(
            "State the research question, define the variables, and propose a method and instruments. "
            "Then critique the design adversarially — sampling bias, measurement error, confounds — "
            "and say how to fix each weakness. Never invent citations, data or prior results."
        ),
        example_idea="Design a survey to measure how remote work affects junior developers' learning",
    ),
    LibraryTemplate(
        id="code-debugging",
        domain="Software engineering",
        title="Code debugging",
        description="Turn a failing behaviour into a diagnosis, a fix and a test that proves it.",
        task_type="code",
        audience="a developer fixing a production bug",
        tone="direct and practical",
        output_format="a diagnosis with headings: likely cause, evidence, fix, test",
        length="medium",
        context=(
            "Ask for the error message, the failing input and the expected behaviour. "
            "Give the most likely cause first, then the fix and a test that proves it. "
            "Never guess at code you cannot see — say what to check."
        ),
        example_idea="My Python API returns 500 on POST /orders, but only when the payload has a discount code",
    ),
    LibraryTemplate(
        id="medical-summary",
        domain="Healthcare",
        title="Medical summarization",
        description="A structured case summary for a clinician — only what is given, nothing invented.",
        task_type="explain",
        audience="a clinician reviewing a case",
        tone="precise and neutral",
        output_format="a structured summary with headings: presentation, findings, assessment, next steps",
        length="medium",
        context=(
            "Summarize only what is given. Never invent findings, values or diagnoses. "
            "Mark anything uncertain as uncertain. This is a summary aid, not medical advice."
        ),
        example_idea="Summarize this discharge note for the ward round",
    ),
    LibraryTemplate(
        id="legal-draft",
        domain="Legal",
        title="Legal draft analysis",
        description="Analyse a contract clause: what it says, where it bites, and better wording.",
        task_type="write",
        audience="a lawyer reviewing a contract clause",
        tone="formal and precise",
        output_format="an analysis with headings: what the clause says, risks, suggested wording",
        length="medium",
        context=(
            "Quote the clause exactly before analysing it. Flag ambiguous terms and one-sided obligations. "
            "Suggest replacement wording. This is drafting help, not legal advice."
        ),
        example_idea="Review the termination clause in this supplier agreement",
    ),
    LibraryTemplate(
        id="marketing-copy",
        domain="Marketing",
        title="Marketing copy",
        description="Launch copy that leads with the reader's benefit and ends with one clear action.",
        task_type="marketing",
        audience="busy small-business owners",
        tone="warm and persuasive",
        output_format="three headline options, then body copy with one call to action",
        length="medium",
        context=(
            "Lead with the reader's benefit, not the feature list. One clear call to action. "
            "Avoid hype words and unverifiable claims."
        ),
        example_idea="A launch email for a neighbourhood bakery's sourdough subscription",
    ),
    LibraryTemplate(
        id="data-analysis",
        domain="Data analysis",
        title="Data analysis plan",
        description="A plan for a dataset: the questions, the quality checks, the methods, the caveats.",
        task_type="plan",
        audience="an analyst with a CSV of sales data",
        tone="clear and methodical",
        output_format="an analysis plan with headings: questions, checks, methods, charts, caveats",
        length="medium",
        context=(
            "List the data-quality checks first. State every assumption. "
            "Never invent numbers — work only from the columns given."
        ),
        example_idea="Plan an analysis of last year's sales by region and channel",
    ),
]


def get_template(template_id: str) -> LibraryTemplate | None:
    for t in TEMPLATES:
        if t.id == template_id:
            return t
    return None
