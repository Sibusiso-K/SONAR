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

It does NOT touch `watchlist` — that is app-owned (stars a person clicks
on the site), not board content this pipeline governs.

It DOES now own two things in `updates`: it deletes Lovable's fabricated
seed rows, and it mirrors data/updates.json (the real, human-written
audit trail) into the table. Anything a person appends through the app
itself is left alone.

An earlier version of this file claimed dangling placeholder rows were
"harmless — they just don't join to anything and stop rendering". That
was wrong, and a screenshot of the live site disproved it: the Updates
page reads summary/detail directly and renders them regardless of
whether opportunity_id resolves. The result was invented events
(Takealot Engineering Hack, Sasol Solve, ARC Prize) and invented
specifics on real ones, all presented with the same authority as
verified entries — the exact failure mode this project exists to
prevent, sitting on the page that is supposed to prove it doesn't
happen.

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
import uuid
from datetime import date, datetime, timezone

# Status/error text may use non-ASCII punctuation. On Windows, stdout defaults
# to the console codepage (cp1252), which can't encode some of it and crashes
# with UnicodeEncodeError. Force UTF-8 so this works on every platform.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OPPS = os.path.join(ROOT, "data", "opportunities.json")
UPDATES = os.path.join(ROOT, "data", "updates.json")

# Deterministic namespace so the same JSON entry always maps to the same row id,
# making `push` idempotent instead of duplicating the audit trail on every run.
NS = uuid.UUID("6ba7b811-9dad-11d1-80b4-00c04fd430c8")

# Lovable seeded 10 fabricated rows into `updates` when it generated the app.
# They are not harmless: the Updates page renders them verbatim, so the audit
# trail carries invented events (Takealot Engineering Hack, Sasol Solve, ARC
# Prize — none of which have ever been on this board) alongside invented
# specifics on real ones ("deadline 2026-10-14 read directly from the official
# brief PDF" when it is 2026-09-07; "team of 4" when it is 2).
#
# Identified by opportunity_id: every one of these slugs is a Lovable
# invention that differs from our real ids (bcg-platinion-2026,
# ibm-z-datathon-2026, mintek-sci-2026, entelect-university-cup-2027...), so
# deleting on them cannot touch real data or anything a human later appends
# through the app.
PLACEHOLDER_UPDATE_IDS = [
    "gradhack-2026",
    "bcg-platinion",
    "ibm-z-datathon",
    "entelect-university-cup",
    "mintek-innovation",
    "takealot-hack",
    "sasol-solve",
    "discovery-gradhack",
    "kaggle-arc-prize",
]

# data/updates.json kinds -> the radar app's change_kind vocabulary.
# "verified" -> "confidence" matters beyond cosmetics: /stats' confidenceTrend()
# measures its promotion window by counting change_kind == "confidence" rows.
CHANGE_KIND = {
    "added": "discovery",
    "changed": "status",
    "verified": "confidence",
    "missed": "stale",
    "system": "note",
}

HUMANS = {"Sibusiso K", "Lethabo"}

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
            "  Store the key in GitHub Secrets, never in the repo.\n"
            "\n"
            "  The service_role key is what you want: it syncs everything,\n"
            "  including purging Lovable's fabricated `updates` rows.\n"
            "  The publishable/anon key also works for the board itself\n"
            "  (opportunities and past_opportunities grant anon full CRUD -\n"
            "  see web/supabase/migrations/20260812_lock_down_anon_writes.sql,\n"
            "  which is there to take that away). With anon, everything syncs\n"
            "  except the purge, which is skipped rather than fatal."
        )


def rest(method, path, body=None, params=None, prefer=None, fatal=True):
    """fatal=False raises PermissionError on 401/403 instead of exiting, so a
    caller can carry on when one operation is denied by RLS but the rest of
    the sync is still worth doing."""
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
        if not fatal and e.code in (401, 403):
            raise PermissionError(f"{method} {path} -> {e.code}: {detail[:200]}")
        sys.exit(f"Supabase {method} {path} -> {e.code}\n{detail}")


