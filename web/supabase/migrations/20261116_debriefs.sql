-- ============================================================================
-- sonar-radar: debriefs
--
-- What happened at an event, filed from the board's "this one has passed, how
-- did it go?" prompt (web/src/components/DebriefPrompt.tsx). One row per
-- person per event. Read by the Crew page's Evaluation section.
--
-- The site has no login (docs/SECURITY_REVIEW_2026-11-09.md), so the public
-- key may INSERT here, exactly as it may add a watchlist star. The policy
-- limits what such a row can be: one of the two crew names, a known outcome,
-- bounded text. It cannot UPDATE or DELETE, so a debrief cannot be rewritten
-- or erased from the browser; corrections are a new row or a service-role
-- edit. Rows are data for people to read. Nothing here is fed to the
-- assistant's prompt, so a forged row is a wrong note, not an injection.
--
-- Apply via .github/workflows/migrate.yml (workflow_dispatch) or paste into
-- the project's SQL editor. Until it is applied the site keeps debriefs in the
-- browser that wrote them and says so.
-- ============================================================================

create table if not exists public.debriefs (
  id               uuid primary key default gen_random_uuid(),
  opportunity_id   text not null,
  opportunity_name text not null,
  filed_by         text not null,
  outcome          text not null,
  placement        text,
  hours_spent      numeric(6,1),
  what_worked      text,
  what_cost_us     text,
  would_reuse      text[] not null default '{}',
  judge_feedback   text,           -- verbatim or null. never paraphrased.
  raw_text         text not null,  -- the person's own words, kept as written
  structured_by    text not null,
  created_at       timestamptz not null default now(),

  constraint debriefs_filed_by_known check (filed_by in ('Sibusiso', 'Lethabo')),
  constraint debriefs_outcome_known check (outcome in ('won', 'placed', 'entered', 'withdrew', 'missed')),
  constraint debriefs_sizes check (
    char_length(opportunity_id) <= 120
    and char_length(opportunity_name) <= 200
    and char_length(raw_text) between 1 and 4000
    and char_length(coalesce(placement, '')) <= 200
    and char_length(coalesce(what_worked, '')) <= 1200
    and char_length(coalesce(what_cost_us, '')) <= 1200
    and char_length(coalesce(judge_feedback, '')) <= 1200
    and char_length(structured_by) <= 120
    and coalesce(array_length(would_reuse, 1), 0) <= 6
    and (hours_spent is null or (hours_spent > 0 and hours_spent < 2000))
  )
);

create index if not exists debriefs_opportunity_idx on public.debriefs (opportunity_id);
create index if not exists debriefs_filed_by_idx on public.debriefs (filed_by, created_at desc);

alter table public.debriefs enable row level security;

revoke all on public.debriefs from anon, authenticated;
grant select, insert on public.debriefs to anon, authenticated;

drop policy if exists "debriefs readable" on public.debriefs;
create policy "debriefs readable" on public.debriefs
  for select to anon, authenticated using (true);

drop policy if exists "debriefs appendable" on public.debriefs;
create policy "debriefs appendable" on public.debriefs
  for insert to anon, authenticated
  with check (filed_by in ('Sibusiso', 'Lethabo'));
