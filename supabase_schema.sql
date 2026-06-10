-- ============================================================
-- MŚ 2026 TYPER — Schemat bazy danych
-- Wklej całość w Supabase → SQL Editor → Run
-- ============================================================

-- TABELE

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  avatar_color text default '#1a73e8',
  is_admin boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  api_match_id integer unique,
  home_team text not null,
  away_team text not null,
  home_flag text,
  away_flag text,
  home_score integer,
  away_score integer,
  kickoff_at timestamptz not null,
  stage text default 'group', -- group | r16 | qf | sf | final
  group_name text,
  status text default 'scheduled', -- scheduled | live | finished
  venue text,
  created_at timestamptz default now()
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  pred_home integer not null,
  pred_away integer not null,
  points_earned integer default 0,
  created_at timestamptz default now(),
  unique(player_id, match_id)
);

create table if not exists public.sync_log (
  id uuid primary key default gen_random_uuid(),
  synced_at timestamptz default now(),
  matches_updated integer default 0,
  notes text
);

-- WIDOK: tabela rankingowa
create or replace view public.leaderboard as
select
  p.id,
  p.name,
  p.email,
  p.avatar_color,
  coalesce(sum(pr.points_earned), 0) as total_points,
  count(pr.id) as predictions_count,
  count(case when pr.points_earned = 3 then 1 end) as exact_hits,
  count(case when pr.points_earned = 1 then 1 end) as result_hits
from public.players p
left join public.predictions pr on pr.player_id = p.id
group by p.id, p.name, p.email, p.avatar_color
order by total_points desc, exact_hits desc;

-- FUNKCJA: oblicz punkty dla meczu po wpisaniu wyniku
create or replace function public.calculate_points(p_match_id uuid)
returns void language plpgsql as $$
declare
  v_home integer;
  v_away integer;
  v_result text;
  v_pred record;
  v_pred_result text;
  v_points integer;
begin
  select home_score, away_score
  into v_home, v_away
  from public.matches
  where id = p_match_id and status = 'finished';

  if not found then return; end if;

  if v_home > v_away then v_result := 'H';
  elsif v_home < v_away then v_result := 'A';
  else v_result := 'D'; end if;

  for v_pred in
    select id, pred_home, pred_away from public.predictions
    where match_id = p_match_id
  loop
    v_points := 0;

    if v_pred.pred_home > v_pred.pred_away then v_pred_result := 'H';
    elsif v_pred.pred_home < v_pred.pred_away then v_pred_result := 'A';
    else v_pred_result := 'D'; end if;

    if v_pred.pred_home = v_home and v_pred.pred_away = v_away then
      v_points := 3; -- dokładny wynik
    elsif v_pred_result = v_result then
      v_points := 1; -- trafiony wynik 1X2
    end if;

    update public.predictions
    set points_earned = v_points
    where id = v_pred.id;
  end loop;
end;
$$;

-- RLS (Row Level Security)
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;

-- Polityki: wszyscy mogą czytać mecze i ranking
create policy "mecze_public_read" on public.matches for select using (true);
create policy "players_public_read" on public.players for select using (true);
create policy "predictions_public_read" on public.predictions for select using (true);

-- Typy: gracz może dodawać/edytować tylko swoje
create policy "predictions_insert" on public.predictions for insert
  with check (true);
create policy "predictions_update" on public.predictions for update
  using (true);

-- Admin: pełny dostęp do wszystkiego
create policy "admin_matches_all" on public.matches for all using (true) with check (true);
create policy "admin_players_all" on public.players for all using (true) with check (true);

-- DANE STARTOWE: kilka przykładowych meczów fazy grupowej MŚ 2026
insert into public.matches (api_match_id, home_team, away_team, home_flag, away_flag, kickoff_at, stage, group_name, venue) values
(1001, 'Meksyk', 'Polska', '🇲🇽', '🇵🇱', '2026-06-11 22:00:00+00', 'group', 'Grupa B', 'Azteca, Mexico City'),
(1002, 'USA', 'Kanada', '🇺🇸', '🇨🇦', '2026-06-12 01:00:00+00', 'group', 'Grupa A', 'MetLife, New York'),
(1003, 'Argentyna', 'Niemcy', '🇦🇷', '🇩🇪', '2026-06-13 18:00:00+00', 'group', 'Grupa C', 'Rose Bowl, LA'),
(1004, 'Francja', 'Brazylia', '🇫🇷', '🇧🇷', '2026-06-14 21:00:00+00', 'group', 'Grupa D', 'AT&T, Dallas'),
(1005, 'Anglia', 'Hiszpania', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇪🇸', '2026-06-15 18:00:00+00', 'group', 'Grupa E', 'SoFi, LA')
on conflict (api_match_id) do nothing;
