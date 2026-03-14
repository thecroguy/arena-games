import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { fetchPlayerHistory, fetchPlayerStats, type GameHistory } from '../utils/supabase'
import { getAvatarUrl, getAvatarColor, AVATAR_STYLES, type AvatarStyle } from '../utils/avatar'
import { getUsername, setUsername, getSavedStyle, setSavedStyle, shortAddr } from '../utils/profile'

export default function Profile() {
  const { address, isConnected } = useAccount()
  const navigate = useNavigate()

  const [history, setHistory]   = useState<GameHistory[]>([])
  const [stats, setStats]       = useState<{ played: number; wins: number; winRate: number; totalEarned: number; totalSpent: number } | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput]     = useState('')
  const [savedName, setSavedName]     = useState('')
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>('adventurer')

  // Load saved preferences
  useEffect(() => {
    if (!address) return
    const name  = getUsername(address)
    const style = getSavedStyle(address) as AvatarStyle
    setSavedName(name)
    setNameInput(name)
    setAvatarStyle(style)
  }, [address])

  useEffect(() => {
    if (!address) return
    setLoading(true)
    setError('')
    Promise.all([fetchPlayerHistory(address), fetchPlayerStats(address)])
      .then(([h, s]) => { setHistory(h); setStats(s) })
      .catch(() => setError('Stats unavailable — play some games first!'))
      .finally(() => setLoading(false))
  }, [address])

  function saveName() {
    if (!address || !nameInput.trim()) return
    const clean = nameInput.trim().replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 20)
    setUsername(address, clean)
    setSavedName(clean)
    setNameInput(clean)
    setEditingName(false)
  }

  function saveStyle(style: AvatarStyle) {
    if (!address) return
    setSavedStyle(address, style)
    setAvatarStyle(style)
  }

  if (!isConnected) {
    return (
      <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }}>🔒</div>
        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1.2rem' }}>Connect Your Wallet</h2>
        <p style={{ color: '#94a3b8', maxWidth: '300px', fontSize: '0.95rem' }}>Connect to view your profile, stats, and game history.</p>
        <ConnectButton />
      </div>
    )
  }

  const netProfit  = stats ? stats.totalEarned - stats.totalSpent : 0
  const avatarUrl  = address ? getAvatarUrl(address, avatarStyle) : ''
  const avatarColor = address ? getAvatarColor(address) : '#7c3aed'

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'clamp(20px,4vw,40px) clamp(16px,4vw,24px)' }}>

      {/* Profile header */}
      <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(6,182,212,0.06) 100%)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '20px', padding: 'clamp(20px,4vw,32px)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img src={avatarUrl} alt="Your avatar" width={80} height={80}
              style={{ borderRadius: '50%', border: `3px solid ${avatarColor}`, background: '#1e1e30', display: 'block' }} />
            <div style={{ position: 'absolute', bottom: 0, right: 0, background: '#22c55e', borderRadius: '50%', width: '16px', height: '16px', border: '2px solid #0a0a0f' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: '#64748b', fontSize: '0.7rem', letterSpacing: '0.1em', fontFamily: 'Orbitron, sans-serif', marginBottom: '4px' }}>PLAYER</p>
            {editingName ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                  maxLength={20}
                  autoFocus
                  placeholder="Enter display name"
                  style={{ background: '#0a0a0f', border: '1px solid #7c3aed', borderRadius: '8px', padding: '6px 12px', color: '#e2e8f0', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', outline: 'none', width: '180px' }}
                />
                <button onClick={saveName} style={{ background: '#7c3aed', border: 'none', borderRadius: '6px', padding: '6px 14px', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Save</button>
                <button onClick={() => { setEditingName(false); setNameInput(savedName) }} style={{ background: 'transparent', border: '1px solid #1e1e30', borderRadius: '6px', padding: '6px 10px', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: 'clamp(0.85rem,2vw,1rem)', color: '#e2e8f0' }}>{savedName}</h1>
                <button onClick={() => setEditingName(true)} style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '6px', padding: '3px 10px', color: '#a78bfa', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}>Edit</button>
              </div>
            )}
            <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px', fontFamily: 'monospace' }}>{address ? shortAddr(address) : ''} · Polygon</p>
          </div>
          <button onClick={() => navigate('/lobby/math-arena')}
            style={{ background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', border: 'none', borderRadius: '10px', padding: '10px 20px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
            Play Now →
          </button>
        </div>
      </div>

      {/* Avatar style picker */}
      <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px' }}>
        <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: '#64748b', letterSpacing: '0.1em', marginBottom: '16px' }}>AVATAR STYLE</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
          {AVATAR_STYLES.map(s => {
            const active = avatarStyle === s.id
            return (
              <button key={s.id} onClick={() => saveStyle(s.id as AvatarStyle)}
                style={{ background: active ? 'rgba(124,58,237,0.15)' : '#0a0a0f', border: `2px solid ${active ? '#7c3aed' : '#1e1e30'}`, borderRadius: '12px', padding: '12px 8px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <img src={address ? getAvatarUrl(address, s.id as AvatarStyle) : ''} alt={s.name} width={48} height={48}
                  style={{ borderRadius: '50%', border: `2px solid ${active ? '#7c3aed' : '#1e1e30'}`, background: '#1e1e30' }} />
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: active ? '#a78bfa' : '#64748b', fontFamily: 'Orbitron, sans-serif' }}>{s.name.toUpperCase()}</span>
                {s.price === 0
                  ? <span style={{ fontSize: '0.6rem', color: '#22c55e', fontWeight: 700 }}>FREE</span>
                  : <span style={{ fontSize: '0.6rem', color: '#f59e0b', fontWeight: 700 }}>${s.price} USDT</span>}
              </button>
            )
          })}
        </div>
        <p style={{ color: '#475569', fontSize: '0.75rem', marginTop: '12px' }}>Premium styles require USDT purchase (coming soon)</p>
      </div>

      {error && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', padding: '12px 18px', marginBottom: '20px', color: '#f59e0b', fontSize: '0.88rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Stats grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '12px', padding: '18px', height: '76px', opacity: 0.4 }} />
          ))}
        </div>
      ) : stats ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <StatCard label="Games Played" value={String(stats.played)} />
            <StatCard label="Wins"         value={String(stats.wins)}   color="#22c55e" />
            <StatCard label="Win Rate"     value={`${stats.winRate}%`}  color={stats.winRate >= 50 ? '#22c55e' : '#ef4444'} />
            <StatCard label="Net Profit"   value={`${netProfit >= 0 ? '+' : ''}$${netProfit.toFixed(2)}`} color={netProfit >= 0 ? '#22c55e' : '#ef4444'} />
            <StatCard label="Earned"       value={`$${stats.totalEarned.toFixed(2)}`} color="#22c55e" />
            <StatCard label="Spent"        value={`$${stats.totalSpent.toFixed(2)}`}  color="#ef4444" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: '14px', padding: '20px 22px' }}>
              <p style={{ color: '#64748b', fontSize: '0.7rem', letterSpacing: '0.08em', fontFamily: 'Orbitron, sans-serif', marginBottom: '6px' }}>TOTAL EARNED</p>
              <p style={{ fontSize: 'clamp(1.3rem,3vw,1.6rem)', fontWeight: 700, color: '#22c55e', fontFamily: 'Orbitron, sans-serif' }}>${stats.totalEarned.toFixed(2)}</p>
              <p style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '4px' }}>USDT across {stats.wins} wins</p>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: '14px', padding: '20px 22px' }}>
              <p style={{ color: '#64748b', fontSize: '0.7rem', letterSpacing: '0.08em', fontFamily: 'Orbitron, sans-serif', marginBottom: '6px' }}>TOTAL SPENT</p>
              <p style={{ fontSize: 'clamp(1.3rem,3vw,1.6rem)', fontWeight: 700, color: '#ef4444', fontFamily: 'Orbitron, sans-serif' }}>${stats.totalSpent.toFixed(2)}</p>
              <p style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '4px' }}>fees across {stats.played} games</p>
            </div>
          </div>
        </>
      ) : (
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', padding: '32px', textAlign: 'center', color: '#64748b', marginBottom: '24px', fontSize: '0.95rem' }}>
          No games played yet —{' '}
          <button style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontWeight: 700, fontSize: 'inherit' }} onClick={() => navigate('/')}>
            play your first game →
          </button>
        </div>
      )}

      {/* Game history */}
      <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e1e30', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: '#64748b', letterSpacing: '0.1em' }}>GAME HISTORY</span>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{history.length} recent games</span>
        </div>
        {history.length === 0 && !loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No games yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e1e30' }}>
                  {['Room', 'Game', 'Score', 'Result', 'Date'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row, idx) => (
                  <tr key={row.id} style={{ borderBottom: idx < history.length - 1 ? '1px solid #0d0d14' : 'none' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.82rem', fontWeight: 700, color: '#a78bfa' }}>{row.room_code}</td>
                    <td style={{ padding: '12px 16px', color: '#e2e8f0', fontSize: '0.88rem', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{row.game_mode.replace('-', ' ')}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.82rem', color: '#94a3b8' }}>{row.score}/{row.total_rounds}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', background: row.result === 'win' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: row.result === 'win' ? '#22c55e' : '#ef4444', border: `1px solid ${row.result === 'win' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                        {row.result === 'win' ? `+$${row.earned.toFixed(2)}` : `-$${Math.abs(row.earned).toFixed(2)}`}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{new Date(row.played_at).toLocaleDateString()}</td>
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
    <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '12px', padding: '16px 18px' }}>
      <p style={{ color: '#64748b', fontSize: '0.68rem', letterSpacing: '0.08em', marginBottom: '6px', fontFamily: 'Orbitron, sans-serif' }}>{label.toUpperCase()}</p>
      <p style={{ fontSize: 'clamp(1.1rem,3vw,1.4rem)', fontWeight: 700, fontFamily: 'Orbitron, sans-serif', color: color ?? '#e2e8f0' }}>{value}</p>
    </div>
  )
}
