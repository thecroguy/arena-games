import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAccount, useWriteContract, useChainId, useSwitchChain, useReadContract } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { connectSocket } from '../utils/socket'
import { getUsername, shortAddr } from '../utils/profile'
import { SUPPORTED_CHAINS, USDT_ABI, getChain, type SupportedChain } from '../utils/chains'
import { getEscrowAddress, getRoomId, ESCROW_ABI, USDT_APPROVE_ABI } from '../utils/escrow'

const HOUSE_WALLET = (import.meta.env.VITE_HOUSE_WALLET || '0x0000000000000000000000000000000000000000') as `0x${string}`
const ACTIVE_ROOM_KEY = 'ag_active_room'

const GAME_META: Record<string, { title: string; emoji: string; desc: string; minPlayers: number; maxPlayers: number }> = {
  'math-arena':     { title: 'Math Arena',     emoji: '✚', desc: 'Speed math quiz — first correct answer scores. 100% skill, zero luck.',          minPlayers: 2, maxPlayers: 10 },
  'word-blitz':     { title: 'Word Blitz',     emoji: 'Aa', desc: 'Unscramble the word fastest to score. Vocabulary meets reaction speed.',          minPlayers: 2, maxPlayers: 10 },
  'reaction-grid':  { title: 'Reaction Grid',  emoji: '⊞', desc: 'A cell lights up — click it before anyone else. Pure reaction speed.',            minPlayers: 2, maxPlayers: 10 },
  'highest-unique': { title: 'Highest Unique', emoji: '↑', desc: 'Pick the highest number nobody else picks. Read the crowd and outsmart them.',     minPlayers: 2, maxPlayers: 20 },
  'lowest-unique':  { title: 'Lowest Unique',  emoji: '↓', desc: 'Pick the lowest number nobody else picks. Contrarian thinking wins.',              minPlayers: 2, maxPlayers: 20 },
  'number-rush':    { title: 'Number Rush',    emoji: '#', desc: 'Pick the rarest number 1–50. Most contrarian pick takes the pot.',                 minPlayers: 2, maxPlayers: 30 },
}

const ENTRY_FEES = [0.5, 1, 2, 5, 10, 25, 50]

type Room = { code: string; host: string; players: number; max: number; entry: number; status: 'waiting' | 'full' }

