# Shared file (docs/GIT-WORKFLOW.md). Each person adds a check-<area> target and lists it under `check`.
.PHONY: up down smoke sample mission follow snapshot osd569 check check-pipeline

# The demo mission. DAY is which mission day "today" is (OPEN 1 in docs/DECISIONS.md).
MISSION = --days 14 --crew a1,a2,a3 --seed 42
DAY ?= 10
LIVE ?= a1

up:              ## start the stack and wait until it is healthy
	docker compose up -d --wait

down:            ## stop the stack, keep the data
	docker compose down

smoke:           ## write, read and delete one test point in VictoriaMetrics
	python3 deploy/smoke_test.py

sample:          ## load a small simulated sample (3 days, crew a1). Replaces all source="sim" data
	python3 -m pipeline.simulator --days 3 --crew a1 --seed 42

mission:         ## load the 14-day demo mission for 3 crew, today = day $(DAY). Replaces all source="sim" data
	python3 -m pipeline.simulator load $(MISSION) --today-is-day $(DAY) --live-crew $(LIVE)

follow:          ## live replay: keep adding simulated readings as time passes. Ctrl+C to stop
	python3 -m pipeline.simulator follow $(MISSION) --live-crew $(LIVE)

snapshot:        ## rewrite data/simulated/ (the mission as a small CSV)
	python3 -m pipeline.simulator snapshot $(MISSION)

osd569:          ## rebuild data/processed/osd569.json from the raw NASA files
	python3 -m pipeline.osd569

check: check-pipeline   ## everything that must pass before a merge

check-pipeline:  ## pipeline tests. Tests that need VictoriaMetrics are skipped when it is down
	python3 -m pytest pipeline/tests -q
