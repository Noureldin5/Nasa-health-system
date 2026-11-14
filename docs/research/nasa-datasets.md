# NASA datasets for the challenge

Source: research pasted by the team on 2026-11-14 (checked by the team that day). Challenge page: https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/ . Resources tab to re-check before the hackathon: https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=resources

The paste arrived partly garbled (tables and some lines were cut). This file keeps what was readable. Where text was lost, it says so. Items marked [verified] were opened or called by the researcher. Items marked [not verified] come from page descriptions only.

## Summary

| Goal | Dataset | Difficulty |
|---|---|---|
| Real astronaut-crew health data with lab values and normal ranges | OSDR OSD-569 (Inspiration4 complete blood count) | Easy: one small CSV, no login |
| More Inspiration4 human data (plasma, immune, microbiome) | OSDR OSD-570, 571, 572, 573, 574, 630, 687 | Medium to hard: omics, large files |
| Bed rest (microgravity analog) human data | OSDR OSD-195, 946, 942, 370, 51, 198 | Medium: omics |
| Reference ranges, thresholds, which indicators to track | NASA Standard Measures, HRP Risks, Evidence Reports | Easy: reading, not data |
| Individual astronaut medical data (LSDA/LSAH) | NASA Life Sciences Portal | Not feasible: approval takes about 13 months |

Recommended minimum: OSD-569 CBC CSV, the Standard Measures list, and the HRP risks text.

## 1. NASA OSDR (Open Science Data Repository), open and no login

- Search UI: https://osdr.nasa.gov/bio/repo/
- Overview of biological and physical science data: https://science.nasa.gov/biological-physical/data/
- 649 studies were listed when checked. Mostly animals, plants and cells, with some human studies.

### Human studies found [verified through the search API]

SpaceX Inspiration4 (civilian crew, 2021 flight):

- OSD-569: RNA-seq, whole-genome sequencing and complete blood count (CBC). https://osdr.nasa.gov/bio/repo/data/studies/OSD-569
- OSD-571: extracellular vesicles, cell-free DNA and RNA. https://osdr.nasa.gov/bio/repo/data/studies/OSD-571
- OSD-570: PBMC single-cell data, TCR/BCR. https://osdr.nasa.gov/bio/repo/data/studies/OSD-570
- OSD-687: T-cell data. https://osdr.nasa.gov/bio/repo/data/studies/OSD-687
- OSD-572, OSD-573, OSD-574, OSD-630, OSD-689: listed in the paste without titles.

Other human studies:

- OSD-53: spaceflight modulates gene expression in astronauts.
- OSD-174: closed space environment, hair follicle gene expression.
- OSD-195, OSD-946, OSD-942, OSD-370, OSD-51, OSD-198: bed rest studies (muscle, insulin resistance, countermeasures).
- OSD-353: spaceflight factors in the human plasma proteome.

More search: `https://osdr.nasa.gov/osdr/data/search?term=astronaut&type=cgene&from=0&size=15` (68 hits for "astronaut").

### How to pull data (API) [verified]

No API key and no login. JSON over HTTPS.

| Purpose | Endpoint |
|---|---|
| Search studies | `GET https://osdr.nasa.gov/osdr/data/search?term=<text>&type=cgene&from=0&size=15` |
| Study metadata (ISA-JSON) | `GET https://osdr.nasa.gov/osdr/data/osd/meta/<number>`, for example `/meta/569` |
| List study files | `GET https://osdr.nasa.gov/osdr/data/osd/files/<number>`, for example `/files/569` |
| Download a file | `GET https://osdr.nasa.gov` plus the `remote_url` field from the file list |

`remote_url` looks like `/geode-py/ws/studies/OSD-569/download?source=datamanager&file=<file_name>`. It redirects (HTTP 302) to a short-lived signed S3 URL. Always follow redirects, and never store the resulting URL. Rebuild it each time.

The `/files/<n>` response has `studies["OSD-<n>"].study_files[]` with the fields `file_name`, `file_size` (bytes), `category`, `remote_url` and `restricted`.

Python sketch from the paste (two lines were omitted in the paste, so this is incomplete):

```python
import requests, io
import pandas as pd

BASE = "https://osdr.nasa.gov"

def list_files(osd_number: int):
    r = requests.get(f"{BASE}/osdr/data/osd/files/{osd_number}", timeout=60)
    # lines omitted in the paste: raise on error, return the study_files list
    ...

def download(file_info: dict) -> bytes:
    r = requests.get(BASE + file_info["remote_url"], timeout=120)  # follows redirects
    # lines omitted in the paste: raise on error, return r.content
    ...

files = list_files(569)
cbc = next(f for f in files if f["file_name"].endswith("CBC_TRANSFORMED.csv"))
df = pd.read_csv(io.BytesIO(download(cbc)))
print(df.shape)
print(df.columns[:8].tolist())
```

curl:

```bash
curl -s https://osdr.nasa.gov/osdr/data/osd/files/569 | python3 -m json.tool | head -50
curl -L -o cbc.csv \
  "https://osdr.nasa.gov/geode-py/ws/studies/OSD-569/download?source=datamanager&file=LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv"
```

### The most useful file: OSD-569 CBC [verified]

OSD-569 has 11 files:

