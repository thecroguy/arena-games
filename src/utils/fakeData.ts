// ══════════════════════════════════════════════════════════════════════════════
// ── FAKE DATA MODULE (remove this entire file when real users grow) ───────────
// ── All fake data is isolated here. Search "FAKE DATA" to find integration ───
// ── points in Lobby.tsx and Leaderboard.tsx ───────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import type { LeaderboardEntry } from './supabase'

// ── Fake user pool ────────────────────────────────────────────────────────────
const FAKE_USERS = [
  'CryptoWolf', 'NeonBlade', 'PixelStorm', 'ShadowPunk', 'CyberFox',
  'GlitchKing', 'VoidRacer', 'NovaDrift', 'ByteHawk', 'QuantumAce',
  'DarkNode', 'StarForge', 'IronPulse', 'EchoStrike', 'ZeroGhost',
  'CipherRex', 'TurboMind', 'NightOwl88', 'HexBreaker', 'ArcFlash',
  'DeepScan', 'MintKing', 'BlockSlayer', 'WarpZone', 'MetaPrime',
]

const GAMES = ['Math Arena', 'Pattern Memory', 'Reaction Grid', 'Highest Unique', "Liar's Dice"]
const ENTRIES = ['$0.50', '$1', '$2', '$5']

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }

// ── Fake activity messages ────────────────────────────────────────────────────
function makeFakeActivity(): string {
  const type = rand(0, 3)
  const user = pick(FAKE_USERS)
  const game = pick(GAMES)
  const entry = pick(ENTRIES)
  const pot = (parseFloat(entry.slice(1)) * 2 * 0.85).toFixed(2)
  switch (type) {
    case 0: return `🏆 ${user} won $${pot} — ${game}`
    case 1: return `👤 ${user} joined ${game} (${entry})`
    case 2: return `🎮 ${user} opened a ${entry} room — ${game}`
    default: return `⚔️ ${user} created a ${entry} duel — ${game}`
  }
}

// ── Fake chat messages ────────────────────────────────────────────────────────
const FAKE_CHAT_LINES = [
  'anyone for $1 match?', 'gg wp', 'who wants to duel?', 'just won $4.25 lol',
  'math arena is my game', 'reaction grid is brutal', 'easy money tonight',
  'lets go 🔥', 'anyone on polygon?', 'highest unique is hard when smart ppl here',
  'pattern memory is actually hard', 'lost twice :(', 'rematch?',
  'this platform is underrated', 'good game everyone', '$5 duel open dm me',
  'who tryna play', 'gg', 'nice win bro', 'first time here, how does escrow work?',
  'loved the liar dice', 'quick match anyone', 'been grinding all day',
]

export function makeFakeChat(): { username: string; message: string; ts: number } {
  return { username: pick(FAKE_USERS), message: pick(FAKE_CHAT_LINES), ts: Date.now() }
}

// ── Hook: fake online count (fluctuates between 8–44, added to real count) ────
export function useFakeOnlineCount(): number {
  const [count, setCount] = useState(() => rand(12, 28))
  useEffect(() => {
    const tick = () => {
      setCount(prev => {
        const delta = rand(-3, 3)
        return Math.max(8, Math.min(44, prev + delta))
      })
    }
    const id = setInterval(tick, rand(18000, 40000)) // change every 18–40s
    return () => clearInterval(id)
  }, [])
  return count
}

// ── Hook: injects fake activity items into the real feed periodically ─────────
export function useFakeActivity(
  setActivityFeed: React.Dispatch<React.SetStateAction<{ msg: string; ts: number }[]>>
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function schedule() {
      const delay = rand(18000, 55000) // every 18–55 seconds
      timerRef.current = setTimeout(() => {
        const fakeItem = { msg: makeFakeActivity(), ts: Date.now() }
        setActivityFeed(prev => [fakeItem, ...prev].slice(0, 15))
        schedule()
      }, delay)
    }
    // Initial burst: 3 fake items already in feed on first load
    setActivityFeed(prev => {
      if (prev.length > 0) return prev // don't add if real data already loaded
      const initial = Array.from({ length: 4 }, () => ({
        msg: makeFakeActivity(),
        ts: Date.now() - rand(30000, 300000),
      })).sort((a, b) => b.ts - a.ts)
      return initial
    })
    schedule()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [setActivityFeed])
}

// ── Hook: injects fake chat messages periodically ─────────────────────────────
export function useFakeChat(
  setGlobalChat: React.Dispatch<React.SetStateAction<{ username: string; message: string; ts: number }[]>>
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function schedule() {
      const delay = rand(25000, 90000) // every 25–90 seconds
      timerRef.current = setTimeout(() => {
        setGlobalChat(prev => [...prev, makeFakeChat()].slice(-50))
        schedule()
      }, delay)
    }
    // Pre-seed 5 fake chat messages on load (spread over last 10 min)
    setGlobalChat(prev => {
      if (prev.length > 0) return prev
      return Array.from({ length: 5 }, (_, i) => ({
        ...makeFakeChat(),
        ts: Date.now() - (5 - i) * rand(60000, 150000),
      }))
    })
    schedule()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [setGlobalChat])
}

// ── Fake leaderboard entries (stable fake addresses, realistic stats) ──────────
// These addresses are obviously fake (0x000...001 etc) — easy to filter out later
const FAKE_LEADERBOARD_RAW = [
  { name: 'CryptoWolf',  addr: '0x0000000000000000000000000000000000000001', wins: 47, games: 63, net: 38.25 },
  { name: 'NeonBlade',   addr: '0x0000000000000000000000000000000000000002', wins: 41, games: 58, net: 31.50 },
  { name: 'PixelStorm',  addr: '0x0000000000000000000000000000000000000003', wins: 38, games: 55, net: 27.80 },
  { name: 'ShadowPunk',  addr: '0x0000000000000000000000000000000000000004', wins: 33, games: 49, net: 22.40 },
  { name: 'CyberFox',    addr: '0x0000000000000000000000000000000000000005', wins: 29, games: 44, net: 19.60 },
  { name: 'GlitchKing',  addr: '0x0000000000000000000000000000000000000006', wins: 25, games: 40, net: 15.30 },
  { name: 'VoidRacer',   addr: '0x0000000000000000000000000000000000000007', wins: 21, games: 36, net: 12.90 },
  { name: 'ByteHawk',    addr: '0x0000000000000000000000000000000000000008', wins: 18, games: 31, net: 10.20 },
  { name: 'QuantumAce',  addr: '0x0000000000000000000000000000000000000009', wins: 14, games: 25, net: 7.50  },
  { name: 'DarkNode',    addr: '0x000000000000000000000000000000000000000a', wins: 11, games: 20, net: 5.10  },
]

export const FAKE_LEADERBOARD_NAMES: Record<string, string> = Object.fromEntries(
  FAKE_LEADERBOARD_RAW.map(e => [e.addr, e.name])
)

export function getFakeLeaderboard(): LeaderboardEntry[] {
  return FAKE_LEADERBOARD_RAW.map((e, i) => ({
    player_address: e.addr,
    wins:           e.wins,
    games_played:   e.games,
    win_rate:       Math.round((e.wins / e.games) * 100),
    net_earned:     e.net,
    rank:           i + 1, // will be re-ranked after merge
  }))
}

// ── END FAKE DATA MODULE ──────────────────────────────────────────────────────
