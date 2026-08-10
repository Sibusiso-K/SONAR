# SONAR Playbook

How we actually run a hackathon. Written so that neither of us has to re-decide the same thing twice.

---

## The decision gate — before we enter anything

Ask these five. Any "no" that can't be fixed in a day is a drop.

1. **Are we eligible?** Nationality, age, student status, entity registration, team size. Check this *first* — it's what kills entries late.
2. **Do we have the runway?** Count actual free evenings and weekends between now and the deadline, not calendar days.
3. **Does it clash?** Check `docs/CALENDAR.md`. We do not run more than two overlapping builds.
4. **What's the artefact?** If we lose, what do we keep — a model, a component, a deploy pipeline, a shipped app? If the answer is "nothing", the score needs to be very high to justify it.
5. **Who's the audience?** Judges decide. Corporate recruiter judges want polish and a business case. Engineer judges want the benchmark table.

Score it: `python3 scripts/sonar.py score --career 8 --win 6 --prize 7 --urgency 9`

---

## T-minus timeline

### T-14 days — commit
- Register. Just registering surfaces the real rules and gets you on the mailing list.
- Read the rules and the **judging criteria** end to end. Judging criteria are the spec; the problem statement is just flavour.
- Create `entries/<hackathon-id>/` and fill `templates/hackathon-brief.md`.
- Get every credential that needs approval: API keys, sandbox access, GPU credits, trial licences. **This is always the long pole.** MTN MoMo sandbox, IBM Bob trial, ADTC GPU credits — none of them are instant.
- Split roles. See `docs/TEAM.md`.

### T-10 to T-4 — build
- Day one: get an end-to-end skeleton working. Ugly is fine. A thin working path beats a beautiful half.
- Reread the judging criteria at the halfway point. Every time. Teams drift.
- Instrument early if the competition scores performance. ADTC scores 30% throughput and 20% RAM — you can't optimise what you're not measuring on day three.

### T-4 — feature freeze
- Nothing new goes in after this point. Non-negotiable.
- Full run on the target environment, not your dev box.
- If the competition has an official profiler or validator, run it now.

### T-3 to T-1 — the deliverable
This is where most teams lose. The build is maybe 60% of the score.

- **Write-up / report** — problem, constraints, design alternatives you rejected and why, tools and why, benchmarks with numbers, screenshots.
- **Video** — respect the limit exactly. Two minutes means 120 seconds. Structure: problem (15s) → demo (75s) → how it works (20s) → impact (10s). Record the demo separately and cut it in; live narration over a live demo always goes wrong.
- **README** — assume the judge spends 90 seconds. What it is, who it's for, how to run it, what the numbers are.

### T-1 — submit
- **Submit a day early.** Platforms fall over at deadline. If it improves overnight, resubmit.
- Verify the submission actually landed: reload the submission page in a private window.

### T+7 — retro
- 20 minutes, `templates/retro.md`, into `entries/<id>/retro.md`. Same week, while it still stings.

---

## What actually wins

**Read the scoring formula literally.** ADTC: `0.50·accuracy + 0.30·throughput + 0.20·efficiency − 10 thermal`. Half the marks are not model quality. Most entrants will chase accuracy and lose 50% of the score to a team running a 1.5B model at 25 tok/s in 4GB. Optimise what's measured.

**Narrow beats broad.** One workflow solved completely beats five gestured at. IBM's brief says "improve a specific developer workflow" — pick onboarding onto a legacy codebase and do only that.

**Show the before/after number.** "Reduced onboarding time from 4 hours to 25 minutes on a 200k-line RPG codebase" beats any adjective.

**Name the constraint you designed around.** Judges — especially at ADTC, Mintek and GovTech — are looking for evidence you understood the operating context. 8GB RAM. Loadshedding. No fibre. Say it explicitly.

**Don't hide the limitations.** A stated limitation reads as engineering maturity. A discovered one reads as sloppiness.

**Local context is a genuine edge.** ADTC has a $1,500 "Best African Use Case" prize. FNB's themes are all SA social problems. You have real ground truth here that overseas entrants are guessing at. Use it — specifically, not as a slogan.

---

## Anti-patterns we've agreed to avoid

| Don't | Instead |
|---|---|
| Start with architecture | Start with a working end-to-end path, then refactor |
| New framework on hackathon week | Use what you already know cold |
| Leave the video to the last 2 hours | Storyboard at feature freeze, record at T-2 |
| Submit at the deadline hour | Submit a day early, improve, resubmit |
| Both work on the same file | Clear ownership split — see TEAM.md |
| Enter because it's there | Score it. Below 5.0 with no reusable artefact, skip it |
| "We'll read the rules later" | Rules at T-14, judging criteria twice |
| Optimise accuracy when the formula is 50% speed | Read the formula |

---

## Reusable assets — the compounding play

The point of doing 10 hackathons instead of 1 is that entry *n* should be cheaper than entry *n−1*. Every entry contributes to `entries/_shared/`:

- **On-device inference stack** (ADTC) → reusable for RSNA efficiency track, any edge-AI brief
- **Quantisation + profiling harness** (ADTC) → reusable for RSNA, Zindi
- **Mobile app shell + payments** (Shipaton) → reusable for MTN MoMo, FNB
- **Pitch deck template** → reusable everywhere
- **Demo video template** (intro card, captions, outro) → reusable everywhere
- **README template with a benchmark table** → reusable everywhere

Before starting anything new, check what's already in `_shared/`.

---

## Per-event notes

**ADTC** — the profiler is the referee. Run it constantly. OOM on 8GB is instant disqualification, so test on a memory-constrained target, not your dev machine. Thermal throttling above 85 °C costs 10 points flat.

**IBM Dev Day** — attend the 27 August enablement session. It's explicitly hackathon prep and it tells you what the judges want. Top 50 teams get passes, so *finishing well* matters more than *winning*.

**BCG Platinion** — this isn't a normal hackathon, it's a recruiting event with a hackathon attached. You apply individually with a CV and motivation letter, and teams form on-site. Optimise the application, not a project. Then on the day, optimise for how you work with strangers — that's what's actually being assessed.

**Shipaton** — the constraint is app-store review, not code. Submit to the stores by mid-September.

**Kaggle (RSNA)** — different game entirely. Public notebooks, a strong baseline, and careful cross-validation. Read the discussion forum daily. Do not chase the public leaderboard; it will shake up.

**FNB / GovTech / Mintek** — SA corporate and government judging panels. Business case, feasibility, and social impact carry real weight alongside the tech. Bring a slide on how it would actually be deployed and paid for.
