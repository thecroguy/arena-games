import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { connectSocket } from '../utils/socket'
import { getAvatarUrl, getAvatarColor } from '../utils/avatar'
import { getUsername } from '../utils/profile'

// ── Types ──────────────────────────────────────────────────────────────────
type Phase = 'waiting' | 'countdown' | 'playing' | 'round_end' | 'finished' | 'abandoned'

interface PlayerState { address: string; score: number; answered?: boolean; correct?: boolean | null }

interface Question {
  round: number; total: number; timeMs: number
  type?: 'math' | 'word' | 'grid' | 'sealed'
  // math
  a?: number; b?: number; op?: string
  // word
  scrambled?: string
  // grid
  target?: number; gridSize?: number
  // sealed
  min?: number; max?: number; gameMode?: string
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

function displayName(addr: string): string {
  if (addr === BOT_ADDR) return 'Bot'
  if (addr === 'YOU') return 'You'
  return getUsername(addr)
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

const BOT_WORDS = ['arena','blitz','pixel','react','speed','craft','flame','storm','swift','brave','sharp','logic','quest','burst','vivid','nexus','pulse','valor','flash','cyber']
function makeWordQ(round: number): Question {
  const word = BOT_WORDS[Math.floor(Math.random() * BOT_WORDS.length)]
  const arr = word.split(''); let s = [...arr]
  for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[s[i], s[j]] = [s[j], s[i]] }
  const scrambled = s.join('') === word ? s.reverse().join('') : s.join('')
  return { round, total: TOTAL_BOT_ROUNDS, scrambled, type: 'word', timeMs: 15000, _word: word } as Question & { _word: string }
}

function makeGridQ(round: number): Question {
  return { round, total: TOTAL_BOT_ROUNDS, target: Math.floor(Math.random() * 16), gridSize: 16, type: 'grid', timeMs: 8000 }
}

function makeSealedQ(round: number, gm: string): Question {
  const max = gm === 'number-rush' ? 50 : 20
  return { round, total: TOTAL_BOT_ROUNDS, min: 1, max, type: 'sealed', gameMode: gm, timeMs: 20000 }
}

const SEALED_GAMES = ['highest-unique', 'lowest-unique', 'number-rush']

const REACTION_EMOJIS = ['😭','💀','🔥','😂','🤯','👀','🫡','😤']

// ── Game help text ─────────────────────────────────────────────────────────
const GAME_HELP: Record<string, { title: string; rules: string[] }> = {
  'math-arena':     { title: 'Math Arena',     rules: ['A math equation appears each round.', 'Type the correct answer and press Enter or GO.', 'First player to answer correctly scores a point.', '10 rounds — most points wins the pot.'] },
  'word-blitz':     { title: 'Word Blitz',     rules: ['A scrambled word appears each round.', 'Type the unscrambled word and press Enter.', 'First correct answer scores a point.', '10 rounds — most points wins the pot.'] },
  'reaction-grid':  { title: 'Reaction Grid',  rules: ['A 4×4 grid appears — one cell lights up.', 'Click the highlighted cell as fast as possible.', 'First click wins the round point.', '15 rounds — most points wins the pot.'] },
  'highest-unique': { title: 'Highest Unique', rules: ['Pick any number 1–100 each round.', 'The player with the highest UNIQUE number scores.', 'If two players pick the same number, both lose.', '8 rounds — most round wins takes the pot.'] },
  'lowest-unique':  { title: 'Lowest Unique',  rules: ['Pick any number 1–50 each round.', 'The player with the lowest UNIQUE number scores.', 'If two players pick the same number, both lose.', '8 rounds — most round wins takes the pot.'] },
  'number-rush':    { title: 'Number Rush',    rules: ['Pick any number 1–50 each round.', 'The rarest pick (fewest duplicates) wins.', 'Ties go to the lowest number.', '8 rounds — most round wins takes the pot.'] },
}

// ── Component ──────────────────────────────────────────────────────────────
export default function Game() {
  const { roomCode }  = useParams<{ roomCode: string }>()
  const location      = useLocation()
  const navigate      = useNavigate()
  const { address }   = useAccount()

  const isBotMode  = location.state?.bot === true
  const isHost     = location.state?.host    ?? false
  const entryFee   = location.state?.entry   ?? 1
  const gameModeLS = location.state?.gameMode ?? 'math-arena'
  const myAddr     = isBotMode ? (address || 'YOU') : (address ?? '')

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
    winner: string; pot: string;
    scores: Array<{ address: string; score: number; rank: number }>
  } | null>(null)
  const [error, setError]       = useState('')
  const [canStart, setCanStart] = useState(false)
  const [botThinking, setBotThinking] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [abandonReason, setAbandonReason] = useState('')
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

  // ── Auto-scroll chat ───────────────────────────────────────────────────
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

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

