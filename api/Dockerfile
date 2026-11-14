# Build context is the repo root (api/ imports pipeline/ as a path dependency, see docs/DECISIONS.md).
# Pin the base image digest before the demo laptop is taken offline (C8).
FROM python:3.12-slim

RUN pip install --no-cache-dir uv==0.11.14
WORKDIR /srv
COPY api/pyproject.toml api/uv.lock /srv/api/
WORKDIR /srv/api
RUN uv sync --frozen --no-dev
COPY api/ /srv/api/
# The API imports C's pipeline package and serves its OSD-569 file (paths are relative to /srv).
COPY pipeline/ /srv/pipeline/
COPY data/processed/ /srv/data/processed/

# SEED_DAY reseeds the simulated mission on every start (demo). Set it to empty to keep data.
ENV SQLITE_PATH=/data/records.db METRICS_BACKEND=vm SEED_DAY=10 VM_URL=http://victoriametrics:8428
EXPOSE 8000
# --no-sync: never touch the network at start. Check with `docker run --network none` (see deploy/README.md).
CMD ["uv", "run", "--no-sync", "uvicorn", "app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
