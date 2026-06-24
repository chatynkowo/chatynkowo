-- =====================================================================
--  Chatynkowo — Ranking Zdobywców (Supabase)
--  Cały "backend" rankingu. Wklej tę zawartość w Supabase → SQL Editor
--  i uruchom (Run). Skrypt jest IDEMPOTENTNY — można go puścić ponownie
--  bez psucia danych (drop policy if exists / create or replace).
--
--  Model: konto Google = jeden gracz. RLS pilnuje, że każdy zapisuje
--  tylko własne wpisy; publiczny, zagregowany ranking udostępnia funkcja
--  leaderboard() (security definer), więc surowe wiersze nie wyciekają.
-- =====================================================================

-- ---------- PROFILES: jawna część konta (pseudonim, opcjonalne zdjęcie) ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  public_id    text unique not null,          -- krótkie, losowe ID do linku ?me=
  display_name text not null,                  -- pseudonim (domyślnie imię z Google)
  avatar_url   text,                           -- NULL = brak zdjęcia (opcjonalne, opt-in)
  completed_at timestamptz,                    -- kiedy zebrano komplet (informacyjnie)
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles_read_own"   on public.profiles;
drop policy if exists "profiles_insert_own"  on public.profiles;
drop policy if exists "profiles_update_own"  on public.profiles;
create policy "profiles_read_own"   on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- FINDS: jedno znalezisko = jeden wiersz (user + chatynka) ----------
create table if not exists public.finds (
  user_id   uuid not null references auth.users on delete cascade,
  slug      text not null,
  found_at  timestamptz not null default now(),  -- realna data odkrycia (z localStorage)
  primary key (user_id, slug)                     -- ta sama chatynka liczy się raz
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

-- ---------- LEADERBOARD: publiczny, zagregowany odczyt ----------
--  security definer → omija RLS, ale ZWRACA TYLKO bezpieczne, zagregowane
--  pola (pseudonim, avatar, liczba, czas). Sortowanie: ukończeni (25/25)
--  najpierw, wg najkrótszego czasu; niżej zbierający wg liczby chatynek.
--  Czas ukończenia = (ostatnie - pierwsze znalezisko) w sekundach.
create or replace function public.leaderboard(p_total int default 25)
returns table (
  public_id          text,
  display_name       text,
  avatar_url         text,
  found              int,
  completed          boolean,
  completion_seconds bigint,
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
    case when count(f.slug) >= p_total
         then extract(epoch from (max(f.found_at) - min(f.found_at)))::bigint
         else null end                                   as completion_seconds,
    min(f.found_at)                                       as first_found,
    max(f.found_at)                                       as last_found
  from public.profiles pr
  join public.finds f on f.user_id = pr.id
  group by pr.public_id, pr.display_name, pr.avatar_url
  having count(f.slug) > 0
  order by
    (count(f.slug) >= p_total) desc,                      -- 1) ukończeni najpierw
    case when count(f.slug) >= p_total                    -- 2) najszybszy komplet
         then extract(epoch from (max(f.found_at) - min(f.found_at))) end asc nulls last,
    count(f.slug) desc,                                   -- 3) niżej: wg liczby
    min(f.found_at) asc;                                  -- 4) remis: kto wcześniej zaczął
$$;

-- Publiczny odczyt rankingu kluczem anon (i dla zalogowanych); blokujemy domyślny grant dla public.
revoke all on function public.leaderboard(int) from public;
grant execute on function public.leaderboard(int) to anon, authenticated;
