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
Errors: 400 = missing/invalid key or unknown provider/model error from
the provider; 502 = provider/network failure.

## POST /api/chat/run-stream

Same request shape and key header as `/api/chat/run`, but the reply
streams as server-sent events: `data: {"type": "delta", "text": "..."}`
per chunk, then `data: {"type": "done", "latency_ms": N}`. A provider
error mid-stream arrives as `data: {"type": "error", "detail": "..."}`
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
