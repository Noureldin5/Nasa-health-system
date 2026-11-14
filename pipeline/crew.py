"""Demo crew and where each person lives. All of this is a Demo parameter.

Cabin Link compares a person's symptoms with the CO2 of their own module, so it needs
to know the module. It is configuration, not a label on the series (docs/DECISIONS.md).
"""

from __future__ import annotations

CREW = ("a1", "a2", "a3")
MODULES = ("node1", "lab")

# Demo parameter. a1 and a2 share the module where CO2 rises in the story; a3 does not.
MODULE_OF = {"a1": "node1", "a2": "node1", "a3": "lab"}
DEFAULT_MODULE = "node1"


def module_of(crew_id: str) -> str:
    return MODULE_OF.get(crew_id, DEFAULT_MODULE)
