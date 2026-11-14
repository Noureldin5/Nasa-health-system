# data/simulated

**Simulated data. Not real patient data.** Everything here is produced by `pipeline/simulator/` from a fixed seed. Every number is a Demo parameter.

| File | What |
|---|---|
| `mission_seed42_14d_daily.csv` | The 14-day demo mission as one row per crew member per mission day: daily values plus the day's mean heart rate and mean CO2 of the person's module. For reading the story and for frontend mocks. Rewrite with `make snapshot` |

The full data (heart rate and CO2 every 5 minutes) is not stored in a file. `make mission` generates it and loads it into VictoriaMetrics with timestamps relative to now, labeled `source="sim"`.

The story: `pipeline/simulator/__init__.py` (top of the file) and `docs/USER-FLOW.md`, "Demo story".
