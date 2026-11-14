"""SQLite connection and schema setup."""

from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA = Path(__file__).with_name("schema.sql")

# Simulated crew (labeled simulated in the UI). Module is the cabin module for CO2 lookups.
SEED_CREW = [
    ("a1", "Astronaut A (simulated)", "node1"),
    ("a2", "Astronaut B (simulated)", "node1"),
    ("a3", "Astronaut C (simulated)", "lab"),
]


def connect(path: str) -> sqlite3.Connection:
    """Open the database, create tables and seed the simulated crew. `":memory:"` in tests."""
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON")
    if path != ":memory:":
        conn.execute("PRAGMA journal_mode = WAL")
    conn.executescript(SCHEMA.read_text())
    conn.executemany("INSERT OR IGNORE INTO crew (id, name, module) VALUES (?, ?, ?)", SEED_CREW)
    conn.commit()
    return conn
