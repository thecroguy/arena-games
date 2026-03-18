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
  chain_id      integer     not null default 137,
  payout_mode   text        not null default 'manual', -- 'escrow' | 'manual'
  played_at     timestamptz not null default now()
);

-- Migration: add columns if table already exists
alter table game_history add column if not exists chain_id      integer not null default 137;
alter table game_history add column if not exists payout_mode   text    not null default 'manual';
alter table game_history add column if not exists escrow_address text;          -- contract address (null = no escrow)
alter table game_history add column if not exists room_id_hash   text;          -- keccak256(roomCode) used on-chain
alter table game_history add column if not exists claim_sig      text;          -- server's ECDSA sig (winner row only)
alter table game_history add column if not exists claimed_at     timestamptz;   -- set when winner calls claim() on-chain

-- ── Escrow audit log ───────────────────────────────────────────────────────
-- Full on-chain evidence for every deposit, payout authorization, and refund.
-- Use this table to resolve any "I never got paid" or "I deposited but no refund" disputes.
create table if not exists escrow_events (
  id             bigserial   primary key,
  event_type     text        not null,  -- see below
  room_code      text        not null,
  room_id_hash   text        not null,  -- bytes32 keccak256(roomCode) — query on Polygonscan
  chain_id       integer     not null,
  escrow_address text        not null,  -- which contract holds the funds
  player_address text        not null,  -- who this event is about
  amount_usdt    numeric,               -- entry fee involved
  tx_hash        text,                  -- on-chain tx hash (when known)
  sig            text,                  -- ECDSA sig server issued (claim_signed / refund_signed)
  note           text,                  -- human-readable context
  created_at     timestamptz not null default now()
);
-- event_type values:
--   'deposit_confirmed'  — server verified player's on-chain deposit
--   'claim_signed'       — server signed winner authorization (claimSig issued)
--   'refund_signed'      — server signed refund authorization (refundSig issued)

create index if not exists idx_escrow_events_room    on escrow_events (room_code);
create index if not exists idx_escrow_events_player  on escrow_events (player_address);
create index if not exists idx_escrow_events_type    on escrow_events (event_type);
create index if not exists idx_escrow_events_created on escrow_events (created_at desc);

alter table escrow_events enable row level security;

drop policy if exists "Public read escrow_events" on escrow_events;
create policy "Public read escrow_events"
  on escrow_events for select using (true);

grant select on escrow_events to anon;

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
create or replace view leaderboard_alltime with (security_invoker = true) as
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
create or replace view leaderboard_weekly with (security_invoker = true) as
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
create or replace view leaderboard_daily with (security_invoker = true) as
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
  avatar_style      text not null default 'bottts',
  purchased_styles  text[] not null default '{"bottts"}',
  updated_at        timestamptz not null default now()
);

alter table player_profiles enable row level security;

-- Anyone can read profiles (for showing usernames/avatars in game)
drop policy if exists "Public read profiles" on player_profiles;
create policy "Public read profiles"
  on player_profiles for select using (true);

-- Writes go through server API (service key bypasses RLS, wallet sig verified server-side)
drop policy if exists "Owner upsert profile" on player_profiles;
revoke insert, update, delete on player_profiles from anon;

grant select on player_profiles to anon;

-- ── Active rooms (survives server restarts) ────────────────────────────────
-- Persisted so rooms are not lost when Render restarts.
-- Only waiting rooms are stored here — cleared when game starts or room ends.
create table if not exists active_rooms (
  code        text primary key,
  game_mode   text not null,
  entry_fee   numeric not null,
  chain_id    integer not null default 137,
  max_players integer not null,
  host        text not null,
  players     jsonb not null default '[]', -- [{address, deposited}]
  status      text not null default 'waiting',
  created_at  timestamptz not null default now()
);

alter table active_rooms enable row level security;

drop policy if exists "Public read active_rooms" on active_rooms;
create policy "Public read active_rooms"
  on active_rooms for select using (true);

grant select on active_rooms to anon;

-- ── Referral program ─────────────────────────────────────────────────────────
alter table player_profiles
  add column if not exists referral_code text unique;

create unique index if not exists idx_player_profiles_referral_code
  on player_profiles (referral_code);

alter table game_history
  add column if not exists referral_credited boolean not null default false;

create table if not exists referrals (
  id               bigserial    primary key,
  referrer_address text         not null,
  referee_address  text         not null unique,
  games_counted    integer      not null default 0 check (games_counted <= 20),
  earned_usdt      numeric(10,4) not null default 0,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now()
);

create index if not exists idx_referrals_referrer on referrals (referrer_address);

alter table referrals enable row level security;
drop policy if exists "Public read referrals" on referrals;
create policy "Public read referrals" on referrals for select using (true);
grant select on referrals to anon;

create table if not exists referral_payouts (
  id               bigserial    primary key,
  referrer_address text         not null,
  amount_usdt      numeric(10,4) not null,
  status           text         not null default 'pending' check (status in ('pending','paid')),
  requested_at     timestamptz  not null default now(),
  paid_at          timestamptz,
  tx_hash          text
);

create index if not exists idx_referral_payouts_referrer on referral_payouts (referrer_address);
create index if not exists idx_referral_payouts_status   on referral_payouts (status);

alter table referral_payouts enable row level security;
drop policy if exists "Public read referral_payouts" on referral_payouts;
create policy "Public read referral_payouts" on referral_payouts for select using (true);
grant select on referral_payouts to anon;
