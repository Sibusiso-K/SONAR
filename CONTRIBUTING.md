# Contributing to SONAR

`data/hackathons.json` is the single source of truth. Everything else references it.

---

## Adding a hackathon

1. **Find it.** Check the `monitoring_sources` list in `hackathons.json` weekly, or wherever you found it.

2. **Score it.**
   ```bash
   python3 scripts/sonar.py score --career 8 --win 6 --prize 7 --urgency 9
   ```
   | Factor | 0–10 means |
   |---|---|
   | `career_leverage` | 10 = corporate recruiters in the room. 5 = good CV line. 1 = nobody who hires will see it. |
   | `winnability` | 10 = small field, we're a strong fit. 5 = even odds. 1 = global grandmasters. |
   | `prize` | 10 = $500k+. 7 ≈ $50k. 5 ≈ $10k. 3 = non-cash. 1 = points only. |
   | `urgency` | 10 = under 14 days. 7 ≈ 30 days. 5 ≈ 60 days. 2 = next year. |

   Tier 1 ≥ 7.0 · Tier 2 6.0–6.9 · Tier 3 < 6.0

3. **Add the entry** to the `hackathons` array. Copy an existing one — every field matters.

4. **Set `confidence` honestly.**
   - `confirmed` — you read it on the organiser's own page today
   - `reported` — news article or aggregator
   - `unconfirmed` — not announced; you're extrapolating from last year

5. **Add a line to `docs/SOURCES.md`** with the URL. No exceptions. A date without a source is a rumour.

6. **If it has fixed dates**, add them to `data/calendar_events.json` too, then:
   ```bash
   python3 scripts/sonar.py ics
   ```

7. **Update `docs/PRIORITY_BOARD.md`** if it lands in Tier 1 or 2.

8. **PR it.** Title: `board: add <name>`.

---

## Entry schema

```jsonc
{
  "id": "kebab-case-year",              // required, unique, stable
  "name": "Full official name",
  "organiser": "Who runs it",
  "scope": "local | continental | international",
  "format": "online | in-person | hybrid",
  "location": "Where",
  "status": "open | closing | monitor | verify | monitor-weekly | closed",
  "tier": 1,
  "score": 7.65,
  "scores": { "career_leverage": 7, "winnability": 7, "prize": 8, "urgency": 10 },
  "dates": {
    "submission_deadline": "2026-08-24T23:45:00-07:00",
    "confidence": "confirmed"           // required
  },
  "prize": { "currency": "USD", "pool": 16500, "breakdown": {}, "non_cash": "" },
  "eligibility": "Who can enter. Flag BLOCKERS in caps.",
  "team_fit": "How it works for a 2-person team specifically.",
  "what_to_build": "The actual brief.",
  "scoring_formula": "If published — this is the spec.",
  "deliverables": ["repo", "report", "video"],
  "links": { "main": "https://..." },   // 'main' is what sonar.py stale shows
  "notes": "What we'd tell each other over coffee. Be blunt."
}
```

**Date keys** `sonar.py` reads, in priority order:
`submission_deadline`, `application_deadline`, `entry_deadline`, `registration_deadline`, `final_submission`, `event_start`, `hackathon_start`, `virtual_event`.

Any date value containing a `YYYY-MM-DD` is parsed, so timestamps and prose both work. Keep timezone-sensitive deadlines in the original timezone and add a `*_sast` sibling — future you will thank present you at 08:45 on a Tuesday.

---

## Changing a score

Scores are opinions. Change them — but in a PR, with a reason in the description. Don't edit them silently, and update `score` to match `scores` (the weights are in `meta.scoring_weights`).

---

## Weekly review checklist

Monday, 30 minutes:

- [ ] `python3 scripts/sonar.py next`
- [ ] `python3 scripts/sonar.py stale` — chase anything not `confirmed`
- [ ] Walk the `monitoring_sources` list
- [ ] Open [Zindi](https://zindi.world/competitions) **in a browser** (JS-rendered, won't fetch) sorted by "Closing soon"
- [ ] Score and add anything new
- [ ] Move anything now past into `dropped_or_past` with a note for next year's cycle
- [ ] `python3 scripts/sonar.py ics` if dates changed, and re-import

---

## Sanity check before pushing

```bash
python3 -c "import json;json.load(open('data/hackathons.json'));json.load(open('data/calendar_events.json'));print('json ok')"
python3 scripts/sonar.py list
python3 scripts/sonar.py ics
```
