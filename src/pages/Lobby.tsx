import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { connectSocket } from '../utils/socket'

const GAME_META: Record<string, { title: string; emoji: string; desc: string; minPlayers: number; maxPlayers: number }> = {
  'math-arena': {
    title: 'Math Arena',
    emoji: '🧮',
    desc: 'Speed math quiz — first correct answer scores. 100% skill, zero luck.',
    minPlayers: 2,
    maxPlayers: 10,
  },
}

const ENTRY_FEES = [0.5, 1, 2, 5, 10, 25, 50]

type Room = {
  code: string
  host: string
  players: number
  max: number
  entry: number
  status: 'waiting' | 'full'
}

export default function Lobby() {
  const { gameMode } = useParams<{ gameMode: string }>()
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()

  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedFee, setSelectedFee] = useState<number>(0)
  const [maxPlayers, setMaxPlayers] = useState<number>(5)
  const [joinCode, setJoinCode] = useState('')
  const [tab, setTab] = useState<'browse' | 'create'>('browse')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const meta = GAME_META[gameMode ?? ''] ?? { title: gameMode ?? 'Game', emoji: '🎮', desc: '', minPlayers: 2, maxPlayers: 10 }

  // Connect socket and load rooms
  useEffect(() => {
    const socket = connectSocket()

    function loadRooms() {
      socket.emit('rooms:list', gameMode, (list: Room[]) => {
        setRooms(list)
        setLoading(false)
      })
    }

    if (socket.connected) {
      loadRooms()
    } else {
      socket.connect()
      socket.once('connect', loadRooms)
    }

    // Live room updates
    socket.on('room:update', () => loadRooms())

    // Refresh list every 5s
    const interval = setInterval(loadRooms, 5000)

    return () => {
      socket.off('room:update')
      clearInterval(interval)
    }
  }, [gameMode])

  const filteredRooms = selectedFee === 0 ? rooms : rooms.filter(r => r.entry === selectedFee)

  function handleJoinRoom(code: string) {
    if (!isConnected || !address) { setError('Connect your wallet first'); return }
    const socket = connectSocket()
    socket.emit('room:join', { code, address }, (res: { ok?: boolean; error?: string; room?: unknown }) => {
      if (res.error) { setError(res.error); return }
      navigate(`/game/${code}`)
    })
  }

  function handleCreateRoom() {
    if (!isConnected || !address) { setError('Connect your wallet first'); return }
    setCreating(true)
    setError('')
    const socket = connectSocket()
    socket.emit('room:create', { gameMode, entryFee: selectedFee || 1, maxPlayers, address }, (res: { code?: string; error?: string }) => {
      setCreating(false)
      if (res.error) { setError(res.error); return }
      navigate(`/game/${res.code}`, { state: { host: true, entry: selectedFee || 1, maxPlayers } })
    })
  }

  function handleJoinByCode() {
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    handleJoinRoom(code)
  }

  const s = {
    page: { maxWidth: '960px', margin: '0 auto', padding: '40px 24px' } as React.CSSProperties,
    card: { background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', padding: '24px' } as React.CSSProperties,
    label: { fontSize: '0.78rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '12px', display: 'block' },
    feeBtn: (active: boolean) => ({
      padding: '8px 16px', borderRadius: '8px', border: `1px solid ${active ? '#7c3aed' : '#1e1e30'}`,
      background: active ? 'rgba(124,58,237,0.15)' : 'transparent', color: active ? '#a78bfa' : '#64748b',
      fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.15s',
    } as React.CSSProperties),
    tabBtn: (active: boolean) => ({
      padding: '8px 20px', borderRadius: '8px', border: 'none',
      background: active ? '#7c3aed' : 'transparent', color: active ? '#fff' : '#64748b',
      fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
    } as React.CSSProperties),
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <button style={{ color: '#64748b', fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '16px' }} onClick={() => navigate('/')}>
          ← Back to Games
        </button>
        <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.8rem', fontWeight: 900, background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          {meta.emoji} {meta.title} — Lobby
        </h1>
        <p style={{ color: '#94a3b8', marginTop: '6px', fontSize: '0.95rem' }}>{meta.desc}</p>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 18px', marginBottom: '20px', color: '#ef4444', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between' }}>
          {error}
          <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }} onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Join by code */}
      <div style={{ ...s.card, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>Have a room code?</span>
        <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '240px' }}>
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
            placeholder="Enter room code (e.g. XK92)"
            maxLength={6}
            style={{ flex: 1, background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: '8px', padding: '10px 14px', color: '#e2e8f0', fontFamily: 'Orbitron, sans-serif', fontSize: '1rem', letterSpacing: '0.15em', outline: 'none' }}
          />
          <button onClick={handleJoinByCode} style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '8px', padding: '10px 20px', color: '#fff', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Join
          </button>
        </div>
      </div>

      {/* Fee filter (browse only) */}
      {tab === 'browse' && (
        <div style={{ marginBottom: '20px' }}>
          <span style={s.label}>Filter by Entry Fee (USDT)</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button style={s.feeBtn(selectedFee === 0)} onClick={() => setSelectedFee(0)}>All</button>
            {ENTRY_FEES.map(fee => (
              <button key={fee} style={s.feeBtn(selectedFee === fee)} onClick={() => setSelectedFee(fee)}>${fee}</button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', background: '#12121a', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
        <button style={s.tabBtn(tab === 'browse')} onClick={() => setTab('browse')}>Browse Rooms</button>
        <button style={s.tabBtn(tab === 'create')} onClick={() => setTab('create')}>Create Room</button>
      </div>

      {/* Browse tab */}
      {tab === 'browse' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading && (
            <div style={{ ...s.card, textAlign: 'center', color: '#64748b', padding: '48px' }}>
              Loading rooms…
            </div>
          )}
          {!loading && filteredRooms.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', color: '#64748b', padding: '48px' }}>
              No open rooms right now.{' '}
              <button style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontWeight: 700, fontSize: 'inherit' }} onClick={() => setTab('create')}>
                Create the first one →
              </button>
            </div>
          )}
          {filteredRooms.map(room => (
            <div key={room.code} style={{ ...s.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', opacity: room.status === 'full' ? 0.5 : 1 }}>
              <div style={{ display: 'flex', gap: '32px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.1em' }}>{room.code}</p>
                  <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '2px' }}>Host: {room.host.slice(0, 6)}…{room.host.slice(-4)}</p>
                </div>
                <div>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>👥 {room.players}/{room.max} players</p>
                </div>
                <div>
                  <p style={{ color: '#22c55e', fontWeight: 700 }}>💵 ${room.entry} USDT</p>
                  <p style={{ color: '#64748b', fontSize: '0.78rem' }}>🏆 Pot: ~${(room.entry * room.players * 0.85).toFixed(2)}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', background: room.status === 'waiting' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: room.status === 'waiting' ? '#22c55e' : '#ef4444', border: `1px solid ${room.status === 'waiting' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                  {room.status === 'waiting' ? '● OPEN' : '■ FULL'}
                </span>
                <button
                  disabled={room.status === 'full'}
                  onClick={() => handleJoinRoom(room.code)}
                  style={{ background: room.status === 'full' ? '#1e1e30' : 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '8px', padding: '10px 24px', color: room.status === 'full' ? '#64748b' : '#fff', fontWeight: 700, cursor: room.status === 'full' ? 'not-allowed' : 'pointer' }}
                >
                  {room.status === 'full' ? 'Full' : 'Join'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create tab */}
      {tab === 'create' && (
        <div style={{ ...s.card, maxWidth: '520px' }}>
          <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1.1rem', marginBottom: '24px' }}>Create a New Room</h2>

          <div style={{ marginBottom: '24px' }}>
            <span style={s.label}>Entry Fee (USDT)</span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {ENTRY_FEES.map(fee => (
                <button key={fee} style={s.feeBtn((selectedFee || 1) === fee)} onClick={() => setSelectedFee(fee)}>${fee}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <span style={s.label}>Max Players ({maxPlayers})</span>
            <input
              type="range" min={meta.minPlayers} max={meta.maxPlayers} value={maxPlayers}
              onChange={e => setMaxPlayers(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#7c3aed' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>
              <span>{meta.minPlayers}</span><span>{meta.maxPlayers}</span>
            </div>
          </div>

          <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '10px', padding: '16px', marginBottom: '24px' }}>
            {[
              ['Entry Fee', `$${selectedFee || 1} USDT`],
              ['Max Players', maxPlayers],
              ['Max Pot (85%)', `$${((selectedFee || 1) * maxPlayers * 0.85).toFixed(2)} USDT`],
            ].map(([k, v], i, arr) => (
              <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', paddingTop: i > 0 ? '8px' : 0, marginTop: i > 0 ? '8px' : 0, borderTop: i > 0 ? '1px solid #1e1e30' : 'none' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{k}</span>
                <span style={{ fontWeight: 700, color: i === arr.length - 1 ? '#22c55e' : '#e2e8f0' }}>{v}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={creating}
            style={{ width: '100%', background: creating ? '#1e1e30' : 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '10px', padding: '14px', color: creating ? '#64748b' : '#fff', fontWeight: 700, fontSize: '1rem', fontFamily: 'Orbitron, sans-serif', cursor: creating ? 'not-allowed' : 'pointer', letterSpacing: '0.05em' }}
          >
            {creating ? 'Creating Room…' : 'Create Room & Deposit'}
          </button>
          {!isConnected && (
            <p style={{ color: '#f59e0b', fontSize: '0.82rem', marginTop: '10px', textAlign: 'center' }}>
              ⚠️ Connect your wallet to create a room
            </p>
          )}
        </div>
      )}
    </div>
  )
}
