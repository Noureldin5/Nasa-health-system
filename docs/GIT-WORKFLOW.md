# Git workflow

How the three of us share one repo without breaking the demo. Who owns what: `docs/TEAM.md`.

Repo: `https://github.com/Noureldin5/Nasa-health-system`. Default branch: `main`.

## The one rule

**`main` always runs the demo.** Anything on `main` must start with `docker compose up`, pass `make check`, and click through the demo path. Broken work lives on a branch until it is fixed.

## Branches

- Short-lived branches off `main`, merged back within a day. No long-running `frontend` or `backend` branches.
- Name: `<person>/<short-topic>`, lowercase, hyphens. Person is `a`, `b` or `c`.
  - `a/body-map`, `a/check-in`, `b/drift-detection`, `b/ground-link`, `c/vm-compose`, `c/osd569-etl`, `c/simulator`
  - Shared-file changes: `shared/<topic>`, for example `shared/types-consult-brief`.
- One branch per feature or requirement ID. If a branch touches more than about 400 lines or lives longer than a day, split it.
- Delete the branch after it is merged.

## Daily loop

```bash
git switch main && git pull
git switch -c b/drift-detection
# work, commit often
git fetch origin && git rebase origin/main     # at least morning and evening
make check                                     # lint + tests for web, api and pipeline
git push -u origin b/drift-detection
# open a pull request into main
```

Rebase your own branch on `main`; do not merge `main` into it. Only force-push your own branch, with `git push --force-with-lease`. Never force-push `main`.

## Pull requests

- Every change reaches `main` through a pull request. No direct commits to `main` after hour 0.
- One reviewer from the other two. Review within 1 hour during working time; if nobody can review within 2 hours, the author may merge if `make check` passes and the demo path still works.
- Merge with **squash and merge**, so `main` has one commit per feature.
- PR title in the commit style below. PR description: what changed, requirement IDs (for example `D5, U5`), how to see it, screenshot for UI changes.

PR checklist (copy into the description):

```
- [ ] make check passes
- [ ] docker compose up still starts the full stack
- [ ] Demo path still clicks through (docs/REQUIREMENTS.md, "Demo")
- [ ] Works with the network off (if it touches compose, images, fonts or data loading)
- [ ] Simulated values are labeled "Simulated" in the UI
- [ ] Health messages use decision-support wording, no diagnosis
- [ ] New thresholds have a source comment or "Demo parameter"
- [ ] No real patient data, no secrets, no files from .serena/ or settings.local.json
```

## Commit messages

Conventional style, short, present tense, as in the existing log:

```
feat(api): drift detection against personal baseline
fix(web): status pill contrast on dark theme
feat(pipeline): OSD-569 ETL to processed JSON
test(api): every surgeon note visible to astronaut
docs: record data shapes in DECISIONS.md
chore(deploy): pin VictoriaMetrics image version
```

Types: `feat`, `fix`, `test`, `data`, `docs`, `design`, `chore`, `refactor`. Scopes: `web`, `api`, `pipeline`, `deploy`, `data`.

## Shared files

These files affect all three people. Change them only in a small `shared/<topic>` PR, tell the other two in the team chat, and get one approval:

- `api/openapi.json` and any endpoint change (contract between A and B)
- The metric schema in `docs/DECISIONS.md` (contract between B and C)
- `docs/DECISIONS.md` in general
- `deploy/docker-compose.yml` (C owns it, but B and A run it)
- `Makefile`, root lint config

Dependencies: each person owns their own lockfile (`web/package-lock.json`, `api/` and `pipeline/` Python requirements). If you get a lockfile conflict, take `main`'s version and reinstall.

## Folder ownership

Edit your own folders freely. To change someone else's folder, ask first or open the PR with them as the reviewer.

| Folder | Owner |
|---|---|
| `web/` | A, frontend |
| `api/` | B, backend |
| `pipeline/`, `data/`, `deploy/` | C, data engineer |
| `docs/` | Everyone, but `docs/DECISIONS.md` is shared |

## Claude Code sessions

- Claude commits only when the person driving it asks. It works on your branch, never on `main`.
- Paste `PROMPT.md` into a fresh session and tell it which person you are (A, B or C) and the branch name.
- Ask the `advisor` agent for a review before merging anything large.
- Do not commit `.serena/`, `.claude/settings.local.json` or other machine files.

## Demo freeze

- When the demo first clicks through end to end on `main`, tag it: `git tag demo-v1 && git push origin demo-v1`. Tag again after each big step (`demo-v2`, ...). If `main` breaks before judging, run the demo from the last tag.
- **Freeze 6 hours before the submission deadline:** only fixes and copy changes go into `main` after that, each one reviewed and demo-tested.
- The submitted version is tagged `submission`.
