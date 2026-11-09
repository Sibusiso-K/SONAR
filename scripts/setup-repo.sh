#!/usr/bin/env bash
#
# One-shot: create the SONAR repo on GitHub, push it, and invite Lethabo.
#
#   ./scripts/setup-repo.sh              # defaults to LethaboMH14
#   ./scripts/setup-repo.sh <username>   # or name someone else
#
# Requires the GitHub CLI, authenticated as you:
#   gh auth login
#
set -euo pipefail
cd "$(dirname "$0")/.."

OWNER="Sibusiso-K"
REPO="SONAR"
COLLAB="${1:-LethaboMH14}"

if [[ -z "$COLLAB" ]]; then
  echo "Usage: ./scripts/setup-repo.sh [github-username]  (defaults to LethaboMH14)" >&2
  exit 1
fi

command -v gh >/dev/null || { echo "GitHub CLI not found: https://cli.github.com/" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Not logged in. Run: gh auth login" >&2; exit 1; }

# 1. git init if needed
if [[ ! -d .git ]]; then
  git init -b main
  git add .
  git commit -m "SONAR: initial board — 17 hackathons, calendar, playbook, CLI"
fi

# 2. create the repo if it doesn't exist, otherwise just wire up the remote
if gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
  echo "Repo $OWNER/$REPO already exists."
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "git@github.com:$OWNER/$REPO.git"
else
  echo "Creating private repo $OWNER/$REPO..."
  gh repo create "$OWNER/$REPO" --private --source=. --remote=origin
fi

# 3. push
git push -u origin main

# 4. invite Lethabo with Write access
echo "Inviting $COLLAB with Write access..."
gh api -X PUT "repos/$OWNER/$REPO/collaborators/$COLLAB" -f permission=push >/dev/null
echo "Invite sent. He needs to accept it from his email or github.com/notifications."

cat <<MSG

Done. Send Lethabo this:

  git clone git@github.com:$OWNER/$REPO.git
  cd $REPO
  python3 scripts/sonar.py next

Then read docs/ONBOARDING.md — it covers the calendar import and his first jobs.
MSG
