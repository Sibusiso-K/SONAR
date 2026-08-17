# SONAR

**Hackathon finder, sorter, and executor.**
Make bread. Get a job. Win everything.

Operators: **Sibusiso K** and **Lethabo**. Two people, one board, the rest of 2026.

---

## Read this first, Lethabo

You just pulled the repo. Everything you need is here — no context transfer required.

| You want to know | Open this |
|---|---|
| What we're doing this week | [`docs/PRIORITY_BOARD.md`](docs/PRIORITY_BOARD.md) |
| Every hackathon, full detail, machine-readable | [`data/hackathons.json`](data/hackathons.json) |
| Every date in one place | [`docs/CALENDAR.md`](docs/CALENDAR.md) + [`calendar/sonar-2026.ics`](calendar/sonar-2026.ics) |
| How we actually run a hackathon | [`docs/PLAYBOOK.md`](docs/PLAYBOOK.md) |
| Who does what | [`docs/TEAM.md`](docs/TEAM.md) |
| Where every fact came from | [`docs/SOURCES.md`](docs/SOURCES.md) |
| How to add or update an entry | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Getting set up from scratch | [`docs/ONBOARDING.md`](docs/ONBOARDING.md) |
| **Where this is going — the autonomous v2 design** | [**`docs/AUTONOMY.md`**](docs/AUTONOMY.md) |

Import `calendar/sonar-2026.ics` into your Google Calendar and you have the same dates Sibusiso does.

---

## The situation as of 14 August 2026

**We are in the Mintek SCI Grad Hackathon.** The selection letter landed 14 August — R50,000 across the top three, possible vacation work at Mintek, abstract due 30 August, and a mandatory in-person final day at Randburg on 1 October. It is now the highest-scored entry on the board (8.2), because it is the only one where we already hold a place.

Beyond that, three things close inside 16 days. One of them is 2 days out.

```
Aug 16  UNESCO Youth Hackathon          SUBMIT OR DROP — 2 days
Aug 24  Africa Deep Tech Challenge      $16,500 — 10 days — PRIMARY
Aug 27  IBM Dev Day: Bob in Action      register before this date
Aug 28  IBM hackathon starts (to 30 Aug)
Aug 30  Mintek abstract due             WE ARE SELECTED — R50,000 pool
Sep 07  BCG Platinion application       HIGHEST career value on the board
Sep 30  RevenueCat Shipaton             $700k+ pool — submit by Sep 29, see below
Oct 01  Mintek FINAL HACKING DAY        in person, Randburg — submit by 13:00
Oct 02  Mintek SCI Conference           mandatory — 5 finalists announced
Oct 15  RSNA Knee (Kaggle) entry        $77,000
Oct 16  BCG Platinion Hackathon, Johannesburg
Nov 14  NASA Space Apps
```

Full board with reasoning: [`docs/PRIORITY_BOARD.md`](docs/PRIORITY_BOARD.md)

> **Closed loose end — and the reason SONAR needs to run itself.** That empty Google Calendar named *"Discovery Gradhack -Team Sonar- 2026"* was tracking a real event: **Discovery Gradhack ran on 7 August 2026 at Discovery Place, Sandton.** 50 IT students, teams of 2–4, R12 500 per winning team member, and a permanent-employment pathway at Discovery. An earlier pass recorded this as missed — it wasn't: the team made the deadline and competed, placing **Top 6**. Correction logged 11 Aug 2026 in `data/hackathons.json`. The near-miss stands regardless of the good outcome — the only warning beforehand was a calendar nobody filled in, and discovery was late.
>
> Moved to `dropped_or_past`. Watch set for ~August 2027. This is finding #1 in [`docs/AUTONOMY.md`](docs/AUTONOMY.md), which is the plan for making sure the *discovery-timing* gap doesn't happen twice.

---

## How things are ranked

Every event gets four scores out of 10, weighted in the order Sibusiso set:

| Factor | Weight | What it measures |
|---|---|---|
| Career leverage | 35% | Does this put us in front of people who hire? |
| Winnability | 30% | Realistic odds for a 2-person SA team |
| Prize | 20% | Cash and cash-equivalent value |
| Urgency | 15% | How soon it closes |

`score = 0.35·career + 0.30·winnability + 0.20·prize + 0.15·urgency`

**Tier 1** (≥7.0) — clear the calendar.
**Tier 2** (6.0–6.9) — do if capacity allows.
**Tier 3** (<6.0) — opportunistic, or blocked on eligibility.

Scores live in `data/hackathons.json` under `scores`. Argue with them in a PR, don't change them silently.

---

## Repo layout

```
SONAR/
├── README.md                    ← you are here
├── CONTRIBUTING.md              ← how to add/update a hackathon
├── data/
│   └── hackathons.json          ← single source of truth
├── docs/
│   ├── ONBOARDING.md            ← start here if you just got access
│   ├── PRIORITY_BOARD.md        ← the ranked board + reasoning
│   ├── CALENDAR.md              ← every date, chronological
│   ├── PLAYBOOK.md              ← how we run a hackathon weekend
│   ├── TEAM.md                  ← roles, split, standing agreements
│   └── SOURCES.md               ← citation for every claim
├── calendar/
│   └── sonar-2026.ics           ← import into Google Calendar
├── scripts/
│   ├── sonar.py                 ← CLI: next / list / brief / ics
│   ├── setup-repo.sh            ← create repo + push + invite Lethabo
│   ├── push-to-github.sh        ← push only
│   └── requirements.txt         ← (none — stdlib only)
├── templates/
│   ├── hackathon-brief.md       ← fill one per event we enter
│   ├── submission-checklist.md  ← run before every submit
│   └── retro.md                 ← 20 minutes after every event
└── entries/                     ← one folder per hackathon we actually enter
    └── .gitkeep
```

---

## The CLI

Pure Python 3, no dependencies.

```bash
python3 scripts/sonar.py next            # what's closing soonest
python3 scripts/sonar.py list            # full board, ranked
python3 scripts/sonar.py list --tier 1   # tier 1 only
python3 scripts/sonar.py list --scope local
python3 scripts/sonar.py brief adtc-2026 # everything about one event
python3 scripts/sonar.py ics             # regenerate calendar/sonar-2026.ics
python3 scripts/sonar.py stale           # entries needing re-verification
```

---

## Data confidence — read this before you trust a date

Every date carries a `confidence` field:

- **`confirmed`** — read directly off the organiser's official page. Trust it.
- **`reported`** — from news or an aggregator. Verify before you commit a weekend.
- **`unconfirmed`** — 2026 edition not announced; based on last year's pattern. Do not plan around it.

`python3 scripts/sonar.py stale` lists everything that is not `confirmed`.

---

## Standing rhythm

- **Monday 08:00** — review the board, run `sonar.py next`, check the monitoring sources in `data/hackathons.json`.
- **Any new find** — add to `hackathons.json`, score it, PR it. Never keep it in your head.
- **After every event** — fill `templates/retro.md` into `entries/<id>/retro.md`. Same week, while it still stings.

---

## Ground rules

1. **`hackathons.json` is the only source of truth.** Docs are generated from it or reference it. If they disagree, the JSON wins.
2. **No date goes in without a link.** `docs/SOURCES.md` gets a line for every claim.
3. **We do not enter more than two overlapping builds.** Two people. Capacity is the constraint, not ambition.
4. **Every entry produces a reusable artefact** — a model, a component, a deploy script. Losing is fine; losing with nothing to show is not.

---

*Last full refresh: 10 August 2026. Mintek selection applied 14 August 2026. Weekly discovery sweep 17 August 2026 — 3 new entries. Next review: 24 August 2026.*
