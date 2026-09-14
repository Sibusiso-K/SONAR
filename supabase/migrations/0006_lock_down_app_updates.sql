-- ============================================================================
-- app schema (Lethabo's project): same fix as
-- web/supabase/migrations/20260914_lock_down_updates_insert.sql, applied to
-- the mirrored app.updates table created by 0004_app_schema_for_website.sql.
--
-- 0004 granted anon/authenticated INSERT on app.updates with
-- `WITH CHECK (true)`: any anonymous caller can already write a row
-- choosing actor, actor_kind, summary and timestamp, which the app then
-- displays as attributed history. Writes belong to the CI pipeline
-- (service_role) via scripts/sync_radar.py. The site only ever needs to
-- READ this table.
--
-- Apply via .github/workflows/migrate.yml (workflow_dispatch, manual: file
-- 0006_lock_down_app_updates.sql). Not applied by this commit - no database
-- credentials are available in this checkout.
-- ============================================================================

revoke insert on app.updates from anon, authenticated;

drop policy if exists "updates appendable" on app.updates;

-- "updates public read" (SELECT) is left as-is.
