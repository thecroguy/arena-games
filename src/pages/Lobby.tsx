import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAccount, useWriteContract, useChainId, useSwitchChain, useReadContract, useSignMessage, usePublicClient } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { connectSocket } from '../utils/socket'
import { getUsername } from '../utils/profile'
import { SUPPORTED_CHAINS, USDT_ABI, getChain, type SupportedChain } from '../utils/chains'
import { getEscrowAddress, getRoomId, ESCROW_ABI, USDT_APPROVE_ABI } from '../utils/escrow'

const HOUSE_WALLET = import.meta.env.VITE_HOUSE_WALLET as `0x${string}` | undefined
const ACTIVE_ROOM_KEY = 'ag_active_room'
const ROOM_HISTORY_KEY = 'ag_room_history'
const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

function addToRoomHistory(code: string, chainId: number) {
  try {
    const prev = JSON.parse(localStorage.getItem(ROOM_HISTORY_KEY) || '[]') as { code: string; chainId: number }[]
    const updated = [{ code, chainId }, ...prev.filter(r => r.code !== code)].slice(0, 20)
    localStorage.setItem(ROOM_HISTORY_KEY, JSON.stringify(updated))
  } catch { /* ignore */ }
}

const GAME_META: Record<string, { title: string; emoji: string; desc: string; minPlayers: number; maxPlayers: number }> = {
  'math-arena':     { title: 'Math Arena',      emoji: '✚',  desc: 'Speed math quiz — first correct answer scores. 100% skill, zero luck.',           minPlayers: 2, maxPlayers: 10 },
  'pattern-memory': { title: 'Pattern Memory 🧠', emoji: '🧠', desc: 'Memorize a digit sequence then type it from memory. First correct scores.',       minPlayers: 2, maxPlayers: 10 },
  'reaction-grid':  { title: 'Reaction Grid',   emoji: '⊞',  desc: 'A cell lights up — click it before anyone else. Pure reaction speed.',             minPlayers: 2, maxPlayers: 10 },
  'highest-unique': { title: 'Highest Unique',  emoji: '↑',  desc: 'Pick the highest number nobody else picks. Read the crowd and outsmart them.',      minPlayers: 2, maxPlayers: 20 },
  'lowest-unique':  { title: 'Lowest Unique',   emoji: '↓',  desc: 'Pick the lowest number nobody else picks. Contrarian thinking wins.',               minPlayers: 2, maxPlayers: 20 },
  'liars-dice':     { title: "Liar's Dice 🎲",  emoji: '🎲',  desc: 'Each player gets 3 dice. Bid on the total — bluff or call LIAR! to win.',          minPlayers: 2, maxPlayers: 6  },
}

const ENTRY_FEES = [0.5, 1, 2, 5, 10, 25, 50]

type Room = { code: string; host: string; players: number; max: number; entry: number; status: 'waiting' | 'full' }

