# Team

**Sibusiso K** · ksibusiso023@gmail.com · [@Sibusiso-K](https://github.com/Sibusiso-K) · repo owner
**Lethabo** · [@LethaboMH14](https://github.com/LethaboMH14) · Write access

Two people. The whole plan is built around that constraint, not around what a six-person team could do.

---

## Standing agreements

1. **Two overlapping builds, maximum.** A third means all three get done badly.
2. **The board is the truth.** If it isn't in `data/hackathons.json`, it doesn't exist. No hackathons live in anyone's head or WhatsApp.
3. **Whoever finds it, scores it.** New find → add to the JSON with a score and a source link, same day.
4. **One owner per deliverable.** Not "we'll both look at the video."
5. **Feature freeze is real.** T-4 days, no exceptions, no "it's just a small thing."
6. **Submit a day early.** Always.
7. **Retro within a week**, win or lose. `templates/retro.md` → `entries/<id>/retro.md`.
8. **Disagree in a PR, not in your head.** Scores especially — if you think BCG shouldn't be number one, change the numbers and say why.

---

## Default split

Adjust per event, but this is the starting point so we don't renegotiate every time.

| Area | Default owner |
|---|---|
| Model / core algorithm / backend | Sibusiso |
| Benchmarking + profiling harness | Sibusiso |
| App layer / UI / integration | Lethabo |
| Written report + README | Lethabo |
| Demo video (storyboard, record, cut) | Lethabo |
| Submission mechanics + deadline watch | Sibusiso |
| Registrations, forms, credential chasing | Sibusiso |
| Board maintenance + Monday review | Both, alternating weeks |

**Swap deliberately.** If Lethabo has never done the quantisation work, do one event where he owns it. The point of a year of hackathons is that both of you can do all of it by December.

---

## Per-event ownership for the August crunch

| Event | Sibusiso | Lethabo |
|---|---|---|
| **ADTC (24 Aug)** | Model selection, quantisation, profiler runs, benchmark table | App/UX layer, RAG over local corpus, report, 2-min video |
| **UNESCO (16 Aug)** | — | Owns it end to end. One evening. |
| **IBM Bob (28–30 Aug)** | Bob agent workflows, prototype | Problem framing, before/after measurement, submission |
| **BCG (apply by 7 Sep)** | Own application | Own application — separately, both of you |

---

## Communication

- **Monday 08:00** — 30-minute board review. Non-negotiable. Run `python3 scripts/sonar.py next`.
- **During a build** — daily 15-minute check-in. What's done, what's blocked, what changed.
- **Blocked more than 2 hours** — say so immediately. Two people can't afford silent blockers.

---

## Repo conventions

**Branches** — `entry/<hackathon-id>` for competition work, `board/<what>` for board and doc changes.

**Commits** — imperative, scoped: `board: add NASA Space Apps`, `adtc: quantise to Q4_K_M`, `docs: correct BCG deadline`.

**Adding a hackathon** — see [`../CONTRIBUTING.md`](../CONTRIBUTING.md). Always: an `id`, four scores, a `confidence` level, a link, and a line in `docs/SOURCES.md`.

**Entry folders** —

```
entries/<hackathon-id>/
├── brief.md          from templates/hackathon-brief.md
├── checklist.md      from templates/submission-checklist.md
├── retro.md          from templates/retro.md
└── src/              or a link out to a separate public repo
```

Competition rules often require a **public** repo (ADTC does). Keep those separate and link them from `brief.md`; don't make SONAR itself public just to satisfy a submission rule.

---

## The honest part

The plan is 10+ events between now and December while job-hunting. That is a lot, and the failure mode is not losing — it's burning out in September and dropping the October events, which are the ones with the actual career payoff (BCG, FNB, RSNA).

So: **early September has one deliberately clear week.** Protect it. If something has to give, it gives from Tier 3 (NASA, Zindi, Space Apps), never from Tier 1.

And keep the artefact discipline. Ten entries with nothing reusable is ten weekends gone. Ten entries that leave you with an on-device inference stack, a shipped app, a Kaggle medal, and two days inside BCG Platinion is a different year entirely.
