-- ============================================================================
-- sonar-radar: stop the public anon key from being able to delete the board
--
-- Lovable generated this schema with, on `opportunities` and
-- `past_opportunities`:
--
--   GRANT SELECT, INSERT, UPDATE, DELETE ... TO anon;
--   CREATE POLICY ... FOR ALL TO anon USING (true) WITH CHECK (true);
--
-- The anon key is compiled into the JS bundle served to every visitor - it
-- is public by design and cannot be treated as a credential. Combined with
-- the grants above, that means any visitor to sonar-two-brown.vercel.app can
-- open a console and DELETE the entire board, or insert fabricated entries
-- that render exactly like verified ones. On a project whose whole premise
-- is that nothing unverified reaches the surface, that is the worst possible
-- hole.
--
-- Writes belong to the CI pipeline (service_role, key held in GitHub
-- Secrets). The site only ever needs to READ.
--
-- Apply via .github/workflows/migrate.yml, or paste into the SQL editor of
-- sonar-radar's project.
-- ============================================================================

-- ---------------------------------------------------------------- board data
-- Read-only for the public. service_role keeps full access (it bypasses RLS).
revoke insert, update, delete on public.opportunities      from anon, authenticated;
revoke insert, update, delete on public.past_opportunities from anon, authenticated;

drop policy if exists "opportunities open" on public.opportunities;
drop policy if exists "past open"         on public.past_opportunities;

create policy "opportunities public read" on public.opportunities
  for select to anon, authenticated using (true);

create policy "past public read" on public.past_opportunities
  for select to anon, authenticated using (true);

-- ------------------------------------------------------------------ updates
-- Already read+insert only (no delete), which is the right shape for an
-- append-only audit trail. Left as-is deliberately: the app appends entries
-- when a person records something, and nobody should be able to erase
-- history through the public key. Deletions - like purging Lovable's
-- fabricated seed rows - stay service_role-only.

-- ---------------------------------------------------------------- watchlist
-- Genuinely needs anon writes: it is the no-login shared watchlist, by
-- design (docs/LOVABLE_PROMPT.md - "no sign-up/sign-in/password auth").
-- Left open, with the tradeoff stated rather than hidden: a visitor could
-- add or clear stars. That is cosmetic and self-inflicted at worst, unlike
-- losing the board. Revisit if the link ever spreads beyond the two of you.
