-- ============================================================================
-- `app` schema — what the website reads, inside the project Lethabo owns.
-- APPLIED 2026-08-12 to project txmxygjqndenkcdpweym (SONAR).
--
-- WHY THIS EXISTS
-- Every blocker hit on 2026-08-12 traced to one thing: the pipeline database
-- and the website's database live in different people's accounts. The pipeline
-- writes here; the site reads from sonar-radar's project in Sbu's account. So
-- nothing the pipeline verified could reach the site without a credential only
-- he can supply, and the board served data from a single manual run for days.
--
-- This gives the site a home in the project Lethabo controls. Repoint the app
-- with two env vars (see docs/HANDOVER_SBU.md) and the dependency is gone.
--
-- WHY A SEPARATE SCHEMA rather than `public`
-- `public` already holds the pipeline tables, and its `opportunities` has a
-- completely different shape (slug/org_id/first_seen_at) from the one the app
-- queries (id/scores/archived). Rather than fight that collision, the two get
-- clean separation with an honest division:
--
--   public.*  = everything the pipeline has ever SEEN (append-only, private)
--   app.*     = what has been VERIFIED and is fit to publish (read-only)
--
-- Same reasoning as docs/DATA.md's repo-vs-database split, one layer deeper.
-- scripts/sync_radar.py targets it via RADAR_SUPABASE_SCHEMA=app, which sets
-- PostgREST's Accept-Profile/Content-Profile headers.
--
-- SECURITY — deliberately NOT a copy of the Lovable schema
-- That schema granted anon SELECT/INSERT/UPDATE/DELETE with an open FOR ALL
-- policy. Since the anon key ships in the public JS bundle, that lets any
-- visitor delete the board from a console. Here anon gets SELECT only on
-- board data; writes are service_role (CI). watchlist keeps anon writes
-- because it is genuinely a no-login shared feature; updates stays
-- append-only with no anon DELETE, because an audit trail nobody can erase
-- is the entire point of having one.
--
-- Exposing the schema to the API also required, once:
--   alter role authenticator set pgrst.db_schemas = 'public, graphql_public, app';
--   notify pgrst, 'reload config';
-- ============================================================================

create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

create table if not exists app.opportunities (
  id            text primary key,
  name          text not null,
  organiser     text not null,
  kind          text not null,
  format        text not null default 'online',
  scope         text not null default 'national',
  tier          smallint not null default 3,
  score         numeric not null default 0,
  scores        jsonb not null default '{}'::jsonb,
  dates         jsonb not null default '{}'::jsonb,
  next_date     date,
  confidence    text not null default 'unconfirmed',
  prize         jsonb not null default '{}'::jsonb,
  career_track  text not null default 'none',
  eligibility   text,
  what_to_build text,
  deliverables  text,
  links         jsonb not null default '{}'::jsonb,
  notes         text,
  source        text,
  went_live_on  date,
  noticed_on    date,
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists app.past_opportunities (
  id              text primary key,
  name            text not null,
  organiser       text not null,
  kind            text not null,
  happened_on     date,
  outcome         text not null default 'missed',
  placement       text,
  note            text,
  corrected       boolean not null default false,
  correction_note text,
  created_at      timestamptz not null default now()
);

create table if not exists app.updates (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id text,
  actor          text not null default 'pipeline',
  actor_kind     text not null default 'automated',
  change_kind    text not null default 'note',
  summary        text not null,
  detail         text,
  created_at     timestamptz not null default now()
);
create index if not exists app_updates_created_idx on app.updates (created_at desc);

create table if not exists app.watchlist (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id text not null,
  watched_by     text not null,
  created_at     timestamptz not null default now(),
  unique (opportunity_id, watched_by)
);

alter table app.opportunities      enable row level security;
alter table app.past_opportunities enable row level security;
alter table app.updates            enable row level security;
alter table app.watchlist          enable row level security;

grant select on app.opportunities, app.past_opportunities to anon, authenticated;
grant all    on app.opportunities, app.past_opportunities to service_role;
create policy "board public read" on app.opportunities
  for select to anon, authenticated using (true);
create policy "past public read" on app.past_opportunities
  for select to anon, authenticated using (true);

grant select, insert on app.updates to anon, authenticated;
grant all           on app.updates to service_role;
create policy "updates public read" on app.updates
  for select to anon, authenticated using (true);
create policy "updates appendable" on app.updates
  for insert to anon, authenticated with check (true);

grant select, insert, update, delete on app.watchlist to anon, authenticated;
grant all                           on app.watchlist to service_role;
create policy "watchlist open" on app.watchlist
  for all to anon, authenticated using (true) with check (true);