export default function Lobby() {
  const { gameMode } = useParams<{ gameMode: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { address, isConnected } = useAccount()
  const currentChainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const { signMessageAsync } = useSignMessage()
  const publicClient = usePublicClient()
  const authSigRef = useRef<string | null>(null)

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
  const [lockedInRoom, setLockedInRoom] = useState<string | null>(null)
  const [searching, setSearching]       = useState(false)
  const [queueSize, setQueueSize]       = useState(0)
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

  useEffect(() => { authSigRef.current = null }, [address])

  // Auto-join when redirected from matchmaking
  useEffect(() => {
    const state = location.state as { autoJoin?: string; autoFee?: number; autoChainId?: number } | null
    if (!state?.autoJoin || !address || joining || creating) return
    const chain = getChain(state.autoChainId ?? 137) ?? selectedChain
    setSelectedChain(chain)
    if (state.autoFee) setSelectedFee(state.autoFee)
    // Clear state so a refresh doesn't re-trigger
    window.history.replaceState({}, '')
    handleJoinRoom(state.autoJoin)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, address])

  // Check if user already has a locked deposit in another room
  useEffect(() => {
    if (!address) return
    fetch(`${SERVER_URL}/api/active-deposit/${address}`)
      .then(r => r.json())
      .then(data => { if (data.hasActive) setLockedInRoom(data.roomCode) })
      .catch(() => {})
  }, [address])

  async function getAuthSig(): Promise<string | null> {
    if (authSigRef.current) return authSigRef.current
    try {
      const sig = await signMessageAsync({ message: `Arena Games: ${address?.toLowerCase()}` })
      authSigRef.current = sig
      return sig
    } catch {
      showError('Wallet signature required to join — this proves you own the address.')
      return null
    }
  }

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
    function verifyActiveRoom(code: string) {
      socket.emit('room:get', code, (room: unknown) => {
        if (!room) {
          localStorage.removeItem(ACTIVE_ROOM_KEY)
          setActiveRoom('')
        }
      })
    }
    if (socket.connected) {
      loadRooms()
      const cached = localStorage.getItem(ACTIVE_ROOM_KEY)
      if (cached) verifyActiveRoom(cached)
    } else {
      socket.connect()
      socket.once('connect', () => {
        loadRooms()
        const cached = localStorage.getItem(ACTIVE_ROOM_KEY)
        if (cached) verifyActiveRoom(cached)
      })
    }
    socket.on('room:update', loadRooms)
    socket.on('matchmaking:queue_update', ({ size }: { size: number }) => setQueueSize(size))
    socket.on('matchmaking:matched', ({ code, entryFee, chainId }: { code: string; entryFee: number; gameMode: string; chainId: number }) => {
      setSearching(false)
      setQueueSize(0)
      addToRoomHistory(code, chainId)
      // Navigate to lobby to complete deposit, with room pre-filled
      navigate(`/lobby/${gameMode}`, { state: { autoJoin: code, autoFee: entryFee, autoChainId: chainId }, replace: true })
    })
    socket.on('matchmaking:timeout', ({ reason }: { reason: string }) => {
      setSearching(false); setQueueSize(0); showError(reason)
    })
    socket.on('room:timeout', () => {
      setLockedInRoom(null)
      setJoining(null)
      setCreating(false)
      setPayStep('idle')
      showError('Room timed out — no second player joined in time. Your deposit will be refunded. Check Profile → Stuck Deposits.')
    })
    const interval = setInterval(loadRooms, 5000)
    return () => {
      socket.off('room:update')
      socket.off('matchmaking:queue_update')
      socket.off('matchmaking:matched')
      socket.off('matchmaking:timeout')
      socket.off('room:timeout')
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
      // Check existing allowance — skip approve if already sufficient
      setPayStep('approving')
      try {
        let needsApprove = true
        if (publicClient && address) {
          try {
            const allowance = await publicClient.readContract({
              address: chain.usdt,
              abi: [{ name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] }],
              functionName: 'allowance',
              args: [address, escrowAddr],
            }) as bigint
            if (allowance >= amount) needsApprove = false
          } catch { /* ignore, proceed with approve */ }
        }
        if (needsApprove) {
          await writeContractAsync({
            address: chain.usdt,
            abi: USDT_APPROVE_ABI,
            functionName: 'approve',
            args: [escrowAddr, amount],
            chainId: chain.id,
          })
        }
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
      if (!HOUSE_WALLET) {
        showError('Payments are not configured for this network yet.')
        return null
      }
      setPayStep('paying')
      try {
        const hash = await writeContractAsync({
          address: chain.usdt,
          abi: USDT_ABI,
          functionName: 'transfer',
          args: [HOUSE_WALLET as `0x${string}`, amount],
          chainId: chain.id,
        })
        return hash
      } catch {
        showError('Payment rejected. Entry fee is required to play.')
        return null
      }
    }
  }

  async function findMatch() {
    if (!isConnected || !address) { showError('Connect your wallet first'); return }
    if (lockedInRoom) { showError(`You have funds locked in room ${lockedInRoom}. Claim a refund from your Profile first.`); return }
    const authSig = await getAuthSig()
    if (!authSig) return
    setSearching(true)
    setQueueSize(0)
    const socket = connectSocket()
    socket.emit('matchmaking:join', { gameMode, entryFee: selectedFee, chainId: selectedChain.id, address, authSig },
      (res: { ok?: boolean; error?: string; queueSize?: number }) => {
        if (res.error) { setSearching(false); showError(res.error) }
        else setQueueSize(res.queueSize ?? 1)
      }
    )
  }

  function cancelMatch() {
    setSearching(false); setQueueSize(0)
    const socket = connectSocket()
    socket.emit('matchmaking:leave', {}, () => {})
  }

  async function payAndCreate() {
    if (!isConnected || !address) { showError('Connect your wallet first'); return }
    if (lockedInRoom) { showError(`You have funds locked in room ${lockedInRoom}. Finish that game or claim a refund from your Profile first.`); return }
    setCreating(true); setError('')
    const authSig = await getAuthSig()
    if (!authSig) { setCreating(false); return }

    // Step 1 — create room on server first to get the room code
    // (needed so we can deposit into escrow with the correct roomId)
    setPayStep('creating')
    const socket = connectSocket()
    const code = await new Promise<string | null>(resolve => {
      socket.emit('room:create',
        { gameMode, entryFee: selectedFee, maxPlayers, address, chainId: selectedChain.id, authSig },
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
    socket.emit('room:deposit', { code, txHash, address }, () => {})
    // Also report to REST API as permanent record (survives server restarts)
    fetch(`${SERVER_URL}/api/report-deposit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, room_code: code, tx_hash: txHash, chain_id: selectedChain.id, amount_usdt: selectedFee }),
    }).catch(() => {})

    setCreating(false); setPayStep('idle')
    localStorage.setItem(ACTIVE_ROOM_KEY, code)
    setActiveRoom(code)
    addToRoomHistory(code, selectedChain.id)
    navigate(`/game/${code}`, { state: { host: true, entry: selectedFee, maxPlayers, gameMode, chainId: selectedChain.id } })
  }

  async function handleJoinRoom(code: string) {
    if (!isConnected || !address) { showError('Connect your wallet first'); return }
    if (lockedInRoom && lockedInRoom !== code) { showError(`You have funds locked in room ${lockedInRoom}. Finish that game or claim a refund from your Profile first.`); return }
    const room = rooms.find(r => r.code === code)
    const fee = room?.entry ?? 1
    setJoining(code); setError('')
    const authSig = await getAuthSig()
    if (!authSig) { setJoining(null); return }

    // Step 1 — pay entry fee into escrow (or legacy transfer) using the room code
    const txHash = await payEntryFee(fee, selectedChain, code)
    if (!txHash) { setJoining(null); setPayStep('idle'); return }

    // Step 2 — join the room on the server
    const socket = connectSocket()
    socket.emit('room:join',
      { code, address, chainId: selectedChain.id, txHash, authSig },
      (res: { ok?: boolean; error?: string; reconnected?: boolean }) => {
        setJoining(null); setPayStep('idle')
        if (res.error) { showError(res.error); return }
        // Step 3 — confirm deposit so server marks player as ready
        socket.emit('room:deposit', { code, txHash, address }, () => {})
        // Also report to REST API as permanent record
        fetch(`${SERVER_URL}/api/report-deposit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, room_code: code, tx_hash: txHash, chain_id: selectedChain.id, amount_usdt: fee }),
        }).catch(() => {})
        localStorage.setItem(ACTIVE_ROOM_KEY, code)
        setActiveRoom(code)
        addToRoomHistory(code, selectedChain.id)
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

      {/* Find Match (matchmaking) */}
      {searching ? (
        <div style={{ background: '#12121a', border: '1px solid rgba(124,58,237,0.4)', borderRadius: '14px', padding: '20px 24px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <p style={{ color: '#a78bfa', fontWeight: 700, fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', marginBottom: '4px' }}>
              Finding opponents… {queueSize > 0 && `(${queueSize} in queue)`}
            </p>
            <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Entry fee ${selectedFee} · {selectedChain.name} · waiting up to 30s</p>
          </div>
          <button onClick={cancelMatch} style={{ background: 'none', border: '1px solid #475569', borderRadius: '8px', padding: '8px 16px', color: '#94a3b8', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Cancel
          </button>
        </div>
      ) : (
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <p style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>Auto Matchmaking</p>
            <p style={{ color: '#64748b', fontSize: '0.78rem' }}>Get paired with opponents automatically — no room code needed</p>
          </div>
          <button onClick={findMatch} disabled={!isConnected}
            style={{ background: isConnected ? 'linear-gradient(135deg,#7c3aed,#06b6d4)' : '#1e1e30', border: 'none', borderRadius: '9px', padding: '10px 22px', color: isConnected ? '#fff' : '#475569', fontWeight: 700, fontFamily: 'Orbitron, sans-serif', fontSize: '0.82rem', cursor: isConnected ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
            Find Match ${selectedFee}
          </button>
        </div>
      )}

      {/* Browse */}
      {tab === 'browse' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={quickMatch}
            style={{ background: 'linear-gradient(135deg, #22c55e, #06b6d4)', border: 'none', borderRadius: '10px', padding: '12px', color: '#0a0a0f', fontWeight: 800, fontSize: '0.92rem', fontFamily: 'Orbitron, sans-serif', cursor: 'pointer', letterSpacing: '0.04em' }}>
            Quick Match — Auto-join best open room
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
                  <p style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '2px' }}>Host: {getUsername(room.host)}</p>
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
