"""OSD-569 ETL: NASA OSDR Inspiration4 complete blood count -> data/processed/osd569.json.

    python3 -m pipeline.osd569

Reads the raw files in data/raw/osd569/ (never edited, checksums verified first) and writes
clean JSON that the API serves. Runs offline. Re-running gives byte-identical output.

What the data is: 4 crew members, blood drawn 3 times before launch and 4 times after
return. There are **no in-flight samples**. The min and max are the laboratory's reference
range printed next to each value: an Earth reference range, shown for context only.
It never drives an alert (CLAUDE.md rule 6).
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import zipfile
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = REPO_ROOT / "data" / "raw" / "osd569"
OUTPUT = REPO_ROOT / "data" / "processed" / "osd569.json"

SUBMITTED = "LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv"
TRANSFORMED = "LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv"
ISA_ZIP = "OSD-569_metadata_OSD-569-ISA.zip"

LABEL = "Inspiration4 crew sample, not your labs"  # docs/TEAM.md, rules for C
ACRONYMS = {"MCV", "MCH", "MCHC", "RDW", "MPV"}
# Shown first on the blood-count card (docs/REQUIREMENTS.md M2b: white cells, lymphocytes).
FEATURED = ["white_blood_cell_count", "absolute_lymphocytes", "lymphocytes"]
# Samples whose values look shifted in BOTH NASA files, so the agreement check cannot catch them.
# C003 L-92: MCH is missing and the values after it sit in the wrong analyte (MPV 330 fL, platelets
# 12.9, absolute neutrophils 10.1; absolute lymphocytes 6826 = 71.1% x 9.6, the neutrophil count).
# Found by the advisor review on 2026-11-14. Not yet confirmed against the OSDR page. The raw files
# stay untouched: the values are kept in the output but flagged and left out of every statistic.
SUSPECT_SAMPLES = {
    ("C003", "L-92"): "Values look shifted by one analyte in the NASA file (MCH missing, MPV 330 fL, "
    "platelets 12.9). Kept as published, excluded from the crew sample statistics and range checks.",
}
PHASE_BY_PREFIX = {"L": "pre-flight", "R": "post-flight"}


class Osd569Error(RuntimeError):
    """The raw files are missing, changed, or not shaped as expected."""


def verify_checksums(raw_dir: Path) -> dict[str, str]:
    """Raw NASA files are never edited: stop if any differs from SHA256SUMS."""
    sums: dict[str, str] = {}
    for line in (raw_dir / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
        digest, name = line.split(maxsplit=1)
        actual = hashlib.sha256((raw_dir / name.strip()).read_bytes()).hexdigest()
        if actual != digest:
            raise Osd569Error(f"{name.strip()} does not match SHA256SUMS. Raw files must not be edited; download again.")
        sums[name.strip()] = digest
    return sums


def _number(text: str) -> int | float:
    value = float(text)
    return int(value) if value.is_integer() else value


def _indicator_id(analyte: str) -> str:
    # One sample writes "HEMOGLOBIN (FEMALE)" for the same analyte.
    analyte = re.sub(r"\s*\(FEMALE\)$", "", analyte.strip())
    return re.sub(r"[^a-z0-9]+", "_", analyte.lower()).strip("_")


def _display_name(indicator_id: str) -> str:
    if indicator_id.upper() in ACRONYMS:
        return indicator_id.upper()
    return indicator_id.replace("_", " ").capitalize()


def _timepoint(test_date: str) -> dict:
    match = re.fullmatch(r"([LR])([+-])(\d+)", test_date)
    if not match:
        raise Osd569Error(f"unexpected test date {test_date!r}")
    prefix, sign, days = match.group(1), match.group(2), int(match.group(3))
    if (prefix, sign) not in {("L", "-"), ("R", "+")}:
        raise Osd569Error(f"unexpected test date {test_date!r}")
    before = prefix == "L"
    return {
        "id": test_date,
        "phase": PHASE_BY_PREFIX[prefix],
        "day": -days if before else days,
        "relative_to": "launch" if before else "return",
        "label": f"{days} day{'s' if days != 1 else ''} {'before launch' if before else 'after return'}",
    }


def _read_isa(raw_dir: Path) -> tuple[dict[str, str], dict[str, str]]:
    """Study facts and the flight phase of each blood-count sample, from the ISA metadata."""
    with zipfile.ZipFile(raw_dir / ISA_ZIP) as archive:
        investigation = archive.read("i_Investigation.txt").decode("utf-8")
        samples = archive.read("s_OSD-569.txt").decode("utf-8")

    facts: dict[str, str] = {}
    for line in investigation.splitlines():
        key, _, rest = line.partition("\t")
        if key not in facts and rest.strip():
            facts[key] = rest.split("\t")[0].strip().strip('"')

    rows = list(csv.reader(io.StringIO(samples), delimiter="\t"))
    header = rows[0]
    name_at, phase_at = header.index("Sample Name"), header.index("Factor Value[Spaceflight]")
    phases = {row[name_at]: row[phase_at] for row in rows[1:] if row[name_at].endswith("_cbc")}
    return facts, phases


def _iso_date(us_date: str) -> str:
    return datetime.strptime(us_date, "%m/%d/%y").date().isoformat()


def _check_against_transformed(raw_dir: Path, values: dict[tuple[str, str, str], int | float]) -> None:
    """The two NASA files must agree on every value they share."""
    with open(raw_dir / TRANSFORMED, encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            subject, _, test_date, _ = row["Sample Name"].split("_")
            for column, text in row.items():
                match = re.fullmatch(r"(.+)_value_.+", column)
                if not match or not text.strip():
                    continue
                key = (match.group(1), subject, test_date)
                if key not in values or float(values[key]) != float(text):
                    raise Osd569Error(f"submitted and transformed files disagree on {key}")


def build(raw_dir: Path = RAW_DIR) -> dict:
    checksums = verify_checksums(raw_dir)
    source = json.loads((raw_dir / "source.json").read_text(encoding="utf-8"))
    facts, phases = _read_isa(raw_dir)

    with open(raw_dir / SUBMITTED, encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    subjects: dict[str, str] = {}
    timepoints: dict[str, dict] = {}
    indicators: dict[str, dict] = {}
    values: dict[tuple[str, str, str], int | float] = {}

    for row in rows:
        indicator_id = _indicator_id(row["ANALYTE"])
        subject, sex, test_date, unit = row["SUBJECT_ID"], row["SEX"], row["TEST_DATE"], row["UNITS"]
        value, low, high = _number(row["VALUE"]), _number(row["RANGE_MIN"]), _number(row["RANGE_MAX"])

        if subjects.setdefault(subject, sex) != sex:
            raise Osd569Error(f"subject {subject} has two different sex values")
        timepoint = timepoints.setdefault(test_date, _timepoint(test_date))
        isa_phase = phases.get(f"{subject}_whole-blood_{test_date}_cbc")
        if isa_phase != timepoint["phase"]:
            raise Osd569Error(f"{subject} {test_date}: ISA metadata says {isa_phase!r}, expected {timepoint['phase']!r}")

        indicator = indicators.setdefault(
            indicator_id, {"id": indicator_id, "name": _display_name(indicator_id), "unit": unit, "values": []}
        )
        if indicator["unit"] != unit:
            raise Osd569Error(f"{indicator_id} has two units: {indicator['unit']!r} and {unit!r}")
        if (indicator_id, subject, test_date) in values:
            raise Osd569Error(f"duplicate value for {indicator_id} {subject} {test_date}")
        values[(indicator_id, subject, test_date)] = value
        suspect = (subject, test_date) in SUSPECT_SAMPLES
        indicator["values"].append(
            {
                "subject": subject,
                "timepoint": test_date,
                "value": value,
                "quality": "suspect" if suspect else "ok",
                # The range printed by the laboratory on this row. Kept per value because the
                # file does not print the same range on every row for female subjects.
                "range_min": low,
                "range_max": high,
                "vs_range": None
                if suspect
                else "below" if value < low else "above" if value > high else "inside",
            }
        )

    _check_against_transformed(raw_dir, values)

    ordered_timepoints = sorted(timepoints.values(), key=lambda t: (t["relative_to"] == "return", t["day"]))
    order = {t["id"]: index for index, t in enumerate(ordered_timepoints)}
    for indicator in indicators.values():
        indicator["values"].sort(key=lambda v: (v["subject"], order[v["timepoint"]]))
        good = [v for v in indicator["values"] if v["quality"] == "ok"]
        numbers = [v["value"] for v in good]
        ranges: dict[tuple, int] = {}
        for v in good:
            key = (subjects[v["subject"]], v["range_min"], v["range_max"])
            ranges[key] = ranges.get(key, 0) + 1
        indicator["earth_reference_ranges"] = [
            {"sex": sex, "min": low, "max": high, "rows": count} for (sex, low, high), count in sorted(ranges.items())
        ]
        indicator["crew_sample"] = {
            "min": min(numbers),
            "max": max(numbers),
            "mean": round(sum(numbers) / len(numbers), 2),
            "n": len(numbers),
        }
        indicator["values"] = indicator.pop("values")  # keep the long list last for readability

    return {
        "schema_version": 1,
        "source": "nasa",
        "label": LABEL,
        "dataset": {
            "id": source["dataset_id"],
            "title": facts["Study Title"],
            "url": source["url"],
            "doi": facts["Comment[DOI]"],
            "public_release": facts["Study Public Release Date"],
            "mission": facts["Comment[Mission Name]"],
            "mission_start": _iso_date(facts["Comment[Mission Start]"]),
            "mission_end": _iso_date(facts["Comment[Mission End]"]),
            "accessed": source["accessed"],
            "citation": (
                f"NASA Open Science Data Repository, {source['dataset_id']}, "
                f"doi:{facts['Comment[DOI]']}, {source['url']} (accessed {source['accessed']})"
            ),
            "files": [{"name": name, "sha256": checksums[name]} for name in (SUBMITTED, TRANSFORMED, ISA_ZIP)],
        },
        "notes": [
            "Real, public, de-identified NASA data from 4 Inspiration4 crew members. Not the user's own lab results.",
            "Samples were taken before launch and after return only. There are no in-flight samples.",
            "range_min and range_max are the laboratory reference range printed with each value: an Earth "
            "reference range. It is shown for context and never triggers an alert.",
            "Sample C003 L-92 looks shifted in the NASA file. Its values carry quality=suspect and are "
            "left out of crew_sample and vs_range.",
            "For female subjects the file does not print the same range on every row; each value keeps its own.",
            "Decision support, not diagnosis.",
        ],
        "featured": FEATURED,
        "subjects": [{"id": subject, "sex": sex} for subject, sex in sorted(subjects.items())],
        "timepoints": ordered_timepoints,
        "indicators": list(indicators.values()),
    }


def render(document: dict) -> str:
    return json.dumps(document, indent=2, ensure_ascii=False) + "\n"
