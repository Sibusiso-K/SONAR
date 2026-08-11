#!/usr/bin/env python3
"""
SONAR — Tier-B watchlist sweep.

Fetches each watched organisation's careers/news page, asks a model to point
at concrete hackathon/competition/programme/deadline mentions, and rejects
anything the model can't back up with an exact quote from the page. This is
the anti-hallucination gate described in docs/AUTONOMY.md: the model never
gets to just assert a date exists — it has to copy the sentence, and code
(not the model) checks that sentence is actually on the page.

Stdlib only, matching scripts/sonar_db.py's reasoning: CI installs nothing
and cannot break on a transitive dependency upgrade.

    export SUPABASE_URL=https://xxxx.supabase.co
    export SUPABASE_SERVICE_KEY=eyJ...
    export GROQ_API_KEY=gsk_...
    export GROQ_MODEL=llama-3.1-8b-instant       # optional, this is the default

    python3 scripts/watch_sources.py              # sweep every org with a URL
    python3 scripts/watch_sources.py --limit 3     # just the first 3 (testing)
    python3 scripts/watch_sources.py --dry-run     # fetch + extract, don't write

WHAT THIS DOES NOT DO YET
This sweeps the organisations already in the `organisations` table that have
a careers_url/news_url set. Most watchlist orgs (see sonar_db.py WATCHLIST)
don't have a URL yet — populating and verifying ~50 real org URLs is manual
research, not something to bulk-guess. Add them as you confirm each one:

    update organisations set careers_url = '...' where slug = 'fnb';
    update organisations set events_url  = '...' where slug = 'zindi';

Nothing this script extracts reaches the published board directly — it
writes to `observations` (unverified evidence), never to `opportunities`.
Promoting an observation to the board is still a human-reviewed step.
"""

import hashlib
import html.parser
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sonar_db  # noqa: E402  (reuse its PostgREST client, not reimplement it)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")

MAX_PAGE_CHARS = 12_000  # keeps prompt tokens (and cost) bounded per fetch
SOURCE_SLUG = "org-watchlist-sweep"
SOURCE_TRUST_ORG_OWN_PAGE = 5  # 1-6 scale; the org's own site, not the actual event page

SYSTEM_PROMPT = """You read the text of one webpage and look for concrete \
mentions of hackathons, competitions, graduate programmes, accelerators, \
bursaries or recruiting events.

Rules, no exceptions:
1. Only report something if the page text contains an exact sentence or \
phrase stating it. Copy that exact phrase into "quoted_span" character for \
character, including punctuation and capitalisation.
2. Never write a date, deadline, prize amount or number that you computed, \
converted, reformatted or inferred. "value" must be copied from the same \
place as quoted_span, not rewritten.
3. If the page does not mention anything in scope, return an empty list. \
An empty list is a correct answer, not a failure.
4. Respond with strict JSON only, no prose: \
{"candidates": [{"name": "...", "field": "...", "value": "...", \
"quoted_span": "..."}]}. \
field must be one of: event_name, deadline, event_date, prize, \
eligibility, location.
"""


class _TextExtractor(html.parser.HTMLParser):
    """Minimal, dependency-free HTML-to-text: strips tags/script/style,
    keeps visible text, collapses whitespace. Not a real markdown
    renderer — good enough for a model to read and for exact substring
    matching against quoted_span, which is all this needs."""

    def __init__(self):
        super().__init__()
        self._skip_depth = 0
        self.chunks = []

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self._skip_depth += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript") and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data):
        if not self._skip_depth and data.strip():
            self.chunks.append(data)


def html_to_text(raw_html: str) -> str:
    parser = _TextExtractor()
    parser.feed(raw_html)
    text = " ".join(parser.chunks)
    return " ".join(text.split())  # collapse all whitespace runs to single spaces


def fetch(url: str) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "SONAR-watchlist/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8", errors="replace")
        return resp.status, body


def call_groq(url: str, page_text: str) -> tuple[list, dict]:
    if not GROQ_KEY:
        sys.exit("GROQ_API_KEY must be set.")
    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"URL: {url}\n\nPage text:\n{page_text[:MAX_PAGE_CHARS]}"},
        ],
        "temperature": 0,
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        GROQ_URL,
        data=json.dumps(payload).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {GROQ_KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:600]
        print(f"  groq error {e.code}: {detail}", file=sys.stderr)
        return [], {}

    usage = body.get("usage", {})
    content = body["choices"][0]["message"]["content"]
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        print(f"  model did not return valid JSON: {content[:200]!r}", file=sys.stderr)
        return [], usage
    return parsed.get("candidates", []), usage


