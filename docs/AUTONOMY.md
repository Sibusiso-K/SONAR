# SONAR v2 — Autonomous Design

**How SONAR stops being a file two people maintain and becomes a system that finds, verifies, schedules and warns on its own.**

Written 10 August 2026. This is a design document, not a build. Nothing here is running yet.

---

## 0. Two things the research turned up while writing this

Both are live board items. Fix these before reading the rest.

**1. Discovery Gradhack 2026 already happened — 7 August 2026, at Discovery Place, Sandton.**
The README lists it as a "loose end: find the dates, score it, add it." That window closed three days ago. Format was 50 IT students from SA universities, teams of 2–4, free entry, R12 500 per winning team member, and a permanent-employment track at Discovery. The empty Google Calendar named *"Discovery Gradhack -Team Sonar- 2026"* was the only warning, and nothing was watching it early.

**Correction, logged 11 Aug 2026:** this was originally recorded here as missed entirely. It wasn't — the team made the deadline and competed, placing Top 6 (`data/hackathons.json`, `dropped_or_past`). The underlying failure this section exists to describe still happened — discovery was late, and the only warning was an empty calendar nobody filled in — but the outcome was good, not lost. Move it to `dropped_or_past` with a `result` of `"Top 6"`, not a missed reason, and log it in the first retro. Discovery runs this annually; set a predicted-window watch for ~August 2027 (see §7.4).

**2. ADTC — the prize conflict is settled; a possible second stage is not.**

First, credit where it's due. `docs/SOURCES.md` ruled that the press's *"$20,000+"* was double-counting GPU credits against Devpost's itemised `$16,500`. That call is now **arithmetically confirmed**:

```
grand 8000 + second 4000 + third 3000 + best_african_use_case 1500  = 16,500   ← Devpost cash
finalist 10×$250 + semifinalist 20×$50                              =  3,500   ← GPU credits
                                                                      ───────
                                                                       20,000   ← press figure
```

Both numbers are right; they describe different things. No action needed — and the six-month residency is already captured in `prize.non_cash`. The board is in better shape here than a skim suggests.

**What is still open is the deadline, and it may be structural.** Press said 25 Aug, Devpost says 24 Aug 23:45 PDT, and we went with Devpost. Current sources still say **25 August** — and one describes it as a *"first-stage deadline"* for *"initial proposals"*, which suggests a **multi-stage competition** that the board models as a single submit-once event.

Going with Devpost's earlier date remains right: submitting a day early is free. But *"is there a stage 2 we haven't planned for?"* is worth ten minutes on the ADTC page before the 24th. If there is, the whole prep ladder after 24 Aug changes shape. This is exactly what `stages[]` in §5 exists to model.

