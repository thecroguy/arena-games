import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useAccount, useWriteContract, useChainId, useSwitchChain, useSignMessage, usePublicClient } from 'wagmi'
import { connectSocket } from '../utils/socket'
import { getAvatarUrl, getAvatarColor } from '../utils/avatar'
import { getUsername } from '../utils/profile'
import { getEscrowAddress, getRoomId, ESCROW_ABI, USDT_APPROVE_ABI } from '../utils/escrow'
import { getChain } from '../utils/chains'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

// ── Types ──────────────────────────────────────────────────────────────────
type Phase = 'waiting' | 'countdown' | 'playing' | 'round_end' | 'finished' | 'abandoned'

interface PlayerState { address: string; username?: string; score: number; answered?: boolean; correct?: boolean | null }

interface Question {
  round: number; total: number; timeMs: number
  type?: 'math' | 'pattern' | 'grid' | 'sealed' | 'bluff'
  // math
  a?: number; b?: number; op?: string
  // pattern-memory
  pattern?: number[]; _patternAnswer?: string
  // grid
  target?: number; gridSize?: number
  // sealed
  min?: number; max?: number; gameMode?: string
  // bluff
  totalDice?: number; turnOrder?: string[]; currentTurnIdx?: number
  currentBid?: { count: number; face: number; bidder: string } | null
}

interface BluffResult {
  allDice: Record<string, number[]>
  bid: { count: number; face: number; bidder: string } | null
  actualCount: number | null
  winner: string | null
  loser: string | null
}

interface SealedResult {
  winnerAddress: string | null
  reason?: string
  picks?: { address: string; pick: number }[]
}

// ── Helpers ────────────────────────────────────────────────────────────────
const ROUND_TIME_S   = 12
const TOTAL_BOT_ROUNDS = 10
const BOT_ADDR       = '0xB07B07B07B07B07B07B07B07B07B07B07B07B07B'

// usernameCache is populated from server-broadcast player objects (Supabase source of truth)
const usernameCache = new Map<string, string>()

function displayName(addr: string): string {
  if (addr === BOT_ADDR) return 'Bot'
  if (addr === 'YOU') return 'You'
  return usernameCache.get(addr.toLowerCase()) || getUsername(addr)
}

function makeMathQ(round: number): Question {
  const ops = ['+', '-', '*']
  const op  = ops[Math.floor(Math.random() * ops.length)]
  let a: number, b: number
  if (op === '+')      { a = Math.floor(Math.random() * 50) + 1; b = Math.floor(Math.random() * 50) + 1 }
  else if (op === '-') { a = Math.floor(Math.random() * 50) + 20; b = Math.floor(Math.random() * 20) + 1 }
  else                 { a = Math.floor(Math.random() * 12) + 1;  b = Math.floor(Math.random() * 12) + 1 }
  return { round, total: TOTAL_BOT_ROUNDS, a, b, op, timeMs: ROUND_TIME_S * 1000, type: 'math' }
}

function solveMath(q: Question): number {
  if (q.op === '+') return (q.a ?? 0) + (q.b ?? 0)
  if (q.op === '-') return (q.a ?? 0) - (q.b ?? 0)
  return (q.a ?? 0) * (q.b ?? 0)
}

function makePatternQ(round: number): Question {
  const gridSize = round >= 8 ? 6 : round >= 5 ? 5 : 4
  const total    = gridSize * gridSize
  const patLen   = Math.min(4 + round, Math.floor(total * 0.55))
  const indices  = Array.from({ length: total }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]]
  }
  const pattern = indices.slice(0, patLen).sort((a, b) => a - b)
  return { round, total: TOTAL_BOT_ROUNDS, type: 'pattern', timeMs: 15000, gridSize, pattern, _patternAnswer: pattern.join(',') }
}

function makeGridQ(round: number): Question {
  return { round, total: TOTAL_BOT_ROUNDS, target: Math.floor(Math.random() * 16), gridSize: 16, type: 'grid', timeMs: 8000 }
}

function makeSealedQ(round: number, gm: string): Question {
  return { round, total: TOTAL_BOT_ROUNDS, min: 1, max: gm === 'highest-unique' ? 100 : 50, type: 'sealed', gameMode: gm, timeMs: 20000 }
}

const SEALED_GAMES = ['highest-unique', 'lowest-unique']

const REACTION_EMOJIS = ['😭','💀','🔥','😂','🤯','👀','🫡','😤']

function DuelCountdownTimer({ expiryMs }: { expiryMs: number }) {
  const [remaining, setRemaining] = useState(Math.max(0, expiryMs - Date.now()))
  useEffect(() => {
    const t = setInterval(() => setRemaining(Math.max(0, expiryMs - Date.now())), 1000)
    return () => clearInterval(t)
  }, [expiryMs])
  if (remaining === 0) return <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 700 }}>Expired</span>
  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  return <span style={{ color: '#f97316', fontSize: '0.75rem', fontWeight: 700 }}>⏱ {mins}:{String(secs).padStart(2, '0')} left</span>
}

// ── Game help text ─────────────────────────────────────────────────────────
const GAME_HELP: Record<string, { title: string; rules: string[] }> = {
  'math-arena':     { title: 'Math Arena',      rules: ['A math equation appears each round.', 'Type the correct answer and press Enter or GO.', 'First player to answer correctly scores a point.', '10 rounds — most points wins the pot.'] },
  'pattern-memory': { title: 'Pattern Memory',    rules: ['A grid of tiles appears — some flash briefly.', 'Memorize which tiles lit up before they go dark.', 'Tap all the correct tiles from memory.', 'First to select all correct tiles scores. Most points wins.'] },
  'reaction-grid':  { title: 'Reaction Grid',   rules: ['A 4×4 grid appears — one cell lights up.', 'Click the highlighted cell as fast as possible.', 'First click wins the round point.', '15 rounds — most points wins the pot.'] },
  'highest-unique': { title: 'Highest Unique',  rules: ['Pick any number 1–100 each round.', 'The player with the highest UNIQUE number scores.', 'If two players pick the same number, both lose.', '8 rounds — most round wins takes the pot.'] },
  'lowest-unique':  { title: 'Lowest Unique',   rules: ['Pick any number 1–50 each round.', 'The player with the lowest UNIQUE number scores.', 'If two players pick the same number, both lose.', '8 rounds — most round wins takes the pot.'] },
  'liars-dice':     { title: "Liar's Dice",      rules: ['Each player gets 3 dice — you can only see yours.', 'Take turns bidding: "At least X dice show face Y across all dice."', 'Each bid must be higher (more dice, or same count + higher face).', 'Call LIAR! to challenge — if the bid was valid, YOU lose. If it was a bluff, THEY lose.'] },
}

