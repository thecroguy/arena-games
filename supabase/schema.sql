-- Arena Games — Supabase Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)

-- ── Game history ─────────────────────────────────────────────────────────
create table if not exists game_history (
  id            bigserial primary key,
  room_code     text        not null,
  game_mode     text        not null,
  player_address text       not null,
  score         integer     not null,
  total_rounds  integer     not null default 10,
  result        text        not null check (result in ('win', 'loss')),
  entry_fee     numeric     not null,
  earned        numeric     not null,  -- positive = profit, negative = loss
  players_count integer     not null,
  played_at     timestamptz not null default now()
);

create index if not exists idx_game_history_address  on game_history (player_address);
create index if not exists idx_game_history_played_at on game_history (played_at desc);
create index if not exists idx_game_history_room      on game_history (room_code);

-- Row level security — anyone can read, only server (service key) can write
alter table game_history enable row level security;

drop policy if exists "Public read game_history" on game_history;
create policy "Public read game_history"
  on game_history for select
  using (true);

-- ── Leaderboard view (all-time) ───────────────────────────────────────────
create or replace view leaderboard_alltime as
select
  player_address,
  count(*)                              as games_played,
  count(*) filter (where result='win')  as wins,
  round(
    count(*) filter (where result='win')::numeric / count(*) * 100
  )                                     as win_rate,
  round(sum(earned)::numeric, 2)        as net_earned,
  row_number() over (order by count(*) filter (where result='win') desc, round(sum(earned)::numeric,2) desc) as rank
from game_history
group by player_address;

-- ── Leaderboard view (weekly) ─────────────────────────────────────────────
create or replace view leaderboard_weekly as
select
  player_address,
  count(*)                              as games_played,
  count(*) filter (where result='win')  as wins,
  round(
    count(*) filter (where result='win')::numeric / count(*) * 100
  )                                     as win_rate,
  round(sum(earned)::numeric, 2)        as net_earned,
  row_number() over (order by count(*) filter (where result='win') desc, round(sum(earned)::numeric,2) desc) as rank
from game_history
where played_at >= now() - interval '7 days'
group by player_address;

-- ── Leaderboard view (daily) ──────────────────────────────────────────────
create or replace view leaderboard_daily as
select
  player_address,
  count(*)                              as games_played,
  count(*) filter (where result='win')  as wins,
  round(
    count(*) filter (where result='win')::numeric / count(*) * 100
  )                                     as win_rate,
  round(sum(earned)::numeric, 2)        as net_earned,
  row_number() over (order by count(*) filter (where result='win') desc, round(sum(earned)::numeric,2) desc) as rank
from game_history
where played_at >= now() - interval '1 day'
group by player_address;

-- Grant access to anon role for views (used by frontend with anon key)
grant select on leaderboard_alltime to anon;
grant select on leaderboard_weekly  to anon;
grant select on leaderboard_daily   to anon;
grant select on game_history        to anon;

-- ── Player profiles ────────────────────────────────────────────────────────
create table if not exists player_profiles (
  address           text primary key,                        -- wallet address (lowercase)
  username          text,
  avatar_style      text not null default 'adventurer',
  purchased_styles  text[] not null default '{"adventurer"}',
  updated_at        timestamptz not null default now()
);

alter table player_profiles enable row level security;

-- Anyone can read profiles (for showing usernames/avatars in game)
drop policy if exists "Public read profiles" on player_profiles;
create policy "Public read profiles"
  on player_profiles for select using (true);

-- Anyone can upsert their own profile (frontend uses anon key + address check)
drop policy if exists "Owner upsert profile" on player_profiles;
create policy "Owner upsert profile"
  on player_profiles for all using (true) with check (true);

grant select, insert, update on player_profiles to anon;
