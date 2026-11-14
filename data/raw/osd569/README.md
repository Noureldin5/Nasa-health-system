# OSD-569 raw files (NASA data, source="nasa")

Raw files from NASA OSDR, **never edited**. Processing is a script that reads them (C4, `pipeline/osd569/`, not written yet).

| | |
|---|---|
| Dataset | OSD-569, "Whole Blood Measurements from the SpaceX Inspiration4 Mission (RNA-seq, epitranscriptome, WGS, clonal hematopoiesis, CBC)" |
| Page | https://osdr.nasa.gov/bio/repo/data/studies/OSD-569 |
| DOI | 10.26030/e0rx-sh52 |
| Public release | 14-May-2024 (from the ISA investigation file) |
| Mission | SpaceX Inspiration4, 2021-09-16 to 2021-09-18 |
| Accessed | 2026-11-14 |
| File list API | `https://osdr.nasa.gov/osdr/data/osd/files/569` |
| Download | `https://osdr.nasa.gov/geode-py/ws/studies/OSD-569/download?source=datamanager&file=<file name>` (follow redirects) |

Files (checksums in `SHA256SUMS`):

| File | What |
|---|---|
| `LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv` | Long format, one row per analyte: value, range min, range max, units, subject, sex, test date. **Use this one for units** |
| `LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv` | Wide format, one row per sample, 20 indicators with value, range min, range max |
| `OSD-569_metadata_OSD-569-ISA.zip` | ISA metadata: samples, timepoints, pre-flight or post-flight |

What was checked on 2026-11-14:

- 4 subjects (C001 to C004, public de-identified IDs), 7 blood draws each: L-92, L-44, L-3 (days before launch) and R+1, R+45, R+82, R+194 (days after return). **No in-flight samples.**
- 20 indicators. 553 values in the submitted file; 7 samples have 19 instead of 20 (MCHC is missing).
- Values agree between the two CSV files.
- The transformed file labels hemoglobin as "percent". The submitted file says g/dL, which is the correct unit.
- In the submitted file, sample C003 R+1 names three analytes with a "(FEMALE)" suffix, and the printed reference range for female subjects is not the same on every row. Keep the range printed on each row; do not pick one.

Open: the OSDR license and data-use terms have not been read yet (`docs/HANDOFF.md`, open item 5). Read them before submission.

In the app these values are labeled "Inspiration4 crew sample, not your labs".
