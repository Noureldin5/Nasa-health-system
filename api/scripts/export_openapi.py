"""Write api/openapi.json (the A <-> B contract). Run: uv run python scripts/export_openapi.py"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app import create_app

out = ROOT / "openapi.json"
out.write_text(json.dumps(create_app().openapi(), indent=2, sort_keys=True) + "\n")
print(f"wrote {out}")
