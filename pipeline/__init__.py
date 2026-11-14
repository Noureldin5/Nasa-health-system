"""Data pipeline for Own Your Baseline (role C).

Import with the repo root on PYTHONPATH:

    from pipeline.ingest import Point, write_points, flush
    from pipeline.queries import Sample, series, latest
    from pipeline.mission import mission_day, mission_start

The contract is in docs/DECISIONS.md. Runtime code uses the standard library only.
"""
