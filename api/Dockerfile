# Build context is the repo root (api/ imports pipeline/ as a path dependency, see docs/DECISIONS.md).
# Pin the base image digest before the demo laptop is taken offline (C8).
FROM python:3.12-slim

RUN pip install --no-cache-dir uv==0.11.14
WORKDIR /srv
COPY api/pyproject.toml api/uv.lock /srv/api/
WORKDIR /srv/api
RUN uv sync --frozen --no-dev
COPY api/ /srv/api/

ENV SQLITE_PATH=/data/records.db METRICS_BACKEND=fake
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
