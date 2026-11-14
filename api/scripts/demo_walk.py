"""Walk the 3-minute demo against a running API and fail loudly if any beat breaks.

    uv run python scripts/demo_walk.py                      # starts its own server on a free port
    uv run python scripts/demo_walk.py --url http://localhost:8000

Uses only localhost and the standard library, so it works with the network off. It resets the
simulated mission to day 10 first. Beats follow docs/REQUIREMENTS.md "Demo".
"""

from __future__ import annotations

import argparse
import json
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def call(base: str, method: str, path: str, body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read() or b"null")
    except urllib.error.HTTPError as err:
        return err.code, json.loads(err.read() or b"null")


def check(ok: bool, beat: str) -> None:
    print(f"{'ok  ' if ok else 'FAIL'} {beat}")
    if not ok:
        raise SystemExit(1)


def walk(base: str) -> None:
    code, _ = call(base, "POST", "/demo/reset?day=10")
    check(code == 200, "reset to mission day 10")

    _, view = call(base, "GET", "/astronaut/a1/view")
    check(view["alert"] is None, "morning: no alert before the check-in")

    code, readout = call(base, "POST", "/astronaut/a1/checkin", {"headache": "moderate", "mood": 4})
    alert = readout["alert"]
    check(code == 201 and alert is not None, "check-in with a headache raises the alert")
    pinned = {i["indicator"] for i in alert["related_items"]}
    check(pinned == {"headache", "co2"}, "alert links the headache days to the cabin CO2 days")
    check(
        alert["contact_if"].startswith("Contact the flight surgeon if"), "alert says when to call"
    )
    check(readout["disclaimer"] == "Decision support, not a diagnosis.", "decision-support footer")

    _, draft = call(base, "GET", "/astronaut/a1/briefs/draft")
    check(
        {i["indicator"] for i in draft["pinned_items"]} == pinned,
        "brief draft pins the alert items",
    )
    code, brief = call(
        base,
        "POST",
        "/astronaut/a1/briefs",
        {"question": draft["question_suggestion"], "alert_id": alert["id"]},
    )
    check(code == 201 and brief["state"] == "queued", "brief is queued for the next ground link")

    _, ground = call(base, "GET", "/ground/a1/view")
    check(ground["briefs"] == [] and ground["alert"] is None, "ground sees nothing before the link")
    _, sync1 = call(base, "POST", "/link/sync")
    check(
        sync1["up"]["briefs"] == 1 and sync1["up"]["alerts"] == 1,
        "ground link carries record and brief",
    )

    _, inbox = call(base, "GET", "/ground/inbox")
    check(
        [i["kind"] for i in inbox] == ["brief", "alert"], "surgeon inbox: brief first, then alert"
    )
    _, ground = call(base, "GET", "/ground/a1/view")
    check(ground["alert"]["id"] == alert["id"], "surgeon sees the astronaut's full record")

    code, _ = call(
        base,
        "POST",
        "/ground/a1/notes",
        {
            "kind": "note",
            "target": "headache",
            "text": "Pattern matches the CO2 rise.",
            "author": "Dr. Ruiz",
        },
    )
    check(code == 201, "surgeon writes a note")
    code, _ = call(
        base,
        "POST",
        f"/briefs/{brief['id']}/reply",
        {"author": "Dr. Ruiz", "text": "Worth watching. Ask for a ventilation check."},
    )
    check(code == 201, "surgeon replies to the brief")

    _, station = call(base, "GET", "/astronaut/a1/view")
    check(
        station["notes"] == [] and station["replies"] == [],
        "astronaut sees nothing before the next link",
    )
    _, sync2 = call(base, "POST", "/link/sync")
    check(sync2["down"] == {"replies": 1, "notes": 1}, "next link brings the note and reply down")

    _, station = call(base, "GET", "/astronaut/a1/view")
    _, ground = call(base, "GET", "/ground/a1/view")
    check(
        {n["id"] for n in station["notes"]} == {n["id"] for n in ground["notes"]}
        and {r["id"] for r in station["replies"]} == {r["id"] for r in ground["replies"]},
        "same picture on both ends: every ground note and reply is in the astronaut view",
    )
    check(station["briefs"][0]["state"] == "answered", "brief shows as answered")

    _, log = call(base, "GET", "/link/log")
    check(len(log) >= 3, f"sync log lists every sync ({len(log)} entries)")
    print("demo path complete")


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", help="API base URL. Default: start a local server.")
    args = parser.parse_args()
    if args.url:
        walk(args.url.rstrip("/"))
        return

    port = free_port()
    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app:create_app", "--factory", "--port", str(port)],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        for _ in range(60):
            try:
                if call(base, "GET", "/health")[0] == 200:
                    break
            except (urllib.error.URLError, ConnectionError):
                time.sleep(0.25)
        else:
            raise SystemExit("server did not start")
        walk(base)
    finally:
        server.terminate()
        server.wait(timeout=10)


if __name__ == "__main__":
    main()
