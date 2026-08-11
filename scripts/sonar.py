#!/usr/bin/env python3
"""
SONAR — hackathon finder, sorter, executor.

Pure stdlib. No dependencies.

    python3 scripts/sonar.py next
    python3 scripts/sonar.py list [--tier N] [--scope local|continental|international] [--status open]
    python3 scripts/sonar.py brief <id>
    python3 scripts/sonar.py stale
    python3 scripts/sonar.py ics [-o calendar/sonar-2026.ics]
    python3 scripts/sonar.py score --career 8 --win 6 --prize 7 --urgency 9
"""

import argparse
import json
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone

# Board text uses non-ASCII punctuation (—, ·, →). On Windows, stdout defaults
# to the console codepage (cp1252), which can't encode "→" and crashes with
# UnicodeEncodeError. Force UTF-8 so the CLI works the same on every platform.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HACKATHONS = os.path.join(ROOT, "data", "hackathons.json")
CAL_EVENTS = os.path.join(ROOT, "data", "calendar_events.json")
ICS_OUT = os.path.join(ROOT, "calendar", "sonar-2026.ics")

WEIGHTS = {"career_leverage": 0.35, "winnability": 0.30, "prize": 0.20, "urgency": 0.15}

BOLD, DIM, RED, YEL, GRN, CYN, RST = (
    "\033[1m", "\033[2m", "\033[31m", "\033[33m", "\033[32m", "\033[36m", "\033[0m"
)
if not sys.stdout.isatty() or os.environ.get("NO_COLOR"):
    BOLD = DIM = RED = YEL = GRN = CYN = RST = ""


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def parse_day(value):
    """Pull a YYYY-MM-DD out of whatever date string we were given."""
    if not isinstance(value, str):
        return None
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", value)
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


DEADLINE_KEYS = (
    "submission_deadline", "application_deadline", "entry_deadline",
    "registration_deadline", "final_submission", "event_start",
    "hackathon_start", "virtual_event",
)


def next_date(h):
    """Soonest meaningful upcoming date for a hackathon entry."""
    today = date.today()
    best = None
    for key in DEADLINE_KEYS:
        d = parse_day(h.get("dates", {}).get(key))
        if d and d >= today and (best is None or d < best[1]):
            best = (key, d)
    return best


def fmt_prize(h):
    p = h.get("prize") or {}
    pool = p.get("pool")
    cur = p.get("currency", "")
    if isinstance(pool, (int, float)):
        return f"{cur} {pool:,.0f}".strip()
    return "TBA" if not p.get("non_cash") else "non-cash"


def cmd_list(args):
    data = load(HACKATHONS)
    rows = data["hackathons"]
    if args.tier:
        rows = [h for h in rows if h.get("tier") == args.tier]
    if args.scope:
        rows = [h for h in rows if h.get("scope") == args.scope]
    if args.status:
        rows = [h for h in rows if h.get("status") == args.status]
    rows.sort(key=lambda h: -h.get("score", 0))

    print(f"\n{BOLD}SONAR board{RST}  ·  {len(rows)} entries  ·  today {date.today():%d %b %Y}\n")
    print(f"{DIM}{'SCORE':>5}  {'T':<2} {'NEXT DATE':<12} {'DAYS':>5}  {'SCOPE':<14} {'PRIZE':<14} NAME{RST}")
    print(f"{DIM}{'-' * 100}{RST}")
    for h in rows:
        nxt = next_date(h)
        if nxt:
            label, d = nxt
            days = (d - date.today()).days
            colour = RED if days <= 14 else (YEL if days <= 30 else "")
            dstr, daystr = f"{d:%Y-%m-%d}", f"{colour}{days}d{RST}"
        else:
            dstr, daystr = "—", f"{DIM}—{RST}"
        tier = h.get("tier", "?")
        tcol = GRN if tier == 1 else (CYN if tier == 2 else DIM)
        print(f"{h.get('score', 0):>5.2f}  {tcol}{tier}{RST}  {dstr:<12} {daystr:>10}  "
              f"{h.get('scope', ''):<14} {fmt_prize(h):<14} {h['name'][:44]}")
    print()


