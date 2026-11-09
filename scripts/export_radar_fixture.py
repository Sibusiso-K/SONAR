#!/usr/bin/env python3
"""Write the rows sync_radar.py would push, as JSON, for the end-to-end tests.

The frontend tests serve this instead of a live database. Because it is built
by the same `build_rows()` that feeds production, the tests exercise the real
contract between the data pipeline and the site: if a change to the pipeline
breaks what the site expects, the e2e suite fails here rather than in prod.

    python3 scripts/export_radar_fixture.py web/e2e/.generated/board.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import sync_radar  # noqa: E402


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    opportunities, past, updates = sync_radar.build_rows()
    out = Path(argv[1])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(
            {"opportunities": opportunities, "past_opportunities": past, "updates": updates},
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"wrote {out}: {len(opportunities)} opportunities, {len(past)} past, {len(updates)} updates")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
