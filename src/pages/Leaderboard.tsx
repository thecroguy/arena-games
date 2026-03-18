import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { fetchLeaderboard, fetchUsernames, type LeaderboardEntry } from '../utils/supabase'
import { getAvatarUrl, getAvatarColor } from '../utils/avatar'
import { getUsername } from '../utils/profile'
// ── FAKE DATA (remove next line when real users grow) ─────────────────────────
import { getFakeLeaderboard, FAKE_LEADERBOARD_NAMES } from '../utils/fakeData'

type Period = 'alltime' | 'weekly' | 'daily'

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function Leaderboard() {
  const [period, setPeriod]   = useState<Period>('alltime')
  const [data, setData]       = useState<LeaderboardEntry[]>([])
  const [usernames, setUsernames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const { address } = useAccount()

  function displayName(addr: string) {
    // ── FAKE DATA: check fake names first (remove FAKE_LEADERBOARD_NAMES lookup when real users grow) ──
    return FAKE_LEADERBOARD_NAMES[addr] ?? usernames[addr.toLowerCase()] ?? getUsername(addr)
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    fetchLeaderboard(period)
      .then(async rows => {
        // ── FAKE DATA: merge real + fake, re-rank by wins (remove fake merge when real users grow) ──
        const fake = getFakeLeaderboard()
        const merged = [...rows, ...fake]
          .sort((a, b) => b.wins - a.wins)
          .map((e, i) => ({ ...e, rank: i + 1 }))
        setData(merged)
        const names = await fetchUsernames(rows.map(r => r.player_address))
        setUsernames(names)
        // ── END FAKE DATA ──
      })
      .catch(() => {
        // ── FAKE DATA: show fake data even if backend unavailable (remove catch body when real users grow) ──
        const fake = getFakeLeaderboard()
        setData(fake)
        // ── END FAKE DATA ──
      })
      .finally(() => setLoading(false))
  }, [period])

  const myRank = address
    ? data.find(p => p.player_address === address.toLowerCase())?.rank ?? null
    : null

  const tabs: { key: Period; label: string }[] = [
    { key: 'daily',   label: 'Today' },
    { key: 'weekly',  label: 'This Week' },
    { key: 'alltime', label: 'All Time' },
  ]

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 24px' }}>

      {/* Header */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(1.5rem, 4vw, 2.4rem)', fontWeight: 900, background: 'linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '8px' }}>
          🏆 Leaderboard
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>Top performers ranked by wins</p>
      </div>

      {/* Period tabs */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '12px', padding: '4px', display: 'flex', gap: '4px' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setPeriod(t.key)} style={{ padding: '9px 22px', borderRadius: '8px', border: 'none', background: period === t.key ? '#7c3aed' : 'transparent', color: period === t.key ? '#fff' : '#64748b', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 18px', marginBottom: '20px', color: '#ef4444', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {/* Your rank */}
      {myRank && (
        <div style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '12px', padding: '14px 24px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#a78bfa', fontWeight: 700 }}>Your rank this period</span>
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: '1.2rem', color: '#a78bfa' }}>#{myRank}</span>
        </div>
      )}

      {loading ? (
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#64748b' }}>
          Loading…
        </div>
      ) : data.length === 0 ? (
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#64748b' }}>
          No games played yet for this period. Be the first!
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          {data.length >= 3 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '24px' }}>
              {([data[1], data[0], data[2]] as LeaderboardEntry[]).map((p, podiumIdx) => {
                const actualRank = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3
                const heights = ['140px', '170px', '120px']
                return (
                  <div key={p.player_address} style={{ background: actualRank === 1 ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(124,58,237,0.1))' : '#12121a', border: `1px solid ${actualRank === 1 ? 'rgba(245,158,11,0.4)' : '#1e1e30'}`, borderRadius: '16px', padding: '20px 16px', textAlign: 'center', alignSelf: 'flex-end', minHeight: heights[podiumIdx], display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <img src={getAvatarUrl(p.player_address)} alt="avatar" width={48} height={48} style={{ borderRadius: '50%', border: `3px solid ${actualRank === 1 ? '#f59e0b' : getAvatarColor(p.player_address)}`, background: '#1e1e30' }} />
                    <div style={{ fontSize: '1.4rem' }}>{MEDAL[actualRank]}</div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.72rem', color: actualRank === 1 ? '#f59e0b' : '#94a3b8', letterSpacing: '0.05em', wordBreak: 'break-all' }}>
                      {displayName(p.player_address)}
                    </div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: '1.1rem', color: '#e2e8f0' }}>
                      {p.wins} <span style={{ fontSize: '0.6rem', color: '#64748b' }}>WINS</span>
                    </div>
                    {period !== 'alltime' && (
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: Number(p.net_earned) >= 0 ? '#22c55e' : '#ef4444' }}>
                        {Number(p.net_earned) >= 0 ? '+' : ''}${Number(p.net_earned).toFixed(2)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Full table */}
          <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e1e30' }}>
                    {(period === 'alltime'
                      ? ['Rank', 'Player', 'Wins', 'Games', 'Win Rate']
                      : ['Rank', 'Player', 'Profit', 'Wins', 'Games', 'Win Rate']
                    ).map(h => (
                      <th key={h} style={{ padding: '12px 20px', textAlign: 'left', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', whiteSpace: 'nowrap', fontFamily: 'Orbitron, sans-serif' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((p, idx) => {
                    const isMe = address && p.player_address === address.toLowerCase()
                    const wr   = Number(p.win_rate)
                    const net  = Number(p.net_earned)
                    return (
                      <tr key={p.player_address} style={{ borderBottom: idx < data.length - 1 ? '1px solid #0d0d14' : 'none', background: isMe ? 'rgba(124,58,237,0.07)' : 'transparent' }}>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: p.rank <= 3 ? '1.1rem' : '0.9rem', color: p.rank === 1 ? '#f59e0b' : p.rank === 2 ? '#9ca3af' : p.rank === 3 ? '#cd7c3e' : '#64748b' }}>
                            {MEDAL[p.rank] ?? `#${p.rank}`}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img src={getAvatarUrl(p.player_address)} alt="avatar" width={28} height={28} style={{ borderRadius: '50%', border: `2px solid ${getAvatarColor(p.player_address)}`, background: '#1e1e30', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: isMe ? '#a78bfa' : '#e2e8f0', fontSize: '0.9rem' }}>{displayName(p.player_address)}</span>
                            {isMe && <span style={{ fontSize: '0.65rem', background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa', borderRadius: '4px', padding: '1px 6px', fontWeight: 700 }}>YOU</span>}
                          </div>
                        </td>
                        {period !== 'alltime' && (
                          <td style={{ padding: '14px 20px', fontWeight: 700, color: net >= 0 ? '#22c55e' : '#ef4444', fontSize: '0.9rem', fontFamily: 'Orbitron, sans-serif' }}>
                            {net >= 0 ? '+' : ''}${net.toFixed(2)}
                          </td>
                        )}
                        <td style={{ padding: '14px 20px', fontFamily: 'Orbitron, sans-serif', fontWeight: 700, color: '#22c55e', fontSize: '0.9rem' }}>{p.wins}</td>
                        <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '0.9rem' }}>{p.games_played}</td>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '48px', height: '4px', background: '#1e1e30', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${wr}%`, background: wr >= 70 ? '#22c55e' : wr >= 50 ? '#f59e0b' : '#ef4444', borderRadius: '2px' }} />
                            </div>
                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{wr}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
