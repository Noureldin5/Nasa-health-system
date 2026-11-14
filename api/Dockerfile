# Build context is the repo root (api/ imports pipeline/ as a path dependency, see docs/DECISIONS.md).
# Pin the base image digest before the demo laptop is taken offline (C8).
FROM python:3.12-slim

RUN pip install --no-cache-dir uv==0.11.14
WORKDIR /srv
COPY api/pyproject.toml api/uv.lock /srv/api/
WORKDIR /srv/api
RUN uv sync --frozen --no-dev
COPY api/ /srv/api/

# SEED_DAY reseeds the simulated mission on every start (demo). Set it to empty to keep data.
ENV SQLITE_PATH=/data/records.db METRICS_BACKEND=fake SEED_DAY=10
EXPOSE 8000
# --no-sync: never touch the network at start. Check with `docker run --network none` (Task 10).
CMD ["uv", "run", "--no-sync", "uvicorn", "app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
