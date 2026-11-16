-- ============================================================================
-- sonar-radar: revoke the privileges Supabase grants by default
--
-- New tables in `public` get every privilege for anon/authenticated through
-- default privileges, including TRUNCATE. RLS does not apply to TRUNCATE, so
-- the public key could empty any table. supabase/audit/rls_audit.sql query 4
-- caught this on the recreated project (16 Nov 2026).
--
-- After this, grants match the audit's expectation:
--   opportunities, past_opportunities  SELECT
--   updates                            SELECT, INSERT (policy: watch rows only)
--   watchlist                          SELECT, INSERT, DELETE (no-login stars)
--   debriefs                           SELECT, INSERT (policy: crew names only)
-- service_role is untouched.
-- ============================================================================

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

revoke update, delete on public.updates from anon, authenticated;
revoke update on public.watchlist from anon, authenticated;

alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;
