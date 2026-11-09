# API reference

Base URL: the backend, e.g. `http://localhost:8000`. Interactive docs at `/docs`.

## POST /api/prompts/generate

Body: `{ idea, task_type?, audience?, tone?, output_format?, length?, constraints?, context?, examples? }`
Returns: `{ original_idea, engineered_prompt, concise_prompt, tips, task_type }`
No key needed. Deterministic, offline.

## GET /api/providers

Returns the provider catalogue: ids, display names, default/suggested
models, key help. Never contains a key.

## GET /api/chatbots?prompt=…

Returns prefilled links (ChatGPT, Claude, Gemini, Perplexity, Copilot)
and copy-first links (Mistral, DeepSeek, Grok, Meta AI, Poe), each with
`prefilled: true|false` and a note.

## POST /api/chat/run

Header: `X-LLM-API-Key: <your key>` (or a server env fallback).
Body: `{ provider, model?, prompt, system?, temperature?, max_tokens?, base_url? }`
Returns: `{ provider, model, reply, via: "httpx", latency_ms, usage? }`
— `model` is the one that actually answered, which can differ from the
requested model when a fallback was used (see below).
Errors: 400 = missing/invalid key or unknown provider/model error from
the provider; a provider's own status is passed through (e.g. a Google
503 overload is a 503, not a 400); 502 = provider/network failure.

Retry and fallback: a 503 (transient overload, e.g. Gemini "high
demand") is retried on the same model with backoff (2s, 4s), then the
next model in the provider's list is tried — for Google the Flash
models, in list order. A 404 also moves to the next model (retired or
never-enabled for this key/project). A 400/401/403 is raised at once:
retrying a bad key cannot help. If every model fails, the error names
the models that were tried.

## POST /api/chat/run-stream

Same request shape and key header as `/api/chat/run`, but the reply
streams as server-sent events: `data: {"type": "delta", "text": "..."}`
per chunk, then `data: {"type": "done", "latency_ms": N, "model": "..."}`.
A provider error mid-stream arrives as `data: {"type": "error", "detail": "..."}`
(the HTTP status stays 200 once streaming has started). Missing key
or unknown provider still return a plain 400 before streaming starts.
The Chat tab uses this by default; the LangChain path has no stream
equivalent and stays on `/api/chat/run-langchain`. The browser can
cancel a stream (Stop button); the partial reply stays on screen.

## POST /api/chat/run-langchain

Same shape, `via: "langchain"`. Requires `requirements-langchain.txt`;
otherwise 501 with installation instructions.

## POST /api/keys/check?provider=…

Header: `X-LLM-API-Key`. Format-only check. Returns
`{ provider, format_ok, stored: false }`. Nothing is stored or called.
