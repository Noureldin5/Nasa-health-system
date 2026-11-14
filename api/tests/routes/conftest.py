from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import create_app
from clock import Clock
from settings import Settings

TODAY_9AM = datetime(2026, 11, 14, 9, 0)


@pytest.fixture
def clock():
    c = Clock()
    c.set(TODAY_9AM)
    return c


@pytest.fixture
def client(clock, tmp_path: Path):
    settings = Settings(sqlite_path=":memory:", seed_day=10, osd569_path=tmp_path / "none.json")
    return TestClient(create_app(settings, clock=clock))


@pytest.fixture
def state(client):
    return client.app.state.services
