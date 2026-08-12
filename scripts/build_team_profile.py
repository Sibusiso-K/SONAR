#!/usr/bin/env python3
"""
GitHub -> data/team_profile.json

Rebuilds the observed-capability profile from what the team has actually
shipped. Every number it writes is a fact GitHub reported (a detected
language, a recorded timestamp) - nothing here is a self-assessed skill
rating, because those are exactly the kind of unfalsifiable claim this
project refuses to put on the board.

    export GITHUB_TOKEN=ghp_...        # needs repo scope to see private repos
    python3 scripts/build_team_profile.py            # write the file
    python3 scripts/build_team_profile.py --dry-run  # print, don't write

WHY THIS EXISTS
"Should we enter this?" splits into two questions. "Will we win" needs
recorded outcomes, and we have exactly one - so any model of it would be
inventing confidence. "Can we build this in the window" is answerable
today from evidence: what stacks we've shipped, in what domains, over
what timescales. This file is that evidence.

The hand-curated parts of data/team_profile.json (demonstrated_domains,
known_unknowns) are preserved on rebuild - they carry judgement that an
API can't derive. Only the machine-derivable sections are overwritten.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date, datetime

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "team_profile.json")

USERS = ["Sibusiso-K", "LethaboMH14"]
TOKEN = os.environ.get("GITHUB_TOKEN", "")

# Repos that map onto a board entry. Hand-maintained: only a person can
# say "KHANYA is the Mintek build" - the repo name doesn't say so, and
# guessing the link would fabricate a connection.
REPO_TO_OPPORTUNITY = {
    # Two repos, one competition, different jobs. Vuka was the theme/idea/plan
    # submitted to APPLY; BEACON was the practice build. Neither repo says so -
    # a human did. That's the whole reason this map is hand-maintained.
    "LethaboMH14/Team-Sonar---Vuka-": "discovery-gradhack-2026",
    "LethaboMH14/BEACON": "discovery-gradhack-2026",
    "Sibusiso-K/KHANYA": "mintek-sci-2026",
    "Sibusiso-K/RSNA-Knee-Abnormality-Detection": "rsna-knee-2026",
    # Entered, but never tracked by SONAR - left mapped to null deliberately
    # so the gap stays visible instead of being quietly tidied away.
    "LethaboMH14/Google-WAXAL-ASR-Challenge": None,
    "LethaboMH14/Agent-Guardian": None,
}

# Repos that are infrastructure for this project, not portfolio evidence.
EXCLUDE = {
    "Sibusiso-K/SONAR",
    "LethaboMH14/sonar",
    "Sibusiso-K/Sibusiso-K",   # GitHub profile README
    "Sibusiso-K/Sibusiso",     # empty 2020 placeholder
}


def gh(path):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "SONAR-team-profile/1.0",
            **({"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f"GitHub {path} -> {e.code}\n{e.read().decode()[:400]}")


def days_between(a, b):
    if not a or not b:
        return None
    return (date.fromisoformat(b[:10]) - date.fromisoformat(a[:10])).days


def main():
    dry_run = "--dry-run" in sys.argv

    repos = []
    for user in USERS:
        page = 1
        while True:
            batch = gh(f"/users/{user}/repos?per_page=100&page={page}&type=owner")
            if not batch:
                break
            repos.extend(batch)
            if len(batch) < 100:
                break
            page += 1

    repos = [r for r in repos if r["full_name"] not in EXCLUDE and not r["fork"]]

    languages = {}
    for r in repos:
        lang = r.get("language")
        if lang:
            languages[lang] = languages.get(lang, 0) + 1

    competition = []
    for r in repos:
        if r["full_name"] not in REPO_TO_OPPORTUNITY:
            continue
        competition.append({
            "repo": r["full_name"],
            "description": r.get("description"),
            "opportunity_id": REPO_TO_OPPORTUNITY[r["full_name"]],
            "language": r.get("language"),
            "created_at": r["created_at"][:10],
            "last_push": (r.get("pushed_at") or "")[:10] or None,
            "active_days": days_between(r["created_at"], r.get("pushed_at")),
            "private": r["private"],
        })
    competition.sort(key=lambda c: c["created_at"], reverse=True)

    spans = [c["active_days"] for c in competition if c["active_days"] is not None]
    spans.sort()

    derived = {
        "generated": datetime.now().date().isoformat(),
        "source": f"GitHub API, users {' and '.join(USERS)}",
        "members": ["Sibusiso K", "Lethabo"],
        "repo_count": len(repos),
        "languages": {
            "note": "Count of repos where GitHub detected this as the primary "
                    "language. A proxy for what the team reaches for, not a "
                    "proficiency score.",
            **dict(sorted(languages.items(), key=lambda kv: -kv[1])),
        },
        "competition_builds": {
            "note": "Repos that map onto a real competition, per "
                    "REPO_TO_OPPORTUNITY. opportunity_id null means we "
                    "entered something the board never tracked.",
            "entries": competition,
        },
        "observed_velocity": {
            "note": "Active days (created -> last push) on competition repos. "
                    "Small sample - stated, not smoothed.",
            "sample_size": len(spans),
            "median_active_days": spans[len(spans) // 2] if spans else None,
            "shortest_active_days": spans[0] if spans else None,
            "longest_active_days": spans[-1] if spans else None,
        },
    }

    # Preserve the hand-written judgement sections.
    existing = {}
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as fh:
            existing = json.load(fh)

    out = {
        "note": existing.get("note", "Observed-capability profile, derived from GitHub."),
        **derived,
        "demonstrated_domains": existing.get("demonstrated_domains", {}),
        "known_unknowns": existing.get("known_unknowns", []),
    }

    if dry_run:
        print(json.dumps(out, indent=2)[:2500])
        print("\n(dry run - nothing written)")
        return

    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    print(f"wrote {OUT}")
    print(f"  {len(repos)} repos, {len(competition)} competition builds")
    print(f"  languages: {', '.join(f'{k} x{v}' for k, v in list(derived['languages'].items())[1:6])}")
    untracked = [c["repo"] for c in competition if c["opportunity_id"] is None]
    if untracked:
        print(f"  NOT ON THE BOARD: {', '.join(untracked)}")


if __name__ == "__main__":
    main()
