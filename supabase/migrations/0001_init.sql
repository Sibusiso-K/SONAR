-- ============================================================================
-- SONAR — Supabase schema
--
-- DIVISION OF LABOUR (read this before adding a table)
--
--   Supabase  = everything we have ever SEEN.  Append-only, machine-written,
--               high volume, queryable across time. This is what makes
--               forecasting possible — git can store history but cannot
--               answer "what day of the year does Discovery usually announce".
--
--   Repo JSON = what we have VERIFIED and committed to.  Low volume,
--               human-reviewed in a PR, drives the static site.
--
-- The pipeline writes observations here. A promotion step lifts verified
-- state into data/opportunities.json as a PR. Nothing reaches the published
-- board without passing through a reviewable diff. Supabase never writes
-- directly to the site.
--
-- Run:  supabase db push        (or paste into the SQL editor)
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";     -- fuzzy name matching for dedupe

-- ============================================================================
-- 1. ORGANISATIONS — the Tier-B watchlist
-- Watching ~80 organisations beats keyword search, because it catches an
-- announcement on day one. Capped-intake events (Gradhack: 50 seats) are won
-- or lost in the first 48 hours.
-- ============================================================================

create type org_sector as enum (
  'bank', 'insurer', 'telco', 'consultancy', 'software_house', 'university',
  'state', 'research', 'community', 'training', 'platform', 'lab', 'other'
);

