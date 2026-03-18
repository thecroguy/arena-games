import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAccount, useWriteContract, useChainId, useSwitchChain, useReadContract, useSignMessage, usePublicClient } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { connectSocket } from '../utils/socket'
import { getUsername } from '../utils/profile'
import { SUPPORTED_CHAINS, USDT_ABI, getChain, type SupportedChain } from '../utils/chains'
import { getEscrowAddress, getRoomId, ESCROW_ABI, USDT_APPROVE_ABI } from '../utils/escrow'

const HOUSE_WALLET = import.meta.env.VITE_HOUSE_WALLET as `0x${string}` | undefined
const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

const GAME_META: Record<string, { title: string; emoji: string; desc: string; minPlayers: number; maxPlayers: number }> = {
  'math-arena':     { title: 'Math Arena',      emoji: '✚',  desc: 'Speed math quiz — first correct answer scores. 100% skill, zero luck.',           minPlayers: 2, maxPlayers: 10 },
  'pattern-memory': { title: 'Pattern Memory',    emoji: '🧠', desc: 'A grid of tiles flashes briefly — memorize which lit up, then tap them all. First correct scores.', minPlayers: 2, maxPlayers: 10 },
  'reaction-grid':  { title: 'Reaction Grid',   emoji: '⊞',  desc: 'A cell lights up — click it before anyone else. Pure reaction speed.',             minPlayers: 2, maxPlayers: 10 },
  'highest-unique': { title: 'Highest Unique',  emoji: '↑',  desc: 'Pick the highest number nobody else picks. Read the crowd and outsmart them.',      minPlayers: 3, maxPlayers: 20 },
  'lowest-unique':  { title: 'Lowest Unique',   emoji: '↓',  desc: 'Pick the lowest number nobody else picks. Contrarian thinking wins.',               minPlayers: 3, maxPlayers: 20 },
  'liars-dice':     { title: "Liar's Dice",      emoji: '🎲',  desc: 'Each player gets 3 dice. Bid on the total — bluff or call LIAR! to win.',          minPlayers: 2, maxPlayers: 6  },
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
  const [activeRoom, setActiveRoom]         = useState('')
  const [selectedChain, setSelectedChain]   = useState<SupportedChain>(SUPPORTED_CHAINS[0])
  const [lockedInRoom, setLockedInRoom]     = useState<string | null>(null)
  const [searching, setSearching]           = useState(false)
  const [queueSize, setQueueSize]           = useState(0)
  const [activityFeed, setActivityFeed]     = useState<{ msg: string; ts: number }[]>([])
  const [globalChat, setGlobalChat]         = useState<{ username: string; message: string; ts: number }[]>([])
  const [chatInput, setChatInput]           = useState('')
  const [panelTab, setPanelTab]             = useState<'activity' | 'chat'>('activity')
  const [activeCreateMode, setActiveCreateMode] = useState<'room' | 'duel' | null>(null)
  // Layout state
  const [isDesktop, setIsDesktop]           = useState(() => window.innerWidth >= 1100)
  const [panelOpen, setPanelOpen]           = useState(() => window.innerWidth >= 1100)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [onlineCount, setOnlineCount]       = useState(0)
  const [unreadChat, setUnreadChat]         = useState(0)

  // Online count comes from server (already includes fake offset server-side)
  const displayOnlineCount = onlineCount

  const chatEndRef     = useRef<HTMLDivElement>(null)
  const activityEndRef = useRef<HTMLDivElement>(null)
  const errorTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const meta = GAME_META[gameMode ?? ''] ?? { title: gameMode ?? 'Game', emoji: '🎮', desc: '', minPlayers: 2, maxPlayers: 10 }
  const myName = address ? getUsername(address) : ''

  // Responsive: track desktop breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1100px)')
    const handler = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches)
      setPanelOpen(e.matches)
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
    setSelectedChain(chain)  // for UI only — handleJoinRoom gets chainOverride directly
    window.history.replaceState({}, '')
    handleJoinRoom(state.autoJoin, state.autoFee, chain)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, address])

  useEffect(() => {
    if (!address) return
    fetch(`${SERVER_URL}/api/active-deposit/${address}`)
      .then(r => r.json())
      .then(data => { if (data.hasActive) setLockedInRoom(data.roomCode) })
      .catch(() => {})
  }, [address])

  useEffect(() => {
    if (!address) { setActiveRoom(''); return }
    fetch(`${SERVER_URL}/api/active-room/${address}`)
      .then(r => r.json())
      .then(data => { setActiveRoom(data.code || '') })
      .catch(() => {})

    // Recover pending deposit that survived a MetaMask mobile redirect
    try {
      const pending = JSON.parse(localStorage.getItem('ag_pending_deposit') || 'null')
      if (pending && pending.address?.toLowerCase() === address.toLowerCase() && Date.now() - pending.ts < 30 * 60 * 1000) {
        fetch(`${SERVER_URL}/api/report-deposit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, room_code: pending.code, chain_id: pending.chainId, amount_usdt: pending.fee }),
        }).then(() => localStorage.removeItem('ag_pending_deposit')).catch(() => {})
      } else if (pending) {
        localStorage.removeItem('ag_pending_deposit')
      }
    } catch { localStorage.removeItem('ag_pending_deposit') }
  }, [address])

  async function getAuthSig(): Promise<string | null> {
    if (authSigRef.current) return authSigRef.current
    const addr = address?.toLowerCase()
    if (!addr) return null
    const cacheKey = `ag_authsig_${addr}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) { authSigRef.current = cached; return cached }
    try {
      const sig = await signMessageAsync({ message: `Arena Games: ${addr}` })
      authSigRef.current = sig
      localStorage.setItem(cacheKey, sig)
      return sig
    } catch {
      showError('Tap "Sign" in MetaMask to verify your wallet, then try again.')
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
    if (socket.connected) {
      loadRooms()
    } else {
      socket.connect()
      socket.once('connect', () => {
        loadRooms()
      })
    }
    socket.on('room:update', loadRooms)
    socket.on('matchmaking:queue_update', ({ size }: { size: number }) => setQueueSize(size))
    socket.on('matchmaking:matched', ({ code, entryFee, chainId }: { code: string; entryFee: number; gameMode: string; chainId: number }) => {
      setSearching(false); setQueueSize(0)
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

  // Auto-scroll chat — fires on new messages, tab switch, drawer open, panel open
  useEffect(() => {
    const isVisible = (isDesktop && panelOpen && panelTab === 'chat') || (!isDesktop && mobileDrawerOpen && panelTab === 'chat')
    if (isVisible) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [globalChat, panelTab, mobileDrawerOpen, panelOpen, isDesktop])

  // Auto-scroll activity
  useEffect(() => {
    const isVisible = (isDesktop && panelOpen && panelTab === 'activity') || (!isDesktop && mobileDrawerOpen && panelTab === 'activity')
    if (isVisible) activityEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activityFeed, panelTab, mobileDrawerOpen, panelOpen, isDesktop])

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
          // Approve max uint256 so future games skip this step entirely
          await writeContractAsync({ address: chain.usdt, abi: USDT_APPROVE_ABI, functionName: 'approve', args: [escrowAddr, 2n ** 256n - 1n], chainId: chain.id, gas: 100000n })
        }
      } catch { showError('Approval rejected. You must approve USDT to lock into the game contract.'); return null }
      setPayStep('paying')
      try {
        const roomId = getRoomId(roomCode)
        localStorage.setItem('ag_pending_deposit', JSON.stringify({ code: roomCode, address, chainId: chain.id, fee, ts: Date.now() }))
        const txHash = await writeContractAsync({ address: escrowAddr, abi: ESCROW_ABI, functionName: 'deposit', args: [roomId, amount], chainId: chain.id, gas: 300000n })
        // Store txHash so Game.tsx rejoin can re-send room:deposit if socket dropped
        localStorage.setItem('ag_pending_deposit', JSON.stringify({ code: roomCode, address, chainId: chain.id, fee, txHash, ts: Date.now() }))
        // Persist deposit permanently — Profile uses this to auto-scan for refunds even if server missed the event
        try { const d = JSON.parse(localStorage.getItem('ag_deposits') || '{}'); d[roomCode] = { chainId: chain.id, escrow: escrowAddr, entryFee: fee, ts: Date.now(), address: address?.toLowerCase() }; localStorage.setItem('ag_deposits', JSON.stringify(d)) } catch {}
        return txHash
      } catch { localStorage.removeItem('ag_pending_deposit'); showError('Deposit failed. Your USDT was not locked — please try again.'); return null }
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
    setActiveRoom(code)
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
    const feeSnapshot = selectedFee
    const chainSnapshot = selectedChain
    const code = await new Promise<string | null>(resolve => {
      socket.emit('room:create',
        { gameMode, entryFee: feeSnapshot, maxPlayers: 2, address, chainId: chainSnapshot.id, authSig, roomType: 'duel' },
        (res: { code?: string; error?: string }) => { if (res.error) { showError(res.error); resolve(null) } else resolve(res.code!) }
      )
    })
    if (!code) { setCreating(false); setPayStep('idle'); return }
    const txHash = await payEntryFee(feeSnapshot, chainSnapshot, code)
    if (!txHash) { setCreating(false); setPayStep('idle'); return }
    socket.emit('room:deposit', { code, txHash, address }, () => {})
    fetch(`${SERVER_URL}/api/report-deposit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, room_code: code, tx_hash: txHash, chain_id: chainSnapshot.id, amount_usdt: feeSnapshot }) }).catch(() => {})
    setCreating(false); setPayStep('idle')
    setActiveRoom(code)
    // Navigate directly into the waiting room — no share card in lobby
    navigate(`/game/${code}`, { state: { host: true, entry: feeSnapshot, maxPlayers: 2, gameMode, chainId: chainSnapshot.id, roomType: 'duel', duelCreatedAt: Date.now() } })
  }

  async function handleJoinRoom(code: string, feeOverride?: number, chainOverride?: SupportedChain) {
    if (!isConnected || !address) { showError('Connect your wallet first'); return }
    if (lockedInRoom && lockedInRoom !== code) { showError(`You have funds locked in room ${lockedInRoom}. Finish that game or claim a refund from your Profile first.`); return }
    const room = rooms.find(r => r.code === code)
    const fee = feeOverride ?? room?.entry ?? selectedFee
    const chain = chainOverride ?? selectedChain
    setJoining(code); setError('')
    const authSig = await getAuthSig()
    if (!authSig) { setJoining(null); return }
    const txHash = await payEntryFee(fee, chain, code)
    if (!txHash) { setJoining(null); setPayStep('idle'); return }
    const socket = connectSocket()
    socket.emit('room:join', { code, address, chainId: chain.id, txHash, authSig },
      (res: { ok?: boolean; error?: string; reconnected?: boolean }) => {
        setJoining(null); setPayStep('idle')
        if (res.error) { showError(res.error); return }
        socket.emit('room:deposit', { code, txHash, address }, () => {})
        fetch(`${SERVER_URL}/api/report-deposit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, room_code: code, tx_hash: txHash, chain_id: chain.id, amount_usdt: fee }) }).catch(() => {})
        setActiveRoom(code)
        navigate(`/game/${code}`, { state: { gameMode, chainId: chain.id, entry: fee } })
      }
    )
  }

  function handleJoinByCode() {
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    handleJoinRoom(code)
  }

  function clearActiveRoom() { setActiveRoom('') }

  function sendChat() {
    const msg = chatInput.trim()
    if (!msg || !myName) return
    connectSocket().emit('global:chat:send', { username: myName, message: msg })
    setChatInput('')
  }



  const escrowAvailable = !!getEscrowAddress(selectedChain.id)
  const createBtnLabel = () => {
    if (payStep === 'switching') return `Switching network…`
    if (payStep === 'creating')  return 'Creating room…'
    if (payStep === 'approving') return 'Confirm in MetaMask → Return here'
    if (payStep === 'paying')    return 'Confirm in MetaMask → Return here'
    return escrowAvailable ? `🔒 Lock & Create` : `Pay & Create`
  }

  const openRooms = rooms.filter(r => !r.roomType || r.roomType === 'public')
  const duelRooms = rooms.filter(r => r.roomType === 'duel')

  // ── Side panel content (shared between desktop left panel and mobile drawer) ──
  const actColors = ['#a78bfa','#06b6d4','#22c55e','#f59e0b','#f472b6']
  const usernameColor = (name: string) => actColors[name.charCodeAt(0) % actColors.length]
  const actIcon = (msg: string) => {
    if (/won|winner|earn/i.test(msg)) return '🏆'
    if (/join/i.test(msg)) return '👤'
    if (/creat/i.test(msg)) return '🎮'
    if (/start/i.test(msg)) return '⚡'
    if (/refund/i.test(msg)) return '↩️'
    return '●'
  }

  const SidePanel = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Pill tabs */}
      <div style={{ display: 'flex', gap: '6px', padding: '10px 10px 0', flexShrink: 0 }}>
        <button className="panel-tab-btn" onClick={() => setPanelTab('activity')}
          style={{ flex: 1, padding: '7px 6px', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.73rem', cursor: 'pointer', transition: 'all 0.18s',
            background: panelTab === 'activity' ? 'linear-gradient(135deg,rgba(124,58,237,0.3),rgba(124,58,237,0.12))' : 'transparent',
            color: panelTab === 'activity' ? '#a78bfa' : '#4a5568',
            boxShadow: panelTab === 'activity' ? 'inset 0 0 0 1px rgba(124,58,237,0.35)' : 'none',
          }}>
          📡 Activity
        </button>
        <button className="panel-tab-btn" onClick={() => { setPanelTab('chat'); setUnreadChat(0) }}
          style={{ flex: 1, padding: '7px 6px', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.73rem', cursor: 'pointer', transition: 'all 0.18s', position: 'relative',
            background: panelTab === 'chat' ? 'linear-gradient(135deg,rgba(6,182,212,0.28),rgba(6,182,212,0.08))' : 'transparent',
            color: panelTab === 'chat' ? '#06b6d4' : '#4a5568',
            boxShadow: panelTab === 'chat' ? 'inset 0 0 0 1px rgba(6,182,212,0.3)' : 'none',
          }}>
          💬 Chat
          {unreadChat > 0 && panelTab !== 'chat' && (
            <span style={{ position: 'absolute', top: '3px', right: '4px', background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', color: '#fff', borderRadius: '10px', padding: '0px 5px', fontSize: '0.58rem', fontWeight: 700, animation: 'unread-pop 0.25s ease' }}>
              {unreadChat > 9 ? '9+' : unreadChat}
            </span>
          )}
        </button>
      </div>
      {/* gradient divider */}
      <div style={{ height: '1px', background: 'linear-gradient(90deg,transparent,rgba(124,58,237,0.3),rgba(6,182,212,0.3),transparent)', margin: '8px 10px 0', flexShrink: 0 }} />

      {/* Activity */}
      {panelTab === 'activity' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {activityFeed.length === 0
            ? <p style={{ color: '#334155', fontSize: '0.78rem', textAlign: 'center', padding: '28px 12px', fontStyle: 'italic' }}>Waiting for activity…</p>
            : [...activityFeed].reverse().map((item, i) => (
              <div key={i} className="panel-act-row"
                style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '5px 12px', borderRadius: '0', transition: 'background 0.15s', animation: `panel-row-in 0.2s ease ${Math.min(i,8)*0.03}s both` }}>
                <span style={{ fontSize: '0.75rem', lineHeight: '1.45', flexShrink: 0, marginTop: '1px', color: actColors[i % actColors.length] }}>
                  {actIcon(item.msg)}
                </span>
                <span style={{ color: '#94a3b8', fontSize: '0.74rem', lineHeight: 1.45, wordBreak: 'break-word' }}>{item.msg}</span>
              </div>
            ))}
          <div ref={activityEndRef} />
        </div>
      )}

      {/* Chat */}
      {panelTab === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
            {globalChat.length === 0
              ? <p style={{ color: '#334155', fontSize: '0.78rem', textAlign: 'center', padding: '28px 12px', fontStyle: 'italic' }}>No messages yet — say hi!</p>
              : globalChat.map((m, i) => {
                  const isMe = !!myName && m.username === myName
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', padding: '3px 10px' }}>
                      {!isMe && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                          <div style={{ width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                            background: `linear-gradient(135deg, ${usernameColor(m.username)}44, ${usernameColor(m.username)}22)`,
                            border: `1px solid ${usernameColor(m.username)}55`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.55rem', fontWeight: 700, color: usernameColor(m.username) }}>
                            {m.username[0]?.toUpperCase()}
                          </div>
                          <span style={{ color: usernameColor(m.username), fontSize: '0.65rem', fontWeight: 700 }}>{m.username}</span>
                        </div>
                      )}
                      <div style={{
                        maxWidth: '88%', padding: '5px 9px', borderRadius: isMe ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                        background: isMe ? 'linear-gradient(135deg,rgba(124,58,237,0.45),rgba(6,182,212,0.25))' : 'rgba(255,255,255,0.05)',
                        border: isMe ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.07)',
                        color: isMe ? '#e2e8f0' : '#94a3b8', fontSize: '0.74rem', lineHeight: 1.45, wordBreak: 'break-word',
                      }}>
                        {m.message}
                      </div>
                    </div>
                  )
                })}
            <div ref={chatEndRef} />
          </div>
          {/* Input */}
          <div style={{ padding: '8px 10px', borderTop: '1px solid #1a1a28', flexShrink: 0 }}>
            <div className="chat-input-wrap"
              style={{ display: 'flex', gap: '6px', background: '#0a0a12', border: '1px solid #1e1e30', borderRadius: '10px', padding: '4px 4px 4px 10px', transition: 'border-color 0.18s, box-shadow 0.18s' }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder={myName ? 'Message…' : 'Connect wallet to chat'}
                disabled={!myName} maxLength={200}
                style={{ flex: 1, background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: '0.8rem', outline: 'none', minWidth: 0 }}
              />
              <button onClick={sendChat} disabled={!myName || !chatInput.trim()}
                style={{ background: myName && chatInput.trim() ? 'linear-gradient(135deg,#7c3aed,#06b6d4)' : '#1e1e30',
                  border: 'none', borderRadius: '7px', padding: '6px 11px', color: myName && chatInput.trim() ? '#fff' : '#374151',
                  fontWeight: 700, fontSize: '1rem', cursor: myName && chatInput.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.18s', lineHeight: 1 }}>
                ↑
              </button>
            </div>
            {!myName && <p style={{ color: '#374151', fontSize: '0.67rem', marginTop: '4px', textAlign: 'center' }}>Connect wallet to join the chat</p>}
          </div>
        </div>
      )}
    </div>
  )

  // ── Main lobby content ────────────────────────────────────────────────────
  const LobbyContent = () => (
    <div style={{ padding: isDesktop ? '32px 28px 40px' : 'clamp(20px,4vw,32px) clamp(14px,3vw,20px)', paddingBottom: !isDesktop ? '72px' : undefined }}>
      <style>{`
        @keyframes lobby-pulse  { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } 50% { box-shadow: 0 0 24px 4px rgba(34,197,94,0.18); } }
        @keyframes btn-glow     { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } 50% { box-shadow: 0 4px 32px 0 rgba(34,197,94,0.35); } }
        @keyframes live-dot     { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.7); } }
        @keyframes searching    { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes fade-in      { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes panel-row-in { from { opacity:0; transform:translateX(-6px); } to { opacity:1; transform:translateX(0); } }
        @keyframes panel-glow   { 0%,100% { box-shadow: 0 0 0 0 rgba(124,58,237,0); } 50% { box-shadow: 0 0 18px 2px rgba(124,58,237,0.18); } }
        @keyframes unread-pop   { 0% { transform:scale(0.6); opacity:0; } 70% { transform:scale(1.15); } 100% { transform:scale(1); opacity:1; } }
        .lobby-fee-btn:hover    { border-color:#7c3aed !important; color:#a78bfa !important; }
        .lobby-chain-btn:hover  { opacity:0.85; }
        .lobby-room-card:hover  { border-color:#2d2d45 !important; background:#14141e !important; }
        .lobby-create-btn:hover { filter: brightness(1.12); }
        .panel-tab-btn:hover    { color:#e2e8f0 !important; background:rgba(255,255,255,0.05) !important; }
        .panel-act-row:hover    { background:rgba(255,255,255,0.03) !important; }
        .chat-row:hover         { background:rgba(255,255,255,0.03) !important; }
        .chat-input-wrap:focus-within { border-color:#7c3aed !important; box-shadow: 0 0 0 2px rgba(124,58,237,0.18) !important; }
        .panel-collapsed-btn:hover { border-color:#7c3aed !important; box-shadow: 0 0 14px 2px rgba(124,58,237,0.22) !important; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '24px', position: 'relative' }}>
        <button style={{ color: '#475569', fontSize: '0.82rem', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '14px', letterSpacing: '0.02em' }} onClick={() => navigate('/')}>
          ← Back
        </button>
        {/* Hero strip */}
        <div style={{ position: 'relative', background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(6,182,212,0.06) 100%)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '16px', padding: '18px 20px', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '180px', height: '100%', background: 'radial-gradient(ellipse at top right, rgba(124,58,237,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 900, background: 'linear-gradient(135deg, #a78bfa, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '6px', lineHeight: 1.1 }}>
                {meta.emoji} {meta.title}
              </h1>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '8px', maxWidth: '380px' }}>{meta.desc}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {myName && <span style={{ color: '#a78bfa', fontSize: '0.75rem', background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '20px', padding: '2px 10px' }}>⚡ {myName}</span>}
                {displayOnlineCount > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.73rem', color: '#64748b' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'live-dot 1.8s ease-in-out infinite' }} />
                    {displayOnlineCount} online
                  </span>
                )}
              </div>
            </div>
            {address && (
              <div style={{ textAlign: 'right', flexShrink: 0, background: 'rgba(0,0,0,0.25)', borderRadius: '10px', padding: '10px 14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: '0.65rem', color: '#475569', marginBottom: '3px', letterSpacing: '0.06em' }}>BALANCE</p>
                <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1rem', color: Number(balanceFormatted) >= selectedFee ? '#22c55e' : '#f59e0b' }}>
                  ${balanceFormatted} <span style={{ fontSize: '0.6rem', color: '#64748b' }}>USDT</span>
                </p>
              </div>
            )}
          </div>
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

      {/* ── INSTANT MATCH section ─────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(160deg, #0f1a14 0%, #12121a 60%)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '18px', padding: '20px 22px', marginBottom: '16px', animation: 'lobby-pulse 4s ease-in-out infinite' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'live-dot 1.5s ease-in-out infinite' }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#22c55e', letterSpacing: '0.12em', fontFamily: 'Orbitron, sans-serif' }}>INSTANT MATCH</span>
        </div>

        {/* Chain */}
        <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', letterSpacing: '0.1em', marginBottom: '8px' }}>PAY WITH USDT ON</p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {SUPPORTED_CHAINS.map(chain => (
            <button key={chain.id} onClick={() => setSelectedChain(chain)} className="lobby-chain-btn"
              style={{ padding: '6px 13px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', background: selectedChain.id === chain.id ? `${chain.color}28` : 'rgba(255,255,255,0.03)', border: `1px solid ${selectedChain.id === chain.id ? chain.color : '#252535'}`, color: selectedChain.id === chain.id ? chain.color : '#4a5568' }}>
              {chain.icon} {chain.shortName}
            </button>
          ))}
        </div>
        {selectedChain.id === 1 && <p style={{ color: '#f59e0b', fontSize: '0.75rem', marginBottom: '12px', background: 'rgba(245,158,11,0.08)', borderRadius: '8px', padding: '6px 10px' }}>⚠️ Ethereum gas is high. Consider Polygon, Arbitrum, or Base.</p>}

        {/* Entry fee */}
        <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', letterSpacing: '0.1em', marginBottom: '8px' }}>ENTRY FEE</p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {ENTRY_FEES.map(fee => (
            <button key={fee} onClick={() => setSelectedFee(fee)} className="lobby-fee-btn"
              style={{ padding: '9px 16px', borderRadius: '20px', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${selectedFee === fee ? '#7c3aed' : '#252535'}`, background: selectedFee === fee ? 'linear-gradient(135deg,rgba(124,58,237,0.3),rgba(99,102,241,0.2))' : 'rgba(255,255,255,0.03)', color: selectedFee === fee ? '#c4b5fd' : '#4a5568', boxShadow: selectedFee === fee ? '0 0 12px rgba(124,58,237,0.25)' : 'none' }}>
              ${fee}
            </button>
          ))}
        </div>

        {/* Max players */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', letterSpacing: '0.1em' }}>MAX PLAYERS</p>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#22c55e', fontFamily: 'Orbitron, sans-serif' }}>{maxPlayers}</span>
        </div>
        <input type="range" min={meta.minPlayers} max={meta.maxPlayers} value={maxPlayers}
          onChange={e => setMaxPlayers(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#22c55e', marginBottom: '4px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155', fontSize: '0.72rem', marginBottom: '18px' }}>
          <span>{meta.minPlayers}</span><span>{meta.maxPlayers}</span>
        </div>

        {/* Instant match button */}
        {searching ? (
          <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: '14px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', animation: 'searching 1.6s ease-in-out infinite' }}>
            <div>
              <p style={{ color: '#a78bfa', fontWeight: 700, fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', marginBottom: '3px' }}>Finding opponents… {queueSize > 0 && `(${queueSize} in queue)`}</p>
              <p style={{ color: '#64748b', fontSize: '0.76rem' }}>Entry ${selectedFee} · {selectedChain.name}</p>
            </div>
            <button onClick={cancelMatch} style={{ background: 'none', border: '1px solid #334155', borderRadius: '8px', padding: '8px 16px', color: '#94a3b8', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>Cancel</button>
          </div>
        ) : (
          <>
            <button onClick={findMatch} disabled={!isConnected}
              style={{ width: '100%', background: isConnected ? 'linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)' : '#1a1a2e', border: 'none', borderRadius: '14px', padding: '16px', color: isConnected ? '#041a0f' : '#334155', fontWeight: 900, fontSize: '1.05rem', fontFamily: 'Orbitron, sans-serif', cursor: isConnected ? 'pointer' : 'not-allowed', letterSpacing: '0.05em', marginBottom: '8px', animation: isConnected ? 'btn-glow 2.5s ease-in-out infinite' : 'none', transition: 'transform 0.1s', boxShadow: isConnected ? '0 4px 20px rgba(34,197,94,0.2)' : 'none' }}>
              ⚡ INSTANT MATCH — ${selectedFee}
            </button>
            {isConnected && <p style={{ textAlign: 'center', color: '#4a5568', fontSize: '0.73rem' }}>Get paired in 10–30 seconds</p>}
          </>
        )}
      </div>

      {/* ── CREATE ROOM / CREATE DUEL toggle buttons ──────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: activeCreateMode ? '0' : '16px' }}>
        <button onClick={() => setActiveCreateMode(activeCreateMode === 'room' ? null : 'room')} disabled={!isConnected} className="lobby-create-btn"
          style={{ flex: 1, background: activeCreateMode === 'room' ? 'rgba(124,58,237,0.22)' : 'rgba(124,58,237,0.07)', border: `1px solid ${activeCreateMode === 'room' ? 'rgba(124,58,237,0.65)' : 'rgba(124,58,237,0.22)'}`, borderRadius: '12px', padding: '13px', color: isConnected ? (activeCreateMode === 'room' ? '#c4b5fd' : '#7c6aaa') : '#334155', fontWeight: 700, fontSize: '0.88rem', cursor: isConnected ? 'pointer' : 'not-allowed', transition: 'all 0.2s', letterSpacing: '0.03em' }}>
          ➕ CREATE ROOM
        </button>
        <button
          onClick={() => setActiveCreateMode(activeCreateMode === 'duel' ? null : 'duel')}
          disabled={!isConnected || gameMode === 'highest-unique' || gameMode === 'lowest-unique'}
          title={gameMode === 'highest-unique' || gameMode === 'lowest-unique' ? 'Duels unavailable — needs 3+ players' : undefined}
          className="lobby-create-btn"
          style={{ flex: 1, background: activeCreateMode === 'duel' ? 'rgba(249,115,22,0.22)' : 'rgba(249,115,22,0.07)', border: `1px solid ${activeCreateMode === 'duel' ? 'rgba(249,115,22,0.65)' : 'rgba(249,115,22,0.22)'}`, borderRadius: '12px', padding: '13px', color: (gameMode === 'highest-unique' || gameMode === 'lowest-unique') ? '#334155' : (activeCreateMode === 'duel' ? '#fdba74' : '#c2763e'), fontWeight: 700, fontSize: '0.88rem', cursor: (!isConnected || gameMode === 'highest-unique' || gameMode === 'lowest-unique') ? 'not-allowed' : 'pointer', opacity: (gameMode === 'highest-unique' || gameMode === 'lowest-unique') ? 0.35 : 1, transition: 'all 0.2s', letterSpacing: '0.03em' }}>
          ⚔️ CREATE DUEL
        </button>
      </div>

      {/* ── Expanded create panel ──────────────────────────────────────────── */}
      {activeCreateMode && (
        <div style={{ background: activeCreateMode === 'duel' ? 'rgba(249,115,22,0.06)' : 'rgba(124,58,237,0.06)', border: `1px solid ${activeCreateMode === 'duel' ? 'rgba(249,115,22,0.25)' : 'rgba(124,58,237,0.25)'}`, borderRadius: '0 0 14px 14px', padding: '18px 20px', marginBottom: '16px' }}>

          {/* Chain */}
          <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', marginBottom: '8px' }}>PAY WITH USDT ON</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {SUPPORTED_CHAINS.map(chain => (
              <button key={chain.id} onClick={() => setSelectedChain(chain)}
                style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', background: selectedChain.id === chain.id ? `${chain.color}22` : 'transparent', border: `1px solid ${selectedChain.id === chain.id ? chain.color : '#1e1e30'}`, color: selectedChain.id === chain.id ? chain.color : '#64748b' }}>
                {chain.icon} {chain.shortName}
              </button>
            ))}
          </div>

          {/* Entry fee */}
          <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', marginBottom: '8px' }}>ENTRY FEE</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {ENTRY_FEES.map(fee => (
              <button key={fee} onClick={() => setSelectedFee(fee)}
                style={{ padding: '8px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', border: `1px solid ${selectedFee === fee ? '#7c3aed' : '#1e1e30'}`, background: selectedFee === fee ? 'rgba(124,58,237,0.18)' : 'transparent', color: selectedFee === fee ? '#a78bfa' : '#64748b' }}>
                ${fee}
              </button>
            ))}
          </div>

          {/* Max players — rooms only */}
          {activeCreateMode === 'room' && (
            <>
              <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', marginBottom: '8px' }}>MAX PLAYERS ({maxPlayers})</p>
              <input type="range" min={meta.minPlayers} max={meta.maxPlayers} value={maxPlayers}
                onChange={e => setMaxPlayers(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#7c3aed', marginBottom: '4px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.75rem', marginBottom: '16px' }}>
                <span>{meta.minPlayers}</span><span>{meta.maxPlayers}</span>
              </div>
            </>
          )}

          {/* Duel info */}
          {activeCreateMode === 'duel' && (
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '16px' }}>
              1v1 match · Share the link to challenge anyone · Winner takes <strong style={{ color: '#f97316' }}>${(selectedFee * 2 * 0.85).toFixed(2)}</strong>
            </p>
          )}

          {/* Action button */}
          <button
            onClick={activeCreateMode === 'room' ? payAndCreate : payAndCreateDuel}
            disabled={creating || !isConnected}
            style={{ width: '100%', background: creating ? '#1e1e30' : activeCreateMode === 'duel' ? 'linear-gradient(135deg,#f97316,#ea580c)' : 'linear-gradient(135deg,#7c3aed,#6d28d9)', border: 'none', borderRadius: '10px', padding: '13px', color: creating ? '#64748b' : '#fff', fontWeight: 800, fontSize: '0.92rem', fontFamily: 'Orbitron, sans-serif', cursor: creating ? 'not-allowed' : 'pointer', letterSpacing: '0.04em' }}>
            {creating ? createBtnLabel() : activeCreateMode === 'duel' ? `Pay $${selectedFee} & Generate Duel Link` : `Pay $${selectedFee} & Create Room`}
          </button>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.08em' }}>🔥 OPEN MATCHES</h3>
          {openRooms.length > 0 && <span style={{ fontSize: '0.68rem', fontWeight: 700, background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '20px', padding: '2px 8px' }}>{openRooms.filter(r => r.status === 'waiting').length} open</span>}
        </div>
        {loading ? (
          <div style={{ background: '#0e0e18', border: '1px solid #1a1a2e', borderRadius: '14px', textAlign: 'center', color: '#334155', padding: '36px', fontSize: '0.85rem' }}>Loading rooms…</div>
        ) : openRooms.length === 0 ? (
          <div style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.05),rgba(6,182,212,0.03))', border: '1px solid rgba(124,58,237,0.15)', borderRadius: '14px', textAlign: 'center', padding: '32px' }}>
            <div style={{ fontSize: '1.6rem', marginBottom: '8px' }}>⚔️</div>
            <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>No matches yet — be the first</div>
            <div style={{ color: '#334155', fontSize: '0.78rem' }}>Create a room and take the full pot</div>
          </div>
        ) : openRooms.map(room => (
          <div key={room.code} className="lobby-room-card" style={{ background: '#0e0e18', border: '1px solid #1a1a2e', borderRadius: '14px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '8px', opacity: room.status === 'full' ? 0.45 : 1, transition: 'all 0.15s', cursor: room.status === 'waiting' ? 'default' : undefined }}>
            <div style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.12em', color: '#e2e8f0' }}>{room.code}</p>
                <p style={{ color: '#334155', fontSize: '0.72rem', marginTop: '2px' }}>by {room.hostName || getUsername(room.host)}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#475569', fontSize: '0.8rem' }}>
                <span>👥</span><span style={{ fontWeight: 700, color: '#64748b' }}>{room.players}/{room.max}</span>
              </div>
              <div>
                <p style={{ color: '#22c55e', fontWeight: 800, fontSize: '0.9rem' }}>${room.entry} <span style={{ fontWeight: 400, fontSize: '0.72rem', color: '#334155' }}>USDT</span></p>
                <p style={{ color: '#334155', fontSize: '0.7rem' }}>pot ~${(room.entry * room.players * 0.85).toFixed(2)}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.67rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: room.status === 'waiting' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)', color: room.status === 'waiting' ? '#22c55e' : '#ef4444', border: `1px solid ${room.status === 'waiting' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.2)'}` }}>
                {room.status === 'waiting' ? '● OPEN' : '■ FULL'}
              </span>
              <button disabled={room.status === 'full' || joining === room.code} onClick={() => handleJoinRoom(room.code)}
                style={{ background: room.status === 'full' ? '#1a1a2e' : 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '10px', padding: '9px 20px', color: room.status === 'full' ? '#334155' : '#fff', fontWeight: 700, cursor: room.status === 'full' ? 'not-allowed' : 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap', boxShadow: room.status === 'waiting' ? '0 2px 12px rgba(124,58,237,0.25)' : 'none' }}>
                {joining === room.code ? 'Confirm in MetaMask →' : `Join ${selectedChain.icon}`}
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
            <p style={{ color: '#475569', fontSize: '0.72rem', fontStyle: 'italic' }}>Join via private link only</p>
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
          height: mobileDrawerOpen ? 'min(65vh, 520px)' : '48px',
          background: mobileDrawerOpen ? '#0e0e1a' : 'linear-gradient(180deg,#0e0e1a,#12121a)',
          borderTop: mobileDrawerOpen ? '1px solid rgba(124,58,237,0.25)' : '1px solid rgba(124,58,237,0.15)',
          borderRadius: mobileDrawerOpen ? '18px 18px 0 0' : '14px 14px 0 0',
          boxShadow: mobileDrawerOpen ? '0 -4px 24px rgba(124,58,237,0.12)' : '0 -2px 12px rgba(0,0,0,0.4)',
          zIndex: 101, transition: 'height 0.3s cubic-bezier(0.4,0,0.2,1)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Handle bar */}
          <div onClick={() => { setMobileDrawerOpen(!mobileDrawerOpen); if (!mobileDrawerOpen) setUnreadChat(0) }}
            style={{ padding: '0 16px', height: '48px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flexShrink: 0, borderBottom: mobileDrawerOpen ? '1px solid #1a1a28' : 'none' }}>
            {/* Drag pill */}
            <div style={{ width: '32px', height: '3px', background: 'linear-gradient(90deg,#7c3aed88,#06b6d488)', borderRadius: '2px', flexShrink: 0 }} />
            {/* Online indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', animation: 'live-dot 1.8s ease-in-out infinite', flexShrink: 0 }} />
              <span style={{ color: '#94a3b8', fontSize: '0.74rem', fontWeight: 600 }}>{displayOnlineCount} online</span>
            </div>
            {unreadChat > 0 && !mobileDrawerOpen && (
              <span style={{ background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', color: '#fff', borderRadius: '20px', padding: '1px 8px', fontSize: '0.68rem', fontWeight: 700, animation: 'unread-pop 0.25s ease' }}>
                💬 {unreadChat} new
              </span>
            )}
            {!mobileDrawerOpen && (
              <span style={{ color: '#4a5568', fontSize: '0.68rem', marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span>📡 Activity</span><span>💬 Chat</span>
              </span>
            )}
            <span style={{ marginLeft: mobileDrawerOpen ? 'auto' : '0', color: '#4a5568', fontSize: '0.7rem' }}>{mobileDrawerOpen ? '▼' : '▲'}</span>
          </div>
          {mobileDrawerOpen && (
            <div style={{ flex: 1, minHeight: 0 }}>
              { SidePanel() }
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
              <div style={{ background: 'linear-gradient(180deg,#0e0e1a,#0b0b14)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '16px', height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                {/* Panel header */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid rgba(124,58,237,0.12)', flexShrink: 0, background: 'rgba(124,58,237,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', animation: 'live-dot 1.8s ease-in-out infinite' }} />
                    <span style={{ color: '#94a3b8', fontSize: '0.73rem', fontWeight: 600 }}>{displayOnlineCount} online</span>
                  </div>
                  <button onClick={() => setPanelOpen(false)}
                    style={{ marginLeft: 'auto', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '3px 8px', color: '#4a5568', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                    ◀
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  { SidePanel() }
                </div>
              </div>
            ) : (
              /* Collapsed chicklet */
              <div className="panel-collapsed-btn" onClick={() => setPanelOpen(true)}
                style={{ background: 'linear-gradient(180deg,#0e0e1a,#0b0b14)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: '14px', width: '44px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', gap: '12px', transition: 'all 0.2s', animation: 'panel-glow 3s ease-in-out infinite' }}>
                {/* Online dot + count */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', animation: 'live-dot 1.8s ease-in-out infinite' }} />
                  <span style={{ color: '#64748b', fontSize: '0.62rem', fontWeight: 700 }}>{displayOnlineCount}</span>
                </div>
                {/* Divider */}
                <div style={{ width: '20px', height: '1px', background: 'rgba(124,58,237,0.3)' }} />
                {/* Chat icon */}
                <span style={{ fontSize: '0.85rem' }}>💬</span>
                {unreadChat > 0 && (
                  <span style={{ background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', color: '#fff', borderRadius: '10px', padding: '1px 5px', fontSize: '0.58rem', fontWeight: 700, minWidth: '18px', textAlign: 'center', animation: 'unread-pop 0.25s ease' }}>
                    {unreadChat > 9 ? '9+' : unreadChat}
                  </span>
                )}
                {/* Divider */}
                <div style={{ width: '20px', height: '1px', background: 'rgba(124,58,237,0.15)' }} />
                {/* Expand arrow */}
                <span style={{ color: '#4a5568', fontSize: '0.65rem' }}>▶</span>
              </div>
            )}
          </div>

          {/* Center: lobby content */}
          <div style={{ minWidth: 0 }}>
            { LobbyContent() }
          </div>

          {/* Right: empty spacer */}
          <div />
        </div>
      ) : (
        /* Mobile: single column */
        <div>
          { LobbyContent() }
        </div>
      )}
    </>
  )
}
