"""The Environment Switcher texts: five NASA HRP hazards, every quote traceable, no uncited numbers."""

import json
import re
from pathlib import Path

import pytest

from pipeline import schema

PATH = Path(__file__).resolve().parents[2] / "data" / "processed" / "hazards.json"


@pytest.fixture(scope="module")
def doc():
    return json.loads(PATH.read_text(encoding="utf-8"))


def test_five_hazards_each_with_a_nasa_url_and_quotes(doc):
    assert [h["id"] for h in doc["hazards"]] == ["radiation", "isolation", "distance", "gravity", "closed-environment"]
    for hazard in doc["hazards"]:
        assert hazard["url"].startswith("https://www.nasa.gov/hrp/hazard-")
        assert hazard["nasa_quotes"]
        assert hazard["app_link"]["provenance"].startswith("Our wording")


def test_no_number_is_stated_without_a_source(doc):
    # NASA quotes carry no digits we added; our own wording carries none at all.
    for hazard in doc["hazards"]:
        assert not re.search(r"(?<![A-Za-z])\d", hazard["app_link"]["text"]), hazard["id"]


def test_linked_metrics_exist_in_the_schema(doc):
    for hazard in doc["hazards"]:
        for metric in hazard["environment_switcher"]["symptom_link"] or []:
            assert metric in schema.METRICS
