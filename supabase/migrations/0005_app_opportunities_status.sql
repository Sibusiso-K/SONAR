-- Add the participation-status column to app.opportunities.
--
-- Why this exists: `status` records the team's own participation state
-- (registered / selected / submitted / dropped), which is separate from
-- `confidence` (how much we trust the dates) and from deadline proximity.
-- It was added to the public schema in sonar-radar's project on 16 Aug
-- (web/supabase/migrations/20260816_add_status_column.sql), but the app
-- schema here never got the matching column.
--
-- That went unnoticed until 24 Aug, because the app-schema sync step was
-- not in the workflow between the two dates. The moment it was re-added
-- (PR #16) the very next run failed:
--
--   Supabase POST opportunities -> 400
--   PGRST204: Could not find the 'status' column of 'opportunities'
--             in the schema cache
--
-- The primary sync to sonar-radar is unaffected and keeps succeeding;
-- it is only this second destination that rejects the payload.
--
-- Purely additive and idempotent: no data is read, moved or dropped.
-- Run it against the SONAR project (the one that owns the app schema),
-- then re-run the "Refresh board" workflow to confirm.

alter table app.opportunities
  add column if not exists status text;

-- PostgREST caches the schema, so an ALTER alone is not enough: without
-- this the API keeps returning PGRST204 against the new column until the
-- next restart. Same step that was missing when app.* first 404'd.
notify pgrst, 'reload schema';
