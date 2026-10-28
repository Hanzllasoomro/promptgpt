# PromptGPT

PromptGPT turns a rough idea into a structured, reusable prompt. You can
review the generated prompt, send it to a supported chatbot, or run it
through an LLM provider using your own API key.

The project is split into two independently deployable services:

- **Backend:** FastAPI, deterministic prompt engineering, provider adapters
- **Frontend:** React, TypeScript, and Vite

The backend is stateless. Prompt history is kept in the browser, and API keys
are not stored by the backend.

## Features

- Generate detailed and concise prompts from a short idea
- Support for writing, coding, explaining, marketing, learning, planning, and
  general tasks
- Configurable audience, tone, length, output format, context, constraints,
  and examples
- Links for ChatGPT, Claude, Gemini, Perplexity, Copilot, Mistral, DeepSeek,
  Grok, Meta AI, and Poe
- Direct chat support for OpenAI, Anthropic, Google Gemini, Hugging Face, and
  OpenAI-compatible servers
- Optional LangChain integration
- Browser-side key storage with per-request forwarding
- Interactive API documentation through FastAPI
- Docker and Docker Compose support

## Requirements

Install the following before starting:

- Python 3.12 or newer
- Node.js 20 or newer
- npm
- Git
- Docker Desktop, only if using Docker

## Quick start

The backend and frontend run in separate terminals.

### Windows PowerShell

#### Terminal 1: backend

```powershell
Set-Location H:\Projects\web\promptgpt\backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

If PowerShell prevents activation, run the backend without activating the
environment:

```powershell
Set-Location H:\Projects\web\promptgpt\backend
..\.venv\Scripts\python.exe
```

Use the direct executable for both installation and startup:

```powershell
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

#### Terminal 2: frontend

```powershell
Set-Location H:\Projects\web\promptgpt\frontend
npm install
npm run dev
```

Open:

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:8000>
- Interactive API docs: <http://localhost:8000/docs>

### macOS or Linux

#### Terminal 1: backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### Terminal 2: frontend

```bash
cd frontend
npm install
npm run dev
```

## Configuration

### Backend environment

Copy the example file before adding optional settings:

```text
backend/.env.example -> backend/.env
```

Available settings:

| Variable | Purpose | Default |
| --- | --- | --- |
| `CORS_ORIGINS` | Comma-separated frontend origins | `http://localhost:5173,http://localhost:3000` |
| `OPENAI_API_KEY` | Optional OpenAI server fallback | Empty |
| `ANTHROPIC_API_KEY` | Optional Anthropic server fallback | Empty |
| `GOOGLE_API_KEY` | Optional Google server fallback | Empty |
| `HF_API_KEY` | Optional Hugging Face server fallback | Empty |
| `HUGGINGFACE_API_KEY` | Alternative Hugging Face variable | Empty |
| `LLM_TIMEOUT_S` | Provider request timeout in seconds | `60` |

Server-side provider keys are optional. The normal workflow is to enter a key
in the frontend Keys tab.

### Frontend environment

Copy the example file when the frontend must call a separately deployed
backend:

```text
frontend/.env.example -> frontend/.env
```

Set:

```env
VITE_API_URL=https://your-backend.example.com
```

For local development, leave `VITE_API_URL` empty. Vite proxies `/api`
requests to `http://localhost:8000`.

## Using the application

1. Open the frontend.
2. Enter an idea and choose the task type.
3. Add optional audience, tone, context, constraints, examples, and output
   format.
4. Generate the engineered prompt.
5. Copy it, open a chatbot link, or select a provider in the chat panel.
6. For direct provider calls, add the provider key in the Keys tab.
7. Review the final prompt before sending it to an external provider.

For Ollama or LM Studio, choose **OpenAI-compatible**, provide the model and
base URL, and use a non-empty local value as the key. Examples:

```text
Ollama:   http://localhost:11434/v1
LM Studio: http://localhost:1234/v1
```

## API overview

The base URL is `http://localhost:8000`. Full reference:
[docs/API.md](docs/API.md).

| Method | Endpoint | Description | Key required |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Service and LangChain status | No |
| `GET` | `/api/providers` | Provider catalogue | No |
| `POST` | `/api/prompts/generate` | Generate an engineered prompt | No |
| `GET` | `/api/chatbots?prompt=...` | Create chatbot links | No |
| `POST` | `/api/chat/run` | Run a direct provider request | Yes or server fallback |
| `POST` | `/api/chat/run-langchain` | Run through optional LangChain | Yes |
| `POST` | `/api/keys/check?provider=...` | Check key format only | Header required |

