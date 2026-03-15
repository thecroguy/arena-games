import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

export type GameHistory = {
  id: number
  room_code: string
  game_mode: string
  player_address: string
  score: number
  total_rounds: number
  result: 'win' | 'loss'
  entry_fee: number
  earned: number
  players_count: number
  played_at: string
}

export type LeaderboardEntry = {
  player_address: string
  games_played: number
  wins: number
  win_rate: number
  net_earned: number
  rank: number
}

export async function fetchLeaderboard(period: 'alltime' | 'weekly' | 'daily'): Promise<LeaderboardEntry[]> {
  const viewMap = {
    alltime: 'leaderboard_alltime',
    weekly:  'leaderboard_weekly',
    daily:   'leaderboard_daily',
  }
  const { data, error } = await supabase
    .from(viewMap[period])
    .select('*')
    .order('rank', { ascending: true })
    .limit(20)

  if (error) throw error
  return data ?? []
}

export async function fetchPlayerHistory(address: string): Promise<GameHistory[]> {
  const { data, error } = await supabase
    .from('game_history')
    .select('*')
    .eq('player_address', address.toLowerCase())
    .order('played_at', { ascending: false })
    .limit(20)

  if (error) throw error
  return data ?? []
}

// ── Player profiles ────────────────────────────────────────────────────────
export type PlayerProfile = {
  address: string
  username: string | null
  avatar_style: string
  purchased_styles: string[]
}

export async function fetchProfile(address: string): Promise<PlayerProfile | null> {
  const { data } = await supabase
    .from('player_profiles')
    .select('*')
    .eq('address', address.toLowerCase())
    .maybeSingle()
  return data ?? null
}

const SERVER_URL = import.meta.env.VITE_SOCKET_URL || ''

export async function upsertProfile(address: string, updates: Partial<Omit<PlayerProfile, 'address'>>, sig: string) {
  const res = await fetch(`${SERVER_URL}/api/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, sig, updates }),
  })
  if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Profile save failed') }
}

export async function unlockAvatarStyle(address: string, style: string, currentStyles: string[], sig: string) {
  const res = await fetch(`${SERVER_URL}/api/avatar-unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, sig, style, currentStyles }),
  })
  if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Avatar unlock failed') }
}

// ── Player stats ────────────────────────────────────────────────────────────
export async function fetchPlayerStats(address: string) {
  const { data, error } = await supabase
    .from('game_history')
    .select('result, earned, entry_fee')
    .eq('player_address', address.toLowerCase())

  if (error) throw error
  const rows = data ?? []
  const played = rows.length
  const wins = rows.filter(r => r.result === 'win').length
  const totalEarned = rows.filter(r => r.earned > 0).reduce((s, r) => s + Number(r.earned), 0)
  const totalSpent  = rows.filter(r => r.earned < 0).reduce((s, r) => s + Math.abs(Number(r.earned)), 0)
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0
  return { played, wins, winRate, totalEarned, totalSpent }
}
