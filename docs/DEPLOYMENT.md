# Deployment

Backend and frontend are two containers. There are two ways to connect
them; the first is the default and the one `docker compose` uses.

## Same origin (default)

The frontend container runs nginx, which serves the SPA and proxies
every `/api` call to the backend (`frontend/nginx.conf.template`).
The browser talks to one origin, so no CORS setup is needed and the
frontend needs no build-time API URL. Streaming works through the
proxy (buffering is off, read timeout 300s).

The backend origin comes from the `BACKEND_URL` environment variable
on the frontend container:

- `docker compose`: `http://backend:8000` (the compose service name).
- Two containers in one ECS task: `http://localhost:8000` (shared
  network namespace).
- Anything else: the backend's internal address or load-balancer URL.

## Split (frontend static, backend elsewhere)

Build the frontend with the backend URL baked in:

```bash
docker build --build-arg VITE_API_URL=https://your-backend.example.com -t promptgpt-frontend ./frontend
```

Or set `VITE_API_URL` when deploying to Vercel/Netlify. The streaming
endpoint respects it too. In this topology the backend must allow the
frontend origin: set `CORS_ORIGINS` to include it, e.g.
`https://your-frontend.vercel.app`.

## Docker Compose (local / single host)

```bash
docker compose up --build
```

Open http://localhost:5173. The backend is also reachable directly at
http://localhost:8000 (`GET /api/health`). Optional server-side key
fallbacks go in `backend/.env` (see `backend/.env.example`); the file
is gitignored and never baked into the image. Keys normally stay in
the browser (bring-your-own-key) and are sent per request.

## Backend (FastAPI)

- Build: `backend/Dockerfile` (Python 3.12-slim, uvicorn, `$PORT`).
  The image also installs `requirements-langchain.txt`, so the
  "Run via LangChain" toggle in the UI works; without those deps
  `/api/chat/run-langchain` returns 501.
- Env: `CORS_ORIGINS` (only matters for the split topology),
  optional `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`,
  `HF_API_KEY` fallbacks, `LLM_TIMEOUT_S` (default 60).
- Health check: `GET /api/health` (also the container HEALTHCHECK).

## Frontend (React + Vite)

- Build: `npm ci && npm run build` → `dist/`, served by nginx.
- No server-side secret is needed for the frontend.

## CI (GitHub Actions)

`.github/workflows/ci.yml` runs on pushes to `main` and on pull
requests: backend tests (`pytest`), frontend build (`npm ci` +
`npm run build`), Docker builds of both images, then a compose smoke
test — backend direct (`:8000/api/health`) and through the nginx
proxy (`:5173/api/health`), plus a check that the SPA serves. No
secrets are needed; nothing is pushed or deployed from CI.

## AWS

Pick one; the deploy workflow (ECR push + deploy) is the next step
once the target is chosen.

- **Single EC2 host (simplest):** install Docker, clone the repo,
  `docker compose up -d --build`. One instance, one public port
  (5173, or 80 via a reverse proxy). Good for a demo or a first
  deployment.
- **ECS Fargate + ECR + ALB (production path):** build both images,
  push to ECR, run them as two containers in one task definition
  (frontend `BACKEND_URL=http://localhost:8000`), behind an ALB
  that routes everything to the frontend container. No servers to
  manage; scale by raising the task count.
- **App Runner (backend) + static frontend:** deploy the backend
  image to App Runner, deploy the frontend to S3/CloudFront or
  Amplify with `VITE_API_URL` set to the App Runner URL (split
  topology; remember `CORS_ORIGINS` on the backend).

`render.yaml` keeps the Render blueprint working (backend web service
+ frontend Docker service, split topology via `VITE_API_URL`).
