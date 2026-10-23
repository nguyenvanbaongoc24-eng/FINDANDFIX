import json
import sqlite3
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "data" / "dev" / "repair_data.sqlite"
CATALOG = ROOT / "mvp" / "data" / "open-data-catalog.json"


class PipelineTests(unittest.TestCase):
    def test_generated_catalog_has_required_lookups(self):
        if not CATALOG.exists():
            self.skipTest("Run the data pipeline first")
        catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
        self.assertTrue(any(row["code"] == "P0420" for row in catalog["dtc_codes"]))
        self.assertGreater(catalog["stats"]["recalls"], 0)
        self.assertGreater(catalog["stats"]["parts"], 0)

    def test_idempotent_counts_after_offline_rerun(self):
        if not DB.exists():
            self.skipTest("Run the data pipeline first")
        before = sqlite3.connect(DB).execute("select count(*) from dtc_codes").fetchone()[0]
        result = subprocess.run([sys.executable, "scripts/data/pipeline.py", "--offline"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        after = sqlite3.connect(DB).execute("select count(*) from dtc_codes").fetchone()[0]
        self.assertEqual(before, after)
