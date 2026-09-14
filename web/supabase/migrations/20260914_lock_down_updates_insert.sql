-- ============================================================================
-- sonar-radar: stop the public anon key from writing fabricated audit history
--
-- 20260812_lock_down_anon_writes.sql closed the board-deletion hole but
-- deliberately left `updates` open to anon INSERT with `WITH CHECK (true)`,
-- reasoning that append-only prevents erasure. It does not prevent forgery:
-- any visitor can already insert a row choosing actor, actor_kind,
-- change_kind, summary and timestamp. /updates renders that as attributed
-- history, and the assistant (web/src/lib/assistant.functions.ts) reads
-- recent rows straight into its system context - a forged row with
-- change_kind 'verification' or 'correction' is not cosmetic, it is a
-- prompt-injection surface into every answer the assistant gives.
--
-- A blanket revoke would break a real feature: web/src/lib/sonar-data.ts's
-- useToggleWatch() has the frontend insert a `change_kind: 'watch'` row
-- whenever someone stars/unstars an opportunity, by design (no login).
-- So this narrows the CHECK instead of removing the grant: anon/authenticated
-- may only insert rows shaped like that one watch action. Every other
-- change_kind (verification, discovery, correction, conflict, status,
-- score, note, ...) is now CI/service_role-only, which is where actual
-- authority should live.
--
-- Apply via .github/workflows/migrate.yml (workflow_dispatch, manual), or
-- paste into the SQL editor of sonar-radar's project. Not applied by this
-- commit - no database credentials are available in this checkout.
-- ============================================================================

drop policy if exists "updates appendable" on public.updates;

create policy "updates appendable by watch action only" on public.updates
  for insert to anon, authenticated
  with check (
    change_kind = 'watch'
    and actor_kind = 'human'
    and opportunity_id is not null
  );

-- "updates readable" (SELECT, from the original migration) is left as-is.
