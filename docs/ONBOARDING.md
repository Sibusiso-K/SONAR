# Onboarding Lethabo

Two parts: Sibusiso grants access, Lethabo pulls and gets set up. Should take under 10 minutes total.

---

## Part 1 — Sibusiso: create the repo and add Lethabo

### Step 1. Push the repo (once)

The SONAR files currently only exist in the folder Claude created. Get them onto GitHub first — there's nothing to collaborate on until then.

```bash
cd path/to/SONAR
./scripts/push-to-github.sh
```

Or manually:

```bash
cd path/to/SONAR
git init -b main
git add .
git commit -m "SONAR: initial board — 17 hackathons, calendar, playbook, CLI"
git remote add origin git@github.com:Sibusiso-K/SONAR.git
git push -u origin main
```

If the repo doesn't exist on GitHub yet, create it first at
**https://github.com/new** → name `SONAR` → **Private** → do *not* add a README (you already have one).

> Keep it **private**. It contains your strategy, your scoring of each event, and honest notes about odds. Competition rules that require a public repo apply to the *submission* repo, not this one — see the note in `docs/TEAM.md`.

### Step 2. Add Lethabo as a collaborator

**Web (3 clicks):**

1. Go to **https://github.com/Sibusiso-K/SONAR/settings/access**
2. Click **Add people**
3. Type **`LethaboMH14`** → select **Write** → **Add to repository**

He gets an email invite. Access starts when he accepts.

**Or with the GitHub CLI:**

```bash
gh repo view Sibusiso-K/SONAR >/dev/null 2>&1 || gh repo create Sibusiso-K/SONAR --private --source=. --remote=origin --push

gh api -X PUT repos/Sibusiso-K/SONAR/collaborators/LethaboMH14 \
  -f permission=push
```

Or just run the script, which does all of the above:

```bash
./scripts/setup-repo.sh LethaboMH14
```

`push` = Write access: he can commit, push, and open PRs, but can't delete the repo or change its settings. That's the right level.

### Step 3. Confirm

```bash
gh api repos/Sibusiso-K/SONAR/invitations --jq '.[].invitee.login'
```

Should print `LethaboMH14` until he accepts, then nothing.

`docs/TEAM.md` already has him recorded as [@LethaboMH14](https://github.com/LethaboMH14) with Write access — add his email and phone there when you get a moment.

---

## Part 2 — Lethabo: get set up

### 1. Clone

```bash
git clone git@github.com:Sibusiso-K/SONAR.git
cd SONAR
```

No SSH key set up yet? Either use HTTPS:

```bash
git clone https://github.com/Sibusiso-K/SONAR.git
```

…or generate a key (2 minutes): `ssh-keygen -t ed25519 -C "your@email.com"`, then paste `~/.ssh/id_ed25519.pub` into **https://github.com/settings/keys**.

### 2. Check it works

```bash
python3 scripts/sonar.py next
```

You should see UNESCO, ADTC, IBM and BCG with countdowns. Python 3.8+, no dependencies to install.

```bash
python3 scripts/sonar.py list      # the whole ranked board
python3 scripts/sonar.py stale     # what still needs verifying
python3 scripts/sonar.py brief adtc-2026
```

### 3. Get the calendar

Google Calendar → **Settings** → **Import & export** → **Import** → select `calendar/sonar-2026.ics` → pick a calendar → **Import**.

31 events land: deadlines, event dates, prep blocks, and a recurring Monday board review. Same dates Sibusiso has.

### 4. Read these three, in this order

1. **`README.md`** — 2 minutes. Where everything lives and what's closing.
2. **`docs/PRIORITY_BOARD.md`** — 10 minutes. The ranked board and *why* each event sits where it does. This is the important one.
3. **`docs/TEAM.md`** — 3 minutes. Your default ownership: app layer, UI, integration, the written report, and the demo video.

Then skim `docs/PLAYBOOK.md` before the first build weekend.

### 5. Your immediate jobs

| When | What |
|---|---|
| **Thu 13 Aug, evening** | UNESCO Youth Hackathon submission. You own it end to end — one evening, then it's off the list. Closes Sun 16 Aug. |
| **Sat 15 – Sun 16 Aug** | ADTC sprint 1 — app layer + RAG over the local corpus while Sibusiso does model selection. |
| **Before 7 Sept** | Your **own** BCG Platinion application. Separate from Sibusiso's — applications are individual, teams form on-site. CV + motivation letter. |
| **Sat 22 – Sun 23 Aug** | ADTC sprint 2 — report, benchmarks, 2-minute video. |

---

## Working agreement

**Branches**

```bash
git checkout -b entry/adtc-2026     # competition work
git checkout -b board/add-gradhack  # board and doc changes
```

**Commits** — imperative and scoped: `board: add NASA Space Apps`, `adtc: quantise to Q4_K_M`, `docs: correct BCG deadline`.

**Pull before you start, every time.** `git pull --rebase origin main`

**Found a hackathon?** Don't message it — add it. `CONTRIBUTING.md` has the schema. Score it, cite the source in `docs/SOURCES.md`, PR it.

**Disagree with a score?** Change the numbers in `data/hackathons.json` and say why in the PR. The scores are opinions, not facts.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Permission denied (publickey)` | SSH key not on GitHub. Use the HTTPS clone URL, or add your key at github.com/settings/keys |
| `Repository not found` | Invite not accepted yet — check your email, or that Sibusiso used the right username |
| `python3: command not found` | Try `python`. On Windows, install from python.org and tick "Add to PATH" |
| `sonar.py` shows odd dates | Run `python3 scripts/sonar.py ics` to regenerate, then re-import |
| Calendar import does nothing | Make sure you selected **Import**, not "Add by URL", and picked a target calendar |
