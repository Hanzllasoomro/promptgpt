# Backend: FastAPI on uvicorn. Build with:
#   docker build -t promptgpt-backend ./backend
# Run with the port from $PORT (8000 by default). Keys are bring-your-own
# in the browser; server-side fallbacks are optional env vars (see
# .env.example) and must never be baked into the image.
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt requirements-langchain.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-langchain.txt
COPY app ./app
# The LangChain toggle in the UI needs these deps; without them
# /api/chat/run-langchain returns 501.
RUN groupadd -r app && useradd -r -g app app
USER app
ENV PORT=8000
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f\"http://localhost:{os.environ.get('PORT', '8000')}/api/health\")"
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
