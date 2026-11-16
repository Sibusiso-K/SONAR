# Comparable sites: what they do well, and what SONAR should take

Written 16 November 2026. Sources are marked: **[read]** means the page's
visible text was read that day; **[browser]** means it was read the same
evening in a real browser session, after a plain fetch had been blocked or had
seen only an empty shell. Everything below is now one or the other except
lablab.ai, whose old address no longer lists any events (noted below).

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
- **[browser]** Filters: Location, Length, Interests, More, and a
  **"Match my eligibility"** toggle. 14,359 hackathons listed. Each card
  shows online/in person, title, **time left** ("18 days left"), the date
  range, **prize total**, **participant count**, host, "Managed by Devpost",
  and theme tags such as "Beginner Friendly". Featured cards are badged.
- **Good:** "time left" and "participants" side by side is the most useful
  pair on any listing: urgency and competition in one glance.
- **For SONAR:** show field size beside the countdown wherever we have it
  (`fieldSize()` already reads it from notes).

### DoraHacks — dorahacks.io/hackathon
- **[read]** Grid and list views; sort; filters for status, location, region
  and tags. Tags lead with frontier topics: Quantum, AI, Crypto / PQC,
  Biology, Student. A "find a team" entry point sits in the top navigation.
- **[browser]** Each card: host, **status** (Ongoing, Pre-registration,
  Upcoming, Extended, Ended, Winner Announced), days left, submission count,
  virtual or city, topic tags, **a separate row of required tech** ("Solidity,
  Foundry", "OpenAI, Claude"), and the prize pool. When there is no cash it
  says so plainly ("No cash, tokens, merch or other rewards"), and gated
  events say "Password needed for submitting Build".
- **Good:** "Student" as a tag is the right idea: an eligibility fact turned
  into a filter.
- **For SONAR:** a grid/list toggle is cheap and helps on the phone.

### Unstop — unstop.com
- **[read]** One brand across competitions, quizzes, hackathons,
  scholarships and internships for students. The listing is rendered by
  JavaScript.
- **[browser]** Filters: Team Size, Payment, Categories, Sort. Each card
  shows the organiser, **team size** ("2 - 4 Members", "Individual
  Participation"), **entry fee where there is one** ("1500 Fee"), online or
  the venue, who can apply ("Everyone can apply", "Undergraduate"), prize
  ("Prizes worth 3,50,000"), **"Pre-Placement Interviews"** as a reward,
  days left, and on popular ones "28,182 Registered".
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
- **[browser]** Grouped as Getting Started, Featured Hackathons, Featured
  Competitions, Community Spotlight, Recently Ended, Community. Every card:
  title, one-line brief, **team count** ("5899 Teams"), prize or "Swag" /
  "Kudos" / "Knowledge", and time to go ("16 days to go", "5 hours to go").
  Recently Ended keeps prize, track and team count (ARC Prize 2026 ARC-AGI-2:
  $700,000, 3,543 teams).
- **Good:** "Teams: 5,733" next to the prize is exactly the expected-value
  input SONAR computes.
- **For SONAR:** we already track field size for RSNA; pull the team count
  automatically when the sweep reads a Kaggle page.

### Zindi — zindi.africa
- **[browser]** zindi.africa now redirects to zindi.world. Header counts
  ("Open Challenges: 8, Past Challenges: 517"), a **"Closing soon"** sort,
  and a "start with a practice challenge" entry for newcomers. Cards: prize
  in its own currency ("$5 000 USD", "€25 000 EUR"), title naming the
  sponsor ("... by the French Embassy in South Africa"), **participants**,
  days left, Join. Several open challenges have South African sponsors
  (Dis-Chem, the French Embassy in South Africa).
- **Good:** explicit "prize eligible for residents of …" is the eligibility
  pattern we want on every row.

### lablab.ai and MLH
- **[browser]** lablab.ai/event now redirects to starfieldlabs.ai/events,
  which says "No events yet". It cannot be relied on as a source until that
  settles.
- **[browser]** MLH (mlh.io now redirects to mlh.com) lists the 2027 season
  as date, name, city, **IN-PERSON**, and badges for **HIGH SCHOOL**,
  **HARDWARE** and **DIVERSITY**. Filters: This Month, Next Month, Diversity
  Focused, Region. Nearly every event is in North America or Europe.
- **Good:** DoraHacks' required-tech row and MLH's badges both answer "is
  this for us?" before the reader opens anything.
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
5. **Learned from the browser pass (16 Nov):** every site that shows a
   participant or team count puts it beside the time left, which confirms
   item 4. Three cheap additions follow from what they do: say "no cash
   prize" outright instead of leaving the prize blank (DoraHacks); show an
   entry fee when there is one (Unstop); and show a required-stack line so a
   brief that demands Solidity or a specific vendor can be dismissed at a
   glance (DoraHacks). Devpost's "Match my eligibility" toggle is the same
   idea as eligibility-first subtitles, done as a filter.
