-- ============================================================================
-- Row Level Security audit for the SONAR live-site database.
--
-- READ-ONLY. Run it in the Supabase SQL editor of the project the website
-- reads (the one behind VITE_SUPABASE_URL). Nothing here changes anything.
--
-- Why it matters: the site's anon key is compiled into the JavaScript every
-- visitor downloads. It is public. These queries show what that public key
-- can actually do. Each query says what a healthy result looks like.
-- ============================================================================

-- 1. Tables in `public` with Row Level Security OFF.
--    EXPECT: no rows. A table without RLS is fully readable and writable by
--    anyone holding the anon key.
select schemaname, tablename
from pg_tables
where schemaname = 'public'
  and not rowsecurity
order by tablename;

-- 2. Every policy that applies to the anon or authenticated roles.
--    EXPECT (live-site project):
--      opportunities       SELECT only
--      past_opportunities  SELECT only
--      updates             SELECT, plus INSERT limited to change_kind = 'watch'
--      watchlist           ALL (deliberate: the no-login shared watchlist)
--    Anything else with cmd = 'ALL' or 'INSERT'/'UPDATE'/'DELETE' on a board
--    table is a hole.
select tablename, policyname, cmd, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'public'
  and (roles && array['anon', 'authenticated']::name[] or roles = '{public}')
order by tablename, cmd, policyname;

-- 3. Policies that allow a write with an unconditional `true`.
--    EXPECT: only the `watchlist` rows. (`opportunities` and
--    `past_opportunities` must NOT appear: that was the original hole, fixed in
--    web/supabase/migrations/20260812_lock_down_anon_writes.sql.)
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
  and (qual is null or qual = 'true')
  and (with_check is null or with_check = 'true')
  and (roles && array['anon', 'authenticated']::name[] or roles = '{public}')
order by tablename;

-- 4. Table privileges granted to anon / authenticated.
--    EXPECT: SELECT on opportunities and past_opportunities; SELECT + INSERT
--    on updates; SELECT + INSERT + DELETE on watchlist. No UPDATE or DELETE on
--    the board tables, no TRUNCATE anywhere.
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

-- 5. SECURITY DEFINER functions in `public`.
--    EXPECT: none, unless you wrote one on purpose. They run with their
--    owner's rights and bypass RLS for whoever can call them.
select n.nspname as schema, p.proname as function
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef;

-- 6. Views. A view runs with its owner's rights unless it is declared
--    security_invoker, which would let it read around RLS.
--    EXPECT: none in `public`, or every one with security_invoker = true.
select c.relname as view, c.reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v';

-- 7. Forged-audit-trail check: rows in `updates` that anon could not have
--    legitimately written (anything that is not a watch action by a human).
--    These can only exist if a write policy was open. EXPECT: rows written by
--    the sync workflow (actor_kind = 'automated'), and 'watch' rows by people.
--    Rows with other change_kind values and actor_kind = 'human' deserve a look.
select change_kind, actor_kind, count(*) as rows, min(created_at) as first, max(created_at) as last
from public.updates
group by change_kind, actor_kind
order by rows desc;
