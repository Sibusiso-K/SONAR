# Comparable sites: what they do well, and what SONAR should take

Written 16 November 2026. Sources are marked: **[read]** means the page was
fetched that day and its visible text read; **[known]** means general product
knowledge, not re-checked that day. Most of these sites render their listings
with JavaScript, so a plain fetch saw navigation but not cards; mlh.io,
lablab.ai and zindi.africa were blocked by this session's network policy, and
Kaggle served a bot check. Treat the **[known]** notes as hypotheses to check
in a browser, not as findings.

## The short version

SONAR is not a listing site and should not become one. Listing sites are
built to show everyone everything; SONAR is built to help two people decide
what to enter this week and to remember how it went. What is worth taking
from them is the **mechanics of deciding fast**, not the catalogue.

| Take | From | Where it lands in SONAR |
|---|---|---|
| Filter by what disqualifies you first (location, age, student status) | Devpost, Unstop | An eligibility check against `team_profile.json` |
| Deadline as the primary sort, with a visible countdown | Devpost, Opportunity Desk ("Deadlines Approaching") | Already the default sort; next-up stack on the board |
| "Open / upcoming / ended" status as a first-class filter | Devpost, DoraHacks | Board status pills |
| Topic tags that match how you build (AI, data, fintech) | DoraHacks, lablab.ai | Tags derived from `what_to_build` |
| Team formation and sign-up in one place | lablab.ai, MLH | Out of scope for two people; skip |
| Past winners and results kept public | Zindi, Kaggle, Opportunity Desk | The archive and debriefs; already a strength |
| A weekly digest | Opportunity Desk and Opportunities for Africans newsletters | The Monday sweep |

## Site by site

### Devpost — devpost.com/hackathons
- **[read]** Navigation splits participants from hosts cleanly ("Join a
  hackathon" vs "Host a hackathon"), and hackathons are grouped by use case
  ("AI hackathons", "Public hackathons").
- **[known]** Filters on the left: location (online / in person), status
  (upcoming, open, ended), length, themes, open to (public, students),
  managed by Devpost. Each card shows: time left, prize total, number of
  participants, host, themes. Sort by "submission date" or "prize amount".
- **Good:** "time left" and "participants" side by side is the most useful
  pair on any listing: urgency and competition in one glance.
- **For SONAR:** show field size beside the countdown wherever we have it
  (`fieldSize()` already reads it from notes).

### DoraHacks — dorahacks.io/hackathon
- **[read]** Grid and list views; sort; filters for status, location, region
  and tags. Tags lead with frontier topics: Quantum, AI, Crypto / PQC,
  Biology, Student. A "find a team" entry point sits in the top navigation.
- **[known]** Cards show prize pool (often in tokens or USD), status, and
  number of BUIDLs (submissions). Some prizes are decided by on-chain
  quadratic voting.
- **Good:** "Student" as a tag is the right idea: an eligibility fact turned
  into a filter.
- **For SONAR:** a grid/list toggle is cheap and helps on the phone.

### Unstop — unstop.com
- **[read]** One brand across competitions, quizzes, hackathons,
  scholarships and internships for students. The listing is rendered by
  JavaScript.
- **[known]** Filters by user type (student, fresher, professional), course,
  location, fee or free, and category. Cards show registrations so far, days
  left, and the organiser's logo. Strong mobile app.
- **Good:** "Registered: 2,341" is a field-size signal before the deadline.
- **For SONAR:** our tiers do this job for two people; the lesson is to
  surface competition size early.

### Opportunity Desk — opportunitydesk.org
- **[read]** Organised by opportunity type (Scholarships, Competitions,
  Awards, Grants, Fellowships, Jobs, Internships) and by region (Africa,
  Asia, Europe, America). Has a **"Deadlines Approaching"** section, a
  mailing list, and "Submit Opportunity".
- **Good:** region and type as the two main axes is right for an
  Africa-based reader; the "Deadlines Approaching" shortcut is the single
  most useful view.
- **For SONAR:** it is already one of our monitoring sources. The Monday
  sweep reads it.

### Opportunities for Africans — opportunitiesforafricans.com
- **[read]** Categories: Call for Applications, Nominations, Papers,
  Proposals, Awards, Scholarships, Fellowships, Internships, Contests.
  Headlines carry the key fact in the title: "(10.000 € grant)", "(CHF 6,000
  monthly stipend)", "for Nigerian Undergraduate Economics Students".
- **Good:** putting eligibility and money **in the title** means a reader
  can dismiss most items without opening them.
- **For SONAR:** the board row's subtitle should lead with the
  disqualifier ("students only", "under 35", "SA citizens") when there is
  one.

### Kaggle — kaggle.com/competitions
- **[read]** Served a bot check to a script.
- **[known]** Competitions grouped as Featured, Research, Getting Started,
  Playground, Community; each shows prize, team count, days to go, and
  tags. Public leaderboards, discussion and shared notebooks.
- **Good:** "Teams: 5,733" next to the prize is exactly the expected-value
  input SONAR computes.
- **For SONAR:** we already track field size for RSNA; pull the team count
  automatically when the sweep reads a Kaggle page.

### Zindi — zindi.africa
- **[blocked here; known]** Africa's data-science competition platform.
  Cards show prize, participants, days left, and an eligibility note when a
  prize is restricted to African residents. Monthly "knowledge" challenges
  sit alongside prize challenges.
- **Good:** explicit "prize eligible for residents of …" is the eligibility
  pattern we want on every row.

### lablab.ai and MLH
- **[blocked here; known]** lablab.ai runs short AI hackathons with sponsor
  tech stacks (OpenAI, Google, etc.) on each card and in-platform team
  formation. MLH lists its season's events as a grid of cards with date,
  city or "Digital", and a high-school badge.
- **Good:** stack on the card ("built with Gemini") helps decide whether
  the team's existing work transfers.
- **For SONAR:** match a brief's required stack against the repos in
  `team_profile.json`.

## What this means for usability (impact on the build)

1. **Decide in one screen.** The new board leads with the next three dates,
   the totals, and the deadline field. Everything a Monday review needs is
   above the fold. (Done in this change.)
2. **Make silence visible.** Listing sites hide what they do not know;
   SONAR's field shows a count of rows with no date. Keep doing this. (Done.)
3. **Close the loop after an event.** None of the listing sites ask you how
   it went. The debrief popup does, and its answers feed the Crew page and
   the season figures. This is the feature that will eventually make win
   prediction honest. (Done in this change.)
4. **Next:** eligibility-first subtitles, a grid/list toggle on phones, and
   automatic field-size capture from Kaggle and Devpost pages during the
   sweep.
