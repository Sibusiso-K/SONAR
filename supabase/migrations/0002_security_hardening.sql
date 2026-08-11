-- ============================================================================
-- SONAR — security hardening pass
-- Fixes raised by `get_advisors` immediately after 0001_init.sql landed:
--
--   1. All four views were created SECURITY DEFINER by default (Postgres
--      default when the creating role differs from the querying role).
--      That means they ran with the view-owner's permissions and silently
--      bypassed RLS on the underlying tables — v_source_yield and
--      v_hallucination_rate read from source_runs/observations, which
--      deliberately have RLS enabled with NO select policy so the anon key
--      can't see cost data or scraped page content. A SECURITY DEFINER view
--      punches straight through that. security_invoker = true makes each
--      view enforce the RLS of whoever is actually querying it.
--   2. Both trigger functions had a mutable search_path — a function
--      without a pinned search_path can be tricked by a role that creates
--      an object earlier in the path. Pin it to public.
--   3. pg_trgm was installed into the public schema; best practice is a
--      dedicated schema so extension objects don't collide with app objects.
-- ============================================================================

alter view v_board              set (security_invoker = true);
alter view v_source_yield       set (security_invoker = true);
alter view v_watch_now          set (security_invoker = true);
alter view v_hallucination_rate set (security_invoker = true);

create or replace function touch_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function supersede_predictions() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.confidence in ('confirmed', 'corroborated')
     and new.next_date is not null
     and (old.next_date is distinct from new.next_date
          or old.confidence is distinct from new.confidence) then
    update predictions
       set superseded_at = now()
     where opportunity_slug = new.slug
       and superseded_at is null;
  end if;
  return new;
end $$;

create schema if not exists extensions;
alter extension pg_trgm set schema extensions;
