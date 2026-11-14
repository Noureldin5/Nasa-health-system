"""Cited reference values (CLAUDE.md rule 7). One place, so code and UI show the same source.

A number that is not here and has no source comment is a "Demo parameter".
These are reference values for context. Alerts follow the personal baseline, and nothing
here is a diagnosis.
"""

from __future__ import annotations

# The CO2 limit is defined as a partial pressure. Our sensor series is in ppm, so it is
# converted assuming a cabin at sea-level pressure (760 mmHg, the nominal ISS cabin pressure
# of 14.7 psia). Conversion assumption: Demo parameter.
CABIN_PRESSURE_MMHG = 760.0


def mmhg_to_ppm(partial_pressure_mmhg: float) -> float:
    return partial_pressure_mmhg / CABIN_PRESSURE_MMHG * 1_000_000


def ppm_to_mmhg(ppm: float) -> float:
    return ppm * CABIN_PRESSURE_MMHG / 1_000_000


CO2_LIMIT = {
    "id": "co2_1h_limit",
    "what": "Cabin CO2 limit, 1-hour average",
    "value_mmhg": 3.0,
    "value_ppm": round(mmhg_to_ppm(3.0)),  # 3947
    "averaging": "1 hour",
    "source": "NASA-STD-3001 Volume 2, Revision D, requirement [V2 6004], as summarized in "
    "NASA OCHMO technical brief OCHMO-TB-004, Carbon Dioxide (CO2)",
    "url": "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf",
    "accessed": "2026-11-14",
    "note": "Converted from mmHg to ppm assuming 760 mmHg cabin pressure (Demo parameter). "
    "The standard's own text was not read, only NASA's technical brief that quotes it.",
}

CO2_HEADACHE_STUDY = {
    "id": "co2_headache_iss",
    "what": "CO2 and reported headaches on the International Space Station",
    "finding": "Each 1 mmHg rise in CO2 about doubled the odds of a reported headache. Keeping the "
    "headache risk below 1% would need a 7-day average below 2.5 mmHg.",
    "value_mmhg": 2.5,
    "value_ppm": round(mmhg_to_ppm(2.5)),  # 3289
    "averaging": "7 days",
    "source": "Law J, et al. Relationship between carbon dioxide levels and reported headaches on the "
    "International Space Station. Journal of Occupational and Environmental Medicine, 2014",
    "url": "https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/20150019624.pdf",
    "accessed": "2026-11-14",
    "note": "A statistical association in crew reports, not proof of cause for one person. "
    "Read from the abstract and NASA summaries; verify the page before the pitch.",
}

ALL = (CO2_LIMIT, CO2_HEADACHE_STUDY)
