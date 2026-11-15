"""Pydantic request/response models for the public API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    idea: str = Field(..., min_length=3, max_length=5000)
    task_type: str = "general"  # general | write | code | explain | marketing | learn | plan
    audience: str = ""
    tone: str = "clear and helpful"
    output_format: str = "structured answer with headings"
    length: str = "medium"  # short | medium | long
    constraints: list[str] = Field(default_factory=list, max_length=20)
    context: str = ""
    examples: str = ""


class GenerateResponse(BaseModel):
    original_idea: str
    engineered_prompt: str
    concise_prompt: str
    tips: list[str]
    task_type: str


class ChatMessage(BaseModel):
    """One turn of a conversation. The frontend sends the whole history
    (ending with the latest user turn); the backend re-sends it to the
    provider so follow-ups have context."""

    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=20000)


class ChatRequest(BaseModel):
    provider: str = Field(..., description="openai | anthropic | google | huggingface | openai-compatible")
    model: str = ""
    prompt: str = Field(..., min_length=1, max_length=20000)
    messages: list[ChatMessage] = Field(default_factory=list)
    system: str = ""
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(1024, ge=1, le=32000)
    base_url: str = ""  # openai-compatible only


class ChatResponse(BaseModel):
    provider: str
    model: str
    reply: str
    via: str  # "httpx" or "langchain"
    latency_ms: int
    usage: dict | None = None


class ProviderInfo(BaseModel):
    id: str
    name: str
    default_model: str
    models: list[str]
    needs_key: bool = True
    key_help: str
    supports_base_url: bool = False


class ChatbotInfo(BaseModel):
    id: str
    name: str
    url: str  # URL with the prompt prefilled, when the chatbot supports it
    prefilled: bool
    note: str


class EvaluateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=20000)


class DimensionScore(BaseModel):
    id: str  # concise | logical | explicit | adaptive | reflective
    name: str
    score: float  # 0-10
    findings: list[str]
    suggestion: str | None = None


class EvaluateResponse(BaseModel):
    overall: float  # 0-10, mean of the five dimensions
    verdict: str
    dimensions: list[DimensionScore]


class LibraryTemplate(BaseModel):
    id: str
    domain: str
    title: str
    description: str
    task_type: str  # one of the seven engine task types
    audience: str
    tone: str
    output_format: str
    length: str  # short | medium | long
    context: str  # domain rules the generated prompt must enforce
    example_idea: str


class LibraryListResponse(BaseModel):
    templates: list[LibraryTemplate]


class RefineRequest(GenerateRequest):
    """GenerateRequest fields plus the provider and round count for the
    auto-refine loop."""

    provider: str = Field(..., description="openai | anthropic | google | huggingface | openai-compatible")
    model: str = ""
    rounds: int = Field(3, ge=1, le=5)
    base_url: str = ""  # openai-compatible only


class RefineRound(BaseModel):
    round: int  # 0 = the engine's starting prompt
    prompt: str
    overall: float
    dimensions: list[DimensionScore]
    improved: bool  # scored higher than the previous round's prompt
    note: str


class RefineResponse(BaseModel):
    rounds: list[RefineRound]
    best_prompt: str
    best_overall: float
    best_round: int
    base_overall: float
    improved_by: float
    stopped_early: bool = False
    note: str | None = None
