# OSD-569 raw files (NASA data, source="nasa")

Raw files from NASA OSDR, **never edited**. Processing is a script that reads them: `python3 -m pipeline.osd569` writes `data/processed/osd569.json`. `source.json` is the machine-readable provenance the script reads.

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
- 20 indicators. 553 values in the submitted file. 7 values are absent and are not filled in: MCHC in 4 samples, MCH in 2, MCV in 1.
- Values agree between the two CSV files.
- The transformed file labels hemoglobin as "percent". The submitted file says g/dL, which is the correct unit.
- In the submitted file, sample C003 R+1 names three analytes with a "(FEMALE)" suffix, and the printed reference range for female subjects is not the same on every row. Keep the range printed on each row; do not pick one.

## Terms of use (read 2026-11-14)

Source: OSDR terms and conditions, https://science.nasa.gov/reference/osdr-help-terms-and-conditions (read on 2026-11-14).

- **Access:** the site is public: "anyone may view or download public content". OSD-569 is public, so no data use agreement applies to it.
- **License:** the page names no license. It says the data "are provided under NASA's open access policy" and distributed under NASA's Science Information Policy. We do not claim a license (such as CC0) for OSDR data. Our wording is "NASA open access policy, per OSDR terms".
- **Citation:** use the dataset citation from the "Citation" panel of the OSD-569 page (BibTeX or RIS export). The app and `data/processed/osd569.json` carry the citation with the DOI `10.26030/e0rx-sh52`.
- **Acknowledgement:** the page asks for a general acknowledgement before the reference list. For OSDR data we use: "Data are courtesy of the NASA Open Science Data Repository." The example on the page is worded for GeneLab; the OSDR FAQ gives the OSDR form (search result, not read on the page itself: verify before submission). Put it in the pitch deck and the app footer.
- **No warranty:** the U.S. Government "does not warrant or assume any legal liability or responsibility for the accuracy, completeness, or usefulness" of the information. This matches our decision-support framing.
- **Not read:** the full terms text beyond what is summarized above. Questions about citing: the contact on the terms page.

In the app these values are labeled "Inspiration4 crew sample, not your labs".
