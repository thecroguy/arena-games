import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

// ── Change this password or set VITE_ANALYTICS_PASSWORD in Vercel env ──────
const ANALYTICS_PASS = import.meta.env.VITE_ANALYTICS_PASSWORD || 'arena2026'
const SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

const GAME_LABELS: Record<string, string> = {
  'math-arena':     'Math Arena',
  'pattern-memory': 'Pattern Memory',
  'reaction-grid':  'Reaction Grid',
  'highest-unique': 'Highest Unique',
  'lowest-unique':  'Lowest Unique',
  'liars-dice':     "Liar's Dice",
}
const MODE_COLORS: Record<string, string> = {
  'math-arena':     '#7c3aed',
  'pattern-memory': '#a855f7',
  'reaction-grid':  '#22c55e',
  'highest-unique': '#f59e0b',
  'lowest-unique':  '#ef4444',
  'liars-dice':     '#f97316',
}

type Row = {
  game_mode: string
  result: string
  entry_fee: number
  earned: number
  players_count: number
  played_at: string
  player_address: string
  room_code: string
}

type DayStat = { date: string; games: number; volume: number; revenue: number }
type ModeStat = { mode: string; games: number; volume: number; pct: number }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Analytics() {
  const [authed, setAuthed]       = useState(() => sessionStorage.getItem('ag_admin') === '1')
  const [pass, setPass]           = useState('')
  const [passErr, setPassErr]     = useState(false)

  const [rows, setRows]           = useState<Row[]>([])
  const [activeRooms, setActiveRooms] = useState<number>(0)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [payouts, setPayouts]     = useState<{id:number;referrer_address:string;amount_usdt:number;status:string;requested_at:string;tx_hash:string|null}[]>([])

  function tryLogin() {
    if (pass === ANALYTICS_PASS) {
      sessionStorage.setItem('ag_admin', '1')
      setAuthed(true)
      setPassErr(false)
    } else {
      setPassErr(true)
    }
  }

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    Promise.all([
      supabase.from('game_history').select('game_mode,result,entry_fee,earned,players_count,played_at,player_address,room_code').order('played_at', { ascending: false }).limit(500),
      fetch(`${SERVER_URL}/health`).then(r => r.json()).catch(() => ({})),
      supabase.from('referral_payouts').select('id,referrer_address,amount_usdt,status,requested_at,tx_hash').order('requested_at', { ascending: false }).limit(100),
    ]).then(([{ data, error: err }, health, { data: payoutData }]) => {
      if (err) { setError(err.message); return }
      setRows((data as Row[]) ?? [])
      setActiveRooms(health?.rooms ?? 0)
      setPayouts((payoutData as typeof payouts) ?? [])
    }).finally(() => setLoading(false))
  }, [authed])

  // ── Login screen ────────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
      <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', padding: '40px 48px', textAlign: 'center', width: '100%', maxWidth: '360px' }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.4rem', fontWeight: 900, background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '8px' }}>
          Analytics
        </div>
        <p style={{ color: '#475569', fontSize: '0.82rem', marginBottom: '28px' }}>Admin access only</p>
        <input
          type="password"
          value={pass}
          onChange={e => { setPass(e.target.value); setPassErr(false) }}
          onKeyDown={e => e.key === 'Enter' && tryLogin()}
          placeholder="Password"
          autoFocus
          style={{ width: '100%', background: '#0a0a0f', border: `1px solid ${passErr ? '#ef4444' : '#1e1e30'}`, borderRadius: '8px', padding: '11px 14px', color: '#e2e8f0', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }}
        />
        {passErr && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginBottom: '10px' }}>Wrong password</p>}
        <button onClick={tryLogin} style={{ width: '100%', background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', border: 'none', borderRadius: '8px', padding: '12px', color: '#fff', fontWeight: 700, fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', cursor: 'pointer' }}>
          Enter
        </button>
      </div>
    </div>
  )

  // ── Compute stats ───────────────────────────────────────────────────────────
  // Deduplicate by room_code (game_history has 1 row per player — use only 'win' rows to avoid double-counting pots)
  const uniqueRooms = new Map<string, Row>()
  for (const r of rows) {
    if (r.result === 'win' && !uniqueRooms.has(r.room_code)) uniqueRooms.set(r.room_code, r)
  }

  const totalGames    = uniqueRooms.size
  const totalPlayers  = new Set(rows.map(r => r.player_address)).size
  const totalVolume   = [...uniqueRooms.values()].reduce((s, r) => s + r.entry_fee * r.players_count, 0)
  const totalRevenue  = totalVolume * 0.15
  const totalPaidOut  = totalVolume * 0.85

  // Games by mode
  const byMode = new Map<string, { games: number; volume: number }>()
  for (const r of uniqueRooms.values()) {
    const cur = byMode.get(r.game_mode) ?? { games: 0, volume: 0 }
    byMode.set(r.game_mode, { games: cur.games + 1, volume: cur.volume + r.entry_fee * r.players_count })
  }
  const modeStats: ModeStat[] = [...byMode.entries()]
    .map(([mode, s]) => ({ mode, games: s.games, volume: s.volume, pct: totalGames > 0 ? Math.round((s.games / totalGames) * 100) : 0 }))
    .sort((a, b) => b.games - a.games)

  // Daily stats — last 14 days
  const dailyMap = new Map<string, DayStat>()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    dailyMap.set(key, { date: key, games: 0, volume: 0, revenue: 0 })
  }
  for (const r of uniqueRooms.values()) {
    const key = r.played_at.slice(0, 10)
    const day = dailyMap.get(key)
    if (day) {
      const vol = r.entry_fee * r.players_count
      day.games++; day.volume += vol; day.revenue += vol * 0.15
    }
  }
  const dailyStats = [...dailyMap.values()]
  const maxGames   = Math.max(...dailyStats.map(d => d.games), 1)
  const maxRevenue = Math.max(...dailyStats.map(d => d.revenue), 0.01)

  // Today
  const todayKey    = today.toISOString().slice(0, 10)
  const todayStat   = dailyMap.get(todayKey) ?? { games: 0, volume: 0, revenue: 0 }

  // Recent games (last 20 unique rooms)
  const recentGames = [...uniqueRooms.values()].slice(0, 20)

  const card = (label: string, value: string, sub?: string, color = '#e2e8f0') => (
    <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', padding: '20px 24px' }}>
      <p style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '8px', textTransform: 'uppercase' as const }}>{label}</p>
      <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: '1.6rem', color, marginBottom: sub ? '4px' : 0 }}>{value}</p>
      {sub && <p style={{ color: '#475569', fontSize: '0.75rem' }}>{sub}</p>}
    </div>
  )

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 'clamp(1.3rem,3vw,1.8rem)', background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '4px' }}>
            Analytics Dashboard
          </h1>
          <p style={{ color: '#475569', fontSize: '0.8rem' }}>All-time · Last 500 games · {loading ? 'Loading…' : `${totalGames} games found`}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ background: activeRooms > 0 ? 'rgba(34,197,94,0.1)' : '#12121a', border: `1px solid ${activeRooms > 0 ? 'rgba(34,197,94,0.3)' : '#1e1e30'}`, borderRadius: '10px', padding: '8px 16px', fontSize: '0.82rem', color: activeRooms > 0 ? '#22c55e' : '#64748b' }}>
            {activeRooms > 0 ? `● ${activeRooms} rooms live` : '○ No rooms live'}
          </div>
          <button onClick={() => { sessionStorage.removeItem('ag_admin'); setAuthed(false) }} style={{ background: 'none', border: '1px solid #1e1e30', borderRadius: '8px', padding: '8px 14px', color: '#64748b', fontSize: '0.78rem', cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 18px', color: '#ef4444', fontSize: '0.88rem', marginBottom: '20px' }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', color: '#475569', padding: '60px' }}>Loading analytics…</div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '28px' }}>
            {card('Total Games', String(totalGames), `${todayStat.games} today`)}
            {card('Unique Players', String(totalPlayers), 'distinct wallets')}
            {card('Total Volume', `$${totalVolume.toFixed(2)}`, `$${totalPaidOut.toFixed(2)} paid out`, '#06b6d4')}
            {card('Platform Revenue', `$${totalRevenue.toFixed(2)}`, `$${todayStat.revenue.toFixed(2)} today`, '#22c55e')}
          </div>

          {/* Daily chart + Mode breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: '16px', marginBottom: '28px' }}>

            {/* Daily activity chart */}
            <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', padding: '20px 24px' }}>
              <p style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '16px' }}>DAILY ACTIVITY — LAST 14 DAYS</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px' }}>
                {dailyStats.map(d => (
                  <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', height: '100%', justifyContent: 'flex-end' }} title={`${d.date}: ${d.games} games · $${d.revenue.toFixed(2)} revenue`}>
                    <div style={{ width: '100%', background: d.date === todayKey ? '#7c3aed' : 'rgba(124,58,237,0.4)', borderRadius: '3px 3px 0 0', height: `${Math.max((d.games / maxGames) * 100, d.games > 0 ? 4 : 0)}%`, minHeight: d.games > 0 ? '4px' : 0, transition: 'height 0.3s' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{ color: '#334155', fontSize: '0.65rem' }}>{fmtDate(dailyStats[0].date)}</span>
                <span style={{ color: '#7c3aed', fontSize: '0.65rem', fontWeight: 700 }}>Today</span>
              </div>

              {/* Revenue line (dots) */}
              <p style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', marginTop: '18px', marginBottom: '10px' }}>REVENUE ($)</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '60px' }}>
                {dailyStats.map(d => (
                  <div key={d.date} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', height: '100%', justifyContent: 'center' }} title={`$${d.revenue.toFixed(2)}`}>
                    <div style={{ width: '100%', background: d.date === todayKey ? '#22c55e' : 'rgba(34,197,94,0.35)', borderRadius: '3px 3px 0 0', height: `${Math.max((d.revenue / maxRevenue) * 100, d.revenue > 0 ? 4 : 0)}%`, minHeight: d.revenue > 0 ? '4px' : 0 }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Mode breakdown */}
            <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', padding: '20px 24px' }}>
              <p style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '16px' }}>GAMES BY MODE</p>
              {modeStats.length === 0 && <p style={{ color: '#334155', fontSize: '0.85rem' }}>No games yet</p>}
              {modeStats.map(m => (
                <div key={m.mode} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{GAME_LABELS[m.mode] ?? m.mode}</span>
                    <span style={{ color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 700 }}>{m.games} <span style={{ color: '#475569' }}>({m.pct}%)</span></span>
                  </div>
                  <div style={{ height: '6px', background: '#1e1e30', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${m.pct}%`, background: MODE_COLORS[m.mode] ?? '#7c3aed', borderRadius: '3px', transition: 'width 0.5s' }} />
                  </div>
                  <p style={{ color: '#475569', fontSize: '0.65rem', marginTop: '2px' }}>${m.volume.toFixed(2)} volume</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent games table */}
          <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e1e30' }}>
              <p style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em' }}>RECENT GAMES</p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e1e30' }}>
                    {['Room', 'Mode', 'Players', 'Entry', 'Pot', 'Revenue', 'Date'].map(h => (
                      <th key={h} style={{ padding: '10px 20px', textAlign: 'left', color: '#475569', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap', fontFamily: 'Orbitron, sans-serif' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentGames.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#334155' }}>No games recorded yet</td></tr>
                  )}
                  {recentGames.map((r, i) => {
                    const pot = r.entry_fee * r.players_count
                    return (
                      <tr key={r.room_code} style={{ borderBottom: i < recentGames.length - 1 ? '1px solid #0d0d14' : 'none' }}>
                        <td style={{ padding: '12px 20px', fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: '#a78bfa' }}>{r.room_code}</td>
                        <td style={{ padding: '12px 20px' }}>
                          <span style={{ background: `${MODE_COLORS[r.game_mode] ?? '#7c3aed'}22`, border: `1px solid ${MODE_COLORS[r.game_mode] ?? '#7c3aed'}44`, color: MODE_COLORS[r.game_mode] ?? '#a78bfa', borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {GAME_LABELS[r.game_mode] ?? r.game_mode}
                          </span>
                        </td>
                        <td style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '0.85rem' }}>{r.players_count}</td>
                        <td style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '0.85rem' }}>${r.entry_fee}</td>
                        <td style={{ padding: '12px 20px', color: '#06b6d4', fontWeight: 700, fontSize: '0.85rem' }}>${pot.toFixed(2)}</td>
                        <td style={{ padding: '12px 20px', color: '#22c55e', fontWeight: 700, fontSize: '0.85rem' }}>${(pot * 0.15).toFixed(2)}</td>
                        <td style={{ padding: '12px 20px', color: '#475569', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{fmtDate(r.played_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        {/* Referral Payouts */}
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', overflow: 'hidden', marginTop: '24px' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e1e30', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: '#64748b', letterSpacing: '0.1em' }}>REFERRAL PAYOUTS</span>
            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{payouts.filter(p => p.status === 'pending').length} pending</span>
          </div>
          {payouts.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>No payout requests yet</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e1e30' }}>
                    {['Referrer', 'Amount', 'Status', 'Requested', 'TX Hash / Action'].map(h => (
                      <th key={h} style={{ padding: '10px 20px', textAlign: 'left', color: '#64748b', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', whiteSpace: 'nowrap', fontFamily: 'Orbitron, sans-serif' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p, idx) => (
                    <tr key={p.id} style={{ borderBottom: idx < payouts.length - 1 ? '1px solid #0d0d14' : 'none', background: p.status === 'pending' ? 'rgba(245,158,11,0.04)' : 'transparent' }}>
                      <td style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '0.82rem', fontFamily: 'monospace' }}>{p.referrer_address.slice(0, 8)}…{p.referrer_address.slice(-6)}</td>
                      <td style={{ padding: '12px 20px', color: '#22c55e', fontWeight: 700 }}>${Number(p.amount_usdt).toFixed(2)}</td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: p.status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)', color: p.status === 'pending' ? '#f59e0b' : '#22c55e', border: `1px solid ${p.status === 'pending' ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px 20px', color: '#475569', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{fmtDate(p.requested_at)}</td>
                      <td style={{ padding: '12px 20px', fontSize: '0.78rem' }}>
                        {p.tx_hash ? (
                          <span style={{ color: '#06b6d4', fontFamily: 'monospace' }}>{p.tx_hash.slice(0, 10)}…</span>
                        ) : (
                          <span style={{ color: '#475569' }}>Send USDT to {p.referrer_address.slice(0, 8)}… then call POST /api/referral/mark-paid with id={p.id}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  )
}