  function startBotRound(round: number) {
    const gm = gameMode || gameModeLS

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
    const q = gm === 'word-blitz' ? makeWordQ(round)
            : gm === 'reaction-grid' ? makeGridQ(round)
            : makeMathQ(round)
    setQuestion(q); setPhase('playing'); setInput(''); setRoundAnswer(null); setSelectedCell(null)
    setPlayers(prev => prev.map(p => ({ ...p, answered: false, correct: null })))
    const roundSecs = gm === 'reaction-grid' ? 8 : gm === 'word-blitz' ? 15 : ROUND_TIME_S
    setTimeLeft(roundSecs)

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { clearInterval(timerRef.current!); endBotRound(q); return 0 } return t - 1 })
    }, 1000)

    // Bot reaction delay — faster for grid, slower for words
    const delay = gm === 'reaction-grid'
      ? 300 + Math.random() * 900
      : gm === 'word-blitz'
        ? 3000 + Math.random() * 7000
        : 2500 + Math.random() * 5000
    setBotThinking(true)
    botRef.current = setTimeout(() => {
      setBotThinking(false)
      const accuracy = gm === 'reaction-grid' ? 0.80 : gm === 'word-blitz' ? 0.60 : 0.70
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
    const ans = q.type === 'word' ? (q as Question & { _word?: string })._word ?? ''
              : q.type === 'grid' ? String(q.target ?? '')
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
        // same → no winner
        winnerAddress = null
      } else if (gm === 'highest-unique') {
        winnerAddress = playerPick > botPick ? myAddr : BOT_ADDR
      } else if (gm === 'lowest-unique') {
        winnerAddress = playerPick < botPick ? myAddr : BOT_ADDR
      } else {
        // number-rush: lower pick wins (both unique, tiebreak lowest)
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
    if (question.type === 'word') {
      correct = input.trim().toLowerCase() === ((question as Question & { _word?: string })._word ?? '').toLowerCase()
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
    connectSocket().emit('chat:send', { code: roomCode, text })
    setChatInput('')
  }

  // ── Multiplayer socket setup ──────────────────────────────────────────
  useEffect(() => {
    if (isBotMode) return
    const socket = connectSocket()

    if (myAddr) {
      socket.emit('room:join', { code: roomCode, address: myAddr }, (res: { ok?: boolean; error?: string; room?: { players: PlayerState[]; gameMode?: string } }) => {
        if (res.error && res.error !== 'Already in room') setError(res.error)
        if (res.room) { setPlayers(res.room.players); if (res.room.gameMode) setGameMode(res.room.gameMode) }
      })
    }

    socket.on('room:update', (room: { players: PlayerState[]; status: string; gameMode?: string }) => {
      setPlayers(room.players)
      if (room.gameMode) setGameMode(room.gameMode)
      setCanStart(room.players.length >= 2 && room.status === 'waiting')
    })
    socket.on('game:countdown', (n: number) => { setPhase('countdown'); setCountdown(n) })
    socket.on('game:question', (q: Question) => {
      setPhase('playing'); setQuestion(q); setInput(''); setRoundAnswer(null)
      setSealedResult(null); setSealedCount(0); setSelectedCell(null)
      setPlayers(prev => prev.map(p => ({ ...p, answered: false, correct: null })))
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
    socket.on('game:round_end', (data: { answer: string | null; scores: PlayerState[]; sealedResult?: SealedResult }) => {
      if (timerRef.current) clearInterval(timerRef.current)
      setPhase('round_end'); setRoundAnswer(data.answer); setPlayers(data.scores)
      if (data.sealedResult) setSealedResult(data.sealedResult)
    })
    socket.on('game:over', (data: { winner: string; pot: string; scores: Array<{ address: string; score: number; rank: number }> }) => {
      if (timerRef.current) clearInterval(timerRef.current)
      localStorage.removeItem('ag_active_room')
      setPhase('finished'); setGameOver(data)
    })
    socket.on('game:player_left', (data: { address: string }) => {
      setPlayers(prev => prev.filter(p => p.address !== data.address))
    })
    socket.on('game:abandoned', (data: { reason: string }) => {
      if (timerRef.current) clearInterval(timerRef.current)
      localStorage.removeItem('ag_active_room')
      setAbandonReason(data.reason)
      setPhase('abandoned')
    })
    socket.on('reaction:message', ({ address, emoji }: { address: string; emoji: string }) => {
      spawnReaction(emoji, displayName(address))
    })
    socket.on('chat:message', (msg: { address: string; text: string; ts: number }) => {
      setChatMessages(prev => [...prev.slice(-49), msg])
    })

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      socket.off('room:update'); socket.off('game:countdown'); socket.off('game:question')
      socket.off('game:player_answered'); socket.off('game:sealed_submitted')
      socket.off('game:round_end'); socket.off('game:over')
      socket.off('game:player_left'); socket.off('game:abandoned')
      socket.off('reaction:message')
      socket.off('chat:message')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, myAddr])

  function handleStart() { connectSocket().emit('room:start', { code: roomCode }) }

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

  function handleWordSubmit() {
    if (!input.trim()) return
    submitAnswer(input.trim())
    setInput('')
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
        <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '0.95rem' }}>{abandonReason || 'A player disconnected.'}</p>
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
            </div>
          ))}
        </div>
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '10px', padding: '12px 18px', marginBottom: '20px', fontSize: '0.85rem', color: '#64748b' }}>
          Share code <strong style={{ color: '#a78bfa', fontFamily: 'Orbitron, sans-serif' }}>{roomCode}</strong> with friends
        </div>
        {error && <p style={{ color: '#ef4444', marginBottom: '12px', fontSize: '0.9rem' }}>{error}</p>}
        {isHost && canStart && (
          <button onClick={handleStart} style={{ width: '100%', background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '10px', padding: '14px', color: '#fff', fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', letterSpacing: '0.05em' }}>
            Start Game
          </button>
        )}
        {isHost && !canStart && <p style={{ color: '#f59e0b', fontSize: '0.85rem' }}>Need at least 2 players to start</p>}

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
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="8" r="6"/>
            <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/>
          </svg>
        </div>
        <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(1.2rem,4vw,1.6rem)', fontWeight: 900, background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '4px' }}>
          {gameOver.winner === myAddr ? 'You Won!' : `${displayName(gameOver.winner)} Wins!`}
        </h1>
        {!isBotMode && (
          <p style={{ color: gameOver.winner === myAddr ? '#22c55e' : '#94a3b8', fontWeight: 700, fontSize: '1.1rem', marginBottom: '24px' }}>
            {gameOver.winner === myAddr ? `+$${gameOver.pot} USDT` : 'Better luck next time'}
          </p>
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
  const isSealedGame = question?.type === 'sealed'
  const isGridGame   = question?.type === 'grid'
  const isWordGame   = question?.type === 'word'
  const isMathGame   = !question || question.type === 'math'

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
          {phase === 'playing' && !isSealedGame && (
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

          {/* ── WORD ── */}
          {isWordGame && (
            <>
              <p style={{ color: '#64748b', fontSize: '0.78rem', letterSpacing: '0.1em', fontFamily: 'Orbitron, sans-serif', marginBottom: '12px' }}>UNSCRAMBLE</p>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(1.8rem,7vw,3.5rem)', fontWeight: 900, marginBottom: '24px', color: '#06b6d4', letterSpacing: '0.3em' }}>
                {question.scrambled}
              </div>
              {phase === 'round_end' ? (
                <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.1rem', color: '#f59e0b' }}>Answer: <strong>{roundAnswer}</strong></p>
              ) : (
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', maxWidth: '360px', margin: '0 auto' }}>
                  <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleWordSubmit()}
                    disabled={!!myPlayer?.answered}
                    placeholder={myPlayer?.answered ? 'Submitted ✓' : 'Type the word'}
                    maxLength={20}
                    style={{ flex: 1, background: '#0a0a0f', border: `2px solid ${myPlayer?.correct === true ? '#22c55e' : myPlayer?.correct === false ? '#ef4444' : '#2a2a40'}`, borderRadius: '10px', padding: '12px 14px', color: '#e2e8f0', fontFamily: 'Orbitron, sans-serif', fontSize: '1.1rem', textAlign: 'center', outline: 'none', textTransform: 'lowercase' }} />
                  <button onClick={handleWordSubmit} disabled={!!myPlayer?.answered}
                    style={{ background: myPlayer?.answered ? '#1e1e30' : 'linear-gradient(135deg, #06b6d4, #7c3aed)', border: 'none', borderRadius: '10px', padding: '12px 20px', color: myPlayer?.answered ? '#64748b' : '#fff', fontWeight: 700, cursor: myPlayer?.answered ? 'not-allowed' : 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem' }}>
                    {myPlayer?.answered ? (myPlayer.correct ? '✓' : '✗') : 'GO'}
                  </button>
                </div>
              )}
            </>
          )}

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

          {/* ── SEALED BID ── */}
          {isSealedGame && (
            <>
              <p style={{ color: '#64748b', fontSize: '0.78rem', letterSpacing: '0.1em', fontFamily: 'Orbitron, sans-serif', marginBottom: '8px' }}>
                {gameMode === 'highest-unique' ? 'PICK THE HIGHEST UNIQUE NUMBER' :
                 gameMode === 'lowest-unique'  ? 'PICK THE LOWEST UNIQUE NUMBER' :
                                                 'PICK THE RAREST NUMBER'}
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

      {/* Emoji bar */}
      {emojiBar}

      {!isSealedGame && !isGridGame && (
        <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.78rem', marginTop: '10px' }}>
          Press <kbd style={{ background: '#1e1e30', borderRadius: '4px', padding: '1px 5px', fontSize: '0.72rem' }}>Enter</kbd> to submit
        </p>
      )}
    </div>
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