def upsert(table, rows, on_conflict):
    if not rows:
        return []
    return rest(
        "POST", table, body=rows,
        params={"on_conflict": on_conflict},
        prefer="resolution=merge-duplicates,return=representation",
    )


def append_only(table, rows, on_conflict="id"):
    """Insert rows, leaving any that already exist untouched.

    `updates` is an append-only audit trail by design: the schema migration
    grants anon SELECT + INSERT and gives it a SELECT policy and an INSERT
    policy, deliberately with no UPDATE policy (verified against pg_policies:
    the table has exactly INSERT and SELECT for anon/authenticated).

    upsert() sends `Prefer: resolution=merge-duplicates`, which PostgREST
    turns into INSERT ... ON CONFLICT DO UPDATE. Postgres then evaluates the
    UPDATE path's RLS, finds no policy for it, and rejects the entire batch:

        new row violates row-level security policy (USING expression)

    The word USING there is the giveaway - a plain INSERT is only ever
    checked against WITH CHECK, so a USING failure means something asked for
    an UPDATE. That is why the board tables sync fine (they have FOR ALL
    policies and full CRUD grants) while this one has been failing every run.

    `resolution=ignore-duplicates` is ON CONFLICT DO NOTHING, which performs
    no update and so needs nothing beyond the INSERT policy. It also happens
    to be the correct semantics: entries already on the trail are history and
    should not be rewritten by a resync.

    The other way to silence this would have been to grant anon UPDATE on the
    trail. That would be the wrong fix - an audit trail the public key can
    rewrite is worth less than one with a gap in it, and this project exists
    to stop exactly that class of problem.
    """
    if not rows:
        return 0
    written = rest(
        "POST", table, body=rows,
        params={"on_conflict": on_conflict},
        prefer="resolution=ignore-duplicates,return=representation",
    )
    return len(written or [])


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
        # Real per-entry facts, not a fixed string: `source` is how each
        # opportunity was actually found (manual research for the initial
        # board; the discovering org/feed name once the watch_sources.py
        # pipeline promotes something). `went_live_on`/`noticed_on` feed
        # /stats' discoveryLag() - null went_live_on is honest for entries
        # with no announcement-date evidence, not a placeholder to paper over.
        "source": o.get("source") or "manual research",
        "went_live_on": o.get("went_live_on"),
        "noticed_on": o.get("noticed_on"),
        # The team's own participation state (registered/selected/submitted/
        # dropped/...), distinct from confidence. web/src/lib/participation.ts
        # collapses anything not in its map to "still to submit".
        "status": o.get("status"),
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
        # Neither missed nor placed just means the entry has no engagement
        # signal at all — most of dropped_or_past is "this event existed,
        # diarise for next year" monitoring notes we never actually entered.
        # Defaulting that to "entered" was fabricating a participation
        # record; the honest move is to not sync it as a past entry at all.
        return None

    return {
        "id": pid,
        "name": p["name"],
        "organiser": p.get("organiser") or "Unknown",
        "kind": p.get("kind") or "hackathon",
        "happened_on": p.get("happened_on"),
        "outcome": outcome,
        "placement": p.get("result"),
        "note": p.get("summary") or reason,
        "corrected": corrected,
        "correction_note": reason if corrected else None,
    }


def to_radar_update(u):
    """data/updates.json entry -> a row in the radar app's `updates` table.

    The id is a uuid5 of the entry's own content, so re-running `push` updates
    the same row instead of appending a duplicate every time.
    """
    at = u.get("at") or ""
    target = u.get("target")
    title = u.get("title") or ""
    by = u.get("by") or "verification pipeline"

    return {
        "id": str(uuid.uuid5(NS, f"{at}|{target}|{title}")),
        "opportunity_id": target,
        "actor": by,
        "actor_kind": "human" if by in HUMANS else "automated",
        "change_kind": CHANGE_KIND.get(u.get("kind"), "note"),
        "summary": title,
        "detail": u.get("body"),
        "created_at": at,
    }


