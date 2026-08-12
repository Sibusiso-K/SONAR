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
