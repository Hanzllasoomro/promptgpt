# PromptGPT v2

Turn a casual idea into an engineered prompt — then **send it to your favourite
chatbot**, or **run it here with your own LLM key**.

This is a rebuild of the original single-package Replit app (one template,
in-memory history, no LLM) as two independently deployable services, written
the way a senior team would ship it: small, stateless backend, typed
frontend, tests, and a key model that never stores a secret server-side.

```
promptgpt/
├── backend/    FastAPI + prompt engine + provider adapters (LangChain optional)
├── frontend/   React + Vite + TypeScript (no UI-kit bloat)
├── docs/       Deployment, API and security notes
└── docker-compose.yml
```

## What changed from v1

| v1 | v2 |
| --- | --- |
| One fixed prompt template | Structured engine: role, objective, context, steps, constraints, output format, quality check — 7 task types, audience, tone, length |
| Monolith (`client/` + `server/` + `shared/` in one package) | `backend/` and `frontend/` with their own manifests, Dockerfiles and env files |
| History lost on restart (in-memory) | History in the browser (localStorage); backend stays stateless, so it scales without a database |
| "Copy and paste into ChatGPT" as a tip | **Send to chatbot**: prefilled links for ChatGPT, Claude, Gemini, Perplexity, Copilot; honest copy-then-paste flow for Mistral, DeepSeek, Grok, Meta AI, Poe |
| No LLM access | **Bring your own key**: OpenAI, Anthropic, Google Gemini, Hugging Face, or any OpenAI-compatible server (Ollama, LM Studio, Groq, DeepSeek) |
| — | LangChain as an opt-in layer (`/api/chat/run-langchain`, `requirements-langchain.txt`), not a hard dependency |

## Quick start

```bash
# Backend (port 8000)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (port 5173, proxies /api to the backend)
cd frontend
npm install
npm run dev
```

Or everything at once:

```bash
docker compose up --build
# frontend http://localhost:5173 · backend http://localhost:8000/docs
```

## API keys — the security model, in one paragraph

Keys live **only in the user's browser** (localStorage, Keys tab). On a chat
request the browser sends the key as an `X-LLM-API-Key` header; the backend
forwards it once to the provider and discards it. There is no database, no
key file, no log line and no response that contains a key. `POST /api/keys/check`
is format-only and stores nothing. Server-side env keys (`OPENAI_API_KEY` etc.)
are optional fallbacks for a self-hosted instance. See `docs/SECURITY.md`.

## Deploy

See `docs/DEPLOYMENT.md` — Render (see `render.yaml`), Railway/Fly via the
Dockerfiles, or Vercel/Netlify for the frontend + any container host for the
backend. Set the frontend's `VITE_API_URL` to the deployed backend URL.

## Tests

```bash
cd backend && pip install -r requirements-dev.txt && python -m pytest -q
cd ../frontend && npm install && npm run build
```

## License

MIT
