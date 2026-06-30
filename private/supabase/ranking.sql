-- =====================================================================
--  Chatynkowo — Ranking Zdobywców (Supabase)
--  The entire ranking "backend". Paste this into Supabase → SQL Editor and
--  Run it. The script is IDEMPOTENT — it can be re-run without harming data
--  (drop policy if exists / create or replace).
--
--  Model: one Google account = one player. RLS ensures each player writes only
--  their own rows; the public, aggregated ranking is exposed by the
--  leaderboard() function (security definer), so raw rows never leak.
-- =====================================================================

-- ---------- PROFILES: the public part of an account (nickname, optional photo) ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  public_id    text unique not null,          -- short, random id for the ?me= link
  display_name text not null,                  -- nickname (defaults to the Google given name)
  avatar_url   text,                           -- NULL = no photo (optional, opt-in)
  completed_at timestamptz,                    -- when the full set was collected (informational)
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles_read_own"   on public.profiles;
drop policy if exists "profiles_insert_own"  on public.profiles;
drop policy if exists "profiles_update_own"  on public.profiles;
create policy "profiles_read_own"   on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- FINDS: one find = one row (user + cottage) ----------
create table if not exists public.finds (
  user_id   uuid not null references auth.users on delete cascade,
  slug      text not null,
  found_at  timestamptz not null default now(),  -- real discovery date (from localStorage)
  primary key (user_id, slug)                     -- the same cottage counts once
);
alter table public.finds enable row level security;

drop policy if exists "finds_read_own"   on public.finds;
drop policy if exists "finds_insert_own" on public.finds;
drop policy if exists "finds_update_own" on public.finds;
drop policy if exists "finds_delete_own" on public.finds;
create policy "finds_read_own"   on public.finds for select using (auth.uid() = user_id);
create policy "finds_insert_own" on public.finds for insert with check (auth.uid() = user_id);
create policy "finds_update_own" on public.finds for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "finds_delete_own" on public.finds for delete using (auth.uid() = user_id);

-- ---------- LEADERBOARD: public, aggregated read ----------
--  security definer → bypasses RLS, but RETURNS ONLY safe, aggregated fields
--  (nickname, avatar, count, time). Ordering: finishers (full set) first, by
--  shortest time; below them collectors by cottage count.
--  elapsed_seconds = (last - first found) in seconds, computed for EVERY player
--  (for finishers = the full-set completion time).
-- The OUT column signature changes, so DROP first — the whole script stays idempotent.
drop function if exists public.leaderboard(int);
create or replace function public.leaderboard(p_total int default 25)
returns table (
  public_id          text,
  display_name       text,
  avatar_url         text,
  found              int,
  completed          boolean,
  elapsed_seconds    bigint,
  first_found        timestamptz,
  last_found         timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pr.public_id,
    pr.display_name,
    pr.avatar_url,
    count(f.slug)::int                                   as found,
    (count(f.slug) >= p_total)                           as completed,
    extract(epoch from (max(f.found_at) - min(f.found_at)))::bigint
                                                         as elapsed_seconds,
    min(f.found_at)                                       as first_found,
    max(f.found_at)                                       as last_found
  from public.profiles pr
  join public.finds f on f.user_id = pr.id
  group by pr.public_id, pr.display_name, pr.avatar_url
  having count(f.slug) > 0
  order by
    (count(f.slug) >= p_total) desc,                      -- 1) finishers first
    case when count(f.slug) >= p_total                    -- 2) fastest full set
         then extract(epoch from (max(f.found_at) - min(f.found_at))) end asc nulls last,
    count(f.slug) desc,                                   -- 3) below: by count
    extract(epoch from (max(f.found_at) - min(f.found_at))) asc,  -- 4) faster pace ranks higher
    min(f.found_at) asc;                                  -- 5) tie-break: who started earlier
$$;

-- Public read of the ranking via the anon key (and for signed-in users); revoke the default grant to public.
revoke all on function public.leaderboard(int) from public;
grant execute on function public.leaderboard(int) to anon, authenticated;
