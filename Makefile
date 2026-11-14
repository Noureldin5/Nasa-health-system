# Shared file (see docs/GIT-WORKFLOW.md). Each role adds its own check; keep targets small.
.PHONY: check api-check

check: api-check

api-check:
	cd api && uv run ruff check . && uv run pytest -q
