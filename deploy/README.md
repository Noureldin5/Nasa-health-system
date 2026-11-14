# deploy

The station server stack. Owner: C. `docker-compose.yml` is a shared file (`docs/GIT-WORKFLOW.md`): B and A add the `api` and `web` services through a PR.

## Start and check

From the repo root:

```bash
docker compose up -d --wait        # starts VictoriaMetrics, waits until it is healthy
python3 deploy/smoke_test.py       # writes one point, reads it back, deletes it. Prints PASS
docker compose down                # stop. Data stays in the volume
docker compose down -v             # stop and delete all time-series data
```

The root `compose.yaml` includes `deploy/docker-compose.yml`, so plain `docker compose` works from the root. It needs Docker Compose 2.20 or newer (`docker compose version`).

| Service | From the host | From another service in compose |
|---|---|---|
| VictoriaMetrics | `http://localhost:8428` | `http://victoriametrics:8428` |

Code reads the address from `VM_URL`. A small built-in query page is at `http://localhost:8428/vmui`.

## Settings we changed, and why

| Flag | Value | Why |
|---|---|---|
| `-retentionPeriod` | `90d` | Demo parameter. Points older than this are dropped |
| `-search.latencyOffset` | `1s` | Demo parameter. The default 30s would hide a live check-in from the chart |

Behaviour to know when reading data (details in `docs/DECISIONS.md`, section 6):

- A point written right now is visible to queries about 1 second later. `pipeline/ingest` has `flush()` for the live check-in.
- `/api/v1/export` needs explicit `start` and `end`, or it does not return a point written this instant. C's query functions always pass them.

## Offline (rule 3)

The image tag is pinned. Compose does not pull an image that is already on the machine, so the stack starts with no internet once the image is there.

On a machine with internet:

```bash
docker pull victoriametrics/victoria-metrics:v1.156.0
docker save victoriametrics/victoria-metrics:v1.156.0 -o victoriametrics-v1.156.0.tar
```

On the demo laptop (USB stick, no internet):

```bash
docker load -i victoriametrics-v1.156.0.tar
docker compose up -d --wait && python3 deploy/smoke_test.py
```

Do not commit the `.tar` file. The full offline rehearsal with all three services is C8.

## If something is wrong

| Symptom | Likely cause |
|---|---|
| `port is already allocated` | Something else uses 8428. Stop it, or stop an old copy of this stack |
| Smoke test: "not reachable" | Stack is not up, or `VM_URL` points elsewhere |
| Smoke test: instant query fails | `-search.latencyOffset` is missing from the compose file |
| Old data missing | Older than 90 days, or the volume was removed with `down -v` |
