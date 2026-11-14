// GENERATED from NASA OSDR OSD-569 (do not edit by hand).
// Source: https://osdr.nasa.gov/bio/repo/data/studies/OSD-569
// File: LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv, downloaded 2026-11-14 via
// https://osdr.nasa.gov/osdr/data/osd/files/569 (open data, no login).
// Values are copied exactly as published, including C003 L-92, which looks unusual.
// REAL NASA DATA, bundled with the app (works offline). The API is meant to serve
// GET /reference/osd569 from data/processed/osd569.json (role C, task C4); until it does, both mock and http mode use this file.
import type { Osd569Reference } from "../api/types";

export const OSD569: Osd569Reference = {
  "datasetId": "OSD-569",
  "title": "SpaceX Inspiration4 complete blood count (CBC)",
  "url": "https://osdr.nasa.gov/bio/repo/data/studies/OSD-569",
  "file": "LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv",
  "accessed": "2026-11-14",
  "timepoints": [
    "L-92",
    "L-44",
    "L-3",
    "R+1",
    "R+45",
    "R+82",
    "R+194"
  ],
  "indicators": [
    {
      "key": "wbc",
      "label": "White blood cells",
      "unit": "10\u00b3/\u00b5L",
      "sourceColumn": "white_blood_cell_count_value_thousand_per_microliter",
      "earthRange": {
        "min": 3.8,
        "max": 10.8
      },
      "samples": [
        {
          "crew": "C001",
          "timepoint": "L-92",
          "value": 5.4
        },
        {
          "crew": "C001",
          "timepoint": "L-44",
          "value": 5.5
        },
        {
          "crew": "C001",
          "timepoint": "L-3",
          "value": 7.0
        },
        {
          "crew": "C001",
          "timepoint": "R+1",
          "value": 5.0
        },
        {
          "crew": "C001",
          "timepoint": "R+45",
          "value": 4.9
        },
        {
          "crew": "C001",
          "timepoint": "R+82",
          "value": 4.9
        },
        {
          "crew": "C001",
          "timepoint": "R+194",
          "value": 4.9
        },
        {
          "crew": "C002",
          "timepoint": "L-92",
          "value": 6.5
        },
        {
          "crew": "C002",
          "timepoint": "L-44",
          "value": 5.4
        },
        {
          "crew": "C002",
          "timepoint": "L-3",
          "value": 7.2
        },
        {
          "crew": "C002",
          "timepoint": "R+1",
          "value": 5.5
        },
        {
          "crew": "C002",
          "timepoint": "R+45",
          "value": 6.4
        },
        {
          "crew": "C002",
          "timepoint": "R+82",
          "value": 5.3
        },
        {
          "crew": "C002",
          "timepoint": "R+194",
          "value": 6.4
        },
        {
          "crew": "C003",
          "timepoint": "L-92",
          "value": 9.6
        },
        {
          "crew": "C003",
          "timepoint": "L-44",
          "value": 9.3
        },
        {
          "crew": "C003",
          "timepoint": "L-3",
          "value": 9.8
        },
        {
          "crew": "C003",
          "timepoint": "R+1",
          "value": 7.0
        },
        {
          "crew": "C003",
          "timepoint": "R+45",
          "value": 7.8
        },
        {
          "crew": "C003",
          "timepoint": "R+82",
          "value": 8.8
        },
        {
          "crew": "C003",
          "timepoint": "R+194",
          "value": 7.4
        },
        {
          "crew": "C004",
          "timepoint": "L-92",
          "value": 7.7
        },
        {
          "crew": "C004",
          "timepoint": "L-44",
          "value": 6.4
        },
        {
          "crew": "C004",
          "timepoint": "L-3",
          "value": 10.6
        },
        {
          "crew": "C004",
          "timepoint": "R+1",
          "value": 8.1
        },
        {
          "crew": "C004",
          "timepoint": "R+45",
          "value": 6.8
        },
        {
          "crew": "C004",
          "timepoint": "R+82",
          "value": 7.9
        },
        {
          "crew": "C004",
          "timepoint": "R+194",
          "value": 8.3
        }
      ]
    },
    {
      "key": "lymph",
      "label": "Lymphocytes (absolute)",
      "unit": "cells/\u00b5L",
      "sourceColumn": "absolute_lymphocytes_value_cells_per_microliter",
      "earthRange": {
        "min": 850.0,
        "max": 3900.0
      },
      "samples": [
        {
          "crew": "C001",
          "timepoint": "L-92",
          "value": 2241.0
        },
        {
          "crew": "C001",
          "timepoint": "L-44",
          "value": 1859.0
        },
        {
          "crew": "C001",
          "timepoint": "L-3",
          "value": 2667.0
        },
        {
          "crew": "C001",
          "timepoint": "R+1",
          "value": 1640.0
        },
        {
          "crew": "C001",
          "timepoint": "R+45",
          "value": 2146.0
        },
        {
          "crew": "C001",
          "timepoint": "R+82",
          "value": 2171.0
        },
        {
          "crew": "C001",
          "timepoint": "R+194",
          "value": 1847.0
        },
        {
          "crew": "C002",
          "timepoint": "L-92",
          "value": 2119.0
        },
        {
          "crew": "C002",
          "timepoint": "L-44",
          "value": 1982.0
        },
        {
          "crew": "C002",
          "timepoint": "L-3",
          "value": 2873.0
        },
        {
          "crew": "C002",
          "timepoint": "R+1",
          "value": 1540.0
        },
        {
          "crew": "C002",
          "timepoint": "R+45",
          "value": 2874.0
        },
        {
          "crew": "C002",
          "timepoint": "R+82",
          "value": 1701.0
        },
        {
          "crew": "C002",
          "timepoint": "R+194",
          "value": 2573.0
        },
        {
          "crew": "C003",
          "timepoint": "L-92",
          "value": 6826.0
        },
        {
          "crew": "C003",
          "timepoint": "L-44",
          "value": 2083.0
        },
        {
          "crew": "C003",
          "timepoint": "L-3",
          "value": 3156.0
        },
        {
          "crew": "C003",
          "timepoint": "R+1",
          "value": 2086.0
        },
        {
          "crew": "C003",
          "timepoint": "R+45",
          "value": 2379.0
        },
        {
          "crew": "C003",
          "timepoint": "R+82",
          "value": 3247.0
        },
        {
          "crew": "C003",
          "timepoint": "R+194",
          "value": 2220.0
        },
        {
          "crew": "C004",
          "timepoint": "L-92",
          "value": 1786.0
        },
        {
          "crew": "C004",
          "timepoint": "L-44",
          "value": 1613.0
        },
        {
          "crew": "C004",
          "timepoint": "L-3",
          "value": 2947.0
        },
        {
          "crew": "C004",
          "timepoint": "R+1",
          "value": 2155.0
        },
        {
          "crew": "C004",
          "timepoint": "R+45",
          "value": 1938.0
        },
        {
          "crew": "C004",
          "timepoint": "R+82",
          "value": 2307.0
        },
        {
          "crew": "C004",
          "timepoint": "R+194",
          "value": 2639.0
        }
      ]
    }
  ]
};