def sweep(limit=None, dry_run=False):
    orgs = sonar_db.rest(
        "GET", "organisations",
        params={
            "select": "id,slug,name,careers_url,news_url,events_url",
            "active": "eq.true",
            "or": "(careers_url.not.is.null,news_url.not.is.null,events_url.not.is.null)",
        },
    )
    if limit:
        orgs = orgs[:limit]

    if not orgs:
        print(
            "No organisations have a careers_url/news_url/events_url set yet.\n"
            "Run `python3 scripts/sonar_db.py seed-orgs` first (idempotent - "
            "safe to rerun), which sets zindi's events_url. To add another:\n"
            "  update organisations set events_url = '...' where slug = 'fnb';"
        )
        return

    total_candidates = 0
    total_verified = 0
    total_rejected = 0
    cost_usd = 0.0
    run_started = datetime.now(timezone.utc)

    for org in orgs:
        urls = filter(None, [org.get("careers_url"), org.get("news_url"), org.get("events_url")])
        for url in urls:
            print(f"[{org['slug']}] {url}")
            try:
                status, raw = fetch(url)
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                print(f"  fetch failed: {e}")
                continue

            page_text = html_to_text(raw)
            sha = hashlib.sha256(page_text.encode()).hexdigest()

            if not dry_run:
                sonar_db.upsert("snapshots", [{
                    "sha": sha, "url": url, "status_code": status,
                    "content": page_text, "byte_size": len(page_text),
                }], on_conflict="sha")

            candidates, usage = call_groq(url, page_text)
            total_candidates += len(candidates)

            observations = []
            for c in candidates:
                span = c.get("quoted_span", "")
                verified = bool(span) and span in page_text
                if verified:
                    total_verified += 1
                else:
                    total_rejected += 1
                    print(f"  REJECTED (span not found verbatim): {c!r}")
                observations.append({
                    "candidate_url": url,
                    "field": c.get("field", "unknown"),
                    "value": c.get("value"),
                    "quoted_span": span or "(none)",
                    "snapshot_sha": sha,
                    "source_url": url,
                    "source_trust": SOURCE_TRUST_ORG_OWN_PAGE,
                    "model": GROQ_MODEL,
                    "span_verified": verified,
                })

            if observations and not dry_run:
                sonar_db.rest("POST", "observations", body=observations, prefer="return=minimal")

            print(f"  {len(candidates)} candidate(s), "
                  f"{sum(1 for o in observations if o['span_verified'])} verified")

    run_ended = datetime.now(timezone.utc)
    print(f"\n{total_candidates} candidates, {total_verified} verified, "
          f"{total_rejected} rejected across {len(orgs)} organisation(s).")

    if dry_run:
        print("(dry run — nothing written to source_runs/pipeline_runs either)")
        return

    sonar_db.upsert("sources", [{
        "name": SOURCE_SLUG, "url": "n/a — many orgs, see organisations table",
        "tier": "B", "cadence": "every 6h", "cost_class": "free", "enabled": True,
    }], on_conflict="name")

    sources = sonar_db.rest("GET", "sources", params={"select": "id", "name": f"eq.{SOURCE_SLUG}"})
    if sources:
        sonar_db.rest("POST", "source_runs", body=[{
            "source_id": sources[0]["id"],
            "candidates": total_candidates,
            "survived_triage": total_verified,
            "new_opportunities": 0,  # promotion to opportunities is a separate, reviewed step
            "committed": 0,
            "cost_usd": cost_usd,
        }], prefer="return=minimal")

    sonar_db.rest("POST", "pipeline_runs", body=[{
        "workflow": "sweep",
        "started_at": run_started.isoformat(),
        "ended_at": run_ended.isoformat(),
        "ok": True,
        "candidates": total_candidates,
        "extracted": total_verified,
        "conflicts": 0,
        "cost_usd": cost_usd,
    }], prefer="return=minimal")


if __name__ == "__main__":
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    limit = None
    if "--limit" in args:
        limit = int(args[args.index("--limit") + 1])
    sweep(limit=limit, dry_run=dry_run)
