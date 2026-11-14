"""OSD-569 ETL, run on the real raw NASA files in data/raw/osd569/."""

import json
import shutil

import pytest

from pipeline.osd569 import LABEL, OUTPUT, RAW_DIR, SUBMITTED, Osd569Error, build, render


@pytest.fixture(scope="module")
def document():
    return build()


def by_id(document, indicator_id):
    return next(i for i in document["indicators"] if i["id"] == indicator_id)


def test_shape_of_the_dataset(document):
    assert len(document["indicators"]) == 20
    assert [s["id"] for s in document["subjects"]] == ["C001", "C002", "C003", "C004"]
    assert [t["id"] for t in document["timepoints"]] == ["L-92", "L-44", "L-3", "R+1", "R+45", "R+82", "R+194"]
    assert sum(len(i["values"]) for i in document["indicators"]) == 553


def test_there_are_no_in_flight_samples(document):
    assert {t["phase"] for t in document["timepoints"]} == {"pre-flight", "post-flight"}


def test_every_indicator_has_value_min_and_max(document):
    for indicator in document["indicators"]:
        assert indicator["unit"] and indicator["name"]
        assert indicator["earth_reference_ranges"]
        for value in indicator["values"]:
            assert value["range_min"] <= value["range_max"]
            expected = "below" if value["value"] < value["range_min"] else "above" if value["value"] > value["range_max"] else "inside"
            assert value["vs_range"] == expected


def test_known_values_from_the_raw_file(document):
    # First rows of the submitted CSV: WHITE BLOOD CELL COUNT,5.4,3.8,10.8,Thousand/uL,CBC,C001,M,L-92
    first = by_id(document, "white_blood_cell_count")["values"][0]
    assert first == {"subject": "C001", "timepoint": "L-92", "value": 5.4, "range_min": 3.8, "range_max": 10.8, "vs_range": "inside"}
    assert by_id(document, "white_blood_cell_count")["unit"] == "Thousand/uL"


def test_hemoglobin_unit_comes_from_the_submitted_file(document):
    # The transformed file labels hemoglobin "percent"; the submitted file has the real unit.
    assert by_id(document, "hemoglobin")["unit"] == "g/dL"


def test_female_suffix_rows_are_merged_into_the_same_indicator(document):
    ids = {i["id"] for i in document["indicators"]}
    assert not any("female" in indicator_id for indicator_id in ids)
    assert len(by_id(document, "hemoglobin")["values"]) == 28


def test_missing_values_stay_missing(document):
    # 7 values are absent in the raw file. They are not filled in.
    counts = {i["id"]: len(i["values"]) for i in document["indicators"]}
    incomplete = {indicator_id: n for indicator_id, n in counts.items() if n != 28}
    assert incomplete == {"mcv": 27, "mch": 26, "mchc": 24}


def test_ranges_are_kept_as_printed_not_chosen(document):
    ranges = by_id(document, "hemoglobin")["earth_reference_ranges"]
    assert {(r["sex"], r["min"], r["max"]) for r in ranges} == {("F", 11.7, 15.5), ("F", 13.2, 17.1), ("M", 13.2, 17.1)}
    assert sum(r["rows"] for r in ranges) == 28


def test_citation_and_labels(document):
    dataset = document["dataset"]
    assert dataset["id"] == "OSD-569"
    assert dataset["url"] == "https://osdr.nasa.gov/bio/repo/data/studies/OSD-569"
    assert dataset["doi"] and dataset["accessed"] and dataset["id"] in dataset["citation"]
    assert (dataset["mission_start"], dataset["mission_end"]) == ("2021-09-16", "2021-09-18")
    assert document["source"] == "nasa"
    assert document["label"] == LABEL == "Inspiration4 crew sample, not your labs"
    assert set(document["featured"]) <= {i["id"] for i in document["indicators"]}


def test_committed_json_is_what_the_etl_produces(document):
    # If this fails, run: python3 -m pipeline.osd569
    assert OUTPUT.read_text(encoding="utf-8") == render(document)
    json.loads(OUTPUT.read_text(encoding="utf-8"))


def test_an_edited_raw_file_is_refused(tmp_path):
    copy = tmp_path / "osd569"
    shutil.copytree(RAW_DIR, copy)
    with open(copy / SUBMITTED, "a", encoding="utf-8") as handle:
        handle.write("HEMOGLOBIN,99,13.2,17.1,g/dL,CBC,C001,M,L-92\n")
    with pytest.raises(Osd569Error, match="must not be edited"):
        build(copy)