Sources: [TechAfrica News](https://techafricanews.com/2026/07/30/africa-deep-tech-foundation-launches-2026-laptop-llm-challenge/) · [Opportunities for Youth](https://opportunitiesforyouth.org/2026/07/27/africa-deep-tech-challenge-2026-win-up-to-8000-by-building-offline-ai-that-runs-on-everyday-laptops-across-africa/) · [africadeeptech.org](https://africadeeptech.org/challenge-2026/) · [Discovery Gradhack](https://www.discovery.co.za/corporate/discovery-gradhack) · [Gradhack FAQ 2026 (PDF)](https://www.discoverygreen.co.za/assets/microsites/gradhack/gradhack-faqs.pdf)

---

## 1. What v1 got right, and the four things it can't do

The v1 repo is a genuinely good foundation and v2 keeps its spine. Specifically worth preserving:

- `hackathons.json` as single source of truth, with docs downstream of it
- Every claim carries a source link (`docs/SOURCES.md`)
- A `confidence` field that already distinguishes confirmed / reported / unconfirmed
- A recorded conflict log with reasoning
- Disagreements resolved in PRs, not in someone's head

That last set is the hard part of an autonomous system, and it's already there in manual form. v2 is mostly **mechanising discipline that already exists** rather than inventing new discipline.

Four gaps:

| Gap | Consequence |
|---|---|
| **Nothing runs.** `monitoring_sources` has cadences, but no executor. | Discovery Gradhack. Every source is checked only when someone remembers. |
| **No change detection.** Dates are read once and frozen. | If an organiser moves a deadline, the board is confidently wrong and nobody finds out. |
| **The calendar is a dead artefact.** `.ics` is generated once and imported by hand, from a *second* hand-maintained file (`calendar_events.json`). | Violates the repo's own "JSON is the only source of truth" rule. Re-importing creates duplicates. |
| **Discovery is aggregator-only.** Devpost, Kaggle, Zindi et al. | Misses exactly the niche, local, and corporate events with the best odds for a 2-person SA team — the ones announced on a LinkedIn post or a university events page and nowhere else. |

---

## 2. The design principle everything else follows from

> **The model is never the source of truth for a fact. It is a reader that must quote its sources, and a judge that must show its reasoning.**

A hallucinated deadline written to a calendar is worse than an empty calendar, because it is trusted. So every fact in v2 carries provenance and every date passes a deterministic check before it can reach a committed calendar.

Three rules that fall out of this, and are non-negotiable in the build:

1. **Extract, don't infer.** The model returns the *literal quoted span* it read a value from. Code then asserts that span actually appears in the stored snapshot. If it doesn't, the extraction is rejected — no retry, straight to human review. This is a cheap deterministic check on a probabilistic output, and it catches the failure mode that matters.
2. **Code does date maths, never the model.** The model returns `"submissions close Friday 25 August at 23:45 PDT"` as a string. Python parses it, converts to SAST, and computes days-remaining. Language models are unreliable at timezone arithmetic; `zoneinfo` is not.
3. **Two independent sources, or one official one, before anything hits a committed calendar.** Everything else lands on a visually distinct *Radar* calendar as `tentative`. Unverified information is never allowed to look verified.

---

## 3. Pipeline architecture

Ten stages. Each writes to disk and is independently re-runnable — a failure in stage 6 never costs you stage 3's network spend.

```
┌── S0  REGISTRY ──────── typed source list: adapters, cadence, cost class, trust rank
│
├── S1  SWEEP ─────────── broad + cheap. adapters, RSS, SERP fan-out, social
│                         → candidate URLs                        [no LLM]
├── S2  TRIAGE ────────── hackathon? relevant? new?
│                         kills ~90%                              [Haiku 4.5, batch]
├── S3  HARVEST ───────── full fetch of survivors, content-addressed snapshot
│                         → evidence/<sha256>.md                  [no LLM]
├── S4  EXTRACT ───────── snapshot → structured record + quoted spans
│                         → candidate record                      [Sonnet 5, cached]
├── S5  VERIFY ────────── span assertion, date sanity, corroboration,
│                         conflict detection, precedence          [rules + Opus 5]
├── S6  SCORE ─────────── career / winnability / prize / urgency + new axes
│                         → tier                                  [Sonnet 5]
├── S7  PLAN ──────────── backward prep ladder from the deadline
│                         → prep blocks                           [rules + Sonnet 5]
├── S8  SYNC ─────────── idempotent upsert → Google Calendars     [no LLM]
├── S9  NOTIFY ────────── P0 instant / P1 digest / P2 Monday brief
└── S10 AUDIT ────────── run record, field-level diff, PR for low confidence
```

**Why staged rather than one big agent:** cost, debuggability, and blast radius. A single agent loop re-reasons about everything on every run and you cannot tell why it did something. Staged, the expensive model only sees the ~8% of candidates that survive triage, every stage is independently testable, and a bad extraction can't corrupt the calendar because stage 5 sits between them. The one genuinely open-ended job — chasing the long tail — is where an agent *does* belong (§8.4).

---

## 4. Sources — the avenues, ranked by yield per rand

Ordered deliberately. **Exhaust the cheap, legally clean layers before spending on social scraping.** Most SA hackathons that appear on Instagram are also in a press release with an RSS feed.

### Tier A — structured, free, deterministic (no LLM, no scraping)
Devpost, Kaggle, Zindi, Unstop, HackerEarth, MLH, DoraHacks, Taikai, lablab.ai, Hack2Skill — platform listings, several with JSON endpoints or predictable pagination.
Plus RSS from the SA/Africa tech press that actually breaks this news: **ITWeb, TechCentral, Ventureburn, Disrupt Africa, Techpoint Africa, MSME Africa, Opportunities for Youth, Opportunity Desk**.

> Empirical note: ADTC was surfaced in this research by *Opportunities for Youth* and *MSME Africa* — two feeds not currently in `monitoring_sources`. The cheap layer works.

### Tier B — the organisation watchlist (highest leverage in the whole design)
**Stop searching for events. Watch the ~80 organisations that run them.** Keyword search finds what's already indexed and popular; watching an org's careers page, news page, and LinkedIn feed catches the announcement on day one — which is the whole game for events with capped intake like Gradhack's 50 seats.

- **Banks & insurers** — FNB, Absa, Standard Bank, Nedbank, Capitec, Discovery, Old Mutual, Sanlam, TymeBank
- **Telcos** — MTN, Vodacom, Telkom, Rain
- **Consultancies & software houses** — BCG (Platinion), McKinsey, Deloitte, EY, PwC, Accenture, Entelect, BBD, DVT, Synthesis, Dariel
- **Universities** — Wits, UCT, UP, UJ, Stellenbosch, UKZN, NWU, TUT, CPUT, DUT, UWC, Rhodes, NMU, Sol Plaatje, VUT, CUT
- **State & research** — SITA, CSIR, Mintek, SANSA, Eskom, Transnet, SARS, MICT SETA, Innovation Hub
- **Community & training** — Geekulcha, GirlCode, Zindi, Umuzi, WeThinkCode, Explore-AI, CodeSpace, Digital Academy
- **International labs & platforms** — Anthropic, OpenAI, Google, Meta, IBM, NVIDIA, Hugging Face, RevenueCat, Kaggle

Each entry gets: careers page, news/press page, events page, LinkedIn slug, and an expected-season hint from prior years.

### Tier C — SERP fan-out
A generated dork matrix through Bright Data's SERP API:

```
{hackathon, datathon, ideathon, makeathon, buildathon, code challenge,
 innovation challenge, case competition, capture the flag, CTF, grad programme challenge}
  × {South Africa, Johannesburg, Cape Town, Durban, Pretoria, Gauteng, Africa, online, remote}
  × {2026, 2027, "applications open", "register now", "call for"}
  × site: filters over the Tier-B domains + .ac.za
```

Run monthly-rotating slices rather than the full cross-product; dedupe hard against known URLs.

### Tier D — social (LinkedIn, Instagram, Facebook, TikTok, X)
Last, because it is the most expensive per useful find and the noisiest. Two things make it worth doing at all:

- **LinkedIn is where SA corporates actually announce.** Discovery's Gradhack 2026 announcement was a LinkedIn post. Entelect's University Cup only has a LinkedIn source in v1 already.
- **Instagram and Facebook announcements are usually flyers, not text.** This needs an OCR/vision path, not a text scraper — the date is pixels inside a JPEG. Claude's vision handles this natively (high-resolution tier, 2576px long edge), so the poster goes straight into the extraction step as an image block. Worth building; it's a real blind spot in every text-only hackathon tracker.

### Tier E — the alumni backlink trick
Find last year's *winners'* posts ("thrilled to have won…"). They tag the organiser and the event. That resolves to the event page, which usually links this year's edition. Catches events that never rank for any keyword you'd think to search.

---

## 5. Data model v2

Additive — every v1 field stays, so `sonar.py` keeps working while v2 is built alongside. Machine-readable version at [`schema/hackathon.schema.json`](../schema/hackathon.schema.json).

```jsonc
{
  "id": "adtc-2026",
  "name": "Africa Deep Tech Challenge 2026 — The Laptop LLM Challenge",

  // ── v1 fields, unchanged ────────────────────────────────
  "organiser": "...", "scope": "continental", "format": "online",
  "status": "open", "tier": 1, "score": 7.65, "scores": { ... },
  "dates": { ... }, "prize": { ... }, "eligibility": "...",
  "team_fit": "...", "what_to_build": "...", "deliverables": [ ... ],
  "links": { ... }, "notes": "...",

  // ── NEW: what the user actually needs on the calendar ───
  "tracks": [
    { "name": "Agriculture", "description": "...", "prize": 1500,
      "our_fit": "high", "chosen": true }
  ],
  "challenges": [
    { "title": "Offline inference under 8GB RAM", "statement": "...",
      "judging_weight": 0.30 }
  ],
  "stages": [                                   // ← would have caught the ADTC ambiguity
    { "name": "Initial proposal", "opens": "...", "closes": "2026-08-24T23:45-07:00",
      "deliverable": "proposal + repo", "confidence": "confirmed" },
    { "name": "Build phase", "closes": null, "confidence": "unconfirmed" }
  ],

  // ── NEW: money, properly modelled ───────────────────────
  "prize": {
    "currency": "USD", "pool": 16500, "pool_disputed": 20000,
    "breakdown": [ { "place": "grand", "amount": 8000 } ],
    "non_cash": [
      { "type": "residency", "value_est": null,
        "description": "6-month scale-up residency: mentorship, commercialisation, investors" },
      { "type": "compute_credits", "value_est": 3500 }
    ],
    "zar_equivalent": 297000, "fx_rate_date": "2026-08-10"
  },

  // ── NEW: provenance. one entry per extracted field ──────
  "evidence": [
    { "field": "stages[0].closes",
      "value": "2026-08-24T23:45-07:00",
      "quoted_span": "Submissions close August 24, 2026 at 11:45pm PDT",
      "source_url": "https://adtc-2026.devpost.com/",
      "source_trust": "submission_platform",
      "snapshot_sha": "9f2a...", "extracted_at": "2026-08-10T04:12:00Z",
      "model": "claude-sonnet-5" }
  ],

  // ── NEW: the verification state machine ─────────────────
  "verification": {
    "status": "conflicted",              // confirmed | corroborated | reported
                                         // | unconfirmed | predicted | conflicted
    "last_checked": "2026-08-10T04:12:00Z",
    "next_check": "2026-08-11T04:00:00Z",
    "check_interval_hours": 24,          // shrinks as the deadline approaches
    "corroborating_sources": 3,
    "conflicts": [
      { "field": "stages[0].closes",
        "values": [ { "v": "2026-08-24", "src": "devpost", "trust": 2 },
                    { "v": "2026-08-25", "src": "press",   "trust": 4 } ],
        "resolution": "devpost", "rule": "submission_platform_wins_on_deadlines",
        "adjudicated_by": "claude-opus-5", "human_ack": false }
    ]
  },

  // ── NEW: eligibility as data, not prose ─────────────────
  "eligibility_check": {
    "age_range": [18, 30], "nationality": ["any"], "student_required": false,
    "team_size": [1, 3], "entity_required": null,   // ← the GovTech EME/SMME trap
    "we_qualify": true, "blockers": []
  },

  // ── NEW: planning + lifecycle ───────────────────────────
  "effort_estimate_hours": 45,
  "prep_plan": [ { "block": "model selection", "starts": "...", "hours": 8, "owner": "sibusiso" } ],
  "lifecycle": "committed",   // discovered → triaged → verified → scored
                              // → committed → submitted → judged → retro_done
  "calendar_sync": {
    "events": { "deadline": "sonarADTC2026DEADLINE", "prep": [ "..." ] },
    "last_synced": "2026-08-10T04:20:00Z", "drift_detected": false
  },
  "history": [ { "year": 2025, "dates": {...}, "winner_profile": "..." } ]
}
```

Two fields carry disproportionate weight:

- **`stages[]`** — modelling a competition as one deadline is why the ADTC multi-stage question is invisible today.
- **`history[]`** — enables prediction (§7.4). Sbu already does this reasoning manually for Mintek, Huawei, Entelect and Geekulcha; this makes it executable.

---

## 6. Verification — the part that has to be right

### 6.1 Deterministic gates (free, run first, no model)

Cheap checks kill most bad extractions before an expensive model is ever consulted:

| Gate | Rejects |
|---|---|
| **Span assertion** | `quoted_span` not found verbatim in the snapshot → hallucinated. Hard reject. |
| **Chronology** | `registration_close > submission_deadline`, `event_end < event_start` |
| **Horizon** | Date in the past, or >18 months out |
| **Timezone present** | A deadline with no TZ is not a deadline. ADTC's cutoff is 08:45 SAST *the next morning* — that distinction has won and lost competitions. |
| **URL liveness** | Source 404s or redirects to a generic homepage → downgrade confidence |
| **Prize plausibility** | Currency parses, magnitude sane, no `$16,500,000` typo |
| **Schema validity** | JSON Schema check before write |

### 6.2 Corroboration and the trust ladder

Confidence is computed, never asserted by a model:

| Rank | Source class | Example |
|---|---|---|
| 1 | Organiser official page | `africadeeptech.org`, `bcgplatinion.com` |
| 2 | Submission platform | Devpost, Kaggle, Unstop |
| 3 | Official social account | organiser's own LinkedIn post |
| 4 | Established press | ITWeb, TechCentral, Techpoint |
| 5 | Aggregator / opportunity blog | MSME Africa, AllHackathons |
| 6 | Community / unattributed social | random TikTok |

```
confirmed     rank-1 source, span-verified, all gates pass
corroborated  ≥2 independent sources at rank ≤4 agreeing
reported      single source at rank 3–5
unconfirmed   rank 6, or organiser page exists but is silent on the field
predicted     no source; extrapolated from history[] (§7.4)
conflicted    sources disagree beyond tolerance → adjudication
```

**Only `confirmed` and `corroborated` reach the committed calendars.** Everything else goes to Radar as `tentative`.

Tie-break rules, applied in order, deterministic before any model is asked:
1. Deadlines → the **submission platform** wins (that's the clock that actually closes). This is Sbu's existing ADTC ruling, now codified.
2. Eligibility / rules → the **organiser page** wins.
3. Prize amounts → the **itemised** figure beats a headline figure (press aggregates credits into cash).
4. Still ambiguous → escalate to Opus 5, which must write a one-paragraph justification into `conflicts[].rule`.
5. Any unresolved conflict on a **committed** entry → P0 alert. Humans decide.

### 6.3 Change detection

Every source is stored content-addressed. On each re-check: hash the fresh fetch, compare to `snapshot_sha`.

- Hash unchanged → **skip extraction entirely.** This is the main cost control; most re-checks cost one HTTP request and no tokens.
- Hash changed → re-extract, diff field by field.
  - Cosmetic change → update snapshot, no alert.
  - **Any date field changed on a committed entry → P0 alert, immediately.** This is the single highest-value alert in the system.
  - Prize / eligibility changed → P1, and re-score.

### 6.4 Verification frequency scales with stakes

Uniform polling is both wasteful and too slow where it matters:

| Entry state | Re-check |
|---|---|
| Committed, T-7 or less | every 12h |
| Committed, T-30 to T-7 | daily |
| Tier 1, T-90 to T-30 | every 3 days |
| Tier 2–3, open | weekly |
| Monitor / predicted | weekly, rising to daily inside the predicted announcement window |
| Past / dropped | never |

---

## 7. What the system does with verified facts

### 7.1 Scoring
Keep the v1 formula exactly — it encodes real judgement and shouldn't be quietly replaced:

`score = 0.35·career + 0.30·winnability + 0.20·prize + 0.15·urgency`

Changes: sub-scores get written **rubrics** so a model can propose them reproducibly, each proposal carries a one-line justification, and **the model never commits a score change on a committed entry without human ack**. Add three inputs that are currently implicit:

- **`effort_cost`** — estimated hours. Prize per hour matters when there are two of you.
- **`reusability`** — does this produce an artefact reusable in the next event? (Already Ground Rule 4; make it scoreable.)
- **`collision`** — overlap with existing commitments (§7.3).

### 7.2 Prep planning — "prepare way before the event"
For each committed entry, generate a backward ladder from the deadline. Templates by event type:

```
Kaggle/ML    T-30 baseline · T-21 feature freeze · T-14 ensemble
             T-7  efficiency pass · T-3 final submit · T-1 buffer
Build/ship   T-30 scaffold+auth · T-21 core loop · T-14 monetisation
             T-10 store submit (review lag!) · T-5 video · T-2 buffer
Application  T-21 CV refresh · T-14 draft letter · T-7 review · T-3 submit
On-site      T-14 logistics/travel · T-7 stack rehearsal · T-2 kit check
```

Blocks are written to the Prep calendar, sized against declared availability, and **automatically rescheduled if a deadline moves**. Ground Rule 6 ("submit a day early") becomes a hard T-1 buffer block the planner never fills.

### 7.3 Capacity enforcement
TEAM.md Standing Agreement 1 says *max two overlapping builds*. Make it executable: when a new Tier-1 find overlaps two existing commitments, the alert doesn't just say "new find" — it says **"this collides with ADTC and Shipaton; on score, drop Shipaton"**, and requires an explicit choice. A rule nothing enforces is a rule that gets broken in a crunch.

### 7.4 Prediction for unannounced editions
For any entry with ≥2 prior editions in `history[]`, compute the historical announcement→event lead time and the seasonal window. Then:

- Create a `predicted` entry with a date *range*, on the Radar calendar only, clearly labelled
- Escalate re-check cadence to daily starting 3 weeks before the predicted **announcement** date
- Alert the moment a real source appears

This turns "Discovery runs Gradhack every August" from tribal knowledge into a watch that fires. It is the direct fix for finding #1.

---

## 8. Models — what runs where, and why

Pricing below is Anthropic first-party, current as of writing.

| Model | Input / Output per MTok | Context |
|---|---|---|
| `claude-opus-5` | $5 / $25 | 1M |
| `claude-sonnet-5` | $3 / $15 — **$2 / $10 intro through 2026-08-31** | 1M |
| `claude-haiku-4-5` | $1 / $5 | 200K |
| `claude-fable-5` | $10 / $50 | 1M |

### 8.1 Routing

| Stage | Model | Why |
|---|---|---|
| **S2 Triage** | `claude-haiku-4-5` + **Batch API** | Thousands of short binary calls. Cheapest capable model, and batch halves it. Recall matters more than precision here — a false positive costs one extraction; a false negative loses a hackathon. Tune the prompt to over-include. |
| **S4 Extract** | `claude-sonnet-5` + prompt caching + structured outputs | The workhorse. Long inputs (full page markdown, or a flyer image), schema-constrained output. Sonnet 5 is near-Opus on this kind of extraction at a fraction of the cost, and intro pricing makes it near-free right now. |
| **S4 escalation** | `claude-opus-5` | Auto-escalate when: extraction confidence low, fields conflict within one page, page is a dense PDF/T&Cs, or the candidate scores Tier 1. Roughly 1 in 10. |
| **S5 Adjudicate** | `claude-opus-5` | Low volume, high stakes, genuine judgement ("press says 25th, Devpost says 24th, which governs and why"). Do not cheap out here — this is the decision that costs you an entry. |
| **S6 Score** | `claude-sonnet-5` | Rubric-guided, needs consistency more than brilliance. |
| **S7 Plan / S9 Brief** | `claude-sonnet-5` | Templated generation with light judgement. |
| **Deep dive (§8.4)** | `claude-opus-5`, adaptive thinking, `effort: high`/`xhigh` | Open-ended long-horizon research with web search + web fetch. This is precisely what Opus 5 is strongest at. |
| **Flyer OCR/vision** | `claude-sonnet-5` (escalate to Opus 5) | Instagram/Facebook poster → structured dates. Both are in the high-resolution vision tier. |

`claude-fable-5` is deliberately unused. At $10/$50 it's 2× Opus 5, and nothing in this pipeline is hard enough to justify it. Revisit only if the deep-dive agent measurably plateaus.

### 8.2 Three API features that dominate the cost model

1. **Prompt caching.** The extraction system prompt — schema + rubric + few-shot examples — is ~5K tokens and byte-identical across every call. Cache it: reads cost 0.1×. Over thousands of extractions this is the difference between real money and noise. *Requires the volatile part (the page content) to come strictly after the cached prefix* — get the ordering wrong and you cache nothing.
2. **Batch API** — 50% off, results within an hour. Triage is not latency-sensitive. Use it.
3. **Structured outputs** (`output_config.format` with a JSON Schema, plus `strict: true` on tools) — guarantees parseable, schema-valid output. Deletes an entire class of "the model returned almost-JSON" retry code.

### 8.3 Why call Anthropic directly rather than through a gateway

The user has AIML API and AIsa available. Both are useful; neither should carry the Claude traffic.

- **AIML API** ([aimlapi.com](https://aimlapi.com/ai-ml-api-pricing)) — 400–1000+ models behind one OpenAI-compatible endpoint, $20 minimum prepaid. It resells Claude at a **markup** (Opus-tier listed around $6.50/M input against $5.00 first-party, ~30%). More importantly, gateways generally don't expose prompt caching, the Batch API, or the server-side web-search/web-fetch tools — which is where the actual savings and capability are. Paying 30% more to lose the 90% caching discount is the wrong trade.
- **AIsa** ([aisa.one](https://aisa.one/docs/guides)) — a unified agent gateway: model routing plus 100+ real-time data endpoints (Twitter/X, Tavily, Perplexity, YouTube SERP) and machine-to-machine micropayments.

Use them where they're genuinely better:

- **AIsa for X/Twitter and Perplexity/Tavily lookups.** Bright Data's X coverage is weaker, and X is a real announcement channel for SA tech. One integration instead of three.
- **AIML API for cheap non-Claude specialty work** — embeddings for dedupe clustering, an OSS OCR pass on low-value flyers before spending vision tokens, and as a **failover** if Anthropic rate-limits mid-run.
- **Keep every Claude call first-party** for caching, batching, and server tools.

### 8.4 Subscription or API? Both — and the subscription covers more than you'd think

Claude Pro / Max / Team subscriptions **can** legitimately drive automation, via `claude-code-action` in GitHub Actions. Run `claude setup-token` locally, store the result as the repo secret `CLAUDE_CODE_OAUTH_TOKEN`, and pass it as `claude_code_oauth_token:` instead of `anthropic_api_key:`. Runs then bill against the subscription, not the API account. Give the step a `prompt:` input and it runs in **automation mode** on any trigger — including `cron`. This is a documented, supported path, not a workaround.

**Where the subscription is the right tool:** agentic, low-frequency, judgement-heavy work — the weekly deep dive, the Monday brief, conflict adjudication. That's what Claude Code is built for.

**Where it isn't:** triaging ~1,500 candidates a month. That's batch inference, not agent work. Claude Code is an agent harness — pushing 1,500 classification calls through it is slow, burns rate limits, and forfeits the two features that make that stage cheap (Batch API, prompt caching). Same for high-volume extraction.

**But that volume is a design choice, not a requirement.** It comes almost entirely from Tier-C SERP fan-out. Drop Tier C, lean on Tier A feeds and the Tier-B org watchlist, and candidate volume collapses to something one daily agent run handles comfortably:

| | **Subscription-first** | **Full pipeline** |
|---|---|---|
| Discovery | Tier A feeds + Tier B watchlist | + Tier C SERP fan-out, Tier D social |
| Candidates/month | ~100–200 | ~1,500 |
| Compute | 1 daily `claude-code-action` cron run | Staged pipeline, Batch API, caching |
| Auth | `CLAUDE_CODE_OAUTH_TOKEN` | `ANTHROPIC_API_KEY` |
| Extra cost | **~$0** on top of the subscription | ~$28/month |
| Trade-off | Slower on the true long tail; niche events found late or missed | Broadest coverage |

**Recommendation: start subscription-first.** It costs nothing extra, proves the loop, and covers the events that actually matter most (Tier B is where Gradhack lives). Add the API pipeline in Phase 2 only if the long tail proves worth it.

Four caveats worth knowing before you wire it up:

- **The OAuth token is tied to one person's subscription** and draws on their rate limits. If it's Sbu's token, a heavy weekend of automation eats the quota Sbu wants for interactive work. Anthropic's own guidance is to use an API key for team-owned automation. Mitigation: keep scheduled runs few and bounded (`--max-turns`, workflow timeouts).
- **If both secrets are set, `ANTHROPIC_API_KEY` wins** and you get billed on the API without noticing. Set one.
- **GitHub disables scheduled workflows on public repos after 60 days of no activity.** Ours will be active, but know it exists.
- **Scheduled runs skip the write-access check but still reject bot actors** — the run is attributed to whoever last edited the cron line.

Max 5× is $100/month and Max 20× is $200/month, with weekly caps on top of the 5-hour windows; Pro is the entry point. If you're already paying for one of these, the marginal cost of SONAR's intelligence is genuinely zero.

### 8.5 The weekly deep dive is the one place an agent belongs

Sunday night, so it lands before the existing Monday 08:00 board review. An Opus 5 agent with web search + web fetch, given a genuinely open brief:

> Re-verify every entry not marked `confirmed`. Chase the Tier-B watchlist for anything new. Investigate the three highest-uncertainty items on the board. Produce Monday's brief.

This is open-ended, benefits from real reasoning, tolerates a 20-minute runtime, and runs once a week — every property that makes agentic execution the right call, where it would be the wrong call for the 15-minute sweep. Run it with `effort: high` (or `xhigh`), a full task specification up front, and a token budget cap. Its output is a **PR**, not a direct write — which keeps Standing Agreement 8 intact.

---

## 9. Scraping stack

**Bright Data** ([brightdata.com](https://brightdata.com/products)) is the right primary. Its MCP server exposes the whole stack — Web Unlocker, SERP API, Web Scraper API, Scraping Browser — as agent-callable tools, with a **free tier of 5,000 requests/month** that likely covers most of Tier A–C at this volume.

| Product | Use in SONAR | Indicative cost |
|---|---|---|
| **SERP API** | Tier-C dork fan-out | ~$1–1.50 / 1k queries |
| **Web Unlocker** | Tier-A/B pages that block plain fetches | ~$1–1.50 / 1k requests |
| **Web Scraper API** (`web_data_*`) | LinkedIn posts, TikTok posts, IG, FB — structured records | ~$0.75–1 / 1k records |
| **Scraping Browser** | JS-only pages. **This is the documented fix for Zindi**, which `docs/SOURCES.md` records as unreadable by any non-browser fetch | ~$5 / GB |
| **MCP server** | Lets the deep-dive agent drive all of the above directly | 5k req/month free |

Solving Zindi alone justifies the integration — v1 explicitly gave up on it and marked it manual-only forever.

**Enable `PRO_MODE`** on the MCP server for the `web_data_*` social tools; the free base tier only carries `search_engine`, `scrape_as_markdown`, and `discover`.

---

## 10. Google Calendar — auto-updating, multi-calendar, idempotent

### 10.1 Five calendars, because confidence must be visible

| Calendar | Contents | Colour |
|---|---|---|
| `SONAR · Deadlines` | Hard cutoffs only. All-day + timed true-cutoff. | Red |
| `SONAR · Events` | The hackathons themselves, with tracks and challenges in the description | Blue |
| `SONAR · Prep` | Generated work blocks. Movable. | Green |
| `SONAR · Radar` | `unconfirmed` / `predicted` / `conflicted`. `status: tentative`. | Grey |
| `SONAR · Rewards` | Conditional (TechXchange, finals) | Purple |

Splitting means each person can toggle Prep off during exam season without losing deadlines, and **unverified dates never share a colour with verified ones**.

### 10.2 Auth — use a service account with shared calendars, not OAuth

This is the detail that breaks most DIY calendar automations, so it's worth being explicit:

- ❌ **OAuth refresh tokens** — a Google Cloud app left in "Testing" publishing status issues refresh tokens that **expire after 7 days**. The automation dies every week. Getting out of that means going through app verification.
- ❌ **Service account + domain-wide delegation** — requires Google Workspace. Both operators are on `gmail.com`.
- ✅ **Service account + calendar sharing.** Create the five calendars under one account, then share each with the service account's address granting *"Make changes to events"*. The service account writes directly, no user token, nothing expires. Both humans subscribe to the shared calendars and see identical data on every device.

Store the service-account JSON in GitHub Secrets. Quotas are a non-issue: 10,000 requests/minute per project and 600/minute/user, against a workload of a few hundred writes a day.

### 10.3 Idempotent upsert — never create duplicates

The v1 flow ("import the .ics") duplicates every event on re-import. Instead, set a **deterministic client-side event ID** at insert:

```
sonar{hackathonId}{eventKind}{seq}      // base32hex, 5–1024 chars
e.g. sonaradtc2026deadline0
```

Then every sync is `update`-by-ID, falling back to `insert` on 404. Re-running the sync a hundred times converges to the same calendar.

Attach machine state via `extendedProperties.private`:

```jsonc
{ "sonar_confidence": "corroborated", "sonar_source_hash": "9f2a...",
  "sonar_run_id": "2026-08-10T04:00Z", "sonar_hackathon_id": "adtc-2026" }
```

This makes the calendar queryable by the system (`privateExtendedProperty` filter), enables **drift detection** — if a human hand-edits an event, the hash mismatches and the system asks before overwriting — and means SONAR only ever touches events it created.

### 10.4 What actually goes in an event

Tracks and challenges belong in the body, since that's what gets read on a phone at 23:00:

```
SUBMIT — Africa Deep Tech Challenge  ($16,500)
─────────────────────────────────────────────
⏰ Cutoff  24 Aug 23:45 PDT  = 25 Aug 08:45 SAST
   ⚠️ hard stop is the MORNING AFTER in SA time
🎯 Track   Agriculture (chosen) — Best African Use Case $1,500
📊 Scored  50% accuracy · 30% throughput · 20% efficiency
           −10 penalty if thermals exceed 85°C · OOM = DQ
📦 Submit  repo · report · benchmark table · 2-min video
🔗 adtc-2026.devpost.com
✅ Confidence: corroborated (3 sources) · ⚠️ 1 unresolved conflict
   Last verified 10 Aug 04:12 SAST
```

Reminders scale with tier: Tier 1 gets 14d / 7d / 3d / 1d / 3h; Tier 3 gets 7d / 1d.

---

## 11. Notifications — push, never pull

The explicit requirement is *"auto update without us checking"*, so the calendar cannot be the only channel.

**Telegram bot** is the right primary: free, instant, reliable on SA mobile data, group chat for both operators, and inline buttons — so "new Tier-1 find, add to board?" is answerable with one tap from a phone. WhatsApp Business API costs money and adds approval friction for no gain here.

| Tier | Trigger | Channel |
|---|---|---|
| **P0** — instant | A committed date **changed**; new Tier-1 find; deadline <48h with submission not marked done; source page 404s; capacity collision | Telegram, both operators |
| **P1** — daily 06:00 | New finds, confidence changes, re-scores, prep blocks moved | Telegram digest |
| **P2** — Monday 08:00 | Full board, week deltas, stale list, capacity warnings — lands exactly on the existing review ritual | Telegram + email + PR |

Plus a **GitHub issue per new find needing a scoring decision**, which keeps Standing Agreement 3 ("whoever finds it, scores it") working when the finder is a machine.

The date-changed alert is the one that pays for the whole system.

---

## 12. Runtime

**GitHub Actions as the spine, Claude API for intelligence, Managed Agents only for the deep dive.**

Reasoning: the repo is already the source of truth, so git gives the audit trail, diffs, and PR review for free — and preserves the existing "argue in a PR" culture. Secrets already have a home. There's no infrastructure to run, and failures are visible as a red X. For two people this beats standing up a server.

| Workflow | Cron (SAST) | Does |
|---|---|---|
| `pulse.yml` | every 6h | Deadline maths, status transitions, P0 checks. No network beyond cheap HEADs. ~free. |
| `sweep.yml` | daily 05:00 | Tier A + C, triage, extract, verify, sync, P1 digest |
| `social.yml` | Tue + Fri 05:30 | Tier D via Bright Data |
| `deepdive.yml` | Sun 20:00 | Opus 5 agent → Monday brief → PR |
| `verify.yml` | every 12h | Re-check queue by §6.4 cadence |

Caveat: Actions cron is best-effort and can drift by minutes under load. Irrelevant here — alerts fire days out, not minutes.

Everything writes through a PR when confidence is below `corroborated`, and directly to `main` when at or above it. Humans stay in the loop exactly where judgement is needed and nowhere else.

---

## 13. Cost

**These are my estimates from assumed volumes, not quotes.** The volumes are the guess; the unit prices are real. Full pipeline, at ~1,500 candidates/month, ~120 extractions, ~40 actively tracked entries:

| Line | Monthly | What the money actually buys |
|---|---|---|
| Triage — Haiku 4.5, batched | ~$1.50 | Reading ~1,500 candidate links and answering "is this a hackathon, is it relevant to us, is it new?" |
| Extraction — Sonnet 5, cached | ~$6 | Turning the ~120 survivors into structured records with quoted evidence |
| Re-verification | ~$7 | Re-checking ~40 live entries on the §6.4 cadence. Most cost **zero tokens** — unchanged page hash means no model call. This is the ~150/month that actually changed. |
| Adjudication — Opus 5 | ~$3 | Resolving ~25 source conflicts (the "24th or 25th?" decisions) |
| Deep dive — Opus 5 × 4 | ~$10 | Four weekly agent runs chasing the long tail and writing Monday's brief |
| **Claude subtotal** | **~$28** | |
| Bright Data | ~$10–15 | Fetching pages that block ordinary requests (Zindi, LinkedIn) and Google results at volume. **First 5,000 requests/month are free** — at this scale you may pay nothing. |
| Google Calendar · GitHub Actions · Telegram | $0 | All comfortably inside free tiers |
| **Total** | **≈ $40–50 / month (~R750–R950)** | |

**Most of this is optional.** On the subscription-first build (§8.4) the entire Claude subtotal goes to **$0** — it's covered by a Pro/Max plan you may already have — and Bright Data likely stays inside its free tier. That version costs nothing extra and gives up breadth of discovery, not correctness: the verification, calendar and alerting layers are identical.

The single biggest cost driver is **discovery breadth**, not the system existing. Triage volume is what SERP fan-out buys you.

Against a board carrying a $700k+ Shipaton pool, $77k RSNA, $16.5k ADTC, and BCG Platinion's career value, this is a rounding error. Sonnet 5's intro pricing ends **31 August 2026**, after which extraction roughly rises to ~$9/month — still immaterial.

Cost control levers, in order of impact: hash-match skipping (most re-checks cost zero tokens), prompt caching, the Batch API, and triage aggressively killing candidates before the expensive stages.

---

## 14. Build order

Sequenced so the crunch is protected first. **Do not start with the fun part.**

**Phase 0 — this week (do before anything else).** UNESCO is in 6 days, ADTC in 14. No new architecture. Just: fix the two findings in §0, hand-verify the five entries inside 60 days, set up the five calendars + service account, and get a manual `sonar.py ics` → calendar sync working. Ship safety, not infrastructure.

**Phase 1 — weeks 1–2.** Schema v2 + JSON Schema validation. Evidence store. Tier-A adapters. Idempotent calendar sync. Telegram P0 alerts. *At this point date-change detection works — the highest-value feature is live and nothing has scraped anything yet.*

**Phase 2 — weeks 3–4.** Triage → extract → verify pipeline. Prompt caching, Batch API. Bright Data SERP + Unlocker. Zindi via Scraping Browser. P1 digest.

**Phase 3 — month 2.** Tier-B org watchlist (highest-yield discovery). Tier-D social + flyer vision. Prep planner. Capacity engine.

**Phase 4 — month 3.** Deep-dive agent. Prediction from `history[]`. Retro loop feeding `winnability` from actual results.

---

## 15. Risks, and the honest compliance position

**Scraping LinkedIn, Instagram, Facebook and TikTok is against those platforms' terms of service.** Bright Data provides the technical means and targets public data, and there's meaningful US case law on public-data scraping, but the position isn't risk-free. Practical guidance, then moving on:

- Exhaust Tiers A–C first. Most of what's on Instagram is also in an RSS feed, and the feed is cheaper *and* clean.
- Use Bright Data's managed scrapers rather than rolling your own — don't ever log in with personal accounts, which is what actually gets people banned.
- **POPIA applies** the moment organiser names, emails or phone numbers are stored. Keep personal data out of `hackathons.json`; store organisation contact pages, not individuals.
- Respect `robots.txt` on university and government sites. They're small, they notice, and you may want to enter their competitions.

| Risk | Mitigation |
|---|---|
| Hallucinated date reaches a calendar | Span assertion + two-source rule + Radar quarantine (§6) |
| Silent pipeline failure | Pulse job asserts freshness; if no successful sweep in 48h → P0 |
| Model writes a wrong date over a right one | Never auto-delete or auto-move a committed date; drift detection + human ack |
| Cost runaway | Hard monthly caps per provider; batch + cache; triage kills volume early |
| Notification fatigue | Strict P0 definition. If P0 fires more than ~twice a week, the threshold is wrong. |
| Over-engineering instead of entering hackathons | Phase 0 first. The system exists to win competitions, not to be a competition entry. |

That last one is the real risk. v1 already works well enough to run the August crunch. Build v2 in the gaps between events, not instead of them.

---

## 16. Repo layout after v2

```
SONAR/
├── data/
│   ├── hackathons.json           ← still the only source of truth
│   ├── sources.json              ← NEW  typed registry + org watchlist
│   └── evidence/<sha256>.md      ← NEW  immutable snapshots
├── schema/
│   └── hackathon.schema.json     ← NEW  validated in CI
├── sonar/                        ← NEW  package (v1 CLI still works)
│   ├── sweep.py  triage.py  harvest.py  extract.py
│   ├── verify.py  score.py  plan.py
│   ├── calendar_sync.py  notify.py
│   └── providers/  anthropic.py  brightdata.py  aisa.py  google.py
├── .github/workflows/            ← NEW  pulse · sweep · social · deepdive · verify
├── docs/AUTONOMY.md              ← this file
└── runs/<timestamp>/             ← NEW  per-run audit records
```

`calendar/sonar-2026.ics` and `data/calendar_events.json` are **retired** in Phase 1 — calendar events get generated from `hackathons.json` directly, which finally makes Ground Rule 1 true.

---

*Design v1.0 · 10 August 2026 · Companion to [`schema/hackathon.schema.json`](../schema/hackathon.schema.json). Argue with it in a PR.*
