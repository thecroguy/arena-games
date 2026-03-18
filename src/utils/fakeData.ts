// ══════════════════════════════════════════════════════════════════════════════
// ── FAKE DATA MODULE (delete this entire file when real users grow) ───────────
// ── Integration points marked with "// ── FAKE DATA" in Lobby + Leaderboard ──
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
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

const GAMES    = ['Math Arena', 'Pattern Memory', 'Reaction Grid', 'Highest Unique', "Liar's Dice"]
const ENTRIES  = ['$0.50', '$1', '$2', '$5']
const POTS     = { '$0.50': '0.85', '$1': '1.70', '$2': '3.40', '$5': '8.50' }

function pickUser() { return FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)] }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }

// ── Fake activity — using same names that appear in leaderboard & chat ─────
function makeFakeActivity(): string {
  const u     = pickUser()
  const game  = pick(GAMES)
  const entry = pick(ENTRIES)
  const pot   = POTS[entry as keyof typeof POTS]
  const type  = rand(0, 3)
  switch (type) {
    case 0:  return `🏆 ${u.name} won $${pot} — ${game}`
    case 1:  return `👤 ${u.name} joined ${game} (${entry})`
    case 2:  return `🎮 ${u.name} opened a ${entry} room — ${game}`
    default: return `⚔️ ${u.name} created a ${entry} duel — ${game}`
  }
}

// ── Fake chat — same users as activity & leaderboard ──────────────────────
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

// ── Hook: inject fake activity periodically into real feed ────────────────
export function useFakeActivity(
  setActivityFeed: React.Dispatch<React.SetStateAction<{ msg: string; ts: number }[]>>
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    // Pre-seed 5 varied fake items (random each page load)
    setActivityFeed(prev => {
      if (prev.length > 0) return prev
      return Array.from({ length: 5 }, (_, i) => ({
        msg: makeFakeActivity(),
        ts: Date.now() - (5 - i) * rand(20000, 120000),
      })).sort((a, b) => b.ts - a.ts)
    })
    function schedule() {
      timerRef.current = setTimeout(() => {
        setActivityFeed(prev => [{ msg: makeFakeActivity(), ts: Date.now() }, ...prev].slice(0, 100))
        schedule()
      }, rand(15000, 60000))
    }
    schedule()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [setActivityFeed])
}

// ── Hook: inject fake chat messages periodically ──────────────────────────
export function useFakeChat(
  setGlobalChat: React.Dispatch<React.SetStateAction<{ username: string; message: string; ts: number }[]>>
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    // Pre-seed 6 varied fake chat messages (random each page load)
    setGlobalChat(prev => {
      if (prev.length > 0) return prev
      return Array.from({ length: 6 }, (_, i) => ({
        ...makeFakeChat(),
        ts: Date.now() - (6 - i) * rand(40000, 200000),
      }))
    })
    function schedule() {
      timerRef.current = setTimeout(() => {
        setGlobalChat(prev => [...prev, makeFakeChat()].slice(-50))
        schedule()
      }, rand(20000, 80000))
    }
    schedule()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [setGlobalChat])
}

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
