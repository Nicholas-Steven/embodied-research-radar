#!/usr/bin/env python3
"""CLI entry point used by local runs and GitHub Actions."""

from radar.pipeline import main


if __name__ == "__main__":
    raise SystemExit(main())
