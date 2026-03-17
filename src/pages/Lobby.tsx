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

type Room = {
  code: string; host: string; hostName: string; players: number; max: number;
  entry: number; status: 'waiting' | 'full';
  roomType: 'public' | 'duel' | 'private';
  duelExpiry: number | null;
}

function DuelCountdown({ expiry }: { expiry: number }) {
  const [remaining, setRemaining] = useState(Math.max(0, expiry - Date.now()))
  useEffect(() => {
    const t = setInterval(() => setRemaining(Math.max(0, expiry - Date.now())), 1000)
    return () => clearInterval(t)
  }, [expiry])
  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  return <span style={{ color: '#f97316', fontSize: '0.75rem', fontWeight: 700 }}>{mins}:{String(secs).padStart(2, '0')} left</span>
}

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

  const [rooms, setRooms]                   = useState<Room[]>([])
  const [selectedFee, setSelectedFee]       = useState<number>(1)
  const [maxPlayers, setMaxPlayers]         = useState<number>(5)
  const [joinCode, setJoinCode]             = useState('')
  const [loading, setLoading]               = useState(true)
  const [creating, setCreating]             = useState(false)
  const [joining, setJoining]               = useState<string | null>(null)
  const [error, setError]                   = useState('')
  const [payStep, setPayStep]               = useState<'idle' | 'switching' | 'approving' | 'paying' | 'creating'>('idle')
  const [activeRoom, setActiveRoom]         = useState(() => localStorage.getItem(ACTIVE_ROOM_KEY) || '')
  const [selectedChain, setSelectedChain]   = useState<SupportedChain>(SUPPORTED_CHAINS[0])
  const [lockedInRoom, setLockedInRoom]     = useState<string | null>(null)
  const [searching, setSearching]           = useState(false)
  const [queueSize, setQueueSize]           = useState(0)
  const [activityFeed, setActivityFeed]     = useState<{ msg: string; ts: number }[]>([])
  const [globalChat, setGlobalChat]         = useState<{ username: string; message: string; ts: number }[]>([])
  const [chatInput, setChatInput]           = useState('')
  const [panelTab, setPanelTab]             = useState<'activity' | 'chat'>('activity')
  const [showCreateDuel, setShowCreateDuel] = useState(false)
  const [duelShareCode, setDuelShareCode]   = useState('')
  // Layout state
  const [isDesktop, setIsDesktop]           = useState(false)
  const [panelOpen, setPanelOpen]           = useState(true)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [onlineCount, setOnlineCount]       = useState(0)
  const [unreadChat, setUnreadChat]         = useState(0)

  const chatEndRef  = useRef<HTMLDivElement>(null)
  const errorTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const meta = GAME_META[gameMode ?? ''] ?? { title: gameMode ?? 'Game', emoji: '🎮', desc: '', minPlayers: 2, maxPlayers: 10 }
  const myName = address ? getUsername(address) : ''

  // Responsive: track desktop breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1100px)')
    setIsDesktop(mq.matches)
    setPanelOpen(mq.matches) // open by default only on desktop
    const handler = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches)
      if (e.matches) setPanelOpen(true)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Track unread chat when panel/drawer is closed or on activity tab
  useEffect(() => {
    const isVisible = (isDesktop && panelOpen && panelTab === 'chat') || (!isDesktop && mobileDrawerOpen && panelTab === 'chat')
    if (!isVisible) {
      setUnreadChat(prev => prev + 1)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalChat.length])

  // Clear unread when chat becomes visible
  useEffect(() => {
    const isVisible = (isDesktop && panelOpen && panelTab === 'chat') || (!isDesktop && mobileDrawerOpen && panelTab === 'chat')
    if (isVisible) setUnreadChat(0)
  }, [panelTab, panelOpen, mobileDrawerOpen, isDesktop])

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

  useEffect(() => {
    const chain = getChain(currentChainId)
    if (chain) setSelectedChain(chain)
  }, [currentChainId])

  useEffect(() => { authSigRef.current = null }, [address])

  useEffect(() => {
    const state = location.state as { autoJoin?: string; autoFee?: number; autoChainId?: number } | null
    if (!state?.autoJoin || !address || joining || creating) return
    const chain = getChain(state.autoChainId ?? 137) ?? selectedChain
    setSelectedChain(chain)
    if (state.autoFee) setSelectedFee(state.autoFee)
    window.history.replaceState({}, '')
    handleJoinRoom(state.autoJoin)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, address])

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
        if (!room) { localStorage.removeItem(ACTIVE_ROOM_KEY); setActiveRoom('') }
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
      setSearching(false); setQueueSize(0)
      addToRoomHistory(code, chainId)
      navigate(`/lobby/${gameMode}`, { state: { autoJoin: code, autoFee: entryFee, autoChainId: chainId }, replace: true })
    })
    socket.on('matchmaking:timeout', ({ reason }: { reason: string }) => {
      setSearching(false); setQueueSize(0); showError(reason)
    })
    socket.on('room:timeout', () => {
      setLockedInRoom(null); setJoining(null); setCreating(false); setPayStep('idle')
      showError('Room timed out — no second player joined in time. Your deposit will be refunded. Check Profile → Stuck Deposits.')
    })
    socket.on('activity:update', setActivityFeed)
    socket.on('chat:message', (msg: { username: string; message: string; ts: number }) => {
      setGlobalChat(prev => [...prev, msg].slice(-50))
    })
    socket.on('online:count', (n: number) => setOnlineCount(n))
    socket.emit('activity:get', setActivityFeed)
    socket.emit('chat:history', (history: { username: string; message: string; ts: number }[]) => setGlobalChat(history))

    const interval = setInterval(loadRooms, 5000)
    return () => {
      socket.off('room:update'); socket.off('matchmaking:queue_update')
      socket.off('matchmaking:matched'); socket.off('matchmaking:timeout')
      socket.off('room:timeout'); socket.off('activity:update')
      socket.off('chat:message'); socket.off('online:count')
      clearInterval(interval)
      if (errorTimer.current) clearTimeout(errorTimer.current)
    }
  }, [gameMode])

  // Auto-scroll chat
  useEffect(() => {
    if (panelTab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [globalChat, panelTab])

  async function payEntryFee(fee: number, chain: SupportedChain, roomCode: string): Promise<string | null> {
    if (currentChainId !== chain.id) {
      setPayStep('switching')
      try { await switchChainAsync({ chainId: chain.id }) }
      catch { showError(`Please switch to ${chain.name} in your wallet`); return null }
    }
    const escrowAddr = getEscrowAddress(chain.id)
    const amount = parseUnits(String(fee), chain.decimals)
    if (escrowAddr) {
      setPayStep('approving')
      try {
        let needsApprove = true
        if (publicClient && address) {
          try {
            const allowance = await publicClient.readContract({
              address: chain.usdt,
              abi: [{ name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] }],
              functionName: 'allowance', args: [address, escrowAddr],
            }) as bigint
            if (allowance >= amount) needsApprove = false
          } catch { /* ignore */ }
        }
        if (needsApprove) {
          await writeContractAsync({ address: chain.usdt, abi: USDT_APPROVE_ABI, functionName: 'approve', args: [escrowAddr, amount], chainId: chain.id })
        }
      } catch { showError('Approval rejected. You must approve USDT to lock into the game contract.'); return null }
      setPayStep('paying')
      try {
        const roomId = getRoomId(roomCode)
        return await writeContractAsync({ address: escrowAddr, abi: ESCROW_ABI, functionName: 'deposit', args: [roomId, amount], chainId: chain.id })
      } catch { showError('Deposit failed. Your USDT was not locked — please try again.'); return null }
    } else {
      if (!HOUSE_WALLET) { showError('Payments are not configured for this network yet.'); return null }
      setPayStep('paying')
      try {
        return await writeContractAsync({ address: chain.usdt, abi: USDT_ABI, functionName: 'transfer', args: [HOUSE_WALLET as `0x${string}`, amount], chainId: chain.id })
      } catch { showError('Payment rejected. Entry fee is required to play.'); return null }
    }
  }

  async function findMatch() {
    if (!isConnected || !address) { showError('Connect your wallet first'); return }
    if (lockedInRoom) { showError(`You have funds locked in room ${lockedInRoom}. Claim a refund from your Profile first.`); return }
    const authSig = await getAuthSig()
    if (!authSig) return
    setSearching(true); setQueueSize(0)
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
    connectSocket().emit('matchmaking:leave', {}, () => {})
  }

  async function payAndCreate() {
    if (!isConnected || !address) { showError('Connect your wallet first'); return }
    if (lockedInRoom) { showError(`You have funds locked in room ${lockedInRoom}. Finish that game or claim a refund from your Profile first.`); return }
    setCreating(true); setError('')
    const authSig = await getAuthSig()
    if (!authSig) { setCreating(false); return }
    setPayStep('creating')
    const socket = connectSocket()
    const code = await new Promise<string | null>(resolve => {
      socket.emit('room:create',
        { gameMode, entryFee: selectedFee, maxPlayers, address, chainId: selectedChain.id, authSig, roomType: 'public' },
        (res: { code?: string; error?: string }) => { if (res.error) { showError(res.error); resolve(null) } else resolve(res.code!) }
      )
    })
    if (!code) { setCreating(false); setPayStep('idle'); return }
    const txHash = await payEntryFee(selectedFee, selectedChain, code)
    if (!txHash) { setCreating(false); setPayStep('idle'); return }
    socket.emit('room:deposit', { code, txHash, address }, () => {})
    fetch(`${SERVER_URL}/api/report-deposit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, room_code: code, tx_hash: txHash, chain_id: selectedChain.id, amount_usdt: selectedFee }) }).catch(() => {})
    setCreating(false); setPayStep('idle')
    localStorage.setItem(ACTIVE_ROOM_KEY, code); setActiveRoom(code)
    addToRoomHistory(code, selectedChain.id)
    navigate(`/game/${code}`, { state: { host: true, entry: selectedFee, maxPlayers, gameMode, chainId: selectedChain.id } })
  }

  async function payAndCreateDuel() {
    if (!isConnected || !address) { showError('Connect your wallet first'); return }
    if (lockedInRoom) { showError(`You have funds locked in room ${lockedInRoom}. Finish that game or claim a refund from your Profile first.`); return }
    setCreating(true); setError('')
    const authSig = await getAuthSig()
    if (!authSig) { setCreating(false); return }
    setPayStep('creating')
    const socket = connectSocket()
    const code = await new Promise<string | null>(resolve => {
      socket.emit('room:create',
        { gameMode, entryFee: selectedFee, maxPlayers: 2, address, chainId: selectedChain.id, authSig, roomType: 'duel' },
        (res: { code?: string; error?: string }) => { if (res.error) { showError(res.error); resolve(null) } else resolve(res.code!) }
      )
    })
    if (!code) { setCreating(false); setPayStep('idle'); return }
    const txHash = await payEntryFee(selectedFee, selectedChain, code)
    if (!txHash) { setCreating(false); setPayStep('idle'); return }
    socket.emit('room:deposit', { code, txHash, address }, () => {})
    fetch(`${SERVER_URL}/api/report-deposit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, room_code: code, tx_hash: txHash, chain_id: selectedChain.id, amount_usdt: selectedFee }) }).catch(() => {})
    setCreating(false); setPayStep('idle')
    localStorage.setItem(ACTIVE_ROOM_KEY, code); setActiveRoom(code)
    addToRoomHistory(code, selectedChain.id)
    setDuelShareCode(code); setShowCreateDuel(false)
  }

  async function handleJoinRoom(code: string) {
    if (!isConnected || !address) { showError('Connect your wallet first'); return }
    if (lockedInRoom && lockedInRoom !== code) { showError(`You have funds locked in room ${lockedInRoom}. Finish that game or claim a refund from your Profile first.`); return }
    const room = rooms.find(r => r.code === code)
    const fee = room?.entry ?? selectedFee
    setJoining(code); setError('')
    const authSig = await getAuthSig()
    if (!authSig) { setJoining(null); return }
    const txHash = await payEntryFee(fee, selectedChain, code)
    if (!txHash) { setJoining(null); setPayStep('idle'); return }
    const socket = connectSocket()
    socket.emit('room:join', { code, address, chainId: selectedChain.id, txHash, authSig },
      (res: { ok?: boolean; error?: string; reconnected?: boolean }) => {
        setJoining(null); setPayStep('idle')
        if (res.error) { showError(res.error); return }
        socket.emit('room:deposit', { code, txHash, address }, () => {})
        fetch(`${SERVER_URL}/api/report-deposit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, room_code: code, tx_hash: txHash, chain_id: selectedChain.id, amount_usdt: fee }) }).catch(() => {})
        localStorage.setItem(ACTIVE_ROOM_KEY, code); setActiveRoom(code)
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

  function clearActiveRoom() { localStorage.removeItem(ACTIVE_ROOM_KEY); setActiveRoom('') }

  function sendChat() {
    const msg = chatInput.trim()
    if (!msg || !myName) return
    connectSocket().emit('global:chat:send', { username: myName, message: msg })
    setChatInput('')
  }

  function copyToClipboard(text: string) { navigator.clipboard.writeText(text).catch(() => {}) }

  const escrowAvailable = !!getEscrowAddress(selectedChain.id)
  const createBtnLabel = () => {
    if (payStep === 'switching') return `Switching to ${selectedChain.name}…`
    if (payStep === 'creating')  return 'Creating room…'
    if (payStep === 'approving') return 'Step 1/2 — Approve USDT…'
    if (payStep === 'paying')    return escrowAvailable ? 'Step 2/2 — Locking…' : `Sending $${selectedFee} USDT…`
    return escrowAvailable ? `🔒 Lock & Create` : `Pay & Create`
  }

  const openRooms = rooms.filter(r => !r.roomType || r.roomType === 'public')
  const duelRooms = rooms.filter(r => r.roomType === 'duel')

  // ── Side panel content (shared between desktop left panel and mobile drawer) ──
  const SidePanel = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e1e30', flexShrink: 0 }}>
        <button onClick={() => setPanelTab('activity')}
          style={{ flex: 1, padding: '10px 8px', background: 'transparent', border: 'none', borderBottom: panelTab === 'activity' ? '2px solid #7c3aed' : '2px solid transparent', color: panelTab === 'activity' ? '#a78bfa' : '#64748b', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
          Live Activity
        </button>
        <button onClick={() => { setPanelTab('chat'); setUnreadChat(0) }}
          style={{ flex: 1, padding: '10px 8px', background: 'transparent', border: 'none', borderBottom: panelTab === 'chat' ? '2px solid #06b6d4' : '2px solid transparent', color: panelTab === 'chat' ? '#06b6d4' : '#64748b', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', position: 'relative' }}>
          Global Chat
          {unreadChat > 0 && panelTab !== 'chat' && (
            <span style={{ position: 'absolute', top: '6px', right: '10px', background: '#7c3aed', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '0.65rem', fontWeight: 700 }}>
              {unreadChat > 9 ? '9+' : unreadChat}
            </span>
          )}
        </button>
      </div>

      {/* Activity */}
      {panelTab === 'activity' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
          {activityFeed.length === 0
            ? <p style={{ color: '#475569', fontSize: '0.78rem', textAlign: 'center', padding: '24px 0' }}>No recent activity</p>
            : activityFeed.map((item, i) => (
              <p key={i} style={{ color: '#94a3b8', fontSize: '0.77rem', padding: '5px 0', borderBottom: i < activityFeed.length - 1 ? '1px solid #0d0d18' : 'none', lineHeight: 1.4 }}>
                {item.msg}
              </p>
            ))}
        </div>
      )}

      {/* Chat */}
      {panelTab === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
            {globalChat.length === 0
              ? <p style={{ color: '#475569', fontSize: '0.78rem', textAlign: 'center', padding: '20px 0' }}>No messages yet — say hi!</p>
              : globalChat.map((m, i) => (
                <p key={i} style={{ color: '#94a3b8', fontSize: '0.77rem', padding: '3px 0', lineHeight: 1.4 }}>
                  <strong style={{ color: '#a78bfa' }}>{m.username}:</strong> {m.message}
                </p>
              ))}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: '8px 10px', borderTop: '1px solid #1e1e30', display: 'flex', gap: '6px', flexShrink: 0 }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder={myName ? 'Say something…' : 'Connect wallet to chat'}
              disabled={!myName} maxLength={200}
              style={{ flex: 1, background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: '7px', padding: '8px 10px', color: '#e2e8f0', fontSize: '0.8rem', outline: 'none' }}
            />
            <button onClick={sendChat} disabled={!myName || !chatInput.trim()}
              style={{ background: myName && chatInput.trim() ? 'linear-gradient(135deg,#7c3aed,#06b6d4)' : '#1e1e30', border: 'none', borderRadius: '7px', padding: '8px 12px', color: myName && chatInput.trim() ? '#fff' : '#475569', fontWeight: 700, fontSize: '0.78rem', cursor: myName && chatInput.trim() ? 'pointer' : 'not-allowed' }}>
              ↑
            </button>
          </div>
        </div>
      )}
    </div>
  )

  // ── Main lobby content ────────────────────────────────────────────────────
  const LobbyContent = () => (
    <div style={{ padding: isDesktop ? '32px 28px 40px' : 'clamp(20px,4vw,32px) clamp(14px,3vw,20px)', paddingBottom: !isDesktop ? '72px' : undefined }}>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <button style={{ color: '#64748b', fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '10px' }} onClick={() => navigate('/')}>
          ← Back
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(1.3rem,4vw,1.8rem)', fontWeight: 900, background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '4px' }}>
              {meta.emoji} {meta.title}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>{meta.desc}</p>
            {myName && <p style={{ color: '#a78bfa', fontSize: '0.78rem', marginTop: '3px' }}>Playing as <strong>{myName}</strong></p>}
          </div>
          {address && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: '2px' }}>Your balance</p>
              <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: Number(balanceFormatted) >= selectedFee ? '#22c55e' : '#f59e0b' }}>
                ${balanceFormatted} <span style={{ fontSize: '0.62rem', color: '#64748b' }}>USDT</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Active room banner */}
      {activeRoom && (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '10px', padding: '12px 18px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ color: '#22c55e', fontSize: '0.88rem', fontWeight: 600 }}>Active room: <strong style={{ fontFamily: 'Orbitron, sans-serif' }}>{activeRoom}</strong></span>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button onClick={() => navigate(`/game/${activeRoom}`)} style={{ background: '#22c55e', border: 'none', borderRadius: '7px', padding: '6px 14px', color: '#0a0a0f', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>Rejoin →</button>
            <button onClick={clearActiveRoom} style={{ background: 'none', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '7px', padding: '6px 10px', color: '#64748b', fontSize: '0.82rem', cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 18px', marginBottom: '14px', color: '#ef4444', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', flexShrink: 0 }} onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Chain selector */}
      <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', padding: '14px 18px', marginBottom: '16px' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', marginBottom: '8px' }}>PAY WITH USDT ON</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {SUPPORTED_CHAINS.map(chain => (
            <button key={chain.id} onClick={() => setSelectedChain(chain)}
              style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', background: selectedChain.id === chain.id ? `${chain.color}22` : 'transparent', border: `1px solid ${selectedChain.id === chain.id ? chain.color : '#1e1e30'}`, color: selectedChain.id === chain.id ? chain.color : '#64748b' }}>
              {chain.icon} {chain.shortName}
            </button>
          ))}
        </div>
        {selectedChain.id === 1 && <p style={{ color: '#f59e0b', fontSize: '0.75rem', marginTop: '8px' }}>⚠️ Ethereum has high gas fees. Consider Polygon, Arbitrum, or Base for cheap transfers.</p>}
      </div>

      {/* Entry fee */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', marginBottom: '8px' }}>ENTRY FEE</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {ENTRY_FEES.map(fee => (
            <button key={fee} onClick={() => setSelectedFee(fee)}
              style={{ padding: '8px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', border: `1px solid ${selectedFee === fee ? '#7c3aed' : '#1e1e30'}`, background: selectedFee === fee ? 'rgba(124,58,237,0.18)' : 'transparent', color: selectedFee === fee ? '#a78bfa' : '#64748b' }}>
              ${fee}
            </button>
          ))}
        </div>
      </div>

      {/* Max players */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', marginBottom: '8px' }}>MAX PLAYERS ({maxPlayers})</p>
        <input type="range" min={meta.minPlayers} max={meta.maxPlayers} value={maxPlayers}
          onChange={e => setMaxPlayers(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#7c3aed' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>
          <span>{meta.minPlayers}</span><span>{meta.maxPlayers}</span>
        </div>
      </div>

      {/* PLAY NOW */}
      {searching ? (
        <div style={{ background: '#12121a', border: '1px solid rgba(124,58,237,0.4)', borderRadius: '14px', padding: '16px 20px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <p style={{ color: '#a78bfa', fontWeight: 700, fontFamily: 'Orbitron, sans-serif', fontSize: '0.88rem', marginBottom: '3px' }}>Finding opponents… {queueSize > 0 && `(${queueSize} in queue)`}</p>
            <p style={{ color: '#64748b', fontSize: '0.78rem' }}>Entry ${selectedFee} · {selectedChain.name}</p>
          </div>
          <button onClick={cancelMatch} style={{ background: 'none', border: '1px solid #475569', borderRadius: '8px', padding: '8px 16px', color: '#94a3b8', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>Cancel</button>
        </div>
      ) : (
        <button onClick={findMatch} disabled={!isConnected}
          style={{ width: '100%', background: isConnected ? 'linear-gradient(135deg, #22c55e, #06b6d4)' : '#1e1e30', border: 'none', borderRadius: '12px', padding: '14px', color: isConnected ? '#0a0a0f' : '#475569', fontWeight: 800, fontSize: '1rem', fontFamily: 'Orbitron, sans-serif', cursor: isConnected ? 'pointer' : 'not-allowed', letterSpacing: '0.04em', marginBottom: '12px' }}>
          🎮 PLAY NOW — ${selectedFee} MATCH
        </button>
      )}

      {/* CREATE ROOM + CREATE DUEL */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button onClick={payAndCreate} disabled={creating || !isConnected}
          style={{ flex: 1, background: creating ? '#1e1e30' : 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: '10px', padding: '11px', color: creating ? '#475569' : '#a78bfa', fontWeight: 700, fontSize: '0.88rem', cursor: creating ? 'not-allowed' : 'pointer' }}>
          {creating ? createBtnLabel() : '➕ CREATE ROOM'}
        </button>
        <button onClick={() => setShowCreateDuel(!showCreateDuel)} disabled={!isConnected}
          style={{ flex: 1, background: showCreateDuel ? 'rgba(249,115,22,0.18)' : 'rgba(249,115,22,0.08)', border: `1px solid ${showCreateDuel ? 'rgba(249,115,22,0.6)' : 'rgba(249,115,22,0.3)'}`, borderRadius: '10px', padding: '11px', color: '#f97316', fontWeight: 700, fontSize: '0.88rem', cursor: isConnected ? 'pointer' : 'not-allowed' }}>
          ⚔️ CREATE DUEL
        </button>
      </div>

      {/* Create duel panel */}
      {showCreateDuel && (
        <div style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
          <p style={{ color: '#f97316', fontWeight: 700, fontSize: '0.88rem', marginBottom: '6px' }}>⚔️ 1v1 Duel Challenge</p>
          <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '12px' }}>Creates a 1v1 room with a shareable link. Challenger pays ${selectedFee} to enter. Winner takes ${(selectedFee * 2 * 0.85).toFixed(2)}.</p>
          <button onClick={payAndCreateDuel} disabled={creating}
            style={{ width: '100%', background: creating ? '#1e1e30' : 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: '10px', padding: '13px', color: creating ? '#64748b' : '#fff', fontWeight: 800, fontSize: '0.92rem', fontFamily: 'Orbitron, sans-serif', cursor: creating ? 'not-allowed' : 'pointer', letterSpacing: '0.04em' }}>
            {creating ? createBtnLabel() : `Pay $${selectedFee} & Generate Duel Link`}
          </button>
        </div>
      )}

      {/* Duel share card */}
      {duelShareCode && (
        <div style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.4)', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
          <p style={{ color: '#f97316', fontWeight: 800, fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', marginBottom: '6px' }}>⚔️ ${(selectedFee * 2).toFixed(0)} POT DUEL CREATED!</p>
          <p style={{ color: '#e2e8f0', fontSize: '0.82rem', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.05em', marginBottom: '12px' }}>joinarena.space/r/{duelShareCode}</p>
          <textarea readOnly
            value={`⚔️ $${(selectedFee * 2).toFixed(0)} POT DUEL\n\n${meta.title}\nWinner takes $${(selectedFee * 2 * 0.85).toFixed(2)}\n\nThink you're faster?\n\njoinarena.space/r/${duelShareCode}`}
            style={{ width: '100%', background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: '8px', padding: '10px', color: '#94a3b8', fontSize: '0.8rem', resize: 'none', height: '110px', marginBottom: '10px', boxSizing: 'border-box', lineHeight: 1.5 }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => copyToClipboard(`⚔️ $${(selectedFee * 2).toFixed(0)} POT DUEL\n\n${meta.title}\nWinner takes $${(selectedFee * 2 * 0.85).toFixed(2)}\n\nThink you're faster?\n\njoinarena.space/r/${duelShareCode}`)}
              style={{ flex: 1, background: 'rgba(249,115,22,0.18)', border: '1px solid rgba(249,115,22,0.4)', borderRadius: '8px', padding: '10px', color: '#f97316', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
              📋 Copy Challenge
            </button>
            <button onClick={() => navigate(`/game/${duelShareCode}`)}
              style={{ flex: 1, background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: '8px', padding: '10px', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
              Go to Room →
            </button>
          </div>
        </div>
      )}

      {/* Room code join */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
          placeholder="ROOM CODE" maxLength={6}
          style={{ flex: 1, background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: '8px', padding: '10px 14px', color: '#e2e8f0', fontFamily: 'Orbitron, sans-serif', fontSize: '0.92rem', letterSpacing: '0.15em', outline: 'none' }}
        />
        <button onClick={handleJoinByCode}
          style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '8px', padding: '10px 20px', color: '#fff', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.88rem' }}>
          Join
        </button>
      </div>

      {/* Open Matches */}
      <section style={{ marginBottom: '20px' }}>
        <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.06em', marginBottom: '10px' }}>🔥 OPEN MATCHES</h3>
        {loading ? (
          <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '12px', textAlign: 'center', color: '#64748b', padding: '36px', fontSize: '0.85rem' }}>Loading rooms…</div>
        ) : openRooms.length === 0 ? (
          <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '12px', textAlign: 'center', color: '#64748b', padding: '28px', fontSize: '0.85rem' }}>No open matches — be the first to create one!</div>
        ) : openRooms.map(room => (
          <div key={room.code} style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '8px', opacity: room.status === 'full' ? 0.5 : 1 }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.1em' }}>{room.code}</p>
                <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>Host: {room.hostName || getUsername(room.host)}</p>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.83rem' }}>👥 {room.players}/{room.max}</p>
              <div>
                <p style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.88rem' }}>${room.entry} USDT</p>
                <p style={{ color: '#64748b', fontSize: '0.72rem' }}>Pot ~${(room.entry * room.players * 0.85).toFixed(2)}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: room.status === 'waiting' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: room.status === 'waiting' ? '#22c55e' : '#ef4444', border: `1px solid ${room.status === 'waiting' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                {room.status === 'waiting' ? '● OPEN' : '■ FULL'}
              </span>
              <button disabled={room.status === 'full' || joining === room.code} onClick={() => handleJoinRoom(room.code)}
                style={{ background: room.status === 'full' ? '#1e1e30' : 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '8px', padding: '8px 18px', color: room.status === 'full' ? '#64748b' : '#fff', fontWeight: 700, cursor: room.status === 'full' ? 'not-allowed' : 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                {joining === room.code ? (payStep === 'approving' ? 'Approving…' : payStep === 'paying' ? 'Locking…' : `${selectedChain.icon} Paying…`) : `Join ${selectedChain.icon}`}
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Duel Challenges */}
      <section style={{ marginBottom: '20px' }}>
        <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.82rem', fontWeight: 700, color: '#f97316', letterSpacing: '0.06em', marginBottom: '10px' }}>⚔️ DUEL CHALLENGES</h3>
        {duelRooms.length === 0 ? (
          <div style={{ background: '#12121a', border: '1px solid rgba(249,115,22,0.15)', borderRadius: '12px', textAlign: 'center', color: '#64748b', padding: '20px', fontSize: '0.83rem' }}>No active duels — create one above and challenge a friend!</div>
        ) : duelRooms.map(room => (
          <div key={room.code} style={{ background: '#12121a', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.1em', color: '#f97316' }}>{room.code}</p>
                <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>By: {room.hostName || getUsername(room.host)}</p>
              </div>
              <div>
                <p style={{ color: '#f97316', fontWeight: 700, fontSize: '0.88rem' }}>${room.entry} USDT</p>
                <p style={{ color: '#64748b', fontSize: '0.72rem' }}>Winner takes ${(room.entry * 2 * 0.85).toFixed(2)}</p>
              </div>
              {room.duelExpiry && <DuelCountdown expiry={room.duelExpiry} />}
            </div>
            <button disabled={joining === room.code} onClick={() => handleJoinRoom(room.code)}
              style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: '8px', padding: '8px 18px', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap', fontFamily: 'Orbitron, sans-serif' }}>
              {joining === room.code ? (payStep === 'approving' ? 'Approving…' : payStep === 'paying' ? 'Locking…' : 'Paying…') : 'Accept ⚔️'}
            </button>
          </div>
        ))}
      </section>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Mobile drawer backdrop */}
      {!isDesktop && mobileDrawerOpen && (
        <div onClick={() => setMobileDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100 }} />
      )}

      {/* Mobile bottom drawer */}
      {!isDesktop && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: mobileDrawerOpen ? 'min(60vh, 480px)' : '44px',
          background: '#12121a', borderTop: '1px solid #1e1e30',
          borderRadius: mobileDrawerOpen ? '16px 16px 0 0' : '0',
          zIndex: 101, transition: 'height 0.3s cubic-bezier(0.4,0,0.2,1)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Handle bar */}
          <div onClick={() => { setMobileDrawerOpen(!mobileDrawerOpen); if (!mobileDrawerOpen) setUnreadChat(0) }}
            style={{ padding: '0 16px', height: '44px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flexShrink: 0, borderBottom: mobileDrawerOpen ? '1px solid #1e1e30' : 'none' }}>
            <div style={{ width: '36px', height: '4px', background: '#2d2d44', borderRadius: '2px', flexShrink: 0 }} />
            <span style={{ color: '#22c55e', fontSize: '0.78rem', fontWeight: 700 }}>🟢 {onlineCount} online</span>
            {unreadChat > 0 && !mobileDrawerOpen && (
              <span style={{ background: '#7c3aed', color: '#fff', borderRadius: '10px', padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700 }}>
                💬 {unreadChat} new
              </span>
            )}
            <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: '0.75rem' }}>{mobileDrawerOpen ? '▼' : '▲'}</span>
          </div>
          {mobileDrawerOpen && (
            <div style={{ flex: 1, minHeight: 0 }}>
              <SidePanel />
            </div>
          )}
        </div>
      )}

      {/* Desktop 3-column layout */}
      {isDesktop ? (
        <div style={{ display: 'grid', gridTemplateColumns: `280px minmax(0, 720px) 1fr`, maxWidth: '1400px', margin: '0 auto', alignItems: 'start', gap: '0' }}>

          {/* Left panel */}
          <div style={{ position: 'sticky', top: '72px', height: 'calc(100vh - 88px)', overflow: 'hidden', paddingTop: '24px', paddingRight: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {panelOpen ? (
              <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Panel header */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid #1e1e30', flexShrink: 0 }}>
                  <span style={{ color: '#22c55e', fontSize: '0.78rem', fontWeight: 700 }}>🟢 {onlineCount} online</span>
                  <button onClick={() => setPanelOpen(false)}
                    style={{ marginLeft: 'auto', background: 'none', border: '1px solid #1e1e30', borderRadius: '6px', padding: '3px 8px', color: '#475569', fontSize: '0.75rem', cursor: 'pointer' }}>
                    ◀
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <SidePanel />
                </div>
              </div>
            ) : (
              /* Collapsed chicklet */
              <div onClick={() => setPanelOpen(true)}
                style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '12px', width: '44px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: '10px' }}>
                <span style={{ fontSize: '0.75rem' }}>🟢</span>
                <span style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 700 }}>{onlineCount}</span>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>💬</span>
                {unreadChat > 0 && (
                  <span style={{ background: '#7c3aed', color: '#fff', borderRadius: '10px', padding: '1px 5px', fontSize: '0.62rem', fontWeight: 700, minWidth: '18px', textAlign: 'center' }}>
                    {unreadChat > 9 ? '9+' : unreadChat}
                  </span>
                )}
                <span style={{ color: '#475569', fontSize: '0.7rem', marginTop: '4px' }}>▶</span>
              </div>
            )}
          </div>

          {/* Center: lobby content */}
          <div style={{ minWidth: 0 }}>
            <LobbyContent />
          </div>

          {/* Right: empty spacer */}
          <div />
        </div>
      ) : (
        /* Mobile: single column */
        <div>
          <LobbyContent />
        </div>
      )}
    </>
  )
}