export default function Lobby() {
  const { gameMode } = useParams<{ gameMode: string }>()
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const currentChainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()

  const [rooms, setRooms]           = useState<Room[]>([])
  const [selectedFee, setSelectedFee] = useState<number>(1)
  const [maxPlayers, setMaxPlayers] = useState<number>(5)
  const [joinCode, setJoinCode]     = useState('')
  const [tab, setTab]               = useState<'browse' | 'create'>('browse')
  const [loading, setLoading]       = useState(true)
  const [creating, setCreating]     = useState(false)
  const [joining, setJoining]       = useState<string | null>(null)
  const [error, setError]           = useState('')
  const [payStep, setPayStep]       = useState<'idle' | 'switching' | 'approving' | 'paying' | 'creating'>('idle')
  const [activeRoom, setActiveRoom] = useState(() => localStorage.getItem(ACTIVE_ROOM_KEY) || '')
  const [selectedChain, setSelectedChain] = useState<SupportedChain>(SUPPORTED_CHAINS[0])
  const [showChainPicker, setShowChainPicker] = useState(false)
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const meta = GAME_META[gameMode ?? ''] ?? { title: gameMode ?? 'Game', emoji: '🎮', desc: '', minPlayers: 2, maxPlayers: 10 }
  const myName = address ? getUsername(address) : ''

  // Read USDT balance on selected chain
  const { data: usdtBalance } = useReadContract({
    address: selectedChain.usdt,
    abi: USDT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: selectedChain.id,
    query: { enabled: !!address },
  })

  const balanceFormatted = usdtBalance !== undefined
    ? Number(formatUnits(usdtBalance as bigint, selectedChain.decimals)).toFixed(2)
    : '—'

  // Sync chain picker to current wallet chain
  useEffect(() => {
    const chain = getChain(currentChainId)
    if (chain) setSelectedChain(chain)
  }, [currentChainId])

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
    return () => {
      socket.off('room:update')
      clearInterval(interval)
      if (errorTimer.current) clearTimeout(errorTimer.current)
    }
  }, [gameMode])

  /** Switch chain if needed, then approve + deposit into escrow (or fallback to direct transfer). */
  async function payEntryFee(fee: number, chain: SupportedChain, roomCode: string): Promise<string | null> {
    // Switch chain if needed
    if (currentChainId !== chain.id) {
      setPayStep('switching')
      try {
        await switchChainAsync({ chainId: chain.id })
      } catch {
        showError(`Please switch to ${chain.name} in your wallet`)
        return null
      }
    }

    const escrowAddr = getEscrowAddress(chain.id)
    const amount     = parseUnits(String(fee), chain.decimals)

    if (escrowAddr) {
      // ── Escrow flow: approve → deposit ──────────────────────────────────
      setPayStep('approving')
      try {
        // Step 1 — approve the escrow contract to pull USDT
        await writeContractAsync({
          address: chain.usdt,
          abi: USDT_APPROVE_ABI,
          functionName: 'approve',
          args: [escrowAddr, amount],
          chainId: chain.id,
        })
      } catch {
        showError('Approval rejected. You must approve USDT to lock into the game contract.')
        return null
      }

      // Step 2 — deposit into escrow (locks funds, auto-pays winner on game end)
      setPayStep('paying')
      try {
        const roomId = getRoomId(roomCode)
        const hash   = await writeContractAsync({
          address: escrowAddr,
          abi: ESCROW_ABI,
          functionName: 'deposit',
          args: [roomId, amount],
          chainId: chain.id,
        })
        return hash
      } catch {
        showError('Deposit failed. Your USDT was not locked — please try again.')
        return null
      }
    } else {
      // ── Legacy fallback: direct transfer to house wallet ─────────────────
      // Used on chains where the escrow contract isn't deployed yet.
      // Winner is paid manually by the team within 24h.
      setPayStep('paying')
      try {
        const hash = await writeContractAsync({
          address: chain.usdt,
          abi: USDT_ABI,
          functionName: 'transfer',
          args: [HOUSE_WALLET, amount],
          chainId: chain.id,
        })
        return hash
      } catch {
        showError('Payment rejected. Entry fee is required to play.')
        return null
      }
    }
  }

  async function payAndCreate() {
    if (!isConnected || !address) { showError('Connect your wallet first'); return }
    setCreating(true); setError('')

    // Step 1 — create room on server first to get the room code
    // (needed so we can deposit into escrow with the correct roomId)
    setPayStep('creating')
    const socket = connectSocket()
    const code = await new Promise<string | null>(resolve => {
      socket.emit('room:create',
        { gameMode, entryFee: selectedFee, maxPlayers, address, chainId: selectedChain.id },
        (res: { code?: string; error?: string }) => {
          if (res.error) { showError(res.error); resolve(null) }
          else resolve(res.code!)
        }
      )
    })
    if (!code) { setCreating(false); setPayStep('idle'); return }

    // Step 2 — pay entry fee (escrow deposit or legacy transfer)
    const txHash = await payEntryFee(selectedFee, selectedChain, code)
    if (!txHash) { setCreating(false); setPayStep('idle'); return }

    // Step 3 — confirm deposit with server (marks host as ready)
    socket.emit('room:deposit', { code, txHash }, () => {})

    setCreating(false); setPayStep('idle')
    localStorage.setItem(ACTIVE_ROOM_KEY, code)
    setActiveRoom(code)
    navigate(`/game/${code}`, { state: { host: true, entry: selectedFee, maxPlayers, gameMode, chainId: selectedChain.id } })
  }

  async function handleJoinRoom(code: string) {
    if (!isConnected || !address) { showError('Connect your wallet first'); return }
    const room = rooms.find(r => r.code === code)
    const fee = room?.entry ?? 1
    setJoining(code); setError('')

    // Step 1 — pay entry fee into escrow (or legacy transfer) using the room code
    const txHash = await payEntryFee(fee, selectedChain, code)
    if (!txHash) { setJoining(null); setPayStep('idle'); return }

    // Step 2 — join the room on the server
    const socket = connectSocket()
    socket.emit('room:join',
      { code, address, chainId: selectedChain.id, txHash },
      (res: { ok?: boolean; error?: string; reconnected?: boolean }) => {
        setJoining(null); setPayStep('idle')
        if (res.error) { showError(res.error); return }
        // Step 3 — confirm deposit so server marks player as ready
        socket.emit('room:deposit', { code, txHash }, () => {})
        localStorage.setItem(ACTIVE_ROOM_KEY, code)
        setActiveRoom(code)
        navigate(`/game/${code}`, { state: { gameMode, chainId: selectedChain.id } })
      }
    )
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

  async function quickMatch() {
    if (!isConnected || !address) { showError('Connect your wallet first'); return }
    const socket = connectSocket()
    socket.emit('rooms:list', gameMode, async (list: Room[]) => {
      const open = list.find(r => r.status === 'waiting' && r.players < r.max)
      if (open) {
        await handleJoinRoom(open.code)
      } else {
        setTab('create')
        showError('No open rooms found — create the first one!')
      }
    })
  }

  const escrowAvailable = !!getEscrowAddress(selectedChain.id)

  const createBtnLabel = () => {
    if (payStep === 'switching')  return `Switching to ${selectedChain.name}…`
    if (payStep === 'creating')   return 'Creating room…'
    if (payStep === 'approving')  return 'Step 1/2 — Approve USDT in wallet…'
    if (payStep === 'paying')     return escrowAvailable ? 'Step 2/2 — Locking into contract…' : `Sending $${selectedFee} USDT…`
    return escrowAvailable
      ? `🔒 Lock $${selectedFee} USDT in contract & Create`
      : `Pay $${selectedFee} USDT & Create`
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: 'clamp(24px,4vw,40px) clamp(16px,3vw,24px)' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <button style={{ color: '#64748b', fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '12px' }} onClick={() => navigate('/')}>
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
            Active room: <strong style={{ fontFamily: 'Orbitron, sans-serif' }}>{activeRoom}</strong>
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
          <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', flexShrink: 0 }} onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Chain selector */}
      <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', padding: '14px 18px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', marginBottom: '4px' }}>PAY WITH USDT ON</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {SUPPORTED_CHAINS.map(chain => (
                <button key={chain.id}
                  onClick={() => setSelectedChain(chain)}
                  style={{
                    padding: '6px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                    background: selectedChain.id === chain.id ? `${chain.color}22` : 'transparent',
                    border: `1px solid ${selectedChain.id === chain.id ? chain.color : '#1e1e30'}`,
                    color: selectedChain.id === chain.id ? chain.color : '#64748b',
                  }}>
                  {chain.icon} {chain.shortName}
                </button>
              ))}
            </div>
          </div>
          {address && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '2px' }}>Your balance</p>
              <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1rem', color: Number(balanceFormatted) >= selectedFee ? '#22c55e' : '#f59e0b' }}>
                ${balanceFormatted} <span style={{ fontSize: '0.65rem', color: '#64748b' }}>USDT</span>
              </p>
            </div>
          )}
        </div>
        {selectedChain.id === 1 && (
          <p style={{ color: '#f59e0b', fontSize: '0.75rem', marginTop: '10px' }}>
            ⚠️ Ethereum has high gas fees. Consider Polygon, Arbitrum, or Base for cheap transfers.
          </p>
        )}
      </div>

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
          <button onClick={quickMatch}
            style={{ background: 'linear-gradient(135deg, #22c55e, #06b6d4)', border: 'none', borderRadius: '10px', padding: '12px', color: '#0a0a0f', fontWeight: 800, fontSize: '0.92rem', fontFamily: 'Orbitron, sans-serif', cursor: 'pointer', letterSpacing: '0.04em' }}>
            ⚡ Quick Match — Auto-join best open room
          </button>
          {loading && <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', textAlign: 'center', color: '#64748b', padding: '48px' }}>Loading rooms…</div>}
          {!loading && rooms.length === 0 && (
            <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', textAlign: 'center', color: '#64748b', padding: '48px' }}>
              No open rooms.{' '}
              <button style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontWeight: 700, fontSize: 'inherit' }} onClick={() => setTab('create')}>Create the first →</button>
            </div>
          )}
          {rooms.map(room => (
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                  <button
                    disabled={room.status === 'full' || joining === room.code}
                    onClick={() => handleJoinRoom(room.code)}
                    style={{ background: room.status === 'full' ? '#1e1e30' : 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '8px', padding: '9px 20px', color: room.status === 'full' ? '#64748b' : '#fff', fontWeight: 700, cursor: room.status === 'full' ? 'not-allowed' : 'pointer', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                    {joining === room.code
                      ? (payStep === 'approving' ? 'Approving…' : payStep === 'paying' ? 'Locking…' : `${selectedChain.icon} Paying…`)
                      : `Join ${selectedChain.icon}`}
                  </button>
                  {room.status === 'waiting' && (
                    <span style={{ fontSize: '0.65rem', color: '#475569' }}>
                      {getEscrowAddress(selectedChain.id) ? '🔒 Auto-payout · no extra fees' : '⚠️ Manual payout'}
                    </span>
                  )}
                </div>
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

          {/* Summary */}
          <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
            {([
              ['Network', `${selectedChain.icon} ${selectedChain.name}`],
              ['Entry Fee', `$${selectedFee} USDT`],
              ['Max Players', maxPlayers],
              ['Max Pot (85%)', `$${(selectedFee * maxPlayers * 0.85).toFixed(2)} USDT`],
            ] as [string, string | number][]).map(([k, v], i) => (
              <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', paddingTop: i > 0 ? '8px' : 0, marginTop: i > 0 ? '8px' : 0, borderTop: i > 0 ? '1px solid #1e1e30' : 'none' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.88rem' }}>{k}</span>
                <span style={{ fontWeight: 700, color: i === 3 ? '#22c55e' : '#e2e8f0', fontSize: '0.88rem' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Balance warning */}
          {address && Number(balanceFormatted) < selectedFee && balanceFormatted !== '—' && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '0.8rem', color: '#ef4444' }}>
              ⚠️ Insufficient USDT on {selectedChain.name}. Balance: ${balanceFormatted}
            </div>
          )}

          {/* Escrow / payout notice */}
          <div style={{ background: escrowAvailable ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${escrowAvailable ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '0.78rem', color: escrowAvailable ? '#86efac' : '#fcd34d', lineHeight: 1.5 }}>
            {escrowAvailable ? (
              <>🔒 Funds locked in smart contract — winner paid automatically on-chain.<br />
              <span style={{ color: '#64748b' }}>You pay entry fee only. Gas covered by the platform from its 15% fee.</span></>
            ) : (
              <>⚠️ Escrow not available on {selectedChain.name} yet — your USDT goes to our house wallet.<br />
              Winner paid manually by the team within 24h. Switch to Polygon for instant auto-payout.</>
            )}
          </div>

          <button onClick={payAndCreate} disabled={creating || !isConnected}
            style={{ width: '100%', background: creating ? '#1e1e30' : 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '10px', padding: '14px', color: creating ? '#64748b' : '#fff', fontWeight: 700, fontSize: '0.95rem', fontFamily: 'Orbitron, sans-serif', cursor: creating ? 'not-allowed' : 'pointer', letterSpacing: '0.04em' }}>
            {creating ? createBtnLabel() : `${selectedChain.icon} Pay & Create Room`}
          </button>
          {!isConnected && (
            <p style={{ color: '#f59e0b', fontSize: '0.82rem', marginTop: '10px', textAlign: 'center' }}>⚠️ Connect your wallet to create a room</p>
          )}
        </div>
      )}

      {/* Chain picker modal */}
      {showChainPicker && (
        <div onClick={() => setShowChainPicker(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '24px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '380px' }}>
            <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.9rem', marginBottom: '16px', color: '#e2e8f0' }}>Select Network</h3>
            {SUPPORTED_CHAINS.map(chain => (
              <button key={chain.id} onClick={() => { setSelectedChain(chain); setShowChainPicker(false) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '10px', border: `1px solid ${selectedChain.id === chain.id ? chain.color : '#1e1e30'}`, background: selectedChain.id === chain.id ? `${chain.color}18` : 'transparent', cursor: 'pointer', marginBottom: '6px' }}>
                <span style={{ fontSize: '1.2rem' }}>{chain.icon}</span>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>{chain.name}</p>
                  <p style={{ color: '#64748b', fontSize: '0.75rem' }}>Gas: {chain.symbol}</p>
                </div>
                {selectedChain.id === chain.id && <span style={{ marginLeft: 'auto', color: chain.color, fontSize: '1rem' }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
