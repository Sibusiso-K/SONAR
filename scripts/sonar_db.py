#!/usr/bin/env python3
"""
SONAR ↔ Supabase.

Stdlib only — PostgREST is just REST and JSON, and keeping this dependency-free
means CI installs nothing and cannot break on a transitive upgrade.

    export SUPABASE_URL=https://xxxx.supabase.co
    export SUPABASE_SERVICE_KEY=eyJ...        # service role. NEVER in the browser.

    python3 scripts/sonar_db.py seed-orgs   # load the Tier-B watchlist
    python3 scripts/sonar_db.py push        # repo JSON  -> Supabase
    python3 scripts/sonar_db.py forecast    # editions   -> predictions
    python3 scripts/sonar_db.py pull        # predictions-> repo JSON
    python3 scripts/sonar_db.py yield       # which sources are worth paying for
    python3 scripts/sonar_db.py health      # hallucination rate, run status

WHY A DATABASE AT ALL, when the repo already holds the board?

Because git can store history but cannot answer questions across it. The
question that matters — "what day of the year does this organiser usually
announce?" — is a GROUP BY over several years of observations. That query is
what turns the Discovery Gradhack miss into a watch that fires next August.

Supabase holds everything we have ever SEEN (append-only, machine-written).
The repo holds what we have VERIFIED (reviewed in a PR, drives the site).
Nothing reaches the published board without passing through a diff.
"""

import json
import os
import statistics
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone

# Status/error text uses non-ASCII punctuation (—, →, ↔). On Windows, stdout
# defaults to the console codepage (cp1252), which can't encode "→" and
# crashes with UnicodeEncodeError. Force UTF-8 so this works on every platform.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OPPS = os.path.join(ROOT, "data", "opportunities.json")
PREDICTIONS_OUT = os.path.join(ROOT, "data", "predictions.json")
EDITIONS = os.path.join(ROOT, "data", "editions.json")
CANDIDATES = os.path.join(ROOT, "data", "candidates.json")

URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY", "")


# --------------------------------------------------------------------------- #
# PostgREST client
# --------------------------------------------------------------------------- #

