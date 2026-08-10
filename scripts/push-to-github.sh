#!/usr/bin/env bash
# First-time setup: turn this folder into the SONAR repo and push it.
set -euo pipefail
cd "$(dirname "$0")/.."

git init -b main
git add .
git commit -m "SONAR: initial board — 17 hackathons, calendar, playbook, CLI"
git remote add origin git@github.com:Sibusiso-K/SONAR.git
git push -u origin main

echo
echo "Done. Tell Lethabo:"
echo "  git clone git@github.com:Sibusiso-K/SONAR.git"
echo "  cd SONAR && python3 scripts/sonar.py next"
echo "  Import calendar/sonar-2026.ics into Google Calendar."
