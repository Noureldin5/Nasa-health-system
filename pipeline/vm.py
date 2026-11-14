"""Thin HTTP client for VictoriaMetrics. Standard library only.

Everything that talks to VictoriaMetrics goes through this module, so the quirks
(docs/DECISIONS.md, section 6) are handled in one place.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Iterable

DEFAULT_VM_URL = "http://localhost:8428"
TIMEOUT_S = 10


class VMUnavailable(RuntimeError):
    """VictoriaMetrics cannot be reached (not started, wrong VM_URL, timeout)."""


class VMError(RuntimeError):
    """VictoriaMetrics answered with an error status."""


def resolve_url(base_url: str | None = None) -> str:
    return (base_url or os.environ.get("VM_URL") or DEFAULT_VM_URL).rstrip("/")


def request(
    path: str,
    *,
    params: Iterable[tuple[str, str]] = (),
    body: bytes | None = None,
    base_url: str | None = None,
) -> bytes:
    """GET, or POST when a body is given. Returns the response body."""
    url = resolve_url(base_url) + path
    query = urllib.parse.urlencode(list(params))
    if query:
        url += "?" + query
    http_request = urllib.request.Request(url, data=body, method="GET" if body is None else "POST")
    try:
        with urllib.request.urlopen(http_request, timeout=TIMEOUT_S) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace").strip()
        raise VMError(f"VictoriaMetrics returned {error.code} for {path}: {detail}") from error
    except (urllib.error.URLError, OSError) as error:
        raise VMUnavailable(
            f"VictoriaMetrics is not reachable at {resolve_url(base_url)} ({error}). "
            "Start it with `docker compose up -d` or check VM_URL."
        ) from error


def selector(name: str, labels: dict[str, str]) -> str:
    """Series selector, for example {__name__="hr_bpm",crew_id="a1"}."""
    parts = [f'__name__="{name}"'] + [f'{key}="{value}"' for key, value in sorted(labels.items())]
    return "{" + ",".join(parts) + "}"


def _seconds(moment: datetime) -> str:
    return f"{moment.timestamp():.3f}"


def export(
    match: str, start: datetime, end: datetime, *, base_url: str | None = None
) -> list[tuple[dict[str, str], int, float]]:
    """Raw samples for every series that matches, as (labels, timestamp_ms, value).

    start and end are always sent: without them VictoriaMetrics does not return
    a point written this instant. Both ends are inclusive here; callers filter.
    """
    raw = request(
        "/api/v1/export",
        params=[("match[]", match), ("start", _seconds(start)), ("end", _seconds(end))],
        base_url=base_url,
    )
    samples: list[tuple[dict[str, str], int, float]] = []
    for line in raw.splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        labels = row["metric"]
        for timestamp_ms, value in zip(row["timestamps"], row["values"]):
            if value is None:
                continue
            samples.append((labels, int(timestamp_ms), float(value)))
    return samples


def import_lines(lines: Iterable[str], *, base_url: str | None = None) -> None:
    body = ("\n".join(lines) + "\n").encode()
    request("/api/v1/import", body=body, base_url=base_url)


def force_flush(*, base_url: str | None = None) -> None:
    """Make just-written samples searchable now. A debug endpoint: demo shortcut."""
    request("/internal/force_flush", base_url=base_url)


def reset_cache(*, base_url: str | None = None) -> None:
    """Drop cached query results. Needed after loading history or deleting series."""
    request("/internal/resetRollupResultCache", base_url=base_url)


def delete_series(match: str, *, base_url: str | None = None) -> None:
    """Delete whole series. VictoriaMetrics cannot delete a time range."""
    request("/api/v1/admin/tsdb/delete_series", params=[("match[]", match)], body=b"", base_url=base_url)
