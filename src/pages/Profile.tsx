import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { fetchPlayerHistory, fetchPlayerStats, type GameHistory } from '../utils/supabase'

export default function Profile() {
  const { address, isConnected } = useAccount()
  const navigate = useNavigate()

  const [history, setHistory]   = useState<GameHistory[]>([])
  const [stats, setStats]       = useState<{ played: number; wins: number; winRate: number; totalEarned: number; totalSpent: number } | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (!address) return
    setLoading(true)
    setError('')
    Promise.all([
      fetchPlayerHistory(address),
      fetchPlayerStats(address),
    ])
      .then(([h, s]) => { setHistory(h); setStats(s) })
      .catch(() => setError('Could not load data — check Supabase env vars'))
      .finally(() => setLoading(false))
  }, [address])

  if (!isConnected) {
    return (
      <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }}>🔒</div>
        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1.3rem' }}>Connect Your Wallet</h2>
        <p style={{ color: '#94a3b8', maxWidth: '320px' }}>Connect your wallet to view your profile, stats, and game history.</p>
        <ConnectButton />
      </div>
    )
  }

  const short = address ? address.slice(0, 8) + '…' + address.slice(-6) : ''
  const netProfit = stats ? stats.totalEarned - stats.totalSpent : 0

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>

      {/* Profile header */}
      <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(6,182,212,0.08) 100%)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '20px', padding: '32px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', flexShrink: 0 }}>
          🎮
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#64748b', fontSize: '0.75rem', letterSpacing: '0.1em', fontFamily: 'Orbitron, sans-serif', marginBottom: '4px' }}>PLAYER</p>
          <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1rem', color: '#e2e8f0', wordBreak: 'break-all' }}>{short}</h1>
          <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>⛓️ Polygon Network</p>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 18px', marginBottom: '20px', color: '#ef4444', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {/* Stats grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px', marginBottom: '28px' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '12px', padding: '18px 20px', height: '80px', opacity: 0.5 }} />
          ))}
        </div>
      ) : stats ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px', marginBottom: '28px' }}>
            <StatCard label="Games Played" value={String(stats.played)} />
            <StatCard label="Wins"         value={String(stats.wins)} color="#22c55e" />
            <StatCard label="Win Rate"     value={`${stats.winRate}%`} color={stats.winRate >= 50 ? '#22c55e' : '#ef4444'} />
            <StatCard label="Net Profit"   value={`${netProfit >= 0 ? '+' : ''}$${netProfit.toFixed(2)}`} color={netProfit >= 0 ? '#22c55e' : '#ef4444'} />
            <StatCard label="Total Earned" value={`$${stats.totalEarned.toFixed(2)}`} color="#22c55e" />
            <StatCard label="Total Spent"  value={`$${stats.totalSpent.toFixed(2)}`}  color="#ef4444" />
          </div>

          {/* Earnings breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '28px' }}>
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '14px', padding: '20px 24px' }}>
              <p style={{ color: '#64748b', fontSize: '0.75rem', letterSpacing: '0.08em', fontFamily: 'Orbitron, sans-serif', marginBottom: '6px' }}>TOTAL EARNED</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, color: '#22c55e', fontFamily: 'Orbitron, sans-serif' }}>${stats.totalEarned.toFixed(2)}</p>
              <p style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '4px' }}>USDT across {stats.wins} wins</p>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', padding: '20px 24px' }}>
              <p style={{ color: '#64748b', fontSize: '0.75rem', letterSpacing: '0.08em', fontFamily: 'Orbitron, sans-serif', marginBottom: '6px' }}>TOTAL SPENT</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ef4444', fontFamily: 'Orbitron, sans-serif' }}>${stats.totalSpent.toFixed(2)}</p>
              <p style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '4px' }}>entry fees across {stats.played} games</p>
            </div>
          </div>
        </>
      ) : (
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', padding: '32px', textAlign: 'center', color: '#64748b', marginBottom: '28px' }}>
          No games played yet — <button style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontWeight: 700, fontSize: 'inherit' }} onClick={() => navigate('/')}>play your first game →</button>
        </div>
      )}

      {/* Game history */}
      <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e1e30', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: '#64748b', letterSpacing: '0.1em' }}>GAME HISTORY</span>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{history.length} recent games</span>
        </div>

        {history.length === 0 && !loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No games yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e1e30' }}>
                  {['Room', 'Game', 'Players', 'Score', 'Result', 'Date'].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row, idx) => (
                  <tr
                    key={row.id}
                    style={{ borderBottom: idx < history.length - 1 ? '1px solid #0d0d14' : 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 20px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', fontWeight: 700, color: '#a78bfa', letterSpacing: '0.1em' }}>{row.room_code}</td>
                    <td style={{ padding: '14px 20px', color: '#e2e8f0', fontSize: '0.9rem', textTransform: 'capitalize' }}>{row.game_mode.replace('-', ' ')}</td>
                    <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '0.9rem' }}>👥 {row.players_count}</td>
                    <td style={{ padding: '14px 20px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: '#94a3b8' }}>{row.score}/{row.total_rounds}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', background: row.result === 'win' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: row.result === 'win' ? '#22c55e' : '#ef4444', border: `1px solid ${row.result === 'win' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                        {row.result === 'win' ? `+$${row.earned.toFixed(2)}` : `-$${Math.abs(row.earned).toFixed(2)}`}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '0.85rem' }}>
                      {new Date(row.played_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '12px', padding: '18px 20px' }}>
      <p style={{ color: '#64748b', fontSize: '0.72rem', letterSpacing: '0.08em', marginBottom: '8px', fontFamily: 'Orbitron, sans-serif' }}>{label.toUpperCase()}</p>
      <p style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'Orbitron, sans-serif', color: color ?? '#e2e8f0' }}>{value}</p>
    </div>
  )
}
