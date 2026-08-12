# SONAR — things worth building

Written 2026-08-12, grounded in what's actually in the repo. Each entry says
what it exploits and roughly what it costs, because a list without cost
signal is just a wishlist.

**The filter used throughout:** does it change a decision the two of you
actually make? A chart nobody acts on is decoration, and this board already
learned that lesson the expensive way.

---

## The three I'd build first

### 1. Make the evidence chain visible
**Exploits:** `evidence[]`, `snapshots`, `observations` (27 rows already) ·
**Cost:** ~half a day

The most distinctive thing about this project — every date traces to a
literal quoted span, verified against a stored snapshot — is completely
invisible in the UI. Nothing on the site shows it.

Click any date → a panel showing the exact sentence it came from, the source
URL, the snapshot SHA, when it was verified, and by which model. For
`unconfirmed` entries, show what's *missing* instead.

Why first: it's the project's whole thesis, it's already computed and stored,
and it costs nothing new to collect. It also turns the board into something
you can show someone — "every claim here has a receipt" is a genuinely rare
thing to be able to demonstrate.

### 2. "Can we build this?" — capability match
**Exploits:** `data/team_profile.json` (25 repos across both accounts) ·
**Cost:** ~half a day

Score every opportunity against what you've *demonstrably shipped*, not what
you'd like to think you can do. The profile already shows an unusual, specific
specialty: **six repos in multi-agent AI** (`apex-trading-organism`,
`Agent-Guardian`, `immunis-acin`, `unified-intent-amplifier`,
`Stokup-Restok-Agent`, `Ai-middleman`).

That maps directly onto live board entries nobody is flagging:
- **IBM Dev Day** literally asks for "Agent mode, parallel tasks, subagents"
- **ADTC** wants on-device LLM apps

Those two should be screaming at you and currently rank by deadline like
everything else. Honest and computable today — unlike win probability, which
needs outcomes you don't have.

### 3. Observation → PR bot
**Exploits:** the whole existing pipeline · **Cost:** ~1 day

The missing link in the autonomy story. Verified observations sit in Supabase
and a human has to notice them. Instead: a nightly job takes span-verified
observations, drafts the `data/opportunities.json` change, and opens a PR with
the quoted evidence in the body. You click merge.

That closes the loop from "something changed on the internet" to "the board
knows", with a human review gate that costs 30 seconds instead of an hour.

---

## Cheap wins, buildable with what's already there

4. **Prize-per-hour ranking.** Expected value ÷ observed prep window = an
   hourly rate. Brutal, clarifying, and it reframes "R12,500 prize" as "R390/hr
   for two people over a weekend". Uses `observed_velocity` + existing EV maths.

