-- ============================================================================
-- SONAR — team evidence: what we've shipped, and how it went
--
-- The board answers "is this worth entering". Answering it well needs two
-- things about US, not just about the competition:
--
--   repos  — what this team has demonstrably built. Machine-derivable from
--            the GitHub API, so it stays true without anyone maintaining it.
--   retros — what actually happened when we entered. NOT derivable from
--            anything: a commit log cannot record that the idea was picked
--            in the last 48 hours, or that auth ate a third of the weekend.
--
-- Why both live here rather than only in JSON: the queries that matter are
-- aggregations across time ("what do we place well in", "does prep window
-- correlate with placement"), which is the same reason the rest of this
-- schema exists. The JSON files stay the reviewable source of truth; these
-- tables are what you can actually ask questions of.
--
-- Deliberately NOT here: any win_probability column. One recorded outcome
-- cannot support one, and a column invites someone to fill it.
-- ============================================================================

create table if not exists repos (
  id             uuid primary key default gen_random_uuid(),
  full_name      text unique not null,          -- owner/name
  owner          text not null,
  description    text,
  language       text,
  is_private     boolean not null default false,

  created_at_gh  date,                          -- GitHub's created_at
  pushed_at_gh   date,
  active_days    integer,                       -- created -> last push

  -- Set by hand. Only a person can say "KHANYA is the Mintek build";
  -- inferring it from the name would fabricate a link.
  opportunity_slug text,

  synced_at      timestamptz not null default now()
);

create index if not exists repos_opportunity_idx on repos (opportunity_slug)
  where opportunity_slug is not null;
create index if not exists repos_language_idx on repos (language);

create type retro_outcome as enum (
  'won', 'placed', 'finalist', 'entered', 'rejected', 'withdrew', 'missed'
);

create table if not exists retros (
  id               uuid primary key default gen_random_uuid(),
  opportunity_slug text,                        -- null = board never tracked it
  repo_full_name   text,

  entered_on       date,
  event_on         date,
  prep_window_days integer generated always as (event_on - entered_on) stored,
  hours_spent      numeric(6,1),

  idea             text,
  idea_origin      text,
  stack            text[] default '{}',

  outcome          retro_outcome,
  placement        text,

  what_worked      text,
  what_cost_us     text,
  would_reuse      text[] default '{}',
  judge_feedback   text,                        -- verbatim or null. never paraphrased.

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists retros_outcome_idx on retros (outcome);
create index if not exists retros_opportunity_idx on retros (opportunity_slug);

create trigger t_retros_touch before update on retros
  for each row execute function touch_updated_at();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Competitions we entered that the board never knew about. Reading the repo
-- list found two of these on day one (Google WAXAL ASR, Agent-Guardian) -
-- a coverage gap no amount of monitoring would have surfaced, because the
-- monitoring never knew to look.
create or replace view v_untracked_entries as
select r.full_name, r.description, r.language, r.created_at_gh
from repos r
where r.opportunity_slug is null
  and r.full_name in (select repo_full_name from retros where repo_full_name is not null)
union
select r.full_name, r.description, r.language, r.created_at_gh
from repos r
where r.opportunity_slug is null
  and (r.description ilike '%hackathon%'
       or r.description ilike '%challenge%'
       or r.description ilike '%competition%'
       or r.description ilike '%kaggle%');

-- What this team reaches for, most-used first. Feeds capability matching.
create or replace view v_stack_profile as
select language, count(*) as repos
from repos
where language is not null
group by language
order by repos desc;

-- Deliberately thin: with n=1 this is a record, not a model. It exists so
-- the shape is ready when there are enough entries to say anything, and so
-- it's obvious how few there are.
create or replace view v_outcomes as
select
  outcome,
  count(*)                        as n,
  round(avg(prep_window_days), 1) as avg_prep_days,
  round(avg(hours_spent), 1)      as avg_hours
from retros
where outcome is not null
group by outcome
order by n desc;

-- ============================================================================
-- RLS — same posture as 0001: published surface readable, evidence private.
-- ============================================================================

alter table repos  enable row level security;
alter table retros enable row level security;

-- repos is portfolio metadata that's mostly public on GitHub anyway.
create policy "public read" on repos for select using (true);

-- retros are NOT public: "what cost us" and verbatim judge feedback are
-- candid internal notes. Service role only, same as snapshots/observations.
-- (No select policy = no anon access.)

alter view v_untracked_entries set (security_invoker = true);
alter view v_stack_profile     set (security_invoker = true);
alter view v_outcomes          set (security_invoker = true);
