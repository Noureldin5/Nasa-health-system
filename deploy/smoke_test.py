#!/usr/bin/env python3
"""Smoke test for C1: write one point to VictoriaMetrics, read it back, delete it.

Run after `docker compose up -d`:

    python3 deploy/smoke_test.py

Uses only the standard library. Reads VM_URL (default http://localhost:8428).
The test series `smoke_test` is not part of the metric schema and is removed at the end.
Exit code 0 means VictoriaMetrics accepts writes and answers queries.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

VM_URL = os.environ.get("VM_URL", "http://localhost:8428").rstrip("/")
SERIES = {"__name__": "smoke_test", "source": "sim", "run": str(time.time_ns())}
SELECTOR = '{__name__="smoke_test"}'
TIMEOUT_S = 5


def call(path: str, *, data: bytes | None = None, params: dict[str, str] | None = None) -> bytes:
    url = VM_URL + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, data=data, method="POST" if data is not None else "GET")
    with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
        return response.read()


def main() -> int:
    value = 42.0
    timestamp_ms = int(time.time() * 1000)
    window = {"start": str(timestamp_ms // 1000 - 60), "end": str(timestamp_ms // 1000 + 60)}

    try:
        call("/health")
    except (urllib.error.URLError, OSError) as error:
        print(f"FAIL: VictoriaMetrics is not reachable at {VM_URL}: {error}")
        print("      Start it with: docker compose up -d")
        return 1

    try:
        line = json.dumps({"metric": SERIES, "values": [value], "timestamps": [timestamp_ms]})
        call("/api/v1/import", data=line.encode() + b"\n")
        # Fresh samples sit in memory for a few seconds. force_flush makes them searchable now.
        call("/internal/force_flush")

        # Always pass start and end to export. Without them a point written this instant is not returned.
        exported = call("/api/v1/export", params={"match[]": SELECTOR, **window})
        rows = [json.loads(row) for row in exported.splitlines() if row.strip()]
        got = [(ts, v) for row in rows for ts, v in zip(row["timestamps"], row["values"])]
        if got != [(timestamp_ms, value)]:
            print(f"FAIL: wrote {(timestamp_ms, value)}, read back {got}")
            return 1
        print(f"ok  write + raw read  ({VM_URL}/api/v1/export)")

        # The same point through the query API with server defaults. It becomes visible after
        # -search.latencyOffset (1s in our compose file, 30s by default), so wait just past 1s.
        time.sleep(1.5)
        answer = json.loads(call("/api/v1/query", params={"query": f'smoke_test{{run="{SERIES["run"]}"}}'}))
        result = answer["data"]["result"]
        if not result or float(result[0]["value"][1]) != value:
            print(f"FAIL: instant query did not return the fresh point: {answer}")
            print("      Check -search.latencyOffset in deploy/docker-compose.yml")
            return 1
        print("ok  instant query sees the point 1.5 s after the write (latency offset is 1s)")
    finally:
        try:
            call("/api/v1/admin/tsdb/delete_series", data=b"", params={"match[]": SELECTOR})
        except (urllib.error.URLError, OSError) as error:
            print(f"warning: could not delete the test series: {error}")

    left = call("/api/v1/export", params={"match[]": SELECTOR, **window})
    if left.strip():
        print("FAIL: test series still present after delete")
        return 1
    print("ok  test series deleted")
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