5. **Deadline collision → resolution proposal.** `/stats` already detects
   clashes. Go further: recommend which to drop, with reasons ("lower EV,
   weaker capability match, and it recurs annually — skip this year").

6. **Confidence decay.** A "confirmed" date verified 40 days ago deserves less
   trust than one verified yesterday. Age-weight it, and let the re-verify
   queue sort by staleness × proximity to deadline.

7. **Snapshot diffing.** Snapshots are already SHA'd. When a watched page
   changes, show the actual diff. *"Devpost changed the paragraph containing
   the deadline"* is the single highest-value alert this system can produce.

8. **Click a globe marker → open the opportunity.** The globe shows but
   doesn't route. Tiny fix, obvious value.

9. **Great-circle arcs from Johannesburg**, weighted by urgency. Turns "where
   is it" into "how far, how soon" — the actual question for a two-person team.

10. **Travel cost vs prize.** For in-person events, a rough flight +
    accommodation estimate against the prize pool. A Cape Town event and a
    Sandton event with identical prizes are not identical opportunities.

11. **`/sources` route.** Show the watchlist itself: which orgs are monitored,
    when each was last swept, what each yielded. `v_source_yield` already
    computes it. Makes the autonomy visible instead of invisible.

12. **Deep-linkable `/stats` sections** (`#collisions`, `#lag`) so the
    assistant can cite a specific chart instead of describing it.

13. **Per-opportunity detail route.** The old static site had `/o/$id`; the
    rebuild dropped it. It's where evidence, prep ladder and the linked build
    repo belong.

---

## Learning from your own history

14. **"We already built this" matcher.** When a new brief lands, match it
    against all 25 repos and surface the overlap: *"this ADTC on-device LLM
    challenge overlaps `immunis-acin`'s adversarial architecture and
    `Ai-middleman`'s routing layer."* Reuse is how a two-person team wins;
    right now that knowledge lives only in your heads.

15. **Idea provenance graph.** Link retros → repos → opportunities, so you can
    see *"this component has been reused three times and appeared in two
    placings."* Needs retros filled in.

16. **The regret log.** Track what you *skipped* and what happened to it. Did
    something you passed on get won by an idea you could have built? This is
    the only mechanism that calibrates judgement rather than just recording it.

17. **The apply-then-practise play, formalised.** Gradhack's known-good
    sequence was: submit the idea (Vuka, 15 Jul) → practise-build (BEACON,
    24–27 Jul) → compete (7 Aug), Top 6. That's a repeatable play with a real
    outcome attached. Detect when an opportunity fits its shape and propose the
    same schedule.

18. **Discovery-lag post-mortem, automated.** When something is found late,
    compute the lag and identify which watched source *should* have caught it
    — then either fix that source or admit it doesn't cover this.

---

## Autonomy the design doc promises but nothing does yet

19. **Announcement-window escalation.** When a prediction window opens, sweep
    that org every 6h instead of weekly. Designed already; needs a second
    edition per event to produce windows.

20. **Calendar sync with the prep ladder.** Not just the deadline — the work
    blocks generated backwards from it, sized to observed velocity, with a
    buffer the planner refuses to fill. When a date moves, the whole ladder
    moves. (`data/calendar_events.json` and `docs/CALENDAR.md` exist; nothing
    has ever written to a calendar.)

21. **Urgency-routed notifications.** ≤7 days → push. ≤21 → daily digest.
    Otherwise weekly. Currently: nothing notifies anything.

22. **Alumni backlink discovery** (Tier E in `AUTONOMY.md`). Whoever links to a
    known hackathon page is often running or listing another one. Cheap way to
    grow the watchlist beyond hand-curation.

23. **Bright Data behind the yield gate.** `v_source_yield.cost_per_commit`
    already exists to decide whether a paid source earns its keep — it just has
    no paid source to judge yet. Wire Bright Data in *behind* that gate, not
    in front of it.

24. **AIsa for what Groq physically can't do.** Groq has no web access. AIsa's
    value is its X/Twitter + Perplexity + Tavily endpoints, not its models.
    Spend the $5 only there; keep bulk extraction on Groq's free tier.

---

## The assistant, made genuinely useful

25. **Give it tools, not a context blob.** Let it query the board and call the
    analytics functions directly, so *"what should we drop this week"* is
    answered from live collisions, EV and capability match — with citations.

26. **Devil's advocate mode.** Make it argue *against* entering something. Your
    scarcest resource is weekends; something in the system should defend them
    rather than cheerlead.

27. **Brief → idea angles, grounded in your repos.** Not generic ideation —
    "here are three angles on this brief that reuse code you've already
    written", with the repo links.

28. **Submission scaffold generator.** On the day you commit to an event,
    generate the repo skeleton, README structure and a checklist derived from
    that opportunity's actual `deliverables` field.

---

## Bigger bets, worth considering later

29. **Exam-calendar overlay.** SA university exam periods against hackathon
    dates. A hackathon during finals is a materially different proposition and
    nothing currently models that.

30. **Team availability model.** Feed in known-busy periods; the planner
    refuses to commit to an overlapping window instead of letting you discover
    the clash on the Friday.

31. **Public receipts page.** Every claim on the board, with source, timestamp
    and verbatim quote. Would be a genuinely impressive portfolio artifact on
    its own — and it's mostly just a view over data you already store.

32. **Win-probability model — but only at ~5–8 recorded outcomes.** You have
    one. Fitting anything to n=1 produces invented confidence, which is the
    exact failure this project exists to prevent. The unlock is
    `data/retros.json`, not more code.

---

---

# Round 2 — killing the "it's all static" feeling

The complaint that prompted these: *the page still shows static info.* Fair —
and worth separating into two causes, because they need different fixes.

**Cause A: the data wasn't arriving.** Addressed — see the `app` schema in
`docs/HANDOVER_SBU.md`. Two env vars and the board is live again.

**Cause B: even with fresh data, the page doesn't feel alive.** Everything on
it is a value rendered once. Nothing moves, nothing reacts, nothing tells you
it just changed. These fix that.

### Make it visibly live

33. **Realtime subscriptions.** Supabase ships Postgres realtime and the
    client is already installed. Subscribe to `app.opportunities` and
    `app.updates`; when the pipeline writes, the page updates *without a
    refresh*, with a brief highlight on the row that changed. This single
    change is the difference between "a website" and "an instrument". ~2h.

34. **Ticking countdowns.** `days_remaining` is computed once at render. Under
    7 days it should count **hours and minutes, live**, and go red inside 24h.
    The ADTC cutoff being 08:45 SAST rather than 23:45 PDT is exactly the kind
    of thing a static "13d" hides. ~1h.

35. **"Changed since you last looked."** Store a last-seen timestamp locally;
    badge anything whose `updated_at` is newer. Turns the board into something
    you *check* rather than re-read.

36. **Live pipeline status strip.** A thin bar: last sweep time, pages
    fetched, candidates found, span-check pass rate, next scheduled run. All
    of it already exists in `pipeline_runs` and `v_hallucination_rate` — and
    it makes the autonomy something you can *watch* instead of trust.

37. **Optimistic watchlist stars.** Star toggles should respond instantly and
    reconcile after, not wait on a round trip.

### Make it react to you

38. **Command palette (⌘K).** Jump to any opportunity, filter by kind,
    trigger a re-verify, ask the assistant. `cmdk` is already a dependency.

39. **Inline editing with an audit write.** Fix a typo or a date directly on
    the card; it appends to `app.updates` with your name on it. The audit
    trail stops being a thing the pipeline writes *at* you.

40. **Saved views.** "Tier 1 only", "closing this month", "direct hiring
    routes", "matches our stack". One click each, shareable by URL.

41. **Keyboard-first triage.** `j`/`k` to move, `w` to watch, `x` to dismiss,
    `?` for help. Two people triaging 16+ opportunities weekly should never
    need the mouse.

### Make the globe an instrument

42. **Auto-rotate to the next deadline** on load, then stop on interaction.
    The globe currently opens on an arbitrary angle.
43. **Pulse rings on urgent markers**, tempo scaled to urgency — a heartbeat
    that gets faster as a deadline closes.
44. **Day/night terminator overlay.** Genuinely useful for online events with
    a foreign submission cutoff: you can *see* that ADTC's 23:45 PDT is your
    breakfast.
45. **Marker clustering + zoom-to-fit** on the SA cluster, which is where the
    travel-cost decisions actually are.

### Make the numbers earn their place

46. **Sparkline per opportunity** — how its confidence and score have moved
    since discovery. `observations` already has the timestamps.
47. **"Why this score?" popover.** Break the composite into its four weighted
    parts with the formula visible. A score you can't interrogate is a vibe.
48. **Board-level burndown** — committed hours vs. hours remaining before the
    next deadline, against observed velocity. Answers "are we over-committed?"
    which is the question a two-person team gets wrong most often.
49. **Cost-per-commit ticker.** `v_source_yield` computes it; nothing shows
    it. Watching a paid source fail to earn its keep is what keeps the bill
    honest once Bright Data is on.

### Small things with outsized effect

50. **Empty states that teach.** "No forecasts yet — every event has 1 prior
    edition, forecasting needs 2. Here's which years to find." The board
    should explain its own silences rather than showing a blank chart.
51. **Stale-data banner.** If the newest `updates` row is older than the
    expected sweep interval, say so at the top. The failure that wasted days
    was invisible staleness — never let that hide again.
52. **Diff view on the Updates page.** Show what actually changed field by
    field, not just prose.
53. **Print/PDF board.** For a Monday review away from a screen.
54. **PWA + push.** Installable, with deadline notifications. The manifest
    already existed on the old static site.

---

## What's blocking the most value right now

Not code. Two research tasks and one credential:

1. **A second dated edition per recurring event.** Forecasting is written,
   tested and correctly silent because every event has one edition. One real
   2025 Gradhack date produces a watch window opening **6 June 2027**.
2. **Fill in `data/retros.json`.** The Gradhack entry is a skeleton of nulls.
   Nothing can infer what cost you time or why the idea was chosen — and
   without ~5 of these, items 15, 16 and 32 stay impossible.
3. **`RADAR_SUPABASE_*` secrets** (see `docs/HANDOVER_SBU.md`) — until then
   none of this reaches the live site anyway.