def _require_creds():
    if not URL or not KEY:
        sys.exit(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.\n"
            "  Supabase dashboard → Project Settings → API\n"
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
        sys.exit(f"Supabase {method} {path} → {e.code}\n{detail}")


def upsert(table, rows, on_conflict):
    """Idempotent by design — reruns converge instead of duplicating."""
    if not rows:
        return []
    return rest(
        "POST", table, body=rows,
        params={"on_conflict": on_conflict},
        prefer="resolution=merge-duplicates,return=representation",
    )


# --------------------------------------------------------------------------- #
# seed-orgs — the Tier-B watchlist
# --------------------------------------------------------------------------- #

# Watching organisations beats searching for events: keyword search only finds
# what is already indexed and popular, while an organisation's own news page
# carries the announcement on day one. These are real organisations that run
# graduate, innovation or hackathon programmes in South Africa. No dates are
# asserted here — the pipeline discovers those.
#
# `url` (careers/news/events page for scripts/watch_sources.py to fetch) is
# deliberately populated for only a handful of orgs so far. Bulk-guessing ~50
# organisation URLs and presenting them as fact would be exactly the kind of
# unverified claim this whole project exists to catch — add a real one only
# once you've actually opened the page and confirmed it's current.
WATCHLIST = [
    # slug, name, sector, url
    # URL sources: reused from the human-verified `links` already committed
    # in data/hackathons.json (zindi, fnb, geekulcha, revenuecat, mtn,
    # bcg-platinion, entelect, sita, mintek) rather than freshly guessed -
    # same anti-hallucination reasoning as the rest of this file, just
    # applied to which URLs we trust enough to seed. Preferred a durable
    # org page (news feed, developer portal, standing event site) over a
    # single dated microsite where both existed on the same entry - a
    # single-event page is the kind of link that already 404'd once (fnb).
    ("zindi", "Zindi", "platform", "https://zindi.world/competitions"),
    ("discovery",        "Discovery",                    "insurer"),
    ("fnb",              "FNB",                          "bank",     "https://appoftheyear.co.za/hackathon/"),
    ("absa",             "Absa",                         "bank"),
    ("standard-bank",    "Standard Bank",                "bank"),
    ("nedbank",          "Nedbank",                      "bank"),
    ("capitec",          "Capitec",                      "bank"),
    ("tymebank",         "TymeBank",                     "bank"),
    ("old-mutual",       "Old Mutual",                   "insurer"),
    ("sanlam",           "Sanlam",                       "insurer"),
    ("momentum",         "Momentum",                     "insurer"),
    ("mtn",              "MTN",                          "telco",    "https://momodeveloper.mtn.com/"),
    ("vodacom",          "Vodacom",                      "telco"),
    ("telkom",           "Telkom",                       "telco"),
    ("rain",             "Rain",                         "telco"),
    ("bcg-platinion",    "BCG Platinion",                "consultancy", "https://www.bcgplatinion.com/hackathon"),
    ("mckinsey",         "McKinsey & Company",           "consultancy"),
    ("deloitte",         "Deloitte",                     "consultancy"),
    ("ey",               "EY",                           "consultancy"),
    ("pwc",              "PwC",                          "consultancy"),
    ("accenture",        "Accenture",                    "consultancy"),
    ("entelect",         "Entelect",                     "software_house", "https://challenge.entelect.co.za/home"),
    ("bbd",              "BBD",                          "software_house"),
    ("dvt",              "DVT",                          "software_house"),
    ("synthesis",        "Synthesis",                    "software_house"),
    ("wits",             "University of the Witwatersrand", "university"),
    ("uct",              "University of Cape Town",      "university"),
    ("up",               "University of Pretoria",       "university"),
    ("uj",               "University of Johannesburg",   "university"),
    ("stellenbosch",     "Stellenbosch University",      "university"),
    ("ukzn",             "University of KwaZulu-Natal",  "university"),
    ("nwu",              "North-West University",        "university"),
    ("tut",              "Tshwane University of Technology", "university"),
    ("cput",             "Cape Peninsula University of Technology", "university"),
    ("uwc",              "University of the Western Cape", "university"),
    ("sol-plaatje",      "Sol Plaatje University",       "university"),
    ("sita",             "SITA",                         "state",    "https://www.govtech.gov.za/"),
    ("csir",             "CSIR",                         "research"),
    ("mintek",           "Mintek",                       "research", "https://mintek.co.za/media/news/"),
    ("sansa",            "SANSA",                        "research"),
    ("mict-seta",        "MICT SETA",                    "state"),
    ("innovation-hub",   "The Innovation Hub",           "state"),
    ("geekulcha",        "Geekulcha",                    "community", "https://www.geekulcha.dev/events"),
    ("girlcode",         "GirlCode",                     "community"),
    ("umuzi",            "Umuzi",                        "training"),
    ("wethinkcode",      "WeThinkCode_",                 "training"),
    ("explore-ai",       "ExploreAI",                    "training"),
    ("ibm",              "IBM",                          "lab"),
    ("google",           "Google",                       "lab"),
    ("anthropic",        "Anthropic",                    "lab"),
    ("nvidia",           "NVIDIA",                       "lab"),
    ("revenuecat",       "RevenueCat",                   "platform", "https://www.shipaton.com/"),
]


def cmd_seed_orgs(_args):
    rows = [
        {
            "slug": entry[0], "name": entry[1], "sector": entry[2],
            "country": "ZA", "active": True,
            "events_url": entry[3] if len(entry) > 3 else None,
        }
        for entry in WATCHLIST
    ]
    out = upsert("organisations", rows, on_conflict="slug")
    print(f"seeded {len(out)} organisations")
    by_sector = {}
    for entry in WATCHLIST:
        sec = entry[2]
        by_sector[sec] = by_sector.get(sec, 0) + 1
    for sec, n in sorted(by_sector.items(), key=lambda x: -x[1]):
        print(f"  {n:>3}  {sec}")


# --------------------------------------------------------------------------- #
# push — repo JSON -> Supabase
# --------------------------------------------------------------------------- #

def _clean(o):
    """Normalise a JSON record into a table row. This is the 'clean' step."""
    prize = o.get("prize") or {}
    pool = prize.get("pool")
    cur = prize.get("currency")

    return {
        "slug":            o["id"],
        "name":            (o.get("name") or "").strip(),
        "organiser":       (o.get("organiser") or "").strip(),
        "kind":            o.get("kind") or "hackathon",
        "scope":           o.get("scope"),
        "format":          o.get("format"),
        "location":        o.get("location"),
        "status":          o.get("status"),
        "lifecycle":       o.get("lifecycle"),
        "career_track":    o.get("career_track") or "none",
        "tier":            o.get("tier"),
        "score":           o.get("score"),
        "scores":          o.get("scores") or {},
        "next_date":       o.get("next_date"),
        "next_date_label": o.get("next_date_label"),
        "confidence":      o.get("confidence") or "unconfirmed",
        "prize_currency":  cur if isinstance(cur, str) and len(cur) == 3 else None,
        "prize_pool":      pool if isinstance(pool, (int, float)) else None,
        "prize":           prize,
        "dates":           o.get("dates") or {},
        "tracks":          o.get("tracks") or [],
        "challenges":      o.get("challenges") or [],
        "stages":          o.get("stages") or [],
        "links":           o.get("links") or {},
        "eligibility":     o.get("eligibility"),
        "what_to_build":   o.get("what_to_build"),
        "notes":           o.get("notes"),
        "last_checked_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def cmd_push(_args):
    board = json.load(open(OPPS, encoding="utf-8"))
    rows = [_clean(o) for o in board["opportunities"]]
    out = upsert("opportunities", rows, on_conflict="slug")
    print(f"pushed {len(out)} opportunities")

    # Past editions become history rows — this is what feeds the forecaster.
    editions = []
    for p in board.get("past", []):
        year = None
        for tok in p.get("reason", "").split():
            if tok.isdigit() and 2000 < int(tok) < 2100:
                year = int(tok)
                break
        if year:
            editions.append({
                "opportunity_slug": p["name"].lower().replace(" ", "-")[:60],
                "year": year,
                "source_url": p.get("link"),
                "we_entered": False,
                "our_placement": "missed" if p.get("missed") else "none",
            })
    if editions:
        upsert("editions", editions, on_conflict="opportunity_slug,year")
        print(f"pushed {len(editions)} historical editions")


# --------------------------------------------------------------------------- #
# forecast — the reason the database exists
# --------------------------------------------------------------------------- #

def _doy(d):
    return d.timetuple().tm_yday


def _circular_mean_doy(days):
    """
    Day-of-year is circular: 2 Jan and 30 Dec are four days apart, not 363.
    Naive averaging puts a December/January event in June. Most SA events
    don't wrap, but the one that does would produce a spectacularly wrong
    prediction, so do it properly.
    """
    import math
    angles = [2 * math.pi * d / 365.25 for d in days]
    x = sum(math.cos(a) for a in angles) / len(angles)
    y = sum(math.sin(a) for a in angles) / len(angles)
    mean_angle = math.atan2(y, x)
    if mean_angle < 0:
        mean_angle += 2 * math.pi
    mean_doy = mean_angle * 365.25 / (2 * math.pi)

    # circular spread -> an equivalent stddev in days
    r = math.sqrt(x * x + y * y)
    spread = math.sqrt(max(0.0, -2 * math.log(max(r, 1e-9)))) * 365.25 / (2 * math.pi)
    return mean_doy, spread


def _doy_to_date(doy, year):
    return date(year, 1, 1) + timedelta(days=int(round(doy)) - 1)


def forecast_from_editions(editions):
    """
    Predict the next edition's announcement and event window.

    Deliberately simple and explainable. With two or three data points, a
    seasonal mean plus spread is honest; anything fancier would be a model
    pretending to know more than the data supports — and the whole point of
    SONAR is not doing that.
    """
    preds = []
    by_slug = {}
    for e in editions:
        by_slug.setdefault(e["opportunity_slug"], []).append(e)

    today = date.today()

    for slug, rows in by_slug.items():
        rows = sorted(rows, key=lambda r: r["year"])
        if len(rows) < 2:
            continue  # one data point is an anecdote, not a season

        def collect(field):
            out = []
            for r in rows:
                v = r.get(field)
                if v:
                    try:
                        out.append(date.fromisoformat(v[:10]))
                    except ValueError:
                        pass
            return out

        def collect_event_dates():
            # Per-row fallback, not per-slug: some editions only ever have a
            # deadline on record (closes_on), others have the actual event
            # date. `collect("event_start") or collect("closes_on")` picked
            # one field for the whole slug, which silently dropped a real
            # edition's closes_on the moment any other row for that slug had
            # an event_start - undercounting editions that are genuinely
            # there, just recorded with different precision.
            out = []
            for r in rows:
                v = r.get("event_start") or r.get("closes_on")
                if v:
                    try:
                        out.append(date.fromisoformat(v[:10]))
                    except ValueError:
                        pass
            return out

        events = collect_event_dates()
        announces = collect("announced_on")
        if not events:
            continue

        next_year = max(r["year"] for r in rows) + 1
        if next_year < today.year:
            next_year = today.year

        ev_doys = [_doy(d) for d in events]
        ev_mean, ev_spread = _circular_mean_doy(ev_doys)
        window = max(ev_spread, 7.0)

        ev_start = _doy_to_date(ev_mean - window, next_year)
        ev_end = _doy_to_date(ev_mean + window, next_year)

        # Announcement: use observed lead time if we have it, else assume the
        # organiser gives about six weeks' notice — and say so in `basis`.
        if announces and len(announces) == len(events):
            leads = [(e - a).days for a, e in zip(announces, events) if (e - a).days > 0]
            lead = statistics.median(leads) if leads else 42
            lead_note = f"median observed lead {int(lead)}d"
        else:
            lead = 42
            lead_note = "assumed 6-week lead (no announcement dates recorded)"

        ann_start = ev_start - timedelta(days=int(lead) + 14)
        ann_end = ev_start - timedelta(days=max(int(lead) - 14, 3))

        # Confidence: more editions and tighter spread earn more trust.
        # Capped at 0.8 — a prediction is never allowed to look confirmed.
        conf = min(0.8, (0.25 * min(len(events), 4)) * (1.0 / (1.0 + ev_spread / 21.0)))

        preds.append({
            "opportunity_slug": slug,
            "predicted_announce_start": ann_start.isoformat(),
            "predicted_announce_end": ann_end.isoformat(),
            "predicted_event_start": ev_start.isoformat(),
            "predicted_event_end": ev_end.isoformat(),
            "method": "seasonal_mean",
            "basis": (
                f"{len(events)} editions ({', '.join(str(r['year']) for r in rows)}); "
                f"spread ±{ev_spread:.0f}d; {lead_note}"
            ),
            "n_editions": len(events),
            "stddev_days": round(ev_spread, 2),
            "confidence": round(conf, 2),
        })

    return preds


def cmd_forecast(_args):
    editions = rest("GET", "editions", params={"select": "*", "limit": "5000"})
    preds = forecast_from_editions(editions)

    if not preds:
        print(
            "No predictions yet — forecasting needs at least 2 editions of the\n"
            "same opportunity with a date. Backfill `editions` with prior years\n"
            "(Gradhack, FNB AOTY, Geekulcha, Huawei, Entelect all recur) and\n"
            "this starts producing watch windows."
        )
        return

    rest("POST", "predictions", body=preds, prefer="return=minimal")
    with open(PREDICTIONS_OUT, "w", encoding="utf-8") as fh:
        json.dump({"generated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                   "predictions": preds}, fh, indent=2)
        fh.write("\n")

    print(f"wrote {len(preds)} predictions → {PREDICTIONS_OUT}\n")
    for p in sorted(preds, key=lambda x: x["predicted_announce_start"]):
        print(f"  {p['opportunity_slug']:<34} watch from {p['predicted_announce_start']}"
              f"  event ~{p['predicted_event_start']}  conf {p['confidence']}")


# --------------------------------------------------------------------------- #
# pull / yield / health
# --------------------------------------------------------------------------- #

def cmd_pull(_args):
    rows = rest("GET", "v_watch_now", params={"select": "*"})
    with open(PREDICTIONS_OUT, "w", encoding="utf-8") as fh:
        json.dump({"generated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                   "predictions": rows}, fh, indent=2)
        fh.write("\n")
    print(f"pulled {len(rows)} active watch windows → {PREDICTIONS_OUT}")


def cmd_yield(_args):
    rows = rest("GET", "v_source_yield", params={"select": "*"})
    if not rows:
        print("No source runs recorded yet.")
        return
    print(f"{'SOURCE':<30} {'TIER':<5} {'CAND':>6} {'COMMIT':>7} {'$':>9} {'$/COMMIT':>9}")
    print("-" * 72)
    for r in rows:
        cpc = r.get("cost_per_commit")
        print(f"{r['name'][:29]:<30} {r['tier']:<5} {r['candidates']:>6} "
              f"{r['committed']:>7} {float(r['cost_usd']):>9.2f} "
              f"{(f'{float(cpc):.2f}' if cpc else '—'):>9}")
    print("\nA source with cost and no commits after a month should be switched off.")


def cmd_health(_args):
    hall = rest("GET", "v_hallucination_rate", params={"select": "*", "limit": "7"})
    print("Span-check failures (should trend to zero — a rise means a prompt regression)")
    for r in hall:
        print(f"  {r['day']}  {r['failed']:>3}/{r['total']:<4}  {r['fail_pct']}%")

    runs = rest("GET", "pipeline_runs",
                params={"select": "*", "order": "started_at.desc", "limit": "5"})
    print("\nRecent runs")
    for r in runs:
        print(f"  {r['started_at'][:16]}  {r['workflow']:<10} "
              f"{'ok' if r.get('ok') else 'FAIL':<5} ${float(r.get('cost_usd') or 0):.3f}")


# --------------------------------------------------------------------------- #

def cmd_seed_editions(_args):
    """data/editions.json -> the editions table. Idempotent on (slug, year).

    This is the table the forecaster reads. It is deliberately fed from a
    reviewable JSON file rather than scraped: a wrong prior date here does
    not fail loudly, it produces a confident watch window months from now
    that nobody can trace back.
    """
    with open(EDITIONS, encoding="utf-8") as fh:
        doc = json.load(fh)

    rows = []
    for e in doc.get("editions", []):
        rows.append({
            "opportunity_slug": e["opportunity_slug"],
            "year": e["year"],
            "announced_on": e.get("announced_on"),
            "opens_on": e.get("opens_on"),
            "closes_on": e.get("closes_on"),
            "event_start": e.get("event_start"),
            "event_end": e.get("event_end"),
            "we_entered": e.get("we_entered", False),
            "our_placement": e.get("our_placement"),
            "source_url": e.get("source_url"),
        })

    out = upsert("editions", rows, on_conflict="opportunity_slug,year")
    print(f"seeded {len(out)} editions")

    # The forecaster needs >=2 per slug. Say plainly which are still short,
    # rather than letting `forecast` silently produce nothing.
    by_slug = {}
    for r in rows:
        by_slug[r["opportunity_slug"]] = by_slug.get(r["opportunity_slug"], 0) + 1

    ready = [s for s, n in by_slug.items() if n >= 2]
    short = [s for s, n in by_slug.items() if n < 2]

    print(f"  {len(ready)} slug(s) have the 2+ editions forecasting needs")
    if short:
        print(f"  {len(short)} still on a single edition — no forecast until a second is found:")
        for s in sorted(short):
            need = doc.get("needed", {}).get(s)
            print(f"    {s}: {need or 'needs one more dated edition'}")


def cmd_promote_candidates(_args):
    """observations -> data/candidates.json.

    watch_sources.py writes span-verified evidence into `observations`, but
    nothing has ever lifted it back out - it sits in Supabase until a human
    happens to query the table by hand (see docs/STATUS.md, "That promotion
    step is the next piece worth building").

    This is deliberately NOT an auto-write to data/hackathons.json. Promotion
    here means the "notice it" half of the gap, not the "write the board
    entry" half: a human still reads the quoted evidence and decides whether
    it is a real, distinct opportunity. Writing straight to the board would
    reintroduce exactly the failure this project exists to prevent - an
    unreviewed claim rendering with the same authority as a verified one.

    Idempotent and stateful across runs via a git-tracked ledger
    (data/candidates.json): a URL already triaged (status changed by a human
    to "promoted" or "dismissed") keeps that status and just gets its
    evidence refreshed, so the same candidate doesn't get flagged "new"
    every 6 hours forever.
    """
    obs = rest("GET", "observations", params={
        "select": "candidate_url,field,value,quoted_span,source_url,source_trust,observed_at,model",
        "candidate_url": "not.is.null",
        "span_verified": "eq.true",
        "order": "observed_at.desc",
        "limit": "2000",
    })

    if os.path.exists(CANDIDATES):
        with open(CANDIDATES, encoding="utf-8") as fh:
            doc = json.load(fh)
    else:
        doc = {
            "note": (
                "Span-verified observations not yet linked to a tracked "
                "opportunity (candidate_url is set, opportunity_id is null). "
                "Written by `scripts/sonar_db.py promote`. Nothing here is on "
                "the board - status starts 'new' and a human sets it to "
                "'promoted' (after writing the real data/hackathons.json "
                "entry) or 'dismissed' (not a real/distinct opportunity, with "
                "a reason in `note`)."
            ),
            "candidates": {},
        }

    ledger = doc.setdefault("candidates", {})
    by_url = {}
    for o in obs:
        by_url.setdefault(o["candidate_url"], []).append(o)

    new_count = 0
    for url, rows in by_url.items():
        rows.sort(key=lambda r: r["observed_at"], reverse=True)
        entry = ledger.get(url)
        if entry is None:
            entry = {"status": "new", "first_seen": rows[-1]["observed_at"], "note": None}
            ledger[url] = entry
            new_count += 1
        entry["last_seen"] = rows[0]["observed_at"]
        entry["observation_count"] = len(rows)
        # Capped: this is a triage view for a human to scan, not a full
        # observation dump - the newest 5 quotes are enough to judge by.
        entry["evidence"] = [
            {
                "field": r["field"],
                "value": r["value"],
                "quoted_span": r["quoted_span"],
                "source_url": r["source_url"],
                "source_trust": r["source_trust"],
                "observed_at": r["observed_at"],
            }
            for r in rows[:5]
        ]

    doc["generated"] = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    with open(CANDIDATES, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    pending = sorted(u for u, e in ledger.items() if e["status"] == "new")
    print(f"{len(by_url)} candidate URL(s) with verified evidence this run, {new_count} newly seen")
    print(f"{len(pending)} awaiting review in {CANDIDATES}")
    for u in pending[:10]:
        n = ledger[u]["observation_count"]
        print(f"  NEW  {u}  ({n} observation{'s' if n != 1 else ''})")


COMMANDS = {
    "seed-orgs": cmd_seed_orgs,
    "seed-editions": cmd_seed_editions,
    "push": cmd_push,
    "forecast": cmd_forecast,
    "pull": cmd_pull,
    "yield": cmd_yield,
    "health": cmd_health,
    "promote": cmd_promote_candidates,
}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        sys.exit(f"usage: sonar_db.py [{' | '.join(COMMANDS)}]")
    COMMANDS[sys.argv[1]](sys.argv[2:])