Example prompt-generation request:

```bash
curl -X POST http://localhost:8000/api/prompts/generate ^
  -H "Content-Type: application/json" ^
  -d "{\"idea\":\"Build a weekly meal plan\",\"task_type\":\"plan\",\"tone\":\"practical\"}"
```

On macOS/Linux, replace the PowerShell line-continuation character `^` with
`\`.

Example direct chat request:

```bash
curl -X POST http://localhost:8000/api/chat/run ^
  -H "Content-Type: application/json" ^
  -H "X-LLM-API-Key: YOUR_PROVIDER_KEY" ^
  -d "{\"provider\":\"openai\",\"prompt\":\"Explain dependency injection\",\"model\":\"gpt-4o-mini\"}"
```

## Project structure

```text
promptgpt/
├── backend/
│   ├── app/
│   │   ├── main.py              FastAPI routes and application setup
│   │   ├── models.py            Request and response models
│   │   ├── prompt_engine.py     Deterministic prompt generation
│   │   ├── chatbots.py          Chatbot link builders
│   │   ├── security.py          Key validation and redaction helpers
│   │   └── llm/                 Provider and LangChain adapters
│   ├── tests/                   Backend tests
│   ├── requirements.txt         Runtime dependencies
│   ├── requirements-dev.txt     Test dependencies
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx              Main application
│   │   ├── api.ts               Backend API client
│   │   └── components/          React UI components
│   ├── package.json
│   └── Dockerfile
├── docs/
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── SECURITY.md
├── docker-compose.yml
└── render.yaml
```

## Testing and production builds

### Backend

From `backend`, with the virtual environment active:

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

### Frontend

From `frontend`:

```bash
npm install
npm run build
```

The build output is written to `frontend/dist`.

## Docker

To run both services:

```bash
docker compose up --build
```

Open:

- Frontend: <http://localhost:5173>
- Backend docs: <http://localhost:8000/docs>

Stop the services with:

```bash
docker compose down
```

To build the frontend for a remote backend:

```bash
docker build --build-arg VITE_API_URL=https://your-backend.example.com ./frontend
```

## Deployment

The backend and frontend can be deployed separately. The frontend only needs
the backend URL at build time.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Render, Railway, Fly.io,
Vercel, Netlify, Docker, and VPS guidance.

For a deployed backend:

1. Set `CORS_ORIGINS` to the exact frontend origin.
2. Configure optional provider fallback keys only when required.
3. Confirm `GET /api/health` returns a successful response.
4. Set the frontend build variable `VITE_API_URL`.
5. Rebuild and redeploy the frontend.

## Security and privacy

- User keys are stored in browser `localStorage`, not in the backend.
- Keys are sent in the `X-LLM-API-Key` header, never in a query string.
- The backend forwards a key once and does not return or log it.
- `/api/keys/check` checks key format only; it does not call a provider.
- Prompt text may be included in chatbot URLs, so do not place secrets in a
  prompt.
- Review prompts copied from third-party content before sending them to an
  external model.

Read the complete policy in [docs/SECURITY.md](docs/SECURITY.md).

## Troubleshooting

### `uvicorn` or `fastapi` is not recognized

Activate the backend virtual environment, or invoke the environment's Python
directly:

```powershell
Set-Location H:\Projects\web\promptgpt\backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

### PowerShell refuses to run `Activate.ps1`

Use the direct Python command above, or allow scripts for the current user:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Frontend cannot reach the backend

Confirm that the backend is running on port 8000. In local development,
confirm Vite is running on port 5173. For a deployed frontend, set
`VITE_API_URL` and ensure the backend `CORS_ORIGINS` includes the frontend
origin.

### Chat requests fail

Check the provider name, model, API key, and base URL. A missing or malformed
key returns `400`; a provider or network failure returns `502`.

### LangChain endpoint returns `501`

LangChain is optional. Install the additional dependencies:

```bash
cd backend
python -m pip install -r requirements-langchain.txt
```

## Contributing

1. Create a branch for your change.
2. Keep backend and frontend changes scoped to the relevant service.
3. Add or update tests for behavior changes.
4. Run backend tests and the frontend production build.
5. Do not commit `.env` files, API keys, or generated secrets.

## License

MIT