// ── Component ──────────────────────────────────────────────────────────────
export default function Game() {
  const { roomCode }  = useParams<{ roomCode: string }>()
  const location      = useLocation()
  const navigate      = useNavigate()
  const { address }   = useAccount()

  const isBotMode      = location.state?.bot === true
  const isHost         = location.state?.host    ?? false
  const entryFee       = location.state?.entry   ?? 1
  const gameModeLS     = location.state?.gameMode ?? 'math-arena'
  const roomChainId    = location.state?.chainId  ?? 137
  const isDuel         = location.state?.roomType === 'duel'
  const isJoining      = location.state?.joining === true   // joiner coming from DuelJoin page
  const duelCreatedAt  = location.state?.duelCreatedAt as number | undefined
  const myAddr         = isBotMode ? (address || 'YOU') : (address ?? '')

  const currentChainId    = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const { signMessageAsync } = useSignMessage()
  const publicClient = usePublicClient()
  const authSigRef = useRef<string | null>(null)
  const addrRef    = useRef(myAddr)
  useEffect(() => { addrRef.current = myAddr }, [myAddr])

  async function getAuthSig(): Promise<string | null> {
    if (authSigRef.current) return authSigRef.current
    const addr = addrRef.current
    if (!addr) return null
    // Re-use cached sig from this browser session (avoids re-prompting on navigation)
    const cacheKey = `ag_authsig_${addr.toLowerCase()}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) { authSigRef.current = cached; return cached }
    try {
      const sig = await signMessageAsync({ message: `Arena Games: ${addr.toLowerCase()}` })
      authSigRef.current = sig
      sessionStorage.setItem(cacheKey, sig)
      return sig
    } catch {
      return null
    }
  }

  const [phase, setPhase]       = useState<Phase>(isBotMode ? 'countdown' : 'waiting')
  const [countdown, setCountdown] = useState(3)
  const [question, setQuestion] = useState<Question | null>(null)
  const [gameMode, setGameMode] = useState<string>(gameModeLS)
  const [players, setPlayers]   = useState<PlayerState[]>(
    isBotMode
      ? [{ address: myAddr, score: 0 }, { address: BOT_ADDR, score: 0 }]
      : myAddr ? [{ address: myAddr, score: 0 }] : []
  )
  const [timeLeft, setTimeLeft]   = useState(ROUND_TIME_S)
  const [input, setInput]         = useState('')
  const [roundAnswer, setRoundAnswer] = useState<string | null>(null)
  const [sealedResult, setSealedResult] = useState<SealedResult | null>(null)
  const [sealedCount, setSealedCount]   = useState(0)
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [gameOver, setGameOver]   = useState<{
    winner: string; pot: string; payoutMode?: string; claimSig?: string;
    scores: Array<{ address: string; score: number; rank: number }>
  } | null>(null)
  const [refundSig, setRefundSig] = useState<string | null>(null)
  const [claimState, setClaimState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle')
  const [error, setError]       = useState('')
  const [connecting, setConnecting] = useState(!isBotMode)
  const [joinPayStep, setJoinPayStep] = useState<'idle' | 'approving' | 'paying' | 'joining'>('idle')
  const [, setCanStart] = useState(false)
  const [botThinking, setBotThinking] = useState(false)
  const [patternVisible, setPatternVisible] = useState(true)
  const [selectedTiles, setSelectedTiles] = useState<number[]>([])
  // Liar's Dice bluff state
  const [bluffMyDice, setBluffMyDice] = useState<number[]>([])
  const [bluffBid, setBluffBid] = useState<{ count: number; face: number; bidder: string } | null>(null)
  const [bluffTurnOrder, setBluffTurnOrder] = useState<string[]>([])
  const [bluffTurnIdx, setBluffTurnIdx] = useState(0)
  const [bluffResult, setBluffResult] = useState<BluffResult | null>(null)
  const [bluffBidCount, setBluffBidCount] = useState(1)
  const [bluffBidFace, setBluffBidFace] = useState(1)
  const [bluffError, setBluffError] = useState('')
  const botBluffDiceRef = useRef<number[]>([])
  const bluffMyDiceRef  = useRef<number[]>([])
  const bluffBidRef     = useRef<{ count: number; face: number; bidder: string } | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [abandonReason, setAbandonReason] = useState('')
  const [disconnectedPlayers, setDisconnectedPlayers] = useState<string[]>([])
  // deposit timeout countdown
  const [depositedAt, setDepositedAt] = useState(0) // timestamp when first deposit confirmed
  const [waitNow, setWaitNow] = useState(Date.now())
  // emoji reactions
  const [floatingReactions, setFloatingReactions] = useState<Array<{id: number; emoji: string; name: string; x: number}>>([])
  const reactionIdRef = useRef(0)
  // queue chat
  const [chatMessages, setChatMessages] = useState<Array<{address: string; text: string; ts: number}>>([])
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  // sealed bot
  const botSealedPickRef = useRef<number | null>(null)
  const playerSealedPickRef = useRef<number | null>(null)

  const inputRef  = useRef<HTMLInputElement>(null)
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const botRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scoresRef = useRef<PlayerState[]>(players)

  useEffect(() => { scoresRef.current = players }, [players])
  useEffect(() => { bluffMyDiceRef.current = bluffMyDice }, [bluffMyDice])
  useEffect(() => { bluffBidRef.current = bluffBid }, [bluffBid])

  // ── Auto-scroll chat ───────────────────────────────────────────────────
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  // ── Waiting room countdown tick ────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'waiting' || !depositedAt) return
    const t = setInterval(() => setWaitNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [phase, depositedAt])


  // ── Bot mode ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isBotMode) return
    let n = 3; setCountdown(n)
    const cd = setInterval(() => {
      n--
      if (n <= 0) { clearInterval(cd); startBotRound(1) }
      else setCountdown(n)
    }, 1000)
    return () => { clearInterval(cd); clearBotTimer() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function clearBotTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (botRef.current) clearTimeout(botRef.current)
  }

  // ── Liar's Dice bot mode ──────────────────────────────────────────────
  function startBotBluffRound(round: number) {
    const myDiceRoll = Array.from({ length: 3 }, () => Math.floor(Math.random() * 6) + 1)
    const botDice    = Array.from({ length: 3 }, () => Math.floor(Math.random() * 6) + 1)
    botBluffDiceRef.current = botDice
    bluffMyDiceRef.current  = myDiceRoll
    bluffBidRef.current     = null
    setBluffMyDice(myDiceRoll)
    setBluffBid(null)
    setBluffTurnOrder([myAddr, BOT_ADDR])
    setBluffTurnIdx(0)
    setBluffResult(null)
    setBluffBidCount(1)
    setBluffBidFace(1)
    setBluffError('')
    const q: Question = { round, total: TOTAL_BOT_ROUNDS, type: 'bluff', totalDice: 6, timeMs: 60000 }
    setQuestion(q)
    setPhase('playing')
    setTimeLeft(60)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current!); resolveBluffBot(bluffBidRef.current, q, myAddr); return 0 }
        return t - 1
      })
    }, 1000)
  }

  function resolveBluffBot(bid: { count: number; face: number; bidder: string } | null, q: Question, challengerAddress: string) {
    clearBotTimer()
    if (!bid) {
      setBluffResult({ allDice: { [myAddr]: bluffMyDiceRef.current, [BOT_ADDR]: botBluffDiceRef.current }, bid: null, actualCount: null, winner: null, loser: null })
      setPhase('round_end')
      setTimeout(() => { const c = scoresRef.current; if (q.round >= q.total) finishBotGame(c); else startBotBluffRound(q.round + 1) }, 3000)
      return
    }
    const allArr = [...bluffMyDiceRef.current, ...botBluffDiceRef.current]
    const actualCount = allArr.filter(d => d === bid.face).length
    const bidSucceeds = actualCount >= bid.count
    const winner = bidSucceeds ? bid.bidder : challengerAddress
    const loser  = bidSucceeds ? challengerAddress : bid.bidder
    setBluffResult({ allDice: { [myAddr]: bluffMyDiceRef.current, [BOT_ADDR]: botBluffDiceRef.current }, bid, actualCount, winner, loser })
    setPhase('round_end')
    setPlayers(prev => { const u = prev.map(p => p.address === winner ? { ...p, score: p.score + 1 } : p); scoresRef.current = u; return u })
    setTimeout(() => { const c = scoresRef.current; if (q.round >= q.total) finishBotGame(c); else startBotBluffRound(q.round + 1) }, 3500)
  }

  function botBluffTurn(currentBid: { count: number; face: number; bidder: string }, q: Question) {
    const totalDice = 6
    const challengeProb = currentBid.count >= totalDice * 0.6 ? 0.75
                        : currentBid.count >= totalDice * 0.4 ? 0.40 : 0.18
    if (Math.random() < challengeProb) {
      resolveBluffBot(currentBid, q, BOT_ADDR)
      return
    }
    // Bot raises bid
    const newCount = currentBid.count + 1
    const newFace  = newCount <= currentBid.count ? Math.min(6, currentBid.face + 1) : currentBid.face
    if (newCount > totalDice) { resolveBluffBot(currentBid, q, BOT_ADDR); return }
    const newBid = { count: newCount, face: newFace, bidder: BOT_ADDR }
    bluffBidRef.current = newBid
    setBluffBid(newBid)
    setBluffTurnIdx(0) // player's turn
  }

  function handleBotPlayerBid(q: Question) {
    const currentBid = bluffBidRef.current
    if (currentBid) {
      const ok = bluffBidCount > currentBid.count || (bluffBidCount === currentBid.count && bluffBidFace > currentBid.face)
      if (!ok) { setBluffError(`Must bid higher than ${currentBid.count}×${currentBid.face}`); return }
    }
    if (bluffBidCount < 1 || bluffBidFace < 1 || bluffBidFace > 6) return
    setBluffError('')
    const newBid = { count: bluffBidCount, face: bluffBidFace, bidder: myAddr }
    bluffBidRef.current = newBid
    setBluffBid(newBid)
    setBluffTurnIdx(1) // bot's turn
    const delay = 1500 + Math.random() * 2000
    botRef.current = setTimeout(() => botBluffTurn(newBid, q), delay)
  }

  function handleBotPlayerChallenge(q: Question) {
    if (!bluffBidRef.current) { setBluffError('No bid to challenge yet!'); return }
    resolveBluffBot(bluffBidRef.current, q, myAddr)
  }

  function handlePlayerBid() {
    const currentBid = bluffBidRef.current
    if (currentBid) {
      const ok = bluffBidCount > currentBid.count || (bluffBidCount === currentBid.count && bluffBidFace > currentBid.face)
      if (!ok) { setBluffError(`Must bid higher than ${currentBid.count}×${currentBid.face}`); return }
    }
    setBluffError('')
    connectSocket().emit('game:bid', { code: roomCode, count: bluffBidCount, face: bluffBidFace })
  }

  function handlePlayerChallenge() {
    if (!bluffBidRef.current) { setBluffError('No bid to challenge yet!'); return }
    connectSocket().emit('game:challenge', { code: roomCode })
  }

  function startBotRound(round: number) {
    const gm = gameMode || gameModeLS

    if (gm === 'liars-dice') { startBotBluffRound(round); return }

    // ── Sealed game handling ──
    if (SEALED_GAMES.includes(gm)) {
      const q = makeSealedQ(round, gm)
      setQuestion(q)
      setPhase('playing')
      setInput('')
      setSealedCount(0)
      setSealedResult(null)
      setTimeLeft(20)
      botSealedPickRef.current = null
      playerSealedPickRef.current = null
      setPlayers(prev => prev.map(p => ({ ...p, answered: false, correct: null })))

      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { clearInterval(timerRef.current!); endBotSealedRound(q); return 0 }
          return t - 1
        })
      }, 1000)

      // Bot picks after 5000 + random*10000ms
      const botDelay = 5000 + Math.random() * 10000
      botRef.current = setTimeout(() => {
        const botPick = Math.floor(Math.random() * (q.max! - q.min! + 1)) + q.min!
        botSealedPickRef.current = botPick
        if (playerSealedPickRef.current !== null) {
          endBotSealedRound(q)
        }
      }, botDelay)

      setTimeout(() => inputRef.current?.focus(), 50)
      return
    }

    // ── Speed game handling (original) ──
    const q = gm === 'pattern-memory' ? makePatternQ(round)
            : gm === 'reaction-grid'  ? makeGridQ(round)
            : makeMathQ(round)
    setQuestion(q); setPhase('playing'); setInput(''); setRoundAnswer(null); setSelectedCell(null); setSelectedTiles([])
    setPlayers(prev => prev.map(p => ({ ...p, answered: false, correct: null })))
    const roundSecs = gm === 'reaction-grid' ? 8 : ROUND_TIME_S
    setTimeLeft(roundSecs)

    // Pattern memory: show sequence for 3s then hide it
    if (gm === 'pattern-memory') {
      setPatternVisible(true)
      setTimeout(() => setPatternVisible(false), 3000)
    }

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { clearInterval(timerRef.current!); endBotRound(q); return 0 } return t - 1 })
    }, 1000)

    // Bot reaction delay — faster for grid, slower for memory
    const delay = gm === 'reaction-grid'
      ? 300 + Math.random() * 900
      : gm === 'pattern-memory'
        ? 4000 + Math.random() * 5000
        : 2500 + Math.random() * 5000
    setBotThinking(true)
    botRef.current = setTimeout(() => {
      setBotThinking(false)
      const accuracy = gm === 'reaction-grid' ? 0.80 : gm === 'pattern-memory' ? 0.65 : 0.70
      const correct = Math.random() < accuracy
      setPlayers(prev => {
        const updated = prev.map(p =>
          p.address === BOT_ADDR
            ? { ...p, answered: true, correct, score: correct ? p.score + 1 : p.score }
            : p
        )
        scoresRef.current = updated; return updated
      })
      const playerDone = scoresRef.current.find(p => p.address === myAddr)?.answered
      if (playerDone) endBotRound(q)
    }, delay)

    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function endBotRound(q: Question) {
    clearBotTimer(); setPhase('round_end')
    const ans = q.type === 'pattern' ? (q._patternAnswer ?? '')
              : q.type === 'grid'    ? String(q.target ?? '')
              : String(solveMath(q))
    setRoundAnswer(ans)
    setTimeout(() => {
      const cur = scoresRef.current
      if (q.round >= q.total) finishBotGame(cur)
      else startBotRound(q.round + 1)
    }, 2000)
  }

  function endBotSealedRound(q: Question) {
    clearBotTimer()

    const playerPick = playerSealedPickRef.current
    const botPick    = botSealedPickRef.current
    const gm = q.gameMode ?? gameModeLS

    let winnerAddress: string | null = null
    const picks: { address: string; pick: number }[] = []

    if (playerPick !== null) picks.push({ address: myAddr, pick: playerPick })
    if (botPick !== null)    picks.push({ address: BOT_ADDR, pick: botPick })

    if (playerPick !== null && botPick !== null) {
      if (playerPick === botPick) {
        // highest-unique / lowest-unique: same pick = no winner
        winnerAddress = null
      } else if (gm === 'highest-unique') {
        winnerAddress = playerPick > botPick ? myAddr : BOT_ADDR
      } else {
        winnerAddress = playerPick < botPick ? myAddr : BOT_ADDR
      }
    } else if (playerPick !== null && botPick === null) {
      winnerAddress = myAddr
      picks.push({ address: BOT_ADDR, pick: -1 })
    } else if (botPick !== null && playerPick === null) {
      winnerAddress = BOT_ADDR
      picks.push({ address: myAddr, pick: -1 })
    }

    const result: SealedResult = { winnerAddress, picks }
    setSealedResult(result)
    setPhase('round_end')

    // Update scores
    if (winnerAddress) {
      setPlayers(prev => {
        const updated = prev.map(p =>
          p.address === winnerAddress ? { ...p, score: p.score + 1 } : p
        )
        scoresRef.current = updated
        return updated
      })
    }

    botSealedPickRef.current = null
    playerSealedPickRef.current = null

    setTimeout(() => {
      const cur = scoresRef.current
      if (q.round >= q.total) finishBotGame(cur)
      else startBotRound(q.round + 1)
    }, 2500)
  }

  function finishBotGame(finalPlayers: PlayerState[]) {
    const sorted = [...finalPlayers].sort((a, b) => b.score - a.score)
    setPhase('finished')
    setGameOver({ winner: sorted[0].address, pot: '0.00', scores: sorted.map((p, i) => ({ address: p.address, score: p.score, rank: i + 1 })) })
  }

  function handleBotSubmit() {
    if (!question) return
    let correct = false
    if (question.type === 'pattern') {
      const myAnswer = [...selectedTiles].sort((a, b) => a - b).join(',')
      correct = myAnswer === (question._patternAnswer ?? '')
    } else if (question.type === 'grid') {
      return // grid handled by handleGridClick
    } else {
      const val = parseInt(input, 10)
      if (isNaN(val)) return
      correct = val === solveMath(question)
    }
    clearTimeout(botRef.current!)
    setBotThinking(false)
    setPlayers(prev => {
      const updated = prev.map(p =>
        p.address === myAddr
          ? { ...p, answered: true, correct, score: correct ? p.score + 1 : p.score }
          : p
      )
      scoresRef.current = updated; return updated
    })
    const botDone = scoresRef.current.find(p => p.address === BOT_ADDR)?.answered
    if (botDone) endBotRound(question)
  }

  // ── Reaction helpers ───────────────────────────────────────────────────
  function spawnReaction(emoji: string, name: string) {
    const id = reactionIdRef.current++
    const x = 10 + Math.random() * 80
    setFloatingReactions(prev => [...prev, { id, emoji, name, x }])
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id))
    }, 3000)
  }

  function sendReaction(emoji: string) {
    if (isBotMode) {
      spawnReaction(emoji, 'You')
    } else {
      connectSocket().emit('reaction:send', { code: roomCode, emoji })
    }
  }

  // ── Chat helper ────────────────────────────────────────────────────────
  function sendChat() {
    const text = chatInput.trim()
    if (!text) return
    connectSocket().emit('chat:send', { code: roomCode, text, address: myAddr })
    setChatInput('')
  }

  // ── Multiplayer socket setup ──────────────────────────────────────────
  useEffect(() => {
    if (isBotMode) return
    const socket = connectSocket()

    let rejoinInFlight = false
    async function rejoin() {
      if (rejoinInFlight) return   // prevent concurrent calls — race condition causes duplicate player
      rejoinInFlight = true
      const addr = addrRef.current
      if (!addr) { rejoinInFlight = false; return }
      setConnecting(true)
      const authSig = await getAuthSig()
      if (!authSig) { setConnecting(false); rejoinInFlight = false; return }
      socket.emit('room:join', { code: roomCode, address: addr, authSig }, (res: { ok?: boolean; error?: string; reconnected?: boolean; room?: { players: PlayerState[]; gameMode?: string } }) => {
        rejoinInFlight = false
        setConnecting(false)
        if (res.error === 'Room not found') {
          navigate(`/lobby/${gameModeLS}`)
          return
        }
        if (res.error && res.error !== 'Already in room') setError(res.error)
        if (res.room) {
          res.room.players.forEach((p: PlayerState) => { if (p.username) usernameCache.set(p.address.toLowerCase(), p.username) })
          setPlayers(res.room.players)
          if (res.room.gameMode) setGameMode(res.room.gameMode)
          if (res.room.players.some((p: PlayerState & { deposited?: boolean }) => p.deposited)) {
            setDepositedAt(prev => prev || Date.now())
          }
        }
      })
    }
    ;(window as any)._arenaRejoin = rejoin
    ;(window as any)._arenaSocket = socket
    if (socket.connected) rejoin()
    socket.on('connect', rejoin)

    socket.on('room:update', (room: { players: PlayerState[]; status: string; gameMode?: string }) => {
      room.players.forEach(p => { if (p.username) usernameCache.set(p.address.toLowerCase(), p.username) })
      setPlayers(room.players)
      if (room.gameMode) setGameMode(room.gameMode)
      setCanStart(room.players.length >= 2 && room.status === 'waiting')
      // Start countdown when first deposit is confirmed
      if (room.players.some((p: PlayerState & { deposited?: boolean }) => p.deposited)) {
        setDepositedAt(prev => prev || Date.now())
      }
    })
    socket.on('game:countdown', (n: number) => { setPhase('countdown'); setCountdown(n) })
    socket.on('game:question', (q: Question) => {
      setPhase('playing'); setQuestion(q); setInput(''); setRoundAnswer(null)
      setSealedResult(null); setSealedCount(0); setSelectedCell(null); setSelectedTiles([])
      setPlayers(prev => prev.map(p => ({ ...p, answered: false, correct: null })))
      if (q.type === 'pattern') { setPatternVisible(true); setTimeout(() => setPatternVisible(false), 3000) }
      if (q.type === 'bluff') {
        setBluffBid(null); bluffBidRef.current = null
        setBluffResult(null); setBluffError('')
        setBluffTurnOrder(q.turnOrder ?? []); setBluffTurnIdx(q.currentTurnIdx ?? 0)
        setBluffBidCount(1); setBluffBidFace(1)
      }
      setTimeLeft(Math.round(q.timeMs / 1000))
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeLeft(t => { if (t <= 1) { clearInterval(timerRef.current!); return 0 } return t - 1 })
      }, 1000)
      if (q.type !== 'grid' && q.type !== 'sealed') setTimeout(() => inputRef.current?.focus(), 50)
    })
    socket.on('game:player_answered', (data: { address: string; correct: boolean; scores: PlayerState[] }) => {
      setPlayers(data.scores.map(p => ({
        ...p, answered: p.address === data.address ? true : undefined,
        correct: p.address === data.address ? data.correct : undefined,
      })))
    })
    socket.on('game:sealed_submitted', (data: { address: string; submitted: number; total: number }) => {
      setSealedCount(data.submitted)
      setPlayers(prev => prev.map(p => p.address === data.address ? { ...p, answered: true } : p))
    })
    socket.on('game:round_end', (data: { answer: string | null; scores: PlayerState[]; sealedResult?: SealedResult; bluffResult?: BluffResult }) => {
      if (timerRef.current) clearInterval(timerRef.current)
      data.scores.forEach((p: PlayerState) => { if (p.username) usernameCache.set(p.address.toLowerCase(), p.username) })
      setPhase('round_end'); setRoundAnswer(data.answer); setPlayers(data.scores)
      if (data.sealedResult) setSealedResult(data.sealedResult)
      if (data.bluffResult) { setBluffResult(data.bluffResult); bluffBidRef.current = data.bluffResult.bid }
    })
    socket.on('game:over', (data: { winner: string; pot: string; payoutMode?: string; claimSig?: string; scores: Array<{ address: string; score: number; rank: number }> }) => {
      if (timerRef.current) clearInterval(timerRef.current)
      setPhase('finished'); setGameOver(data)
    })
    socket.on('game:refund_sig', ({ refundSig: sig }: { refundSig: string }) => {
      setRefundSig(sig)
    })
    socket.on('game:player_left', (data: { address: string }) => {
      setPlayers(prev => prev.filter(p => p.address !== data.address))
      setDisconnectedPlayers(prev => prev.filter(a => a !== data.address))
    })
    socket.on('room:timeout', (data: { message: string }) => {
      if (timerRef.current) clearInterval(timerRef.current)
      // If player deposited, show abandoned screen (refund button); otherwise go back to lobby
      const myPlayer = scoresRef.current.find(p => p.address === myAddr)
      if ((myPlayer as PlayerState & { deposited?: boolean })?.deposited) {
        setAbandonReason(data.message)
        setPhase('abandoned')
      } else {
        navigate(`/lobby/${gameModeLS}`)
      }
    })
    socket.on('game:abandoned', (data: { reason: string }) => {
      if (timerRef.current) clearInterval(timerRef.current)
      setAbandonReason(data.reason)
      setPhase('abandoned')
    })
    socket.on('game:player_disconnected', ({ address: addr, reconnectSecs }: { address: string; reconnectSecs: number }) => {
      setDisconnectedPlayers(prev => prev.includes(addr) ? prev : [...prev, addr])
      setTimeout(() => setDisconnectedPlayers(prev => prev.filter(a => a !== addr)), reconnectSecs * 1000)
    })
    socket.on('game:player_reconnected', ({ address: addr }: { address: string }) => {
      setDisconnectedPlayers(prev => prev.filter(a => a !== addr))
    })
    socket.on('game:reconnected', (data: { round: number; total: number; scores: PlayerState[]; question: Question | null; timeMs: number; status: string; gameMode: string }) => {
      setPlayers(data.scores)
      if (data.gameMode) setGameMode(data.gameMode)
      if (data.status === 'playing' && data.question) {
        const restoredQ = { ...data.question, round: data.round, total: data.total, timeMs: data.timeMs }
        setQuestion(restoredQ)
        setPhase('playing')
        setTimeLeft(Math.round(data.timeMs / 1000))
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = setInterval(() => {
          setTimeLeft(t => { if (t <= 1) { clearInterval(timerRef.current!); return 0 } return t - 1 })
        }, 1000)
      } else if (data.status === 'round_end') {
        setPhase('round_end')
      }
    })
    socket.on('reaction:message', ({ address, emoji }: { address: string; emoji: string }) => {
      spawnReaction(emoji, displayName(address))
    })
    socket.on('room:chat', (msg: { address: string; text: string; ts: number }) => {
      setChatMessages(prev => [...prev.slice(-49), msg])
    })
    socket.on('game:bluff_dice', ({ dice, currentBid, currentTurnIdx, turnOrder }: { dice: number[]; currentBid?: typeof bluffBid; currentTurnIdx?: number; turnOrder?: string[] }) => {
      setBluffMyDice(dice); bluffMyDiceRef.current = dice
      if (currentBid !== undefined) { setBluffBid(currentBid); bluffBidRef.current = currentBid }
      if (currentTurnIdx !== undefined) setBluffTurnIdx(currentTurnIdx)
      if (turnOrder) setBluffTurnOrder(turnOrder)
    })
    socket.on('game:bluff_update', ({ currentBid, currentTurnIdx }: { currentBid: typeof bluffBid; currentTurnIdx: number }) => {
      setBluffBid(currentBid); bluffBidRef.current = currentBid; setBluffTurnIdx(currentTurnIdx)
    })
    socket.on('game:bluff_error', (msg: string) => setBluffError(msg))

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      socket.off('connect', rejoin)
      socket.off('room:update'); socket.off('game:countdown'); socket.off('game:question')
      socket.off('game:player_answered'); socket.off('game:sealed_submitted')
      socket.off('game:round_end'); socket.off('game:over'); socket.off('game:refund_sig')
      socket.off('game:player_left'); socket.off('game:abandoned'); socket.off('room:timeout')
      socket.off('game:player_disconnected'); socket.off('game:player_reconnected')
      socket.off('game:reconnected')
      socket.off('reaction:message'); socket.off('room:chat')
      socket.off('game:bluff_dice'); socket.off('game:bluff_update'); socket.off('game:bluff_error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, myAddr])

  // ── Claim payout (winner calls contract from their own wallet) ────────────
  async function handleClaim() {
    if (!gameOver?.claimSig || !myAddr) return
    const escrowAddr = getEscrowAddress(roomChainId)
    if (!escrowAddr) return
    setClaimState('pending')
    try {
      if (currentChainId !== roomChainId) await switchChainAsync({ chainId: roomChainId })
      await writeContractAsync({
        address: escrowAddr,
        abi: ESCROW_ABI,
        functionName: 'claim',
        args: [getRoomId(roomCode ?? ''), gameOver.winner as `0x${string}`, gameOver.claimSig as `0x${string}`],
      })
      setClaimState('done')
    } catch {
      setClaimState('error')
    }
  }

  // ── Claim refund (each player calls contract, pays own ~$0.01 gas) ────────
  async function handleClaimRefund() {
    if (!refundSig || !myAddr) return
    const escrowAddr = getEscrowAddress(roomChainId)
    if (!escrowAddr) return
    setClaimState('pending')
    try {
      if (currentChainId !== roomChainId) await switchChainAsync({ chainId: roomChainId })
      await writeContractAsync({
        address: escrowAddr,
        abi: ESCROW_ABI,
        functionName: 'claimRefund',
        args: [getRoomId(roomCode ?? ''), refundSig as `0x${string}`],
      })
      setClaimState('done')
    } catch {
      setClaimState('error')
    }
  }

  function handleStart() { connectSocket().emit('room:start', { code: roomCode }) }

  async function payAndJoin() {
    if (!address) return
    setError(''); setJoinPayStep('approving')
    const authSig = await getAuthSig()
    if (!authSig) { setJoinPayStep('idle'); return }
    const chain = getChain(roomChainId)
    if (!chain) { setError('Unsupported chain'); setJoinPayStep('idle'); return }
    if (currentChainId !== chain.id) {
      try { await switchChainAsync({ chainId: chain.id }) }
      catch { setError(`Switch to ${chain.name} in your wallet`); setJoinPayStep('idle'); return }
    }
    const amount = BigInt(Math.round(entryFee * 1e6))
    const escrowAddr = getEscrowAddress(chain.id)
    if (!escrowAddr) { setError('Payments not configured for this network'); setJoinPayStep('idle'); return }
    // Check existing allowance — skip approve tx if already sufficient
    let needsApprove = true
    if (publicClient) {
      try {
        const allowance = await publicClient.readContract({ address: chain.usdt, abi: USDT_APPROVE_ABI, functionName: 'allowance', args: [address as `0x${string}`, escrowAddr] }) as bigint
        if (allowance >= amount) needsApprove = false
      } catch { /* if read fails, fall through to approve */ }
    }
    if (needsApprove) {
      // Approve max uint256 once — future deposits skip this step entirely (1-click from then on)
      const MAX_UINT256 = 2n ** 256n - 1n
      try {
        await writeContractAsync({ address: chain.usdt, abi: USDT_APPROVE_ABI, functionName: 'approve', args: [escrowAddr, MAX_UINT256], chainId: chain.id, gas: 100000n })
      } catch { setError('Approval rejected'); setJoinPayStep('idle'); return }
    }
    setJoinPayStep('paying')
    let txHash: string
    try {
      const roomId = getRoomId(roomCode!)
      localStorage.setItem('ag_pending_deposit', JSON.stringify({ code: roomCode, address, chainId: chain.id, fee: entryFee, ts: Date.now() }))
      txHash = await writeContractAsync({ address: escrowAddr, abi: ESCROW_ABI, functionName: 'deposit', args: [roomId, amount], chainId: chain.id, gas: 300000n })
      localStorage.removeItem('ag_pending_deposit')
    } catch { localStorage.removeItem('ag_pending_deposit'); setError('Deposit failed — try again'); setJoinPayStep('idle'); return }
    // room:join was already called by rejoin() on mount — just confirm the deposit
    setJoinPayStep('joining')
    const socket = connectSocket()
    socket.emit('room:deposit', { code: roomCode, txHash, address }, () => {})
    fetch(`${SERVER_URL}/api/report-deposit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, room_code: roomCode, tx_hash: txHash, chain_id: chain.id, amount_usdt: entryFee }) }).catch(() => {})
    setJoinPayStep('idle')
  }

  function submitAnswer(val: string) {
    if (isBotMode) { handleBotSubmit(); return }
    if (!question || !val.trim()) return
    connectSocket().emit('game:answer', { code: roomCode, answer: val.trim() })
  }

  function handleMathSubmit() {
    const val = parseInt(input, 10)
    if (isNaN(val)) return
    submitAnswer(String(val))
  }

  function handlePatternSubmit() {
    if (selectedTiles.length === 0) return
    if (isBotMode) { handleBotSubmit(); return }
    const answer = [...selectedTiles].sort((a, b) => a - b).join(',')
    submitAnswer(answer)
  }

  function handleGridClick(cell: number) {
    if (myPlayer?.answered) return
    setSelectedCell(cell)
    if (isBotMode) {
      const correct = cell === question?.target
      clearTimeout(botRef.current!)
      setBotThinking(false)
      setPlayers(prev => {
        const updated = prev.map(p =>
          p.address === myAddr
            ? { ...p, answered: true, correct, score: correct ? p.score + 1 : p.score }
            : p
        )
        scoresRef.current = updated; return updated
      })
      const botDone = scoresRef.current.find(p => p.address === BOT_ADDR)?.answered
      if (botDone && question) endBotRound(question)
    } else {
      submitAnswer(String(cell))
    }
  }

  function handleSealedSubmit() {
    const val = parseInt(input, 10)
    if (isNaN(val)) return
    const min = question?.min ?? 1
    const max = question?.max ?? 100
    if (val < min || val > max) return

    if (isBotMode) {
      playerSealedPickRef.current = val
      setPlayers(prev => prev.map(p => p.address === myAddr ? { ...p, answered: true } : p))
      if (botSealedPickRef.current !== null && question) {
        endBotSealedRound(question)
      }
      // else: bot will trigger endBotSealedRound when it picks
      return
    }

    submitAnswer(String(val))
  }

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)
  const timerColor    = timeLeft <= 3 ? '#ef4444' : timeLeft <= 6 ? '#f59e0b' : '#22c55e'
  const myPlayer      = players.find(p => p.address === myAddr)
  const roundTimeS    = question ? Math.round(question.timeMs / 1000) : ROUND_TIME_S
  const help          = GAME_HELP[gameMode] ?? GAME_HELP['math-arena']

  // ── Disconnect banner ─────────────────────────────────────────────────
  const disconnectBanner = disconnectedPlayers.length > 0 ? (
    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '8px 14px', marginBottom: '10px', color: '#f87171', fontSize: '0.8rem', textAlign: 'center' }}>
      ⚠️ {disconnectedPlayers.map(a => displayName(a)).join(', ')} disconnected — 30s to reconnect
    </div>
  ) : null

  // ── Emoji bar (shown during playing/round_end) ─────────────────────────
  const showEmojiBar = phase === 'playing' || phase === 'round_end'
  const emojiBar = showEmojiBar ? (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12 }}>
      {REACTION_EMOJIS.map(emoji => (
        <button key={emoji} onClick={() => sendReaction(emoji)}
          style={{ padding: '6px', fontSize: '1.3rem', background: 'transparent', border: '1px solid #1e1e30', borderRadius: '8px', cursor: 'pointer' }}>
          {emoji}
        </button>
      ))}
    </div>
  ) : null

  // ── Abandoned phase ───────────────────────────────────────────────────
  if (phase === 'abandoned') return (
    <Center>
      <div style={{ textAlign: 'center', maxWidth: '400px', padding: '0 16px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⚠️</div>
        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1.2rem', color: '#ef4444', marginBottom: '8px' }}>Game Abandoned</h2>
        <p style={{ color: '#94a3b8', marginBottom: '16px', fontSize: '0.95rem' }}>{abandonReason || 'A player disconnected.'}</p>
        {refundSig && getEscrowAddress(roomChainId) && (
          claimState === 'done' ? (
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.82rem', color: '#86efac' }}>
              ✅ Your ${entryFee} USDT entry fee has been refunded!
            </div>
          ) : (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '8px', padding: '8px 14px', marginBottom: '10px', fontSize: '0.78rem', color: '#a78bfa' }}>
                Your ${entryFee} USDT is locked in the contract — click below to claim it back.
                <br /><span style={{ color: '#475569' }}>You pay ~$0.01 gas to reclaim 100% of your entry fee.</span>
              </div>
              <button onClick={handleClaimRefund} disabled={claimState === 'pending'}
                style={{ width: '100%', background: claimState === 'pending' ? '#1e1e30' : 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '10px', padding: '13px', color: claimState === 'pending' ? '#64748b' : '#fff', fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.9rem', cursor: claimState === 'pending' ? 'not-allowed' : 'pointer', marginBottom: '6px' }}>
                {claimState === 'pending' ? 'Confirm in wallet…' : `Claim Refund $${entryFee} USDT`}
              </button>
              {claimState === 'error' && <p style={{ color: '#ef4444', fontSize: '0.78rem', margin: 0 }}>Transaction failed — please try again.</p>}
            </div>
          )
        )}
        <button onClick={() => navigate(`/lobby/${gameMode}`)} style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '10px', padding: '12px 28px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem' }}>
          Back to Lobby →
        </button>
      </div>
    </Center>
  )

  // ── Waiting phase ─────────────────────────────────────────────────────
  if (phase === 'waiting') return (
    <Center>
      <div style={{ textAlign: 'center', maxWidth: '400px', width: '100%', padding: '0 16px' }}>
        <div style={{ color: '#64748b', fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '6px' }}>ROOM</div>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(2rem,8vw,3rem)', fontWeight: 900, letterSpacing: '0.2em', background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          {roomCode}
        </div>
        <p style={{ color: '#94a3b8', margin: '12px 0 24px', fontSize: '0.95rem' }}>
          {players.length} player{players.length !== 1 ? 's' : ''} — waiting for more…
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '24px' }}>
          {players.map(p => (
            <div key={p.address} style={{ background: '#12121a', border: `1px solid ${p.address === myAddr ? '#7c3aed' : '#1e1e30'}`, borderRadius: '10px', padding: '8px 14px', fontSize: '0.82rem', color: p.address === myAddr ? '#a78bfa' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src={getAvatarUrl(p.address)} alt="avatar" width={28} height={28} style={{ borderRadius: '50%', border: `2px solid ${getAvatarColor(p.address)}`, background: '#1e1e30' }} />
              {displayName(p.address)} {p.address === myAddr && '(you)'}
              {(p as PlayerState & { deposited?: boolean }).deposited
                ? <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#22c55e' }}>🔒 Locked</span>
                : <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#f59e0b' }}>⏳ Pending</span>}
            </div>
          ))}
        </div>
        {isDuel && !isHost && isJoining && (() => {
          const fmt = (n: number) => parseFloat(n.toFixed(2)).toString()
          const pot = fmt(entryFee * 2)
          const win = fmt(entryFee * 2 * 0.85)
          const gameTitle = GAME_HELP[gameMode]?.title || gameMode
          return (
            <div style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '14px', padding: '14px 18px', marginBottom: '16px', textAlign: 'left' }}>
              <p style={{ color: '#f97316', fontWeight: 800, fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', margin: '0 0 8px' }}>⚔️ ${pot} DUEL — {gameTitle}</p>
              <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>Winner takes <strong style={{ color: '#e2e8f0' }}>${win} USDT</strong> · Lock your funds to confirm you're in</p>
            </div>
          )
        })()}
        {isDuel && isHost && players.length < 2 ? (() => {
          const fmt = (n: number) => parseFloat(n.toFixed(2)).toString()
          const pot = fmt(entryFee * 2)
          const win = fmt(entryFee * 2 * 0.85)
          const gameTitle = GAME_HELP[gameMode]?.title || gameMode
          const duelUrl = `https://joinarena.space/r/${roomCode}`
          const tweetText = `⚔️ $${pot} POT DUEL — ${gameTitle}\n\nEntry fee: $${fmt(entryFee)} USDT each\nWinner takes $${win} USDT\nExpires in 15 min ⏱\n\nThink you can beat me?\n${duelUrl}`
          const expiryMs = (duelCreatedAt || Date.now()) + 15 * 60 * 1000
          return (
            <div style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.4)', borderRadius: '14px', padding: '18px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <p style={{ color: '#f97316', fontWeight: 800, fontFamily: 'Orbitron, sans-serif', fontSize: '0.88rem', margin: 0 }}>⚔️ ${pot} DUEL CREATED!</p>
                <DuelCountdownTimer expiryMs={expiryMs} />
              </div>
              <p style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '10px' }}>Winner takes <strong style={{ color: '#e2e8f0' }}>${win} USDT</strong> · Share this link to challenge someone</p>
              <div onClick={() => navigator.clipboard.writeText(duelUrl).catch(() => {})}
                style={{ background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px', fontSize: '0.82rem', color: '#a78bfa', fontFamily: 'monospace', cursor: 'pointer', wordBreak: 'break-all' }}
                title="Click to copy link">
                {duelUrl}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => navigator.clipboard.writeText(tweetText).catch(() => {})}
                  style={{ flex: 1, background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', borderRadius: '8px', padding: '10px', color: '#f97316', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                  📋 Copy Post
                </button>
                <button onClick={() => window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank')}
                  style={{ flex: 1, background: '#000', border: '1px solid #333', borderRadius: '8px', padding: '10px', color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                  𝕏 Post on X
                </button>
              </div>
            </div>
          )
        })() : isDuel && isHost && players.length >= 2 ? (
          <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '10px 16px', marginBottom: '12px', fontSize: '0.85rem', color: '#22c55e', textAlign: 'center' }}>
            ⚔️ Challenger accepted — game starting when both players lock funds
          </div>
        ) : !isDuel && isHost ? (
          <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '10px', padding: '12px 18px', marginBottom: '12px', fontSize: '0.85rem', color: '#64748b' }}>
            Share code <strong style={{ color: '#a78bfa', fontFamily: 'Orbitron, sans-serif' }}>{roomCode}</strong> with friends
          </div>
        ) : null}
        {depositedAt > 0 && (() => {
          const secsLeft = Math.max(0, Math.round((depositedAt + 10 * 60 * 1000 - waitNow) / 1000))
          const mm = String(Math.floor(secsLeft / 60)).padStart(2, '0')
          const ss = String(secsLeft % 60).padStart(2, '0')
          return (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '7px 14px', marginBottom: '16px', fontSize: '0.78rem', color: '#f59e0b', textAlign: 'center' }}>
              Room closes in {mm}:{ss} if game doesn't start
            </div>
          )
        })()}
        {connecting && (
          <div style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', animation: 'pulse 1.2s infinite' }} />
            Connecting to room…
          </div>
        )}
        {!connecting && error && (
          <div style={{ marginBottom: '12px' }}>
            <p style={{ color: '#ef4444', fontSize: '0.9rem', margin: '0 0 8px' }}>{error}</p>
            <button onClick={() => (window as any)._arenaRejoin?.()}
              style={{ background: 'transparent', border: '1px solid #7c3aed', borderRadius: '8px', padding: '8px 18px', color: '#a78bfa', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>
              Reconnect →
            </button>
          </div>
        )}
        {/* Joiner: pay to lock in */}
        {isJoining && !connecting && (() => {
          const myP = players.find(p => p.address === myAddr) as (PlayerState & { deposited?: boolean }) | undefined
          if (myP?.deposited) return (
            <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '12px', color: '#22c55e', fontSize: '0.88rem', textAlign: 'center' }}>
              ✓ Funds locked — waiting for host to start
            </div>
          )
          const labels = { idle: `Pay $${entryFee} USDT to Lock In`, approving: 'Setting up USDT…', paying: 'Locking funds…', joining: 'Confirming…' }
          return (
            <button onClick={payAndJoin} disabled={joinPayStep !== 'idle'}
              style={{ width: '100%', background: joinPayStep !== 'idle' ? '#1e1e30' : 'linear-gradient(135deg, #f97316, #ea580c)', border: 'none', borderRadius: '10px', padding: '14px', color: joinPayStep !== 'idle' ? '#64748b' : '#fff', fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1rem', cursor: joinPayStep !== 'idle' ? 'not-allowed' : 'pointer', letterSpacing: '0.05em', marginBottom: '8px' }}>
              {labels[joinPayStep]}
            </button>
          )
        })()}
        {/* Host: Start Game when all players are deposited */}
        {isHost && (() => {
          const allDeposited = players.length >= 2 && players.every(p => (p as PlayerState & { deposited?: boolean }).deposited)
          if (allDeposited) return (
            <button onClick={handleStart} style={{ width: '100%', background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '10px', padding: '14px', color: '#fff', fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', letterSpacing: '0.05em' }}>
              Start Game ▶
            </button>
          )
          if (players.length < 2) return <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Waiting for {isDuel ? 'challenger' : 'players'}…</p>
          return <p style={{ color: '#f59e0b', fontSize: '0.85rem' }}>Waiting for all players to lock funds…</p>
        })()}

        {/* Cancel game — available to any player in waiting room */}
        {!connecting && players.some(p => p.address === myAddr) && (() => {
          const myDeposited = (players.find(p => p.address === myAddr) as PlayerState & { deposited?: boolean })?.deposited
          const anyDeposited = players.some(p => (p as PlayerState & { deposited?: boolean }).deposited)
          return (
            <button onClick={() => {
              const socket = (window as any)._arenaSocket
              if (socket) socket.emit('room:cancel', { code: roomCode })
            }}
              style={{ width: '100%', marginTop: '10px', background: 'transparent', border: `1px solid ${anyDeposited ? '#ef4444' : '#374151'}`, borderRadius: '10px', padding: '10px', color: anyDeposited ? '#ef4444' : '#475569', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>
              {myDeposited ? '↩ Cancel & Claim Refund' : '↩ Cancel Game'}
            </button>
          )
        })()}

        {/* Queue chat */}
        <div style={{ maxHeight: 180, overflowY: 'auto', background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: 10, padding: 10, marginTop: 12, textAlign: 'left' }}>
          {chatMessages.length === 0 && (
            <p style={{ color: '#475569', fontSize: '0.78rem', margin: 0, textAlign: 'center' }}>No messages yet — say hi!</p>
          )}
          {chatMessages.map((msg, i) => (
            <div key={i} style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: 4, wordBreak: 'break-word' }}>
              <span style={{ color: msg.address === myAddr ? '#a78bfa' : '#64748b', fontWeight: 600 }}>{displayName(msg.address)}</span>: {msg.text}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendChat()}
            placeholder="Type a message…"
            maxLength={200}
            style={{ flex: 1, background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: '0.85rem', outline: 'none' }}
          />
          <button onClick={sendChat}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: 8, padding: '8px 14px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
            Send
          </button>
        </div>

        <Spinner />
      </div>
    </Center>
  )

  // ── Countdown phase ───────────────────────────────────────────────────
  if (phase === 'countdown') return (
    <Center>
      <div style={{ textAlign: 'center' }}>
        {isBotMode && <div style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '20px', padding: '6px 16px', marginBottom: '20px', color: '#a78bfa', fontSize: '0.8rem', fontWeight: 700, display: 'inline-block' }}>PRACTICE vs BOT</div>}
        <p style={{ color: '#64748b', fontFamily: 'Orbitron, sans-serif', marginBottom: '16px', letterSpacing: '0.1em', fontSize: '0.85rem' }}>GAME STARTS IN</p>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(5rem,20vw,9rem)', fontWeight: 900, lineHeight: 1, background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          {countdown}
        </div>
        <p style={{ color: '#64748b', marginTop: '16px' }}>Get ready!</p>
      </div>
    </Center>
  )

  // ── Finished phase ────────────────────────────────────────────────────
  if (phase === 'finished' && gameOver) return (
    <Center>
      <div style={{ textAlign: 'center', maxWidth: '480px', width: '100%', padding: '0 16px' }}>
        <div style={{ marginBottom: '8px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" height="56" viewBox="0 -960 960 960" width="56" fill="#F19E39">
            <path d="M536.5-543.5Q560-567 560-600t-23.5-56.5Q513-680 480-680t-56.5 23.5Q400-633 400-600t23.5 56.5Q447-520 480-520t56.5-23.5ZM280-120v-80h160v-124q-49-11-87.5-41.5T296-442q-75-9-125.5-65.5T120-640v-40q0-33 23.5-56.5T200-760h80v-80h400v80h80q33 0 56.5 23.5T840-680v40q0 76-50.5 132.5T664-442q-18 46-56.5 76.5T520-324v124h160v80H280Zm0-408v-152h-80v40q0 38 22 68.5t58 43.5Zm285 93q35-35 35-85v-240H360v240q0 50 35 85t85 35q50 0 85-35Zm115-93q36-13 58-43.5t22-68.5v-40h-80v152Zm-200-52Z"/>
          </svg>
        </div>
        <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(1.2rem,4vw,1.6rem)', fontWeight: 900, background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '4px' }}>
          {gameOver.winner === myAddr ? 'You Won!' : `${displayName(gameOver.winner)} Wins!`}
        </h1>
        {!isBotMode && (
          <>
            <p style={{ color: gameOver.winner === myAddr ? '#22c55e' : '#94a3b8', fontWeight: 700, fontSize: '1.1rem', marginBottom: '12px' }}>
              {gameOver.winner === myAddr ? `+$${gameOver.pot} USDT` : 'Better luck next time'}
            </p>
            {/* Payout status — fully transparent */}
            {gameOver.payoutMode === 'escrow' && gameOver.claimSig ? (
              gameOver.winner === myAddr ? (
                <div style={{ marginBottom: '20px' }}>
                  {claimState === 'done' ? (
                    <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.82rem', color: '#86efac' }}>
                      ✅ ${gameOver.pot} USDT claimed to your wallet!
                      <br /><span style={{ color: '#475569' }}>Winner: 85% of pot · Platform fee: 15% (covers gas)</span>
                    </div>
                  ) : (
                    <>
                      <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '8px 14px', marginBottom: '10px', fontSize: '0.78rem', color: '#86efac' }}>
                        🏆 You won <strong>${gameOver.pot} USDT</strong>! Click below to claim it to your wallet.
                        <br /><span style={{ color: '#475569' }}>You pay ~$0.01 gas · Winner: 85% · Platform: 15%</span>
                      </div>
                      <button onClick={handleClaim} disabled={claimState === 'pending'}
                        style={{ width: '100%', background: claimState === 'pending' ? '#1e1e30' : 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: '10px', padding: '14px', color: claimState === 'pending' ? '#64748b' : '#fff', fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.95rem', cursor: claimState === 'pending' ? 'not-allowed' : 'pointer', marginBottom: '6px' }}>
                        {claimState === 'pending' ? 'Confirm in wallet…' : `Claim $${gameOver.pot} USDT →`}
                      </button>
                      {claimState === 'error' && <p style={{ color: '#ef4444', fontSize: '0.78rem', margin: 0 }}>Transaction failed — please try again.</p>}
                    </>
                  )}
                </div>
              ) : (
                <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '8px 14px', marginBottom: '20px', fontSize: '0.78rem', color: '#86efac' }}>
                  🏆 Winner is claiming ${gameOver.pot} USDT from the smart contract.
                  <br /><span style={{ color: '#475569' }}>Funds locked in escrow — auto-released on claim</span>
                </div>
              )
            ) : !isBotMode && (
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '8px 14px', marginBottom: '20px', fontSize: '0.78rem', color: '#fcd34d' }}>
                ⏳ Team will manually send ${gameOver.pot} USDT to winner within 24h.
                <br /><span style={{ color: '#475569' }}>Winner receives 85% of the pot. 15% platform fee.</span>
              </div>
            )}
          </>
        )}
        {isBotMode && <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '0.9rem' }}>Practice complete — play for real to win USDT</p>}
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
          {gameOver.scores.map((p, i) => (
            <div key={p.address} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: i < gameOver.scores.length - 1 ? '1px solid #0d0d14' : 'none', background: p.address === myAddr ? 'rgba(124,58,237,0.08)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, color: i === 0 ? '#f59e0b' : '#64748b', width: '24px', fontSize: '0.9rem' }}>#{p.rank}</span>
                <img src={getAvatarUrl(p.address)} alt="avatar" width={32} height={32} style={{ borderRadius: '50%', border: `2px solid ${getAvatarColor(p.address)}`, background: '#1e1e30', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: p.address === myAddr ? '#a78bfa' : '#e2e8f0', fontSize: '0.9rem' }}>
                  {displayName(p.address)}{p.address === myAddr && ' (you)'}
                </span>
              </div>
              <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, color: i === 0 ? '#f59e0b' : '#94a3b8' }}>{p.score}/{question?.total ?? TOTAL_BOT_ROUNDS}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {isBotMode
            ? <button onClick={() => navigate('/game/practice', { state: { bot: true, entry: 0 } })} style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '10px', padding: '12px 24px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem' }}>Play Again</button>
            : <button onClick={() => navigate(`/lobby/${gameMode}`)} style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '10px', padding: '12px 24px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem' }}>Play Again</button>
          }
          <button onClick={() => navigate('/')} style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '10px', padding: '12px 24px', color: '#94a3b8', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
            {isBotMode ? 'Play for Real →' : 'Home'}
          </button>
        </div>
      </div>
    </Center>
  )

  // ── Playing / Round end ───────────────────────────────────────────────
  const isSealedGame  = question?.type === 'sealed'
  const isGridGame    = question?.type === 'grid'
  const isPatternGame = question?.type === 'pattern'
  const isBluffGame   = question?.type === 'bluff'
  const isMathGame    = !question || (question.type === 'math')

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '20px 16px' }}>

      {/* floatUp keyframe */}
      <style>{`@keyframes floatUp { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(-200px);opacity:0} }`}</style>

      {/* Floating reactions */}
      <div style={{ position: 'fixed', bottom: 80, left: 0, right: 0, pointerEvents: 'none', zIndex: 50 }}>
        {floatingReactions.map(r => (
          <div key={r.id} style={{ position: 'absolute', left: `${r.x}%`, animation: 'floatUp 3s ease-out forwards', fontSize: '1.6rem', userSelect: 'none' }}>
            <div>{r.emoji}</div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', textAlign: 'center', marginTop: 2 }}>{r.name}</div>
          </div>
        ))}
      </div>

      {isBotMode && (
        <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '8px', padding: '6px 14px', marginBottom: '16px', fontSize: '0.8rem', color: '#a78bfa', textAlign: 'center', fontWeight: 600 }}>
          Practice Mode — no real money
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <span style={{ fontFamily: 'Orbitron, sans-serif', color: '#64748b', fontSize: '0.7rem', letterSpacing: '0.1em' }}>
            {isBotMode ? 'PRACTICE' : `ROOM ${roomCode}`}
          </span>
          {question && <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, marginTop: '2px', fontSize: '0.9rem' }}>Round {question.round}/{question.total}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {phase === 'playing' && !isSealedGame && !isBluffGame && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(1.8rem,6vw,2.8rem)', fontWeight: 900, color: timerColor, lineHeight: 1 }}>{timeLeft}</div>
              <div style={{ fontSize: '0.6rem', color: '#64748b', letterSpacing: '0.1em' }}>SEC</div>
            </div>
          )}
          {!isBotMode && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.9rem' }}>💵 ${(entryFee * players.length * 0.85).toFixed(2)}</p>
              <p style={{ color: '#64748b', fontSize: '0.78rem' }}>pot</p>
            </div>
          )}
          {/* Help button */}
          <button onClick={() => setShowHelp(h => !h)}
            style={{ background: showHelp ? 'rgba(124,58,237,0.2)' : '#12121a', border: `1px solid ${showHelp ? '#7c3aed' : '#1e1e30'}`, borderRadius: '8px', padding: '6px 12px', color: '#a78bfa', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
            ?
          </button>
        </div>
      </div>

      {/* Help panel */}
      {showHelp && (
        <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.72rem', color: '#a78bfa', letterSpacing: '0.1em', marginBottom: '10px' }}>{help.title.toUpperCase()}</p>
          <ul style={{ paddingLeft: '16px', color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.7, margin: 0 }}>
            {help.rules.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {/* Timer bar */}
      {phase === 'playing' && !isSealedGame && (
        <div style={{ height: '4px', background: '#1e1e30', borderRadius: '2px', marginBottom: '20px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(timeLeft / roundTimeS) * 100}%`, background: timerColor, borderRadius: '2px', transition: 'width 1s linear, background 0.5s' }} />
        </div>
      )}

      {/* ── Question area ── */}
      {question && (
        <div style={{
          background: '#12121a',
          border: `2px solid ${feedbackColor(myPlayer, phase)}`,
          borderRadius: '16px', padding: 'clamp(20px,5vw,40px) clamp(16px,4vw,32px)',
          textAlign: 'center', marginBottom: '18px', transition: 'border-color 0.2s',
        }}>

          {/* ── MATH ── */}
          {isMathGame && question.a !== undefined && (
            <>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(2rem,8vw,4.5rem)', fontWeight: 900, marginBottom: '24px', color: '#e2e8f0' }}>
                {question.a} {question.op === '*' ? '×' : question.op} {question.b} = ?
              </div>
              {phase === 'round_end' ? (
                <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.1rem', color: '#f59e0b' }}>Answer: <strong>{roundAnswer}</strong></p>
              ) : (
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', maxWidth: '300px', margin: '0 auto' }}>
                  <input ref={inputRef} type="number" value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleMathSubmit()}
                    disabled={!!myPlayer?.answered}
                    placeholder={myPlayer?.answered ? 'Submitted ✓' : 'Your answer'}
                    style={{ flex: 1, background: '#0a0a0f', border: `2px solid ${myPlayer?.correct === true ? '#22c55e' : myPlayer?.correct === false ? '#ef4444' : '#2a2a40'}`, borderRadius: '10px', padding: '12px 14px', color: '#e2e8f0', fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(1rem,4vw,1.3rem)', textAlign: 'center', outline: 'none' }} />
                  <button onClick={handleMathSubmit} disabled={!!myPlayer?.answered}
                    style={{ background: myPlayer?.answered ? '#1e1e30' : 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '10px', padding: '12px 20px', color: myPlayer?.answered ? '#64748b' : '#fff', fontWeight: 700, cursor: myPlayer?.answered ? 'not-allowed' : 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem' }}>
                    {myPlayer?.answered ? (myPlayer.correct ? '✓' : '✗') : 'GO'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── PATTERN MEMORY ── */}
          {isPatternGame && (() => {
            const gs = question.gridSize ?? 4
            const pat = question.pattern ?? []
            const canClick = phase === 'playing' && !patternVisible && !myPlayer?.answered
            const cellSize = gs >= 6 ? 52 : gs === 5 ? 62 : 72
            const gap = gs >= 6 ? 6 : 8
            return (
              <>
                <p style={{ color: '#64748b', fontSize: '0.78rem', letterSpacing: '0.1em', fontFamily: 'Orbitron, sans-serif', marginBottom: '16px' }}>
                  {phase === 'round_end' ? 'ROUND OVER' : patternVisible
                    ? <span style={{ color: '#a855f7', fontWeight: 700 }}>MEMORIZE {pat.length} TILES!</span>
                    : myPlayer?.answered ? 'SUBMITTED'
                    : <span>{selectedTiles.length} / {pat.length} selected</span>}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gs}, ${cellSize}px)`, gap: `${gap}px`, margin: '0 auto 20px', width: 'fit-content' }}>
                  {Array.from({ length: gs * gs }, (_, i) => {
                    const inPat = pat.includes(i)
                    const inSel = selectedTiles.includes(i)
                    let bg = '#151525', border = '1px solid #1e1e35', shadow = 'none', scale = '1'
                    if (phase === 'round_end') {
                      if (inPat && inSel)  { bg = 'rgba(34,197,94,0.4)';   border = '2px solid #22c55e'; shadow = '0 0 10px rgba(34,197,94,0.4)' }
                      else if (inPat)      { bg = 'rgba(168,85,247,0.5)';  border = '2px solid #a855f7'; shadow = '0 0 10px rgba(168,85,247,0.4)' }
                      else if (inSel)      { bg = 'rgba(239,68,68,0.4)';   border = '2px solid #ef4444' }
                    } else if (patternVisible) {
                      if (inPat) { bg = 'linear-gradient(135deg,#a855f7,#7c3aed)'; border = '2px solid #c084fc'; shadow = '0 0 22px rgba(168,85,247,0.9)'; scale = '1.06' }
                    } else {
                      if (inSel) { bg = 'rgba(34,197,94,0.4)'; border = '2px solid #22c55e'; shadow = '0 0 10px rgba(34,197,94,0.3)' }
                      else if (canClick) { bg = '#1a1a2e' }
                    }
                    return (
                      <button key={i}
                        onClick={() => { if (!canClick) return; setSelectedTiles(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]) }}
                        style={{ width: `${cellSize}px`, height: `${cellSize}px`, borderRadius: '8px', background: bg, border, boxShadow: shadow, cursor: canClick ? 'pointer' : 'default', transition: 'all 0.15s', transform: `scale(${scale})` }}
                      />
                    )
                  })}
                </div>
                {phase !== 'round_end' && !patternVisible && (
                  <button onClick={handlePatternSubmit} disabled={!!myPlayer?.answered || selectedTiles.length === 0}
                    style={{ background: myPlayer?.answered ? '#1e1e30' : selectedTiles.length === 0 ? '#1e1e30' : 'linear-gradient(135deg, #a855f7, #7c3aed)', border: 'none', borderRadius: '10px', padding: '12px 32px', color: myPlayer?.answered || selectedTiles.length === 0 ? '#64748b' : '#fff', fontWeight: 700, cursor: myPlayer?.answered || selectedTiles.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem' }}>
                    {myPlayer?.answered ? (myPlayer.correct ? '✓ CORRECT' : '✗ WRONG') : `SUBMIT (${selectedTiles.length} / ${pat.length})`}
                  </button>
                )}
              </>
            )
          })()}

          {/* ── GRID ── */}
          {isGridGame && (
            <>
              <p style={{ color: '#64748b', fontSize: '0.78rem', letterSpacing: '0.1em', fontFamily: 'Orbitron, sans-serif', marginBottom: '16px' }}>
                {phase === 'round_end' ? 'ROUND OVER' : 'CLICK THE HIGHLIGHTED CELL'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', maxWidth: '280px', margin: '0 auto' }}>
                {Array.from({ length: 16 }, (_, i) => {
                  const isTarget  = i === question.target
                  const wasTarget = phase === 'round_end' && i === question.target
                  const clicked   = selectedCell === i
                  return (
                    <button key={i}
                      onClick={() => phase === 'playing' && !myPlayer?.answered && handleGridClick(i)}
                      style={{
                        aspectRatio: '1', borderRadius: '10px',
                        cursor: phase === 'playing' && !myPlayer?.answered ? 'pointer' : 'default',
                        background: wasTarget ? 'rgba(34,197,94,0.3)' : (isTarget && phase === 'playing') ? `rgba(124,58,237,0.8)` : clicked ? 'rgba(239,68,68,0.3)' : '#1e1e30',
                        boxShadow: (isTarget && phase === 'playing') ? '0 0 20px rgba(124,58,237,0.6)' : 'none',
                        transition: 'all 0.1s',
                        border: wasTarget ? '2px solid #22c55e' : (isTarget && phase === 'playing') ? '2px solid #7c3aed' : '1px solid #2a2a40',
                      }}
                    />
                  )
                })}
              </div>
              {myPlayer?.answered && phase === 'playing' && (
                <p style={{ color: myPlayer.correct ? '#22c55e' : '#ef4444', marginTop: '12px', fontWeight: 600 }}>
                  {myPlayer.correct ? '✓ Hit!' : '✗ Missed'}
                </p>
              )}
            </>
          )}

          {/* ── LIAR'S DICE (BLUFF) ── */}
          {isBluffGame && (
            <>
              <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.72rem', color: '#64748b', letterSpacing: '0.1em', marginBottom: '14px' }}>
                {phase === 'round_end' ? 'ALL DICE REVEALED' : bluffTurnOrder[bluffTurnIdx] === myAddr ? '🎲 YOUR TURN' : `⏳ ${displayName(bluffTurnOrder[bluffTurnIdx] ?? '')} IS THINKING…`}
              </p>

              {/* My dice */}
              <div style={{ marginBottom: '14px' }}>
                <p style={{ color: '#64748b', fontSize: '0.65rem', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em', marginBottom: '8px' }}>YOUR DICE</p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  {(phase === 'round_end' && bluffResult ? bluffResult.allDice[myAddr] ?? bluffMyDice : bluffMyDice).map((d, i) => (
                    <DiceFace key={i} value={d} size={52} color="#a855f7" />
                  ))}
                </div>
              </div>

              {/* Opponents dice — only shown at round end */}
              {phase === 'round_end' && bluffResult && Object.entries(bluffResult.allDice).filter(([a]) => a !== myAddr).map(([addr, dice]) => (
                <div key={addr} style={{ marginBottom: '14px' }}>
                  <p style={{ color: '#64748b', fontSize: '0.65rem', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em', marginBottom: '8px' }}>{displayName(addr).toUpperCase()}'S DICE</p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    {dice.map((d, i) => <DiceFace key={i} value={d} size={52} color="#f97316" />)}
                  </div>
                </div>
              ))}

              {/* Current bid display */}
              <div style={{ background: bluffBid ? 'rgba(249,115,22,0.08)' : '#0a0a0f', border: `1px solid ${bluffBid ? 'rgba(249,115,22,0.35)' : '#1e1e30'}`, borderRadius: '10px', padding: '12px 20px', marginBottom: '14px', textAlign: 'center' }}>
                {bluffBid ? (
                  <>
                    <p style={{ color: '#64748b', fontSize: '0.65rem', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em', marginBottom: '4px' }}>CURRENT BID</p>
                    <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, color: '#f97316', fontSize: '1.4rem', marginBottom: '4px' }}>
                      {bluffBid.count} × <DiceFace value={bluffBid.face} size={32} color="#f97316" style={{ display: 'inline-block', verticalAlign: 'middle' } as React.CSSProperties} />
                    </p>
                    <p style={{ color: '#64748b', fontSize: '0.72rem' }}>
                      "At least {bluffBid.count} die/dice showing {bluffBid.face}" — {displayName(bluffBid.bidder)}
                    </p>
                    {phase === 'round_end' && bluffResult?.bid && (
                      <p style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '8px' }}>
                        Actual {bluffResult.bid.face}s across all dice:&nbsp;
                        <strong style={{ color: (bluffResult.actualCount ?? 0) >= bluffResult.bid.count ? '#22c55e' : '#ef4444' }}>
                          {bluffResult.actualCount}
                        </strong>
                        {' '}— {(bluffResult.actualCount ?? 0) >= bluffResult.bid.count ? '✓ bid was honest' : '✗ bid was a BLUFF'}
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{ color: '#475569', fontSize: '0.88rem' }}>No bid yet — make the opening bid!</p>
                )}
              </div>

              {/* Round result */}
              {phase === 'round_end' && bluffResult && (
                <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.92rem', fontWeight: 700, color: bluffResult.winner ? '#22c55e' : '#f59e0b', marginBottom: '10px', textAlign: 'center' }}>
                  {bluffResult.winner ? `${displayName(bluffResult.winner)} wins this round!` : 'No winner — no bid made'}
                </p>
              )}

              {/* Bid controls — player's turn only */}
              {phase === 'playing' && bluffTurnOrder[bluffTurnIdx] === myAddr && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: '#64748b', fontSize: '0.65rem', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' }}>COUNT</span>
                      <input type="number" min={1} max={6} value={bluffBidCount}
                        onChange={e => setBluffBidCount(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
                        style={{ width: '68px', background: '#0a0a0f', border: '2px solid #2a2a40', borderRadius: '8px', padding: '10px', color: '#e2e8f0', fontFamily: 'Orbitron, sans-serif', fontSize: '1.3rem', textAlign: 'center', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: '#64748b', fontSize: '0.65rem', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em' }}>FACE VALUE</span>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {[1,2,3,4,5,6].map(f => (
                          <button key={f} onClick={() => setBluffBidFace(f)}
                            style={{ padding: '3px', background: bluffBidFace === f ? 'rgba(249,115,22,0.2)' : '#0a0a0f', border: `2px solid ${bluffBidFace === f ? '#f97316' : '#2a2a40'}`, borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s' }}>
                            <DiceFace value={f} size={34} color={bluffBidFace === f ? '#f97316' : '#475569'} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {bluffBid && (() => {
                    const ok = bluffBidCount > bluffBid.count || (bluffBidCount === bluffBid.count && bluffBidFace > bluffBid.face)
                    return !ok ? <p style={{ color: '#ef4444', fontSize: '0.74rem', textAlign: 'center' }}>Must be higher than {bluffBid.count}×{bluffBid.face}</p> : null
                  })()}
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button onClick={() => isBotMode ? handleBotPlayerBid(question!) : handlePlayerBid()}
                      style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', border: 'none', borderRadius: '10px', padding: '12px 28px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem' }}>
                      BID
                    </button>
                    {bluffBid && (
                      <button onClick={() => isBotMode ? handleBotPlayerChallenge(question!) : handlePlayerChallenge()}
                        style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none', borderRadius: '10px', padding: '12px 28px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem' }}>
                        CALL LIAR! 🫵
                      </button>
                    )}
                  </div>
                  {bluffError && <p style={{ color: '#ef4444', fontSize: '0.78rem', textAlign: 'center' }}>{bluffError}</p>}
                </div>
              )}
              {phase === 'playing' && bluffTurnOrder[bluffTurnIdx] !== myAddr && (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '16px', fontSize: '0.88rem' }}>
                  {isBotMode ? '🤔 Bot is thinking…' : `Waiting for ${displayName(bluffTurnOrder[bluffTurnIdx] ?? '')}…`}
                </div>
              )}
            </>
          )}

          {/* ── SEALED BID ── */}
          {isSealedGame && (
            <>
              <p style={{ color: '#64748b', fontSize: '0.78rem', letterSpacing: '0.1em', fontFamily: 'Orbitron, sans-serif', marginBottom: '8px' }}>
                {gameMode === 'highest-unique' ? 'PICK THE HIGHEST UNIQUE NUMBER' :
                 gameMode === 'lowest-unique'  ? 'PICK THE LOWEST UNIQUE NUMBER' :
                                                 'PICK A NUMBER'}
              </p>
              <p style={{ color: '#475569', fontSize: '0.8rem', marginBottom: '20px' }}>
                Range: {question.min}–{question.max} · {sealedCount}/{players.length} submitted
              </p>

              {/* Sealed timer */}
              {phase === 'playing' && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginBottom: '4px' }}>
                    <span>Time left</span><span style={{ color: timerColor }}>{timeLeft}s</span>
                  </div>
                  <div style={{ height: '4px', background: '#1e1e30', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(timeLeft / roundTimeS) * 100}%`, background: timerColor, borderRadius: '2px', transition: 'width 1s linear' }} />
                  </div>
                </div>
              )}

              {phase === 'round_end' && sealedResult ? (
                <div>
                  {sealedResult.picks && (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
                      {sealedResult.picks.map(p => (
                        <span key={p.address} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700, background: p.address === sealedResult.winnerAddress ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.1)', color: p.address === sealedResult.winnerAddress ? '#22c55e' : '#94a3b8', border: `1px solid ${p.address === sealedResult.winnerAddress ? 'rgba(34,197,94,0.3)' : '#1e1e30'}` }}>
                          {displayName(p.address)}: {p.pick}
                        </span>
                      ))}
                    </div>
                  )}
                  <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', color: sealedResult.winnerAddress ? '#22c55e' : '#f59e0b' }}>
                    {sealedResult.winnerAddress
                      ? `${displayName(sealedResult.winnerAddress)} scores!`
                      : (sealedResult.reason || 'No unique picks — no point')}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  {myPlayer?.answered ? (
                    <div style={{ padding: '16px 32px', background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '12px', color: '#a78bfa', fontWeight: 700, fontSize: '1rem', fontFamily: 'Orbitron, sans-serif' }}>
                      Submitted — waiting for others…
                    </div>
                  ) : (
                    <>
                      <input type="number" value={input} onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSealedSubmit()}
                        min={question.min} max={question.max}
                        placeholder={`Pick ${question.min}–${question.max}`}
                        style={{ background: '#0a0a0f', border: '2px solid #2a2a40', borderRadius: '10px', padding: '14px 20px', color: '#e2e8f0', fontFamily: 'Orbitron, sans-serif', fontSize: '1.4rem', textAlign: 'center', outline: 'none', width: '180px' }} />
                      <button onClick={handleSealedSubmit}
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '10px', padding: '12px 32px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.95rem' }}>
                        Lock In
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Scoreboard */}
      <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '10px 18px', borderBottom: '1px solid #1e1e30', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.68rem', color: '#64748b', letterSpacing: '0.1em' }}>SCOREBOARD</span>
          {isBotMode && botThinking && <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Bot thinking…</span>}
        </div>
        {sortedPlayers.map((p, i) => (
          <div key={p.address} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: i < sortedPlayers.length - 1 ? '1px solid #0d0d14' : 'none', background: p.address === myAddr ? 'rgba(124,58,237,0.06)' : 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#64748b', fontSize: '0.78rem', width: '18px' }}>#{i + 1}</span>
              <img src={getAvatarUrl(p.address)} alt="avatar" width={28} height={28} style={{ borderRadius: '50%', border: `2px solid ${getAvatarColor(p.address)}`, background: '#1e1e30', flexShrink: 0 }} />
              <span style={{ fontWeight: 600, color: p.address === myAddr ? '#a78bfa' : '#94a3b8', fontSize: '0.88rem' }}>
                {displayName(p.address)}{p.address === myAddr && ' (you)'}
              </span>
              {p.answered && !isSealedGame && <span style={{ fontSize: '0.8rem', color: p.correct ? '#22c55e' : '#ef4444' }}>{p.correct ? '✓' : '✗'}</span>}
              {p.answered && isSealedGame && <span style={{ fontSize: '0.75rem', color: '#a78bfa' }}>✓</span>}
            </div>
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, color: i === 0 ? '#f59e0b' : '#e2e8f0', fontSize: '0.9rem' }}>{p.score}</span>
          </div>
        ))}
      </div>

      {/* Disconnect banner */}
      {disconnectBanner}

      {/* Emoji bar */}
      {emojiBar}

      {!isSealedGame && !isGridGame && !isBluffGame && (
        <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.78rem', marginTop: '10px' }}>
          {isPatternGame
            ? 'Tiles flash for 3 seconds — tap from memory then submit'
            : <>Press <kbd style={{ background: '#1e1e30', borderRadius: '4px', padding: '1px 5px', fontSize: '0.72rem' }}>Enter</kbd> to submit</>
          }
        </p>
      )}
    </div>
  )
}

function DiceFace({ value, size = 48, color = '#e2e8f0', style }: { value: number; size?: number; color?: string; style?: React.CSSProperties }) {
  const dots: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
  }
  const positions = dots[value] ?? dots[1]
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={style}>
      <rect x="4" y="4" width="92" height="92" rx="16" fill="#12121a" stroke={color} strokeWidth="3"/>
      {positions.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="9" fill={color}/>)}
    </svg>
  )
}

function feedbackColor(p: PlayerState | undefined, phase: Phase) {
  if (phase === 'round_end') return '#1e1e30'
  if (p?.correct === true) return '#22c55e'
  if (p?.correct === false) return '#ef4444'
  return '#1e1e30'
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
      <div style={{ width: '26px', height: '26px', border: '3px solid #1e1e30', borderTop: '3px solid #7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
