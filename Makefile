# Shared file (docs/GIT-WORKFLOW.md). Each person adds a check-<area> target and lists it under `check`.
.PHONY: up down smoke sample check check-pipeline

up:              ## start the stack and wait until it is healthy
	docker compose up -d --wait

down:            ## stop the stack, keep the data
	docker compose down

smoke:           ## write, read and delete one test point in VictoriaMetrics
	python3 deploy/smoke_test.py

sample:          ## load a small simulated sample (3 days, crew a1). Replaces all source="sim" data
	python3 -m pipeline.simulator --days 3 --crew a1 --seed 42

check: check-pipeline   ## everything that must pass before a merge

check-pipeline:  ## pipeline tests. Tests that need VictoriaMetrics are skipped when it is down
	python3 -m pytest pipeline/tests -q