def cmd_next(args):
    data = load(HACKATHONS)
    upcoming = []
    for h in data["hackathons"]:
        nxt = next_date(h)
        if nxt:
            upcoming.append((nxt[1], nxt[0], h))
    upcoming.sort(key=lambda t: t[0])
    horizon = date.today() + timedelta(days=args.days)

    print(f"\n{BOLD}Next {args.days} days{RST}  ·  today {date.today():%A %d %B %Y}\n")
    shown = 0
    for d, label, h in upcoming:
        if d > horizon:
            break
        days = (d - date.today()).days
        colour = RED if days <= 7 else (YEL if days <= 21 else GRN)
        print(f"  {colour}{d:%d %b}  ({days:>3}d){RST}  {BOLD}{h['name']}{RST}")
        print(f"            {DIM}{label.replace('_', ' ')} · tier {h.get('tier')} · "
              f"score {h.get('score')} · {fmt_prize(h)} · {h['dates'].get('confidence', '?')}{RST}")
        shown += 1
    if not shown:
        print(f"  {DIM}Nothing in the window. Widen it: sonar.py next --days 120{RST}")
    print()


def cmd_brief(args):
    data = load(HACKATHONS)
    for h in data["hackathons"]:
        if h["id"] == args.id:
            print(f"\n{BOLD}{h['name']}{RST}")
            print(f"{DIM}{h['id']} · tier {h.get('tier')} · score {h.get('score')} · "
                  f"{h.get('scope')} · {h.get('format')} · {h.get('status')}{RST}\n")
            print(f"  {BOLD}Organiser{RST}   {h.get('organiser')}")
            print(f"  {BOLD}Location{RST}    {h.get('location')}")
            print(f"  {BOLD}Prize{RST}       {fmt_prize(h)}")
            if (h.get("prize") or {}).get("non_cash"):
                print(f"              {DIM}{h['prize']['non_cash']}{RST}")
            print(f"\n  {BOLD}Dates{RST}")
            for k, v in h.get("dates", {}).items():
                print(f"    {k:<26} {v}")
            print(f"\n  {BOLD}Eligibility{RST}\n    {h.get('eligibility')}")
            print(f"\n  {BOLD}Team fit{RST}\n    {h.get('team_fit')}")
            print(f"\n  {BOLD}What to build{RST}\n    {h.get('what_to_build')}")
            if h.get("scoring_formula"):
                print(f"\n  {BOLD}How it's scored{RST}\n    {h['scoring_formula']}")
            print(f"\n  {BOLD}Deliverables{RST}")
            for d in h.get("deliverables", []):
                print(f"    - {d}")
            print(f"\n  {BOLD}Links{RST}")
            for k, v in (h.get("links") or {}).items():
                print(f"    {k:<22} {v}")
            print(f"\n  {BOLD}Notes{RST}\n    {h.get('notes')}\n")
            return
    sys.exit(f"No hackathon with id '{args.id}'. Run: sonar.py list")


def cmd_stale(args):
    data = load(HACKATHONS)
    bad = [h for h in data["hackathons"]
           if h.get("dates", {}).get("confidence") != "confirmed"]
    print(f"\n{BOLD}Needs verification{RST}  ·  {len(bad)} of {len(data['hackathons'])} entries\n")
    for h in sorted(bad, key=lambda x: -x.get("score", 0)):
        conf = h.get("dates", {}).get("confidence", "missing")
        colour = RED if conf in ("unconfirmed", "missing") else YEL
        print(f"  {colour}{conf:<12}{RST} {h.get('score', 0):>5.2f}  {h['name']}")
        link = (h.get("links") or {}).get("main") or next(iter((h.get("links") or {}).values()), "")
        print(f"  {DIM}{'':<12}        {link}{RST}")
    print(f"\n  {DIM}Verify these before committing a weekend to them.{RST}\n")


def cmd_score(args):
    s = (WEIGHTS["career_leverage"] * args.career
         + WEIGHTS["winnability"] * args.win
         + WEIGHTS["prize"] * args.prize
         + WEIGHTS["urgency"] * args.urgency)
    tier = 1 if s >= 7.0 else (2 if s >= 6.0 else 3)
    print(f"\n  score {BOLD}{s:.2f}{RST}   →  tier {BOLD}{tier}{RST}")
    print(f"  {DIM}0.35·{args.career} + 0.30·{args.win} + 0.20·{args.prize} + 0.15·{args.urgency}{RST}\n")


# --- ICS -------------------------------------------------------------------