create table organisations (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  sector        org_sector not null default 'other',
  country       text default 'ZA',

  -- where to look. the pipeline sweeps these on a cadence.
  careers_url   text,
  news_url      text,
  events_url    text,
  linkedin_slug text,

  -- learned from history: which month do they usually announce?
  typical_announce_month smallint check (typical_announce_month between 1 and 12),

  active        boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on organisations (sector) where active;
create index on organisations using gin (name gin_trgm_ops);

-- ============================================================================
-- 2. OPPORTUNITIES — current canonical state, mirrors data/opportunities.json
-- ============================================================================

create type opportunity_kind as enum (
  'hackathon', 'datathon', 'ml_competition', 'build_competition', 'challenge',
  'competition', 'grad_programme', 'recruiting_event', 'accelerator', 'bursary'
);

create type confidence_level as enum (
  'confirmed', 'corroborated', 'reported', 'unconfirmed', 'predicted', 'conflicted'
);

create type career_track as enum ('direct', 'adjacent', 'none');

create table opportunities (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,          -- matches the JSON `id`
  org_id         uuid references organisations(id) on delete set null,

  name           text not null,
  organiser      text not null,
  kind           opportunity_kind not null default 'hackathon',
  scope          text check (scope in ('local','continental','international')),
  format         text,
  location       text,

  status         text,
  lifecycle      text,
  career_track   career_track not null default 'none',

  tier           smallint check (tier between 1 and 3),
  score          numeric(4,2) check (score between 0 and 10),
  scores         jsonb default '{}'::jsonb,

  next_date      date,
  next_date_label text,
  confidence     confidence_level not null default 'unconfirmed',

  prize_currency char(3),
  prize_pool     numeric(14,2),
  prize          jsonb default '{}'::jsonb,

  dates          jsonb default '{}'::jsonb,
  tracks         jsonb default '[]'::jsonb,
  challenges     jsonb default '[]'::jsonb,
  stages         jsonb default '[]'::jsonb,
  links          jsonb default '{}'::jsonb,
  eligibility    text,
  what_to_build  text,
  notes          text,

  first_seen_at  timestamptz not null default now(),
  last_checked_at timestamptz,
  next_check_at  timestamptz,
  updated_at     timestamptz not null default now()
);

create index on opportunities (next_date) where next_date is not null;
create index on opportunities (confidence);
create index on opportunities (kind);
create index on opportunities (next_check_at) where next_check_at is not null;
create index on opportunities using gin (name gin_trgm_ops);

-- ============================================================================
-- 3. EDITIONS — the history that makes forecasting possible
-- One row per year per recurring opportunity. This is the single most
-- valuable table in the schema: it is what turns "Discovery runs Gradhack
-- every August" from tribal knowledge into a watch that fires.
-- ============================================================================

create table editions (
  id              uuid primary key default gen_random_uuid(),
  opportunity_slug text not null,               -- family key, e.g. 'discovery-gradhack'
  org_id          uuid references organisations(id) on delete set null,
  year            smallint not null,

  announced_on    date,      -- when the world first heard about it
  opens_on        date,      -- registration opens
  closes_on       date,      -- registration / submission closes
  event_start     date,
  event_end       date,

  prize_pool      numeric(14,2),
  prize_currency  char(3),
  participants    integer,

  -- feedback loop: did we enter, and how did it go?
  we_entered      boolean default false,
  our_placement   text,                          -- 'won','finalist','placed','none'
  hours_spent     numeric(6,1),

  source_url      text,
  created_at      timestamptz not null default now(),

  unique (opportunity_slug, year)
);

create index on editions (opportunity_slug, year desc);

-- ============================================================================
-- 4. SNAPSHOTS + OBSERVATIONS — the provenance spine
-- Every fact the pipeline extracts points at the exact bytes it came from.
-- `quoted_span` must appear verbatim in the snapshot or the extraction is
-- rejected — that check is the anti-hallucination mechanism.
-- ============================================================================

create table snapshots (
  sha         char(64) primary key,             -- sha256 of `content`
  url         text not null,
  fetched_at  timestamptz not null default now(),
  status_code integer,
  content     text,                             -- markdown-rendered page
  byte_size   integer
);

create index on snapshots (url, fetched_at desc);

create table observations (
  id            bigserial primary key,
  opportunity_id uuid references opportunities(id) on delete cascade,
  candidate_url text,                           -- set when not yet an opportunity

  field         text not null,                  -- JSON pointer, e.g. /stages/0/closes
  value         jsonb,
  quoted_span   text not null,
  snapshot_sha  char(64) references snapshots(sha),
  source_url    text not null,
  source_trust  smallint not null check (source_trust between 1 and 6),

  model         text,
  observed_at   timestamptz not null default now(),

  -- the deterministic gate. false = the quoted span was NOT found in the
  -- snapshot, i.e. the model hallucinated it. kept for analysis, never promoted.
  span_verified boolean not null default false
);

create index on observations (opportunity_id, field, observed_at desc);
create index on observations (observed_at desc);
create index on observations (span_verified) where not span_verified;

-- ============================================================================
-- 5. SOURCES + YIELD — self-optimising cost control
-- Tracks which feeds actually produce opportunities we commit to. A source
-- that costs money and has never yielded a commit gets switched off. This
-- is the mechanism that keeps the API bill falling over time.
-- ============================================================================

create table sources (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  url        text not null,
  tier       char(1) not null check (tier in ('A','B','C','D','E')),
  cadence    text not null default 'weekly',
  cost_class text not null default 'free' check (cost_class in ('free','serp','unlocker','browser','social')),
  enabled    boolean not null default true,
  notes      text
);

create table source_runs (
  id             bigserial primary key,
  source_id      uuid references sources(id) on delete cascade,
  ran_at         timestamptz not null default now(),
  candidates     integer not null default 0,
  survived_triage integer not null default 0,
  new_opportunities integer not null default 0,
  committed      integer not null default 0,   -- reached the published board
  cost_usd       numeric(10,4) not null default 0
);

create index on source_runs (source_id, ran_at desc);

-- ============================================================================
-- 6. PREDICTIONS — forecast output, written by scripts/forecast.py
-- Predictions are never published as fact. They land on the Radar calendar
-- as tentative, and raise the re-check cadence in the predicted window.
-- ============================================================================

create table predictions (
  id                uuid primary key default gen_random_uuid(),
  opportunity_slug  text not null,
  org_id            uuid references organisations(id) on delete set null,

  predicted_announce_start date,
  predicted_announce_end   date,
  predicted_event_start    date,
  predicted_event_end      date,

  method            text not null,        -- 'seasonal_mean', 'last_year_offset'
  basis             text not null,        -- human-readable: which editions fed it
  n_editions        smallint not null,
  stddev_days       numeric(6,2),
  confidence        numeric(3,2) check (confidence between 0 and 1),

  generated_at      timestamptz not null default now(),
  superseded_at     timestamptz           -- set when a real source confirms
);

create index on predictions (opportunity_slug, generated_at desc);
create index on predictions (predicted_announce_start)
  where superseded_at is null;

-- ============================================================================
-- 7. PIPELINE RUNS — operational audit + spend
-- ============================================================================

create table pipeline_runs (
  id           uuid primary key default gen_random_uuid(),
  workflow     text not null,          -- 'sweep','verify','deepdive','social'
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  ok           boolean,
  candidates   integer default 0,
  extracted    integer default 0,
  conflicts    integer default 0,
  cost_usd     numeric(10,4) default 0,
  error        text
);

create index on pipeline_runs (workflow, started_at desc);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- What the website renders. The app reads this at build time.
create or replace view v_board as
select
  o.slug            as id,
  o.name, o.organiser, o.kind, o.scope, o.format, o.location,
  o.status, o.lifecycle, o.career_track, o.tier, o.score, o.scores,
  o.next_date, o.next_date_label, o.confidence,
  o.prize, o.dates, o.tracks, o.challenges, o.stages, o.links,
  o.eligibility, o.what_to_build, o.notes,
  o.next_date - current_date as days_remaining,
  org.name          as org_name,
  org.sector        as org_sector
from opportunities o
left join organisations org on org.id = o.org_id
where coalesce(o.status, '') not in ('past', 'dropped');

-- Which sources are worth paying for.
-- cost_per_commit is the number that decides whether a feed stays on.
create or replace view v_source_yield as
select
  s.name, s.tier, s.cost_class, s.enabled,
  count(r.id)                       as runs,
  coalesce(sum(r.candidates), 0)    as candidates,
  coalesce(sum(r.committed), 0)     as committed,
  coalesce(sum(r.cost_usd), 0)      as cost_usd,
  case when coalesce(sum(r.committed), 0) > 0
       then round(sum(r.cost_usd) / sum(r.committed), 4)
       end                          as cost_per_commit,
  case when coalesce(sum(r.candidates), 0) > 0
       then round(100.0 * sum(r.committed) / sum(r.candidates), 2)
       end                          as commit_rate_pct
from sources s
left join source_runs r on r.source_id = s.id
group by s.id, s.name, s.tier, s.cost_class, s.enabled
order by cost_per_commit nulls last;

-- Predicted announcement windows we should be watching right now.
create or replace view v_watch_now as
select p.*, (p.predicted_announce_start - current_date) as days_to_window
from predictions p
where p.superseded_at is null
  and p.predicted_announce_end >= current_date
  and p.predicted_announce_start <= current_date + interval '30 days'
order by p.predicted_announce_start;

-- Extractions that failed the span check. Should trend to zero.
-- A rising number here means a prompt regression.
create or replace view v_hallucination_rate as
select
  date_trunc('day', observed_at)::date as day,
  count(*)                              as total,
  count(*) filter (where not span_verified) as failed,
  round(100.0 * count(*) filter (where not span_verified) / nullif(count(*),0), 2) as fail_pct
from observations
group by 1
order by 1 desc;

-- ============================================================================
-- ROW LEVEL SECURITY
-- The site builds with the anon key and only ever reads. The pipeline uses
-- the service-role key, which bypasses RLS — that key lives in GitHub
-- Secrets and must never reach the browser.
-- ============================================================================

alter table organisations  enable row level security;
alter table opportunities  enable row level security;
alter table editions       enable row level security;
alter table predictions    enable row level security;
alter table sources        enable row level security;
alter table snapshots      enable row level security;
alter table observations   enable row level security;
alter table source_runs    enable row level security;
alter table pipeline_runs  enable row level security;

-- Public read on the published surface only.
create policy "public read" on organisations for select using (true);
create policy "public read" on opportunities for select using (true);
create policy "public read" on editions      for select using (true);
create policy "public read" on predictions   for select using (true);
create policy "public read" on sources       for select using (true);

-- Evidence, raw snapshots and run logs stay private: they contain scraped
-- page content and cost data with no reason to be public.
-- (No select policy = no anon access. Service role still has full access.)

-- ============================================================================
-- TRIGGERS
-- ============================================================================

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger t_org_touch  before update on organisations
  for each row execute function touch_updated_at();
create trigger t_opp_touch  before update on opportunities
  for each row execute function touch_updated_at();

-- When a real source confirms a date, retire any open prediction for it.
create or replace function supersede_predictions() returns trigger
language plpgsql as $$
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

create trigger t_supersede after update on opportunities
  for each row execute function supersede_predictions();
