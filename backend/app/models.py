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


class ChatRequest(BaseModel):
    provider: str = Field(..., description="openai | anthropic | google | huggingface | openai-compatible")
    model: str = ""
    prompt: str = Field(..., min_length=1, max_length=20000)
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
