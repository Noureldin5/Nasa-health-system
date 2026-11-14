"""Shared fixtures. Tests marked `vm` talk to a real VictoriaMetrics.

They write only series with a throwaway crew_id or module, and delete them afterwards,
so a mission loaded for development is left alone.
"""

from __future__ import annotations

import os
import uuid

import pytest

from pipeline import vm


def _reachable() -> bool:
    try:
        vm.request("/health")
        return True
    except (vm.VMUnavailable, vm.VMError):
        return False


def pytest_collection_modifyitems(config, items):
    if not any("vm" in item.keywords for item in items) or _reachable():
        return
    if os.environ.get("PIPELINE_REQUIRE_VM") == "1":
        raise pytest.UsageError(f"PIPELINE_REQUIRE_VM=1 but VictoriaMetrics is not reachable at {vm.resolve_url()}")
    skip = pytest.mark.skip(reason=f"VictoriaMetrics not reachable at {vm.resolve_url()} (docker compose up -d)")
    for item in items:
        if "vm" in item.keywords:
            item.add_marker(skip)


@pytest.fixture
def test_id():
    """A unique crew_id / module for one test. Its series are deleted afterwards."""
    value = "test-" + uuid.uuid4().hex[:10]
    yield value
    for label in ("crew_id", "module"):
        vm.delete_series('{%s="%s"}' % (label, value))
    vm.reset_cache()
