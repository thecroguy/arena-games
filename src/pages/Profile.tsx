import { useEffect, useState } from 'react'
import { useAccount, useWriteContract, useChainId, useSwitchChain } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { parseUnits } from 'viem'
import { polygon } from 'wagmi/chains'
import { fetchPlayerHistory, fetchPlayerStats, fetchProfile, upsertProfile, unlockAvatarStyle, type GameHistory } from '../utils/supabase'
import {
  getAvatarUrl, getAvatarColor, AVATAR_STYLES, STYLE_CATALOG,
  isStyleOwned, parseStyleId, getDefaultStyle,
  type AvatarStyle, type AvatarEntry,
} from '../utils/avatar'
import { getUsername, setUsername, shortAddr } from '../utils/profile'

const HOUSE_WALLET = (import.meta.env.VITE_HOUSE_WALLET || '0x0000000000000000000000000000000000000000') as `0x${string}`
const USDT_POLYGON = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' as `0x${string}`
const USDT_ABI = [
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }] },
] as const

type PriceFilter = 'all' | 0 | 1 | 2 | 3

export default function Profile() {
  const { address, isConnected } = useAccount()
  const navigate = useNavigate()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()

  const [history, setHistory]   = useState<GameHistory[]>([])
  const [stats, setStats]       = useState<{ played: number; wins: number; winRate: number; totalEarned: number; totalSpent: number } | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // Profile state (synced to Supabase)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput]     = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>('bottts')
  const [ownedBases, setOwnedBases]   = useState<string[]>(['bottts'])

  // Avatar picker filter
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all')

  // Purchase flow
  const [buying, setBuying]             = useState<string | null>(null)  // base key being bought
  const [confirmEntry, setConfirmEntry] = useState<AvatarEntry | null>(null)
  const [buyStatus, setBuyStatus]       = useState<'idle' | 'switching' | 'paying' | 'saving'>('idle')

  // Load profile from Supabase on connect
  useEffect(() => {
    if (!address) return
    const localName = getUsername(address)
    setDisplayName(localName)
    setNameInput(localName)
    // Set address-derived robot default while loading
    setAvatarStyle(getDefaultStyle(address))

    fetchProfile(address).then(p => {
      if (p) {
        if (p.username) { setDisplayName(p.username); setNameInput(p.username); setUsername(address, p.username) }
        if (p.avatar_style) setAvatarStyle(p.avatar_style as AvatarStyle)
        setOwnedBases(p.purchased_styles ?? ['bottts'])
      }
    })
  }, [address])

  useEffect(() => {
    if (!address) return
    setLoading(true)
    Promise.all([fetchPlayerHistory(address), fetchPlayerStats(address)])
      .then(([h, s]) => { setHistory(h); setStats(s) })
      .catch(() => setError('Stats unavailable — play some games first!'))
      .finally(() => setLoading(false))
  }, [address])

  async function saveName() {
    if (!address || !nameInput.trim()) return
    const clean = nameInput.trim().replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 20)
    setUsername(address, clean)
    setDisplayName(clean)
    setNameInput(clean)
    setEditingName(false)
    await upsertProfile(address, { username: clean }).catch(() => null)
  }

  async function handleBuyStyle(entry: AvatarEntry) {
    if (!address || !isConnected) return
    const { baseKey, price } = entry

    if (price === 0 || isStyleOwned(entry.id, ownedBases)) {
      // Free or already owned — just switch
      setAvatarStyle(entry.id)
      await upsertProfile(address, { avatar_style: entry.id }).catch(() => null)
      setConfirmEntry(null)
      return
    }

    setBuying(baseKey)
    setBuyStatus('switching')

    if (chainId !== polygon.id) {
      try { await switchChainAsync({ chainId: polygon.id }) }
      catch {
        setError('Switch to Polygon to pay for this avatar')
        setBuying(null); setBuyStatus('idle'); setConfirmEntry(null); return
      }
    }

    setBuyStatus('paying')
    try {
      await writeContractAsync({
        address: USDT_POLYGON,
        abi: USDT_ABI,
        functionName: 'transfer',
        args: [HOUSE_WALLET, parseUnits(String(price), 6)],
        chainId: polygon.id,
      })
    } catch {
      setError('Payment cancelled. No charge applied.')
      setBuying(null); setBuyStatus('idle'); setConfirmEntry(null); return
    }

    setBuyStatus('saving')
    try {
      await unlockAvatarStyle(address, baseKey, ownedBases)
      const newBases = Array.from(new Set([...ownedBases, baseKey]))
      setOwnedBases(newBases)
      setAvatarStyle(entry.id)
      await upsertProfile(address, { avatar_style: entry.id }).catch(() => null)
    } catch {
      setError('Paid but failed to save — refresh and it may appear.')
    } finally {
      setBuying(null); setBuyStatus('idle'); setConfirmEntry(null)
    }
  }

  async function switchToStyle(entry: AvatarEntry) {
    if (!address) return
    setAvatarStyle(entry.id)
    await upsertProfile(address, { avatar_style: entry.id }).catch(() => null)
  }

  if (!isConnected) {
    return (
      <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }}>🔒</div>
        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1.2rem' }}>Connect Your Wallet</h2>
        <p style={{ color: '#94a3b8', maxWidth: '300px', fontSize: '0.95rem' }}>Your wallet address is your account — no signup needed.</p>
        <ConnectButton />
      </div>
    )
  }

  const netProfit   = stats ? stats.totalEarned - stats.totalSpent : 0
  const avatarUrl   = address ? getAvatarUrl(address, avatarStyle) : ''
  const avatarColor = address ? getAvatarColor(address) : '#7c3aed'

  const filteredStyles = priceFilter === 'all'
    ? AVATAR_STYLES
    : AVATAR_STYLES.filter(s => s.price === priceFilter)

  const priceCounts = {
    all: AVATAR_STYLES.length,
    0: AVATAR_STYLES.filter(s => s.price === 0).length,
    1: AVATAR_STYLES.filter(s => s.price === 1).length,
    2: AVATAR_STYLES.filter(s => s.price === 2).length,
    3: AVATAR_STYLES.filter(s => s.price === 3).length,
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'clamp(20px,4vw,40px) clamp(16px,4vw,24px)' }}>

      {/* Profile header */}
      <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(6,182,212,0.06) 100%)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '20px', padding: 'clamp(20px,4vw,32px)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img src={avatarUrl} alt="avatar" width={80} height={80}
              style={{ borderRadius: '50%', border: `3px solid ${avatarColor}`, background: '#1e1e30', display: 'block' }} />
            <div style={{ position: 'absolute', bottom: 0, right: 0, background: '#22c55e', borderRadius: '50%', width: '16px', height: '16px', border: '2px solid #0a0a0f' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: '#64748b', fontSize: '0.68rem', letterSpacing: '0.1em', fontFamily: 'Orbitron, sans-serif', marginBottom: '4px' }}>PLAYER ACCOUNT</p>
            {editingName ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input value={nameInput} onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                  maxLength={20} autoFocus placeholder="Display name"
                  style={{ background: '#0a0a0f', border: '1px solid #7c3aed', borderRadius: '8px', padding: '6px 12px', color: '#e2e8f0', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', outline: 'none', width: '180px' }} />
                <button onClick={saveName} style={{ background: '#7c3aed', border: 'none', borderRadius: '6px', padding: '6px 14px', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Save</button>
                <button onClick={() => { setEditingName(false); setNameInput(displayName) }} style={{ background: 'transparent', border: '1px solid #1e1e30', borderRadius: '6px', padding: '6px 10px', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: 'clamp(0.85rem,2vw,1rem)', color: '#e2e8f0' }}>{displayName}</h1>
                <button onClick={() => setEditingName(true)} style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '6px', padding: '3px 10px', color: '#a78bfa', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}>Edit</button>
              </div>
            )}
            <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px', fontFamily: 'monospace' }}>{address ? shortAddr(address) : ''}</p>
            <p style={{ color: '#475569', fontSize: '0.7rem', marginTop: '2px' }}>🔑 Your wallet = your account. No password needed.</p>
          </div>
          <button onClick={() => navigate('/lobby/math-arena')}
            style={{ background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', border: 'none', borderRadius: '10px', padding: '10px 20px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
            Play Now →
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px 18px', marginBottom: '20px', color: '#ef4444', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between' }}>
          {error}
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Avatar picker */}
      <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: '#64748b', letterSpacing: '0.1em' }}>
            AVATAR STYLE &nbsp;<span style={{ color: '#475569' }}>{AVATAR_STYLES.length} styles</span>
          </p>
          <p style={{ color: '#475569', fontSize: '0.72rem' }}>Buying a style unlocks all 6 color variants</p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {([['all', 'All'], [0, 'Free'], [1, '$1'], [2, '$2'], [3, '$3']] as [PriceFilter, string][]).map(([val, label]) => (
            <button key={String(val)} onClick={() => setPriceFilter(val)}
              style={{ background: priceFilter === val ? 'rgba(124,58,237,0.2)' : '#0a0a0f', border: `1px solid ${priceFilter === val ? '#7c3aed' : '#1e1e30'}`, borderRadius: '20px', padding: '4px 12px', color: priceFilter === val ? '#a78bfa' : '#64748b', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'Orbitron, sans-serif' }}>
              {label} <span style={{ opacity: 0.6, fontSize: '0.65rem' }}>{priceCounts[val === 'all' ? 'all' : val]}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
          {filteredStyles.map(s => {
            const owned  = isStyleOwned(s.id, ownedBases)
            const active = avatarStyle === s.id
            const isBuyingThis = buying === s.baseKey
            const activeStyle = parseStyleId(avatarStyle)
            const sameBase = activeStyle.dicebearStyle === s.baseKey
            return (
              <button key={s.id}
                onClick={() => {
                  if (owned) switchToStyle(s)
                  else setConfirmEntry(s)
                }}
                style={{
                  background: active ? 'rgba(124,58,237,0.18)' : sameBase && owned ? 'rgba(124,58,237,0.06)' : '#0a0a0f',
                  border: `2px solid ${active ? '#7c3aed' : sameBase && owned ? 'rgba(124,58,237,0.25)' : '#1e1e30'}`,
                  borderRadius: '12px', padding: '10px 6px', cursor: 'pointer',
                  transition: 'all 0.15s', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: '6px', position: 'relative',
                  opacity: isBuyingThis ? 0.6 : 1,
                }}>
                {/* Lock badge — top-right corner only, no blur */}
                {!owned && (
                  <span style={{ position: 'absolute', top: '4px', right: '4px', fontSize: '0.6rem', lineHeight: 1 }}>🔒</span>
                )}
                {active && (
                  <span style={{ position: 'absolute', top: '4px', left: '4px', width: '7px', height: '7px', borderRadius: '50%', background: '#7c3aed', display: 'block' }} />
                )}
                <img
                  src={address ? getAvatarUrl(address, s.id) : ''}
                  alt={s.name} width={44} height={44}
                  style={{ borderRadius: '50%', border: `2px solid ${active ? '#7c3aed' : '#1e1e30'}`, background: '#1e1e30', display: 'block' }}
                />
                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: active ? '#a78bfa' : '#64748b', fontFamily: 'Orbitron, sans-serif', textAlign: 'center', lineHeight: 1.2 }}>
                  {s.baseName.toUpperCase()}
                </span>
                {s.bgLabel && s.bgLabel !== 'Classic' && (
                  <span style={{ fontSize: '0.55rem', color: '#475569', marginTop: '-4px' }}>{s.bgLabel}</span>
                )}
                {s.price === 0
                  ? <span style={{ fontSize: '0.55rem', color: '#22c55e', fontWeight: 700 }}>FREE</span>
                  : owned
                    ? <span style={{ fontSize: '0.55rem', color: '#a78bfa', fontWeight: 700 }}>✓ OWNED</span>
                    : <span style={{ fontSize: '0.55rem', color: '#f59e0b', fontWeight: 700 }}>${s.price} USDT</span>
                }
              </button>
            )
          })}
        </div>
      </div>

      {/* Stats */}
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

      {/* Purchase confirmation modal */}
      {confirmEntry && (
        <div onClick={() => !buying && setConfirmEntry(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '24px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#12121a', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '380px', textAlign: 'center' }}>
            {(() => {
              const baseMeta = STYLE_CATALOG.find(s => s.key === confirmEntry.baseKey)!
              const buyLabel = buyStatus === 'switching' ? 'Switching to Polygon…' : buyStatus === 'paying' ? `Sending $${baseMeta.price} USDT…` : buyStatus === 'saving' ? 'Saving…' : `Unlock for $${baseMeta.price} USDT`
              return (
                <>
                  <img src={address ? getAvatarUrl(address, confirmEntry.id) : ''} alt={confirmEntry.name}
                    width={80} height={80} style={{ borderRadius: '50%', border: `3px solid ${getAvatarColor(address ?? '')}`, background: '#1e1e30', margin: '0 auto 16px' }} />
                  <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>{confirmEntry.baseName}</h3>
                  {confirmEntry.bgLabel && confirmEntry.bgLabel !== 'Classic' && (
                    <p style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '8px' }}>{confirmEntry.bgLabel} variant</p>
                  )}
                  <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '20px', lineHeight: 1.6 }}>
                    One-time <strong style={{ color: '#f59e0b' }}>${baseMeta.price} USDT</strong> on Polygon.<br />
                    Unlocks <strong style={{ color: '#e2e8f0' }}>all 6 color variants</strong> of this style permanently.
                  </p>
                  <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>
                    🔑 Linked to <strong style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{address ? shortAddr(address) : ''}</strong> — works on any device
                  </div>
                  <button onClick={() => handleBuyStyle(confirmEntry)} disabled={!!buying}
                    style={{ width: '100%', background: buying ? '#1e1e30' : 'linear-gradient(135deg,#7c3aed,#06b6d4)', border: 'none', borderRadius: '10px', padding: '13px', color: buying ? '#64748b' : '#fff', fontWeight: 700, cursor: buying ? 'not-allowed' : 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', marginBottom: '10px' }}>
                    {buying ? buyLabel : `Unlock for $${baseMeta.price} USDT`}
                  </button>
                  {!buying && (
                    <button onClick={() => setConfirmEntry(null)}
                      style={{ width: '100%', background: 'transparent', border: '1px solid #1e1e30', borderRadius: '10px', padding: '11px', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>
                      Cancel
                    </button>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}
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
