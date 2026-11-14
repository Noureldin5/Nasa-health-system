import re
from pathlib import Path

import pytest

from pipeline import schema

DECISIONS = Path(__file__).resolve().parents[2] / "docs" / "DECISIONS.md"


def _section(text: str, number: int) -> str:
    match = re.search(rf"^## {number}\. .*?(?=^## )", text, flags=re.S | re.M)
    assert match, f"section {number} not found in docs/DECISIONS.md"
    return match.group(0)


def test_metric_names_match_decisions_md():
    section = _section(DECISIONS.read_text(encoding="utf-8"), 2)
    table_rows = [line for line in section.splitlines() if line.startswith("| `")]
    # Rows of the metric table have 5 columns; the label table has 3.
    documented = {re.match(r"\| `([a-z0-9_]+)`", row).group(1) for row in table_rows if row.count("|") == 6}
    assert documented == set(schema.METRICS)


def test_every_source_is_documented():
    section = _section(DECISIONS.read_text(encoding="utf-8"), 2)
    for source in schema.SOURCES:
        assert f'`source="{source}"`' in section


def test_every_metric_has_a_cadence_and_unit():
    for metric in schema.METRICS.values():
        assert metric.cadence in (schema.FIVE_MIN, schema.DAILY)
        assert metric.unit


def test_unknown_metric_names_the_known_ones():
    with pytest.raises(ValueError, match="hr_bpm"):
        schema.get("heart_rate")