def ics_escape(text):
    return (str(text).replace("\\", "\\\\").replace(";", r"\;")
            .replace(",", r"\,").replace("\n", r"\n"))


def fold(line):
    """RFC 5545 says 75 octets per line."""
    out, cur = [], line
    while len(cur.encode("utf-8")) > 74:
        cut = 74
        while len(cur[:cut].encode("utf-8")) > 74:
            cut -= 1
        out.append(cur[:cut])
        cur = " " + cur[cut:]
    out.append(cur)
    return out


VTIMEZONE = """BEGIN:VTIMEZONE
TZID:Africa/Johannesburg
X-LIC-LOCATION:Africa/Johannesburg
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0200
TZNAME:SAST
DTSTART:19700101T000000
END:STANDARD
END:VTIMEZONE"""


def cmd_ics(args):
    data = load(CAL_EVENTS)
    tz = data["meta"]["timezone"]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0",
        "PRODID:-//SONAR//Hackathon Board//EN",
        "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
        "X-WR-CALNAME:SONAR — Hackathons 2026",
        f"X-WR-TIMEZONE:{tz}",
        "X-WR-CALDESC:Hackathon deadlines\\, events and prep blocks for Sibusiso & Lethabo.",
    ]
    lines.extend(VTIMEZONE.splitlines())

    for ev in data["events"]:
        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:{ev['id']}@sonar.hackathons")
        lines.append(f"DTSTAMP:{stamp}")
        if ev.get("all_day"):
            start = parse_day(ev["start"])
            end = parse_day(ev.get("end")) or (start + timedelta(days=1))
            lines.append(f"DTSTART;VALUE=DATE:{start:%Y%m%d}")
            lines.append(f"DTEND;VALUE=DATE:{end:%Y%m%d}")
        else:
            s = ev["start"].replace("-", "").replace(":", "")
            e = ev.get("end", ev["start"]).replace("-", "").replace(":", "")
            lines.append(f"DTSTART;TZID={tz}:{s}00")
            lines.append(f"DTEND;TZID={tz}:{e}00")
        if ev.get("rrule"):
            lines.append(f"RRULE:{ev['rrule']}")
        lines.append(f"SUMMARY:{ics_escape(ev['summary'])}")
        if ev.get("description"):
            lines.append(f"DESCRIPTION:{ics_escape(ev['description'])}")
        lines.append(f"CATEGORIES:{ev.get('kind', 'event').upper()}")
        lines.append("TRANSP:TRANSPARENT" if ev.get("kind") in ("deadline", "reward") else "TRANSP:OPAQUE")
        for mins in ev.get("reminders", []):
            lines += ["BEGIN:VALARM", "ACTION:DISPLAY",
                      f"DESCRIPTION:{ics_escape(ev['summary'])}",
                      f"TRIGGER:-PT{mins}M", "END:VALARM"]
        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")

    folded = []
    for line in lines:
        folded.extend(fold(line))

    out = args.output or ICS_OUT
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="") as fh:
        fh.write("\r\n".join(folded) + "\r\n")
    print(f"Wrote {len(data['events'])} events to {out}")


def main():
    ap = argparse.ArgumentParser(prog="sonar", description="SONAR hackathon board")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("list", help="full board, ranked")
    p.add_argument("--tier", type=int)
    p.add_argument("--scope", choices=["local", "continental", "international"])
    p.add_argument("--status")
    p.set_defaults(func=cmd_list)

    p = sub.add_parser("next", help="what's closing soonest")
    p.add_argument("--days", type=int, default=60)
    p.set_defaults(func=cmd_next)

    p = sub.add_parser("brief", help="everything about one event")
    p.add_argument("id")
    p.set_defaults(func=cmd_brief)

    p = sub.add_parser("stale", help="entries needing re-verification")
    p.set_defaults(func=cmd_stale)

    p = sub.add_parser("ics", help="regenerate the .ics calendar")
    p.add_argument("-o", "--output")
    p.set_defaults(func=cmd_ics)

    p = sub.add_parser("score", help="score a new find")
    p.add_argument("--career", type=float, required=True)
    p.add_argument("--win", type=float, required=True)
    p.add_argument("--prize", type=float, required=True)
    p.add_argument("--urgency", type=float, required=True)
    p.set_defaults(func=cmd_score)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
