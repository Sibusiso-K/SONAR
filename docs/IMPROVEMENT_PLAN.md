# SONAR improvement plan

Proposed 14 September 2026, based on the repository review at `082b0b3`. These are recommendations, not shipped features. Event-specific dates and requirements remain subject to the evidence gates in the preparation pack.

## War Room: make the next action obvious

The first screen should answer three questions: what could prevent us from competing, who owns it, and what evidence will close it? Keep the useful event dossiers below an operational action board.

| Priority | Improvement | Acceptance criterion |
|---|---|---|
| Now | Put unresolved admission and submission blockers first | GovTech attendance evidence is visible before general strategy; missing evidence is distinguished from a confirmed missed reply |
| Now | Replace relative dates and unsupported claims | Every deadline has an absolute date/time and timezone; remove the eight-days/three-weeks error, unsupported readiness claims and universal claims about winning |
| Now | Update source references | Current Geekulcha brief and GovTech clauses are linked; public schedule versus later email discrepancy stays visible until resolved |
| Next | Add owned preparation tasks | Each task has an event, owner, due time, status, blocker and evidence link; edits survive reload and are shared between operators |
| Next | Add readiness gates per event | Show admission, rules, build, validation, demo, submission and logistics separately; critical missing evidence prevents a “ready” label |
| Next | Connect deliverables to the actual projects | Each event links its implementation repo, submitted pack, evaluation results, demo and final receipt; a plan is never displayed as a completed artifact |
| Next | Show workload and recovery together | Event duration, internal preparation targets and each member's availability appear together; conflicts use real intervals and confirmed participation |
| Later | Add a focused event-day view | A compact mobile view shows the next cutoff, submitter, upload link, backup artifact and receipt checklist |

Avoid a single readiness percentage: nine uploaded documents can coexist with a missing RSVP or a prototype that has not run. Use specific gates such as “Admission: evidence missing; Demo: rehearsed 16 Sep; Submission: pending.” Suggested owners must accept assignments before the app represents them as commitments.

### Proposed page order

1. **Needs attention:** overdue unfinished tasks, admission blockers and approaching hard cutoffs.
2. **Next seven days:** actions grouped by owner and due date, including recovery and travel.
3. **Event readiness:** gate status and the one next action for each event.
4. **Evidence and strategy:** organiser rubric, submitted brief, technical proof, limitations and source history.
5. **Results and reuse:** submission receipt, feedback, retro and reusable artifacts.

## SONAR: establish reliable dates and evidence first

| Priority | Improvement | Acceptance criterion |
|---|---|---|
| P1 | Fix date-only calendar handling | A 17 September event appears on 17 September in Johannesburg and UTC; week labels and month boundaries are correct |
| P1 | Separate source pages from event identity | A new event on a monitored listing reaches triage even when that listing already backs an older event |
| P1 | Protect authoritative audit history | Anonymous callers cannot create “verified” or pipeline-attributed updates; shared watch actions remain visibly unverified |
| P1 | Expose read/sync failures | Database errors show retry/stale state, not zero opportunities; required sync failures fail the job; no assistant answer is generated from failed required reads |
| P2 | Unify milestones across surfaces | RSVP, application, event, code freeze, presentation and conference are represented once and drive the board, War Room and calendar |
| P2 | Enforce data contracts in CI | Validate source records and generated documents with matching schemas, status vocabulary, date formats, score bounds and unique IDs before publishing |
| P2 | Add a source inbox | New evidence is grouped by event/edition, shows its exact quote and source, and supports review, merge, dismiss and promote with reasons |
| P2 | Make freshness visible | Display source checked-at time separately from sync time; a destination revision proves the app received the intended data |
| P2 | Improve assistant grounding | Bound conversation history, retrieve relevant full fields, link evidence and distinguish absent data from unavailable data; rate-limit inference |
| Later | Improve ranking labels | Present current win/EV calculations as heuristics; compare career fit, effort and eligible award amounts without implying calibrated financial forecasts |

### Data design for the next implementation

Keep `data/hackathons.json` as the current human-reviewed event source during migration. Introduce a milestone/readiness model that references stable event IDs rather than copying event dossiers into another source of truth.

- **Milestone:** stable ID, event ID, type, due timestamp or date-only value, timezone, owner, state and completion evidence.
- **Evidence:** source URL or private document reference, exact claim, observed time, confidence and supersession relationship.
- **Participation:** event-specific roster and acceptance evidence, separate from whether the event itself is open.
- **Artifact:** repository/version, deliverable type, validation result and submitted receipt.

Choose one writer for each kind of state. A practical split is reviewed JSON for event facts and authenticated server writes for collaborative tasks; Git snapshots can preserve history without a service-role sync overwriting operator task updates. Resolve the two Supabase destinations explicitly before introducing more writable state. Keep personal identifiers and private letters behind appropriate access controls; publish only the minimal status evidence needed.

### Delivery sequence

**First pass — correctness:** calendar keys, query error states, sync failure reporting, current War Room factual corrections and audit-write restrictions. Add focused regression checks for the reproduced failures.

**Second pass — execution:** shared task persistence, evidence-linked readiness gates and one milestone-driven calendar. Pilot on GovTech, Geekulcha and Mintek before widening to the whole board.

**Third pass — discovery:** resolve event identities, retain new mentions from known pages, implement a review inbox and measure extraction failures separately from empty results.

**Fourth pass — automation:** notify only on meaningful deadline changes, newly discovered opportunities, unresolved critical tasks or failed publication. Include deduplication, acknowledgement and quiet hours. No notification integration or recurring automation is created by this proposal.

## How to measure whether this helps

- Every active event has an accepted owner and its next unfinished milestone visible.
- Every “ready” gate links to actual completion evidence.
- No missed RSVP or mandatory attendance requirement due to an omitted milestone.
- Calendar dates match source dates in the team's timezone.
- Newly published events on existing source pages reach the review inbox.
- Failed reads and publication runs are detectable without inspecting raw logs.
- Every submitted event leaves a receipt, a short retro and an identified reusable artifact.

Do not spend the next pass on more visual effects or a stronger forecasting model. The existing interface already supports exploration; the highest-value improvement is confidence that its dates, evidence and next actions are dependable.
