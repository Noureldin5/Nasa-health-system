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

Use `--pull never` when you want proof that nothing is downloaded: compose then fails at once if the image is missing instead of reaching for the network. Do not commit the `.tar` file.

### Offline check (C8): what was verified on 2026-11-14, and what was not

Verified on the development machine (native Docker engine, VictoriaMetrics only):

- `docker save` wrote a 19 MB archive. Image ID `sha256:da8a90ac...3b66970` is the digest noted in the compose file.
- With the image removed, `docker compose up --pull never` fails with "No such image" and downloads nothing.
- After `docker load -i`, `docker compose up -d --wait --pull never` starts the stack, healthy in a few seconds, with the earlier time-series data still in the `vmdata` volume. `deploy/smoke_test.py` prints PASS and `make check` passes (102 tests).
- The compose file has no `build:` section, no `latest` tag and no other image, so VictoriaMetrics is the only thing to pre-load today.

**Not verified. Do this on the demo laptop with Wi-Fi off** (`docs/TEAM.md`, C8 "Done when"):

1. Turn Wi-Fi off and unplug the network cable. Open a browser tab to any website to confirm it is really offline.
2. `docker load -i victoriametrics-v1.156.0.tar` (from the USB stick), then `docker compose up -d --wait --pull never`.
3. `make mission` and `python3 deploy/smoke_test.py`. Open `http://localhost:8428/vmui`.
4. Reboot the laptop and start again from step 2, to check the volume and Docker's own startup do not need the network.
5. Confirm the architecture matches: an `amd64` image will not run on an `arm64` laptop (`docker image inspect --format '{{.Architecture}}' victoriametrics/victoria-metrics:v1.156.0` on both machines).
6. The `api` and `web` images do not exist yet. When B and A add them, each needs: pinned base image, dependencies installed at build time (no `pip install` or `npm install` at start), fonts and icons bundled in the app (no CDN link), and its own `docker save`. Re-run this whole list with all three services before the demo. A web page that loads a font or script from the internet will look broken offline.
7. Python on the laptop must run `pipeline/` (3.12, standard library only). `make mission` needs `make` and `python3` on the host.

The offline claim for the whole stack stays unproven until step 6 passes.

## If something is wrong

| Symptom | Likely cause |
|---|---|
| `port is already allocated` | Something else uses 8428. Stop it, or stop an old copy of this stack |
| Smoke test: "not reachable" | Stack is not up, or `VM_URL` points elsewhere |
| Smoke test: instant query fails | `-search.latencyOffset` is missing from the compose file |
| Old data missing | Older than 90 days, or the volume was removed with `down -v` |
