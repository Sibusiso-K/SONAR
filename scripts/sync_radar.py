#!/usr/bin/env python3
"""
data/opportunities.json -> the sonar-radar app's live Supabase project.

sonar-radar (web/) is a Lovable rebuild with its own Supabase project,
schema web/supabase/migrations/20260811105003_*.sql. It was seeded with
Lovable-generated placeholder opportunities (fabricated events, prize
pools and dates) and never wired to the repo's real, source-verified
board. This script closes that gap: it makes `opportunities` and
`past_opportunities` in that Supabase project match data/opportunities.json
exactly — insert/update what belongs, delete what doesn't (i.e. the
placeholder seed rows).

It deliberately does NOT touch `updates` or `watchlist` — those are
live, app-owned tables (audit trail entries and stars the app itself
writes when a person uses the site), not board content the JSON pipeline
governs. The one exception: watchlist/updates rows left dangling because
their opportunity_id no longer exists (e.g. the old placeholder ids) are
harmless — they just don't join to anything and stop rendering.

    export RADAR_SUPABASE_URL=https://xxxx.supabase.co
    export RADAR_SUPABASE_SERVICE_KEY=eyJ...   # service role. NEVER in the browser.

    python3 scripts/sync_radar.py push   # data/opportunities.json -> Supabase
    python3 scripts/sync_radar.py check  # what would change, no writes
"""

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone

# Status/error text may use non-ASCII punctuation. On Windows, stdout defaults
# to the console codepage (cp1252), which can't encode some of it and crashes
# with UnicodeEncodeError. Force UTF-8 so this works on every platform.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OPPS = os.path.join(ROOT, "data", "opportunities.json")

URL = os.environ.get("RADAR_SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("RADAR_SUPABASE_SERVICE_KEY", "")


# --------------------------------------------------------------------------- #
# PostgREST client (same shape as scripts/sonar_db.py, different project)
# --------------------------------------------------------------------------- #

def _require_creds():
    if not URL or not KEY:
        sys.exit(
            "RADAR_SUPABASE_URL and RADAR_SUPABASE_SERVICE_KEY must be set.\n"
            "  sonar-radar's Supabase dashboard -> Project Settings -> API\n"
            "  Store the service key in GitHub Secrets, never in the repo."
        )


def rest(method, path, body=None, params=None, prefer=None):
    _require_creds()
    url = f"{URL}/rest/v1/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params, safe="*.,()")

    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {KEY}")
    req.add_header("Content-Type", "application/json")
    if prefer:
        req.add_header("Prefer", prefer)

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw.strip() else []
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:600]
        sys.exit(f"Supabase {method} {path} -> {e.code}\n{detail}")


def upsert(table, rows, on_conflict):
    if not rows:
        return []
    return rest(
        "POST", table, body=rows,
        params={"on_conflict": on_conflict},
        prefer="resolution=merge-duplicates,return=representation",
    )


def delete_not_in(table, ids):
    """Remove every row whose id isn't in `ids`. Empty `ids` deletes nothing
    (a truncated source list is far more likely to be a bug than intent)."""
    if not ids:
        return
    id_list = ",".join(f'"{i}"' for i in ids)
    rest("DELETE", table, params={"id": f"not.in.({id_list})"})


# --------------------------------------------------------------------------- #
# data/opportunities.json -> radar schema
# --------------------------------------------------------------------------- #

def slugify(name):
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "untitled"


def to_radar_opportunity(o):
    scores = o.get("scores") or {}
    # Root scores 0-10; sonar-radar's WinRing/winProbability math assumes 0-100.
    scaled_scores = {k: round(v * 10) for k, v in scores.items() if isinstance(v, (int, float))}
    score = o.get("score")

    deliverables = o.get("deliverables")
    if isinstance(deliverables, list):
        deliverables = "\n".join(str(d) for d in deliverables)

    return {
        "id": o["id"],
        "name": o["name"],
        "organiser": o.get("organiser") or "Unknown",
        "kind": o.get("kind") or "hackathon",
        "format": o.get("format") or "online",
        "scope": o.get("scope") or "local",
        "tier": o.get("tier") or 3,
        "score": round(score * 10, 1) if isinstance(score, (int, float)) else 0,
        "scores": scaled_scores,
        "dates": o.get("dates") or {},
        "next_date": o.get("next_date"),
        "confidence": o.get("confidence") or "unconfirmed",
        "prize": o.get("prize") or {},
        "career_track": o.get("career_track") or "none",
        "eligibility": o.get("eligibility"),
        "what_to_build": o.get("what_to_build"),
        "deliverables": deliverables,
        "links": o.get("links") or {},
        "notes": o.get("notes"),
        "source": "SONAR data pipeline",
        "archived": o.get("status") in ("past", "dropped"),
    }


def to_radar_past(p, used_ids):
    base = slugify(p["name"])
    pid, n = base, 2
    while pid in used_ids:
        pid = f"{base}-{n}"
        n += 1
    used_ids.add(pid)

    reason = p.get("reason") or ""
    corrected = "correction" in reason.lower()

    if p.get("missed"):
        outcome = "missed"
    elif p.get("result"):
        outcome = "placed"
    else:
        outcome = "entered"

    return {
        "id": pid,
        "name": p["name"],
        "organiser": p.get("organiser") or "Unknown",
        "kind": p.get("kind") or "hackathon",
        "happened_on": None,
        "outcome": outcome,
        "placement": p.get("result"),
        "note": p.get("summary") or reason,
        "corrected": corrected,
        "correction_note": reason if corrected else None,
    }


def build_rows():
    with open(OPPS, encoding="utf-8") as fh:
        board = json.load(fh)

    opp_rows = [to_radar_opportunity(o) for o in board["opportunities"]]

    used_ids = set()
    past_rows = [to_radar_past(p, used_ids) for p in board.get("past", [])]

    return opp_rows, past_rows


# --------------------------------------------------------------------------- #
# commands
# --------------------------------------------------------------------------- #

def cmd_check(_args):
    opp_rows, past_rows = build_rows()
    print(f"would sync {len(opp_rows)} opportunities, {len(past_rows)} past entries")
    for r in opp_rows[:5]:
        print(f"  {r['id']:<32} score {r['score']:>5} tier {r['tier']} {r['confidence']}")
    if len(opp_rows) > 5:
        print(f"  ... and {len(opp_rows) - 5} more")


def cmd_push(_args):
    opp_rows, past_rows = build_rows()

    upsert("opportunities", opp_rows, on_conflict="id")
    delete_not_in("opportunities", [r["id"] for r in opp_rows])
    print(f"synced {len(opp_rows)} opportunities")

    upsert("past_opportunities", past_rows, on_conflict="id")
    delete_not_in("past_opportunities", [r["id"] for r in past_rows])
    print(f"synced {len(past_rows)} past entries")

    rest(
        "POST", "updates",
        body=[{
            "actor": "sync_radar.py",
            "actor_kind": "automated",
            "change_kind": "sync",
            "summary": "Board resynced from data/opportunities.json",
            "detail": f"{len(opp_rows)} opportunities, {len(past_rows)} past entries. "
                      f"Replaces anything not present in the repo's source of truth.",
        }],
        prefer="return=minimal",
    )


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("push", "check"):
        sys.exit(__doc__)
    {"push": cmd_push, "check": cmd_check}[sys.argv[1]](sys.argv[2:])


if __name__ == "__main__":
    main()