| File | Size | Notes |
|---|---|---|
| `LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv` | about 0.01 MB | Use this one. Wide format, one row per sample |
| `LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv` | about 0.03 MB | Original submitted version |
| `OSD-569_metadata_OSD-569-ISA.zip` | about 0.12 MB | ISA metadata (subjects, timepoints) |
| `GLDS-561_long-readRNAseq_..._Processed.xlsx` | about 123 MB | Omics, skip |
| `GLDS-561_directm6Aseq_..._Processed_Data.xlsx` | about 93 MB | Omics, skip |
| MultiQC reports and md5 files | under 2 MB | QC, skip |

CBC columns follow the pattern `absolute_basophils_value_cells_per_microliter`, `absolute_basophils_range_min_cells_per_microliter` and `absolute_basophils_range_max_cells_per_microliter`. The same pattern covers eosinophils, lymphocytes, monocytes and neutrophils, with percent versions too. Each indicator has its own value plus a min and max, which maps onto the challenge's "color coding at a glance" idea (normal, low, high).

Only the header was checked. The full column list and the number of subjects and timepoints were not verified. Pre-flight, in-flight and post-flight labels are in the ISA metadata.

### Difficulty

- Easy: the CBC CSV, about 15 lines of pandas, no auth, tiny file.
- Medium: the ISA metadata zip (map samples to subject and timepoint), and the bed rest studies.
- Hard: RNA-seq, proteomics, metagenomics. Large files and bioinformatics knowledge needed. Not worth it without a team biologist.
- Pitfalls: signed redirect URLs expire. Part of the paste about OSDR license and data-use terms was lost. Read the OSDR terms before submitting.

## 2. NASA Life Sciences Portal (LSDA and LSAH)

Portal: https://nlsp.nasa.gov . Data requests: https://nlsp.nasa.gov/data-request . Guidelines: https://nlsp.nasa.gov/data-request-guidelines .

Individual-level data needs NASA IRB approval: about 13 months for de-identified data and about 25 months for identifiable data. Not usable in a hackathon. Pooled data (means and ranges) is described as publicly available on the site. Which pooled datasets can be downloaded was not verified.

Pages readable without login [verified]:

- Standard Measures: https://nlsp.nasa.gov/resources/standard-measures . Official list of core health measurements on the ISS (9), HERA (3), NEK (3) and :envihab (12). Use it to choose indicators. ISS items include actigraphy, cognition, personality questionnaire, sleep quality and team questionnaire, biochemical measures, carotid intima-media thickness, cellular profile, microbiome and sensorimotor. HERA adds PANAS and GHQ.
- UTMB Bedrest Campaign 1: 84-day head-down-tilt bed rest, 3 subjects, 25 experiments listed (metadata only). https://nlsp.nasa.gov/explore/data/details/6eaf1654-72d4-5d71-a9dd-a02e674c6473?dataType=MISSIONS
- UTMB Bedrest Campaign 3 [not verified]: https://nlsp.nasa.gov/explore/data/details/593a6726-8650-551a-8d67-0f03468de92f?dataType=MISSIONS
- UTMB Bedrest Campaign 11 [not verified]: 70-day bed rest, exercise countermeasures. https://nlsp.nasa.gov/explore/data/details/8e583564-d124-58ce-b44a-a16bb5b5d981?dataType=MISSIONS
- LSAH "Summarized List of Medical Tests" and "Detailed Description" [not verified]: links on https://nlsp.nasa.gov/resources/lsah

## 3. Human Research Program (HRP) pages

The paste lost most of this section. Links that survived:

- NASA HRP five hazards: https://www.nasa.gov/hrp/hazards/
- HRP risks: https://www.nasa.gov/hrp/risks/
- HRP ongoing research: https://www.nasa.gov/hrp/ongoing-hrp-research/
- Human Research Roadmap evidence reports: https://humanresearchroadmap.nasa.gov/evidence/
- NLSP overview: https://www.nasa.gov/hrp/nlsp/

## 4. Other space agencies

- Canadian Space Agency, monitoring radiation and astronaut health: https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp
- Canadian Space Agency, why science experiments in space: https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp

The challenge page says more resources may be added before the hackathon. Re-check the Resources tab.

## 5. Not NASA (only if the rules allow)

The team reports the organizers said NASA data must be used. These are optional extras. Check the rules before using them.

- PhysioNet open databases (ECG, heart rate, sleep): https://physionet.org/about/database/ [verified list page]. Examples seen: multi-night Apple Watch heart rate and accelerometry with EEG sleep-stage labels, and multimodal physiological signals (EDA, HR, PPG).

## 6. Suggested plan (from the researcher)

1. Pull the OSD-569 `CBC_TRANSFORMED.csv` (about 20 minutes). Use the `value` and `range_min`/`range_max` columns to build color coding and trend charts.
2. Read the ISA metadata zip to map samples to subjects and timepoints (pre, in and post flight).
3. Choose the user-entered indicators from the Standard Measures list (sleep, mood/PANAS, cognition, biochemistry) and justify them with the HRP risk pages.
4. For indicators with no open NASA data (blood pressure, heart rate, glucose), use the challenge text's own example indicators and label the demo values synthetic.
5. Cite OSD IDs and page URLs in the submission.

## 7. Open questions for the organizers

- Does "must use NASA data" accept NASA-published ranges and pooled data, or must the app ingest an actual NASA dataset? (OSD-569 CBC satisfies the strict reading.)
- Are synthetic demo values acceptable where no open NASA data exists? The paste was cut off here.
