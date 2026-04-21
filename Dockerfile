# ── Stage 1: base image ──────────────────────────────────────────────────────
FROM python:3.11-slim AS base

# Prevents Python from writing .pyc files and enables stdout/stderr logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# ── Stage 2: dependencies ─────────────────────────────────────────────────────
FROM base AS deps

COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Stage 3: final image ──────────────────────────────────────────────────────
FROM deps AS final

# Copy application source
COPY app/ .

# Cloud Run injects $PORT at runtime — default to 8080
ENV PORT=8080
EXPOSE 8080

# Use Gunicorn as the production WSGI server
# - 2 workers is a safe default for a 256 Mi Cloud Run instance
# - timeout 120s matches Cloud Run's request timeout
CMD ["gunicorn", \
     "--bind", "0.0.0.0:8080", \
     "--workers", "2", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "main:app"]