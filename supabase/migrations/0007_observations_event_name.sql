-- ============================================================================
-- observations.event_name - fixes discovery silently dropping new events on
-- already-tracked source pages (docs/REVIEW_2026-09-14.md, finding 2).
--
-- watch_sources.py's model prompt already asks for {"name", "field",
-- "value", "quoted_span"} per candidate - "name" is the event the fact is
-- about - but the write path only ever stored field/value/quoted_span,
-- discarding the one piece of information that could distinguish "a new
-- event mentioned on Geekulcha's events page" from "the same Geekulcha
-- event this page already backs." Without it, scripts/sonar_db.py's
-- promote command could only deduplicate by source page URL, which is
-- wrong: it means an already-tracked page can never surface a genuinely
-- new event again, because the page's URL is already in a tracked
-- opportunity's `links`.
-- ============================================================================

alter table observations add column if not exists event_name text;
