#!/usr/bin/env python3
"""
Migrate data/hackathons.json -> data/opportunities.json

Broadens the board from "hackathons" to every opportunity that moves the
needle: competitions, graduate programmes, recruiting events, accelerators.
Same verification spine, one new `kind` field.

Purely additive. Every v1 field is carried through untouched, so
scripts/sonar.py keeps working against hackathons.json until it's retired.

    python3 scripts/migrate_to_opportunities.py
"""

import json
import os
from datetime import date, datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "hackathons.json")
OUT = os.path.join(ROOT, "data", "opportunities.json")

# What each existing entry actually IS. Several were never really hackathons —
# BCG Platinion is a recruiting funnel, Mintek is a graduate programme.
KIND = {
    "adtc-2026": "hackathon",
    "bcg-platinion-2026": "recruiting_event",
    "ibm-devday-bob-2026": "hackathon",
    "shipaton-2026": "build_competition",
    "govtech-2026": "hackathon",
    "rsna-knee-2026": "ml_competition",
    "fnb-aoty-2026": "hackathon",
    "mtn-momo-miniapp-2026": "hackathon",
    "mintek-sci-2026": "grad_programme",
    "ibm-z-datathon-2026": "datathon",
    "unesco-youth-2026": "challenge",
    "zindi-rolling": "ml_competition",
    "geekulcha-2026": "hackathon",
    "huawei-ict-2026-2027": "competition",
    "entelect-university-cup-2027": "competition",
    "nasa-space-apps-2026": "hackathon",
}

# Career value beyond the prize. This is what "things around hackathons and
# company" means in practice — some of these are worth more as a job route
# than as a payday.
CAREER_TRACK = {
    "bcg-platinion-2026": "direct",      # the event IS the interview
    "mintek-sci-2026": "direct",
    "ibm-devday-bob-2026": "adjacent",   # TechXchange passes -> network
    "fnb-aoty-2026": "adjacent",
    "govtech-2026": "adjacent",
    "adtc-2026": "adjacent",             # residency + XPrize pathway
}

DEADLINE_KEYS = (
    "submission_deadline", "application_deadline", "entry_deadline",
    "registration_deadline", "final_submission", "event_start",
    "hackathon_start", "virtual_event",
)


def parse_day(value):
    if not isinstance(value, str) or len(value) < 10:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def next_date(entry):
    """Soonest meaningful upcoming date, as (label, iso)."""
    today = date.today()
    best = None
    for key in DEADLINE_KEYS:
        d = parse_day(entry.get("dates", {}).get(key))
        if d and d >= today and (best is None or d < best[1]):
            best = (key, d)
    return (best[0], best[1].isoformat()) if best else (None, None)


def main():
    with open(SRC, encoding="utf-8") as fh:
        src = json.load(fh)

    today = date.today()
    out_items = []

    for h in src["hackathons"]:
        item = dict(h)  # carry every v1 field through untouched
        oid = h["id"]

        item["kind"] = KIND.get(oid, "hackathon")
        item["career_track"] = CAREER_TRACK.get(oid, "none")

        label, iso = next_date(h)
        item["next_date"] = iso
        item["next_date_label"] = label.replace("_", " ") if label else None
        item["days_remaining"] = (
            (date.fromisoformat(iso) - today).days if iso else None
        )

        # Confidence lives on dates.confidence in v1. Promote it so the UI
        # can colour-code without reaching into a nested object.
        item["confidence"] = (h.get("dates") or {}).get("confidence", "unconfirmed")

        # lifecycle: our state, distinct from the competition's own status
        st = h.get("status")
        if st in ("open", "closing"):
            item["lifecycle"] = "committed" if h.get("tier") == 1 else "scored"
        elif st in ("monitor", "monitor-weekly"):
            item["lifecycle"] = "triaged"
        elif st == "verify":
            item["lifecycle"] = "discovered"
        elif st in ("selected", "registered"):
            # The team's own action, not just the competition's status: a
            # letter/confirmation page says we're actually in. That's what
            # "committed" lifecycle means, same as an open tier-1 entry.
            item["lifecycle"] = "committed"
        else:
            item["lifecycle"] = "scored"

        item.setdefault("tracks", [])
        item.setdefault("challenges", [])
        item.setdefault("stages", [])
        item.setdefault("evidence", [])
        item.setdefault("history", [])

        out_items.append(item)

    # Past / missed — keep them visible, they drive next year's predictions
    past = []
    for p in src["dropped_or_past"]:
        reason = p.get("reason", "")
        missed = reason.startswith("MISSED")

        # The full reason carries internal cross-references ("see AUTONOMY.md
        # §7.4", "history[]") that read badly in a UI banner. Take the first
        # two sentences as a display summary and keep the full text for detail.
        body = reason[len("MISSED — "):] if missed else reason
        parts = body.replace(". ", ".\x00").split("\x00")
        summary = " ".join(parts[:2]).strip()

        past.append({
            "name": p["name"],
            "summary": summary,
            "reason": reason,
            "link": p.get("link"),
            "missed": missed,
            "result": p.get("result"),
        })

    out = {
        "$schema": "../schema/hackathon.schema.json",
        "meta": {
            **src["meta"],
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "generator": "scripts/migrate_to_opportunities.py",
            "kinds": {
                "hackathon": "Build something in a fixed window",
                "datathon": "Data/ML sprint, usually team-based",
                "ml_competition": "Leaderboard competition, rolling or fixed",
                "build_competition": "Ship a real product, judged on the product",
                "challenge": "Concept or proposal submission, not code",
                "competition": "Structured multi-round contest",
                "grad_programme": "Graduate hiring programme with a build component",
                "recruiting_event": "The event is the interview",
                "accelerator": "Funding + programme",
                "bursary": "Study funding",
            },
            "career_tracks": {
                "direct": "The event is a hiring funnel — placement is the prize",
                "adjacent": "Opens a network or pathway, not a direct offer",
                "none": "Prize and portfolio value only",
            },
        },
        "opportunities": out_items,
        "past": past,
        "monitoring_sources": src["monitoring_sources"],
    }

    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    live = [o for o in out_items if o["days_remaining"] is not None]
    live.sort(key=lambda o: o["days_remaining"])
    print(f"wrote {OUT}")
    print(f"  {len(out_items)} opportunities · {len(past)} past · {len(live)} with an upcoming date")
    print()
    for o in live[:6]:
        print(f"  {o['days_remaining']:>4}d  {o['kind']:<18} {o['name'][:46]}")


if __name__ == "__main__":
    main()
