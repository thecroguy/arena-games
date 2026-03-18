// ══════════════════════════════════════════════════════════════════════════════
// ── FAKE DATA MODULE (delete this entire file when real users grow) ───────────
// ── Integration points marked with "// ── FAKE DATA" in Lobby + Leaderboard ──
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import type { LeaderboardEntry } from './supabase'

// ── Fake users — same Adj+Noun+number style as the real addrName() function ──
// So they look indistinguishable from real auto-generated usernames
const FAKE_USERS = [
  { name: 'SwiftWolf23',    addr: '0x0000000000000000000000000000000000000001' },
  { name: 'DarkFox07',      addr: '0x0000000000000000000000000000000000000002' },
  { name: 'BoldHawk44',     addr: '0x0000000000000000000000000000000000000003' },
  { name: 'IronPhoenix15',  addr: '0x0000000000000000000000000000000000000004' },
  { name: 'NeonDragon33',   addr: '0x0000000000000000000000000000000000000005' },
  { name: 'FrostShark62',   addr: '0x0000000000000000000000000000000000000006' },
  { name: 'BlazeTiger08',   addr: '0x0000000000000000000000000000000000000007' },
  { name: 'ShadowLion55',   addr: '0x0000000000000000000000000000000000000008' },
  { name: 'StormNinja77',   addr: '0x0000000000000000000000000000000000000009' },
  { name: 'LunarViper21',   addr: '0x000000000000000000000000000000000000000a' },
  { name: 'TurboEagle48',   addr: '0x000000000000000000000000000000000000000b' },
  { name: 'GhostPanda09',   addr: '0x000000000000000000000000000000000000000c' },
  { name: 'SteelKnight36',  addr: '0x000000000000000000000000000000000000000d' },
  { name: 'NovaRider63',    addr: '0x000000000000000000000000000000000000000e' },
  { name: 'CrimsonNomad17', addr: '0x000000000000000000000000000000000000000f' },
  { name: 'SavageTitan52',  addr: '0x0000000000000000000000000000000000000010' },
  { name: 'RogueWizard28',  addr: '0x0000000000000000000000000000000000000011' },
  { name: 'SigmaSniper71',  addr: '0x0000000000000000000000000000000000000012' },
  { name: 'HyperCoder39',   addr: '0x0000000000000000000000000000000000000013' },
  { name: 'PixelPirate56',  addr: '0x0000000000000000000000000000000000000014' },
  { name: 'WildRanger82',   addr: '0x0000000000000000000000000000000000000015' },
  { name: 'SlyHunter13',    addr: '0x0000000000000000000000000000000000000016' },
  { name: 'BraveBlade94',   addr: '0x0000000000000000000000000000000000000017' },
  { name: 'CyberBear91',    addr: '0x0000000000000000000000000000000000000018' },
  { name: 'SolarBandit84',  addr: '0x0000000000000000000000000000000000000019' },
]

// Name→address and address→name lookups (used by leaderboard displayName)
export const FAKE_USER_NAMES: Record<string, string> = Object.fromEntries(
  FAKE_USERS.map(u => [u.addr, u.name])
)

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function pickUser() { return pick(FAKE_USERS) }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }

// ── Fake chat — same users as activity & leaderboard (activity now server-side) ─
const CHAT_LINES = [
  'anyone for $1 match?', 'gg wp', 'who wants to duel?', 'just won nice',
  'math arena is my game', 'reaction grid is brutal', 'easy tonight',
  'lets go 🔥', 'highest unique is hard when smart ppl here',
  'pattern memory is actually tough', 'lost twice :(', 'rematch?',
  'this platform is underrated', 'good game everyone', 'duel open',
  'who tryna play', 'gg', 'nice win', 'first time here',
  'been grinding all day', 'quick match anyone', 'love liar dice',
  'anyone on polygon?', 'down for a game', 'solid platform ngl',
  'cant believe i won that', 'pattern memory is wild', 'on a streak rn',
  'who has the highest win rate here', 'nice round', 'wp all',
]

export function makeFakeChat(): { username: string; message: string; ts: number } {
  return { username: pickUser().name, message: pick(CHAT_LINES), ts: Date.now() }
}

// ── Hook: fake online count (fluctuates 8–44, added to real count) ────────
export function useFakeOnlineCount(): number {
  const [count, setCount] = useState(() => rand(12, 28))
  useEffect(() => {
    const tick = () => setCount(prev => Math.max(8, Math.min(44, prev + rand(-3, 3))))
    const id = setInterval(tick, rand(18000, 40000))
    return () => clearInterval(id)
  }, [])
  return count
}

// (useFakeActivity and useFakeChat removed — now handled server-side so all users see same feed)

// ── Fake leaderboard — SAME users as activity & chat, realistic stats ─────
// Addresses are obviously fake (0x000...001) so easy to filter/remove later
const FAKE_LB_RAW = [
  { idx: 0,  wins: 47, games: 63,  net: 38.25 },
  { idx: 1,  wins: 41, games: 58,  net: 31.50 },
  { idx: 2,  wins: 38, games: 55,  net: 27.80 },
  { idx: 3,  wins: 33, games: 49,  net: 22.40 },
  { idx: 4,  wins: 29, games: 44,  net: 19.60 },
  { idx: 5,  wins: 25, games: 40,  net: 15.30 },
  { idx: 6,  wins: 21, games: 36,  net: 12.90 },
  { idx: 7,  wins: 18, games: 31,  net: 10.20 },
  { idx: 8,  wins: 14, games: 25,  net:  7.50 },
  { idx: 9,  wins: 11, games: 20,  net:  5.10 },
  { idx: 10, wins:  9, games: 17,  net:  3.80 },
  { idx: 11, wins:  7, games: 14,  net:  2.60 },
]

export function getFakeLeaderboard(): LeaderboardEntry[] {
  return FAKE_LB_RAW.map((e, i) => ({
    player_address: FAKE_USERS[e.idx].addr,
    wins:           e.wins,
    games_played:   e.games,
    win_rate:       Math.round((e.wins / e.games) * 100),
    net_earned:     e.net,
    rank:           i + 1,
  }))
}

// ── END FAKE DATA MODULE ──────────────────────────────────────────────────
