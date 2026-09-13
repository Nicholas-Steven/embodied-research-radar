"""V2 logic tests: run the node-based harness for collision scoring and risk
mapping (the logic lives in web/assets/v2/workspace.js). Skips with a notice
if node is unavailable."""

import os
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "tests" / "v2_logic_harness.mjs"


@unittest.skipIf(shutil.which("node") is None, "node is not installed")
class TestV2CollisionLogic(unittest.TestCase):
    def test_collision_score_and_risk_mapping(self):
        result = subprocess.run(
            ["node", str(HARNESS)],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=str(ROOT),
            env={**os.environ},
        )
        self.assertEqual(
            result.returncode,
            0,
            f"v2 logic harness failed:\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}",
        )
        self.assertIn("ALL V2 LOGIC TESTS PASSED", result.stdout)


if __name__ == "__main__":
    unittest.main()