def build_rows():
    with open(OPPS, encoding="utf-8") as fh:
        board = json.load(fh)

    opp_rows = [to_radar_opportunity(o) for o in board["opportunities"]]

    used_ids = set()
    past_rows = [
        row
        for p in board.get("past", [])
        if (row := to_radar_past(p, used_ids)) is not None
    ]

    with open(UPDATES, encoding="utf-8") as fh:
        update_rows = [to_radar_update(u) for u in json.load(fh).get("updates", [])]

    return opp_rows, past_rows, update_rows


# --------------------------------------------------------------------------- #
# commands
# --------------------------------------------------------------------------- #

def purge_placeholder_updates():
    """Delete Lovable's fabricated seed rows from `updates`. See
    PLACEHOLDER_UPDATE_IDS for why matching on these ids is safe.

    Non-fatal by design. `updates` grants anon SELECT+INSERT but not DELETE,
    so running this with the publishable key fails while every other part of
    the sync succeeds. Aborting there would mean an anon-key run delivers
    nothing at all - worse than delivering the board and leaving the
    fabricated rows for a service_role run to clear.
    """
    id_list = ",".join(f'"{i}"' for i in PLACEHOLDER_UPDATE_IDS)
    try:
        rest("DELETE", "updates", params={"opportunity_id": f"in.({id_list})"},
             fatal=False)
        return True
    except PermissionError as e:
        print(f"  purge skipped: {e}")
        print("  (needs the service_role key - anon has no DELETE on updates. "
              "Board data below still syncs.)")
        return False


def cmd_check(_args):
    opp_rows, past_rows, update_rows = build_rows()
    print(f"would sync {len(opp_rows)} opportunities, {len(past_rows)} past entries, "
          f"{len(update_rows)} audit-trail entries")
    print(f"would purge update rows for {len(PLACEHOLDER_UPDATE_IDS)} placeholder ids: "
          f"{', '.join(PLACEHOLDER_UPDATE_IDS)}")
    for r in opp_rows[:5]:
        print(f"  {r['id']:<32} score {r['score']:>5} tier {r['tier']} {r['confidence']}")
    if len(opp_rows) > 5:
        print(f"  ... and {len(opp_rows) - 5} more")
    print()
    for r in update_rows[:5]:
        print(f"  {r['created_at'][:10]}  {r['change_kind']:<11} {r['actor']:<20} {r['summary'][:52]}")


def cmd_push(_args):
    opp_rows, past_rows, update_rows = build_rows()

    upsert("opportunities", opp_rows, on_conflict="id")
    delete_not_in("opportunities", [r["id"] for r in opp_rows])
    print(f"synced {len(opp_rows)} opportunities")

    upsert("past_opportunities", past_rows, on_conflict="id")
    delete_not_in("past_opportunities", [r["id"] for r in past_rows])
    print(f"synced {len(past_rows)} past entries")

    # Order matters: purge the fabrications first, then write the real trail.
    purged = purge_placeholder_updates()
    added = append_only("updates", update_rows)
    print(
        f"{'purged placeholder updates, ' if purged else ''}"
        f"synced {len(update_rows)} real audit entries ({added} new, "
        f"{len(update_rows) - added} already on the trail)"
        f"{'' if purged else ' (fabricated seed rows still present)'}"
    )

    # One sync row per day, not per run: uuid5 on the date means the first
    # sync of the day writes the row and later ones are no-ops, instead of
    # burying the real entries under a daily "Board resynced" drumbeat. The
    # counts below are therefore the first sync of the day's, which is the
    # right trade for an append-only trail - see append_only().
    today = date.today().isoformat()
    append_only(
        "updates",
        [{
            "id": str(uuid.uuid5(NS, f"sync|{today}")),
            "actor": "sync_radar.py",
            "actor_kind": "automated",
            "change_kind": "sync",
            "summary": "Board resynced from data/opportunities.json",
            "detail": f"{len(opp_rows)} opportunities, {len(past_rows)} past entries, "
                      f"{len(update_rows)} audit entries. "
                      f"Replaces anything not present in the repo's source of truth.",
        }],
        on_conflict="id",
    )


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("push", "check"):
        sys.exit(__doc__)
    {"push": cmd_push, "check": cmd_check}[sys.argv[1]](sys.argv[2:])


if __name__ == "__main__":
    main()
