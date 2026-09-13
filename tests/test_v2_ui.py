"""Workspace UI render tests: run the node-based render harness that executes
the real workspace.js with DOM stubs. Covers the Experiment Builder regression
(blank page root cause: missing import) and the empty-data Empty State."""

import os
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "tests" / "ws_render_harness.mjs"


@unittest.skipIf(shutil.which("node") is None, "node is not installed")
class TestWorkspaceRender(unittest.TestCase):
    def test_experiment_builder_renders(self):
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
            f"workspace render harness failed:\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}",
        )
        self.assertIn("ALL WORKSPACE RENDER TESTS PASSED", result.stdout)


if __name__ == "__main__":
    unittest.main()
