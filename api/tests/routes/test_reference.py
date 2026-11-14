import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import create_app
from settings import DEFAULT_OSD569, Settings

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")


def client_for(path: Path) -> TestClient:
    return TestClient(create_app(Settings(osd569_path=path, seed_day=None)))


def write(tmp_path: Path, **overrides) -> Path:
    doc = {
        "schema_version": 1,
        "source": "OSDR OSD-569",
        "label": "Inspiration4 crew sample, not your labs",
        "dataset": {"id": "OSD-569", "url": "https://osdr.nasa.gov/bio/repo/data/studies/OSD-569"},
        "notes": ["note"],
        "featured": ["hemoglobin"],
        "subjects": [{"id": "C001", "sex": "F"}],
        "timepoints": [{"id": "L-92", "phase": "pre", "day": -92, "label": "92 days before"}],
        "indicators": [
            {
                "id": "hemoglobin",
                "name": "Hemoglobin",
                "unit": "g/dL",
                "earth_reference_ranges": [
                    {"sex": "F", "min": 11.7, "max": 15.5, "rows": 13},
                    {"sex": "M", "min": 13.2, "max": 17.1, "rows": 14},
                ],
                "crew_sample": {"min": 12.0, "max": 16.0, "mean": 14.0, "n": 27},
                "values": [
                    {
                        "subject": "C001",
                        "timepoint": "L-92",
                        "value": 12.5,
                        "quality": "ok",
                        "range_min": 11.7,
                        "range_max": 15.5,
                        "vs_range": "inside",
                    },
                    {
                        "subject": "C002",
                        "timepoint": "L-92",
                        "value": None,
                        "quality": "suspect",
                        "range_min": None,
                        "range_max": None,
                        "vs_range": None,
                    },
                ],
            }
        ],
    }
    doc.update(overrides)
    out = tmp_path / "osd569.json"
    out.write_text(json.dumps(doc))
    return out


def test_the_real_file_from_c_is_served_without_error():
    # The file C's ETL produced must always pass through the API (docs/DECISIONS.md section 9).
    assert DEFAULT_OSD569.exists()
    body = client_for(DEFAULT_OSD569).get("/reference/osd569").json()
    assert body["dataset_id"] == "OSD-569" and "osdr.nasa.gov" in body["url"]
    assert body["placeholder"] is False
    assert "not your labs" in body["label"]
    assert len(body["indicators"]) == 20
    wbc = next(i for i in body["indicators"] if i["indicator"] == "white_blood_cell_count")
    assert (wbc["range_min"], wbc["range_max"]) == (3.8, 10.8)
    assert wbc["value"] == 6.9  # crew sample mean, n = 27
    assert wbc["crew_sample"]["n"] == 27 and len(wbc["values"]) > 0
    assert body["featured"] == ["white_blood_cell_count", "absolute_lymphocytes", "lymphocytes"]


def test_per_sample_values_and_suspect_flags_pass_through(tmp_path):
    body = client_for(write(tmp_path)).get("/reference/osd569").json()
    values = body["indicators"][0]["values"]
    assert [v["subject"] for v in values] == ["C001", "C002"]
    assert values[0]["vs_range"] == "inside" and values[0]["quality"] == "ok"
    assert values[1]["value"] is None and values[1]["quality"] == "suspect"
    assert values[1]["vs_range"] is None


def test_two_sex_specific_ranges_are_kept_and_the_flat_range_is_the_widest(tmp_path):
    ind = client_for(write(tmp_path)).get("/reference/osd569").json()["indicators"][0]
    assert [(r["sex"], r["min"], r["max"]) for r in ind["earth_reference_ranges"]] == [
        ("F", 11.7, 15.5),
        ("M", 13.2, 17.1),
    ]
    assert (ind["range_min"], ind["range_max"]) == (11.7, 17.1)  # kept for A's current adapter
    assert ind["indicator"] == "hemoglobin" and ind["name"] == "Hemoglobin"


def test_dataset_timepoints_and_subjects_pass_through(tmp_path):
    body = client_for(write(tmp_path)).get("/reference/osd569").json()
    assert body["subjects"] == [{"id": "C001", "sex": "F"}]
    assert body["timepoints"][0]["id"] == "L-92"
    assert body["dataset"]["id"] == "OSD-569"


def test_missing_file_gives_a_labeled_placeholder_with_no_numbers(tmp_path):
    body = client_for(tmp_path / "nope.json").get("/reference/osd569").json()
    assert body["placeholder"] is True and body["indicators"] == []
    assert body["dataset_id"] == "OSD-569" and "not your labs" in body["label"]


def test_a_file_that_does_not_match_fails_loudly_with_the_file_name(tmp_path):
    path = write(tmp_path, indicators=[{"name": "no id"}])
    resp = client_for(path).get("/reference/osd569")
    assert resp.status_code == 500
    assert "osd569.json" in resp.json()["detail"]


def test_hazards_serves_the_five_nasa_hazards_from_the_real_file(tmp_path):
    from pathlib import Path

    from fastapi.testclient import TestClient

    from app import create_app
    from settings import DEFAULT_HAZARDS, Settings

    assert DEFAULT_HAZARDS.exists()
    c = TestClient(create_app(Settings(seed_day=10, osd569_path=tmp_path / "none.json")))
    doc = c.get("/reference/hazards").json()
    assert len(doc["hazards"]) == 5
    assert all(h["url"].startswith("https://www.nasa.gov/hrp/") for h in doc["hazards"])

    missing = TestClient(
        create_app(Settings(seed_day=None, hazards_path=Path(tmp_path / "x.json")))
    )
    assert missing.get("/reference/hazards").status_code == 404
