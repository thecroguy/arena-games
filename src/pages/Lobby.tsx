import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAccount, useWriteContract, useChainId, useSwitchChain } from 'wagmi'
import { polygon } from 'wagmi/chains'
import { parseUnits } from 'viem'
import { connectSocket } from '../utils/socket'
import { getUsername, shortAddr } from '../utils/profile'

const ACTIVE_ROOM_KEY = 'ag_active_room'

const USDT_POLYGON = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
const HOUSE_WALLET = (import.meta.env.VITE_HOUSE_WALLET || '0x0000000000000000000000000000000000000000') as `0x${string}`
const USDT_ABI = [
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }] },
] as const

const GAME_META: Record<string, { title: string; emoji: string; desc: string; minPlayers: number; maxPlayers: number }> = {
  'math-arena': {
    title: 'Math Arena', emoji: '🧮',
    desc: 'Speed math quiz — first correct answer scores. 100% skill, zero luck.',
    minPlayers: 2, maxPlayers: 10,
  },
}

const ENTRY_FEES = [0.5, 1, 2, 5, 10, 25, 50]

type Room = { code: string; host: string; players: number; max: number; entry: number; status: 'waiting' | 'full' }

export default function Lobby() {
  const { gameMode } = useParams<{ gameMode: string }>()
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()

  const [rooms, setRooms]         = useState<Room[]>([])
  const [selectedFee, setSelectedFee] = useState<number>(1)
  const [maxPlayers, setMaxPlayers]   = useState<number>(5)
  const [joinCode, setJoinCode]   = useState('')
  const [tab, setTab]             = useState<'browse' | 'create'>('browse')
  const [loading, setLoading]     = useState(true)
  const [creating, setCreating]   = useState(false)
  const [joining, setJoining]     = useState<string | null>(null)
  const [error, setError]         = useState('')
  const [payStep, setPayStep]     = useState<'idle' | 'switching' | 'paying' | 'creating'>('idle')
  const [activeRoom, setActiveRoom] = useState(() => localStorage.getItem(ACTIVE_ROOM_KEY) || '')
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const meta = GAME_META[gameMode ?? ''] ?? { title: gameMode ?? 'Game', emoji: '🎮', desc: '', minPlayers: 2, maxPlayers: 10 }
  const myName = address ? getUsername(address) : ''

  // Auto-dismiss errors after 5s
  function showError(msg: string) {
    setError(msg)
    if (errorTimer.current) clearTimeout(errorTimer.current)
    errorTimer.current = setTimeout(() => setError(''), 5000)
  }

  useEffect(() => {
    const socket = connectSocket()
    function loadRooms() {
      socket.emit('rooms:list', gameMode, (list: Room[]) => { setRooms(list); setLoading(false) })
    }
    if (socket.connected) loadRooms()
    else { socket.connect(); socket.once('connect', loadRooms) }
    socket.on('room:update', loadRooms)
    const interval = setInterval(loadRooms, 5000)
    return () => { socket.off('room:update'); clearInterval(interval); if (errorTimer.current) clearTimeout(errorTimer.current) }
  }, [gameMode])

  const filteredRooms = rooms

  async function payAndCreate() {
    if (!isConnected || !address) { showError('Connect your wallet first'); return }
    setCreating(true)
    setError('')

    if (chainId !== polygon.id) {
      setPayStep('switching')
      try {
        await switchChainAsync({ chainId: polygon.id })
      } catch {
        showError('Please switch to Polygon network to pay entry fee')
        setCreating(false); setPayStep('idle'); return
      }
    }

    setPayStep('paying')
    try {
      await writeContractAsync({
        address: USDT_POLYGON as `0x${string}`,
        abi: USDT_ABI,
        functionName: 'transfer',
        args: [HOUSE_WALLET, parseUnits(String(selectedFee), 6)],
        chainId: polygon.id,
      })
    } catch {
      showError('Payment failed or rejected. Entry fee is required to create a room.')
      setCreating(false); setPayStep('idle'); return
    }

    setPayStep('creating')
    const socket = connectSocket()
    socket.emit('room:create', { gameMode, entryFee: selectedFee, maxPlayers, address }, (res: { code?: string; error?: string }) => {
      setCreating(false); setPayStep('idle')
      if (res.error) { showError(res.error); return }
      localStorage.setItem(ACTIVE_ROOM_KEY, res.code!)
      setActiveRoom(res.code!)
      navigate(`/game/${res.code}`, { state: { host: true, entry: selectedFee, maxPlayers } })
    })
  }

  async function handleJoinRoom(code: string) {
    if (!isConnected || !address) { showError('Connect your wallet first'); return }
    const room = rooms.find(r => r.code === code)
    const fee = room?.entry ?? 1
    setJoining(code)
    setError('')

    if (chainId !== polygon.id) {
      try {
        await switchChainAsync({ chainId: polygon.id })
      } catch {
        showError('Please switch to Polygon network')
        setJoining(null); return
      }
    }

    try {
      await writeContractAsync({
        address: USDT_POLYGON as `0x${string}`,
        abi: USDT_ABI,
        functionName: 'transfer',
        args: [HOUSE_WALLET, parseUnits(String(fee), 6)],
        chainId: polygon.id,
      })
    } catch {
      showError('Payment failed or rejected. Entry fee is required to join.')
      setJoining(null); return
    }

    const socket = connectSocket()
    socket.emit('room:join', { code, address }, (res: { ok?: boolean; error?: string }) => {
      setJoining(null)
      if (res.error) { showError(res.error); return }
      localStorage.setItem(ACTIVE_ROOM_KEY, code)
      setActiveRoom(code)
      navigate(`/game/${code}`)
    })
  }

  function handleJoinByCode() {
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    handleJoinRoom(code)
  }

  function clearActiveRoom() {
    localStorage.removeItem(ACTIVE_ROOM_KEY)
    setActiveRoom('')
  }

  const createBtnLabel = () => {
    if (payStep === 'switching') return 'Switching to Polygon…'
    if (payStep === 'paying')    return `Sending $${selectedFee} USDT…`
    if (payStep === 'creating')  return 'Creating room…'
    return `Pay $${selectedFee} & Create Room`
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: 'clamp(24px,4vw,40px) clamp(16px,3vw,24px)' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <button style={{ color: '#64748b', fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => navigate('/')}>
          ← Back
        </button>
        <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 900, background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '4px' }}>
          {meta.emoji} {meta.title}
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.88rem' }}>{meta.desc}</p>
        {myName && <p style={{ color: '#a78bfa', fontSize: '0.8rem', marginTop: '4px' }}>Playing as <strong>{myName}</strong></p>}
      </div>

      {/* Active room banner */}
      {activeRoom && (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '10px', padding: '12px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ color: '#22c55e', fontSize: '0.88rem', fontWeight: 600 }}>
            You have an active room: <strong style={{ fontFamily: 'Orbitron, sans-serif' }}>{activeRoom}</strong>
          </span>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button onClick={() => navigate(`/game/${activeRoom}`)}
              style={{ background: '#22c55e', border: 'none', borderRadius: '7px', padding: '6px 14px', color: '#0a0a0f', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
              Rejoin →
            </button>
            <button onClick={clearActiveRoom}
              style={{ background: 'none', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '7px', padding: '6px 10px', color: '#64748b', fontSize: '0.82rem', cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 18px', marginBottom: '16px', color: '#ef4444', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', flexShrink: 0 }} onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Join by code */}
      <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap' }}>Have a code?</span>
        <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '220px' }}>
          <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
            placeholder="ROOM CODE"
            maxLength={6}
            style={{ flex: 1, background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: '8px', padding: '10px 14px', color: '#e2e8f0', fontFamily: 'Orbitron, sans-serif', fontSize: '0.95rem', letterSpacing: '0.15em', outline: 'none' }}
          />
          <button onClick={handleJoinByCode}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '8px', padding: '10px 18px', color: '#fff', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.88rem' }}>
            Join
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: '#12121a', borderRadius: '10px', padding: '4px', width: 'fit-content', border: '1px solid #1e1e30' }}>
        {(['browse', 'create'] as const).map(t => (
          <button key={t} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: tab === t ? '#7c3aed' : 'transparent', color: tab === t ? '#fff' : '#64748b', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }} onClick={() => setTab(t)}>
            {t === 'browse' ? 'Browse Rooms' : 'Create Room'}
          </button>
        ))}
      </div>

      {/* Browse */}
      {tab === 'browse' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading && <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', textAlign: 'center', color: '#64748b', padding: '48px' }}>Loading rooms…</div>}
          {!loading && filteredRooms.length === 0 && (
            <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', textAlign: 'center', color: '#64748b', padding: '48px' }}>
              No open rooms.{' '}
              <button style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontWeight: 700, fontSize: 'inherit' }} onClick={() => setTab('create')}>Create the first →</button>
            </div>
          )}
          {filteredRooms.map(room => (
            <div key={room.code} style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', opacity: room.status === 'full' ? 0.5 : 1 }}>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.1em' }}>{room.code}</p>
                  <p style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '2px' }}>Host: {shortAddr(room.host)}</p>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>👥 {room.players}/{room.max}</p>
                <div>
                  <p style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.9rem' }}>${room.entry} USDT</p>
                  <p style={{ color: '#64748b', fontSize: '0.75rem' }}>Pot ~${(room.entry * room.players * 0.85).toFixed(2)}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: room.status === 'waiting' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: room.status === 'waiting' ? '#22c55e' : '#ef4444', border: `1px solid ${room.status === 'waiting' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                  {room.status === 'waiting' ? '● OPEN' : '■ FULL'}
                </span>
                <button
                  disabled={room.status === 'full' || joining === room.code}
                  onClick={() => handleJoinRoom(room.code)}
                  style={{ background: room.status === 'full' ? '#1e1e30' : 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '8px', padding: '9px 20px', color: room.status === 'full' ? '#64748b' : '#fff', fontWeight: 700, cursor: room.status === 'full' ? 'not-allowed' : 'pointer', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                  {joining === room.code ? 'Paying…' : `Join $${room.entry}`}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create */}
      {tab === 'create' && (
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', padding: '24px', maxWidth: '520px' }}>
          <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1rem', marginBottom: '24px', color: '#e2e8f0' }}>New Room</h2>

          <div style={{ marginBottom: '22px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '10px', display: 'block' }}>Entry Fee (USDT)</span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {ENTRY_FEES.map(fee => (
                <button key={fee}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: `1px solid ${selectedFee === fee ? '#7c3aed' : '#1e1e30'}`, background: selectedFee === fee ? 'rgba(124,58,237,0.15)' : 'transparent', color: selectedFee === fee ? '#a78bfa' : '#64748b', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}
                  onClick={() => setSelectedFee(fee)}>${fee}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '22px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '10px', display: 'block' }}>Max Players ({maxPlayers})</span>
            <input type="range" min={meta.minPlayers} max={meta.maxPlayers} value={maxPlayers}
              onChange={e => setMaxPlayers(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#7c3aed' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.78rem', marginTop: '4px' }}>
              <span>{meta.minPlayers}</span><span>{meta.maxPlayers}</span>
            </div>
          </div>

          <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
            {([['Entry Fee', `$${selectedFee} USDT`], ['Max Players', maxPlayers], ['Pot if full (85%)', `$${(selectedFee * maxPlayers * 0.85).toFixed(2)} USDT`]] as [string, string | number][]).map(([k, v], i) => (
              <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', paddingTop: i > 0 ? '8px' : 0, marginTop: i > 0 ? '8px' : 0, borderTop: i > 0 ? '1px solid #1e1e30' : 'none' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.88rem' }}>{k}</span>
                <span style={{ fontWeight: 700, color: i === 2 ? '#22c55e' : '#e2e8f0', fontSize: '0.88rem' }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '10px', padding: '10px 14px', marginBottom: '20px', fontSize: '0.8rem', color: '#64748b' }}>
            💳 Your wallet will prompt you to send <strong style={{ color: '#22c55e' }}>${selectedFee} USDT</strong> on Polygon as entry fee.
          </div>

          <button onClick={payAndCreate} disabled={creating || !isConnected}
            style={{ width: '100%', background: creating ? '#1e1e30' : 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '10px', padding: '14px', color: creating ? '#64748b' : '#fff', fontWeight: 700, fontSize: '0.95rem', fontFamily: 'Orbitron, sans-serif', cursor: creating ? 'not-allowed' : 'pointer', letterSpacing: '0.04em' }}>
            {creating ? createBtnLabel() : `Pay $${selectedFee} USDT & Create`}
          </button>
          {!isConnected && (
            <p style={{ color: '#f59e0b', fontSize: '0.82rem', marginTop: '10px', textAlign: 'center' }}>⚠️ Connect your wallet to create a room</p>
          )}
        </div>
      )}
    </div>
  )
}
