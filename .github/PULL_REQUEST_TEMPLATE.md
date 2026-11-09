## What and why

<!-- One or two sentences. Link the issue if there is one. -->

## Type

- [ ] Board data (new entry, status change, score change)
- [ ] Web app
- [ ] Pipeline scripts / workflows
- [ ] Docs or tooling

## Checklist

- [ ] `make check` passes locally (lint, types, unit and data tests)
- [ ] If `data/hackathons.json` or `data/calendar_events.json` changed: ran `make data` and committed the regenerated files
- [ ] New or changed entries have a source URL in `docs/SOURCES.md` and an honest `confidence`
- [ ] Score changes are explained here (scores are opinions, so say why)
- [ ] Browser-visible change: `make e2e` passes, and screenshots attached if the UI changed
- [ ] No secrets, tokens or personal data in the diff

## Notes for the reviewer

<!-- Anything you were unsure about, or that you chose not to do. -->
