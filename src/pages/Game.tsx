import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { connectSocket } from '../utils/socket'
import { getAvatarUrl, getAvatarColor } from '../utils/avatar'
import { getUsername } from '../utils/profile'

// ── Types ──────────────────────────────────────────────────────────────────
type Phase = 'waiting' | 'countdown' | 'playing' | 'round_end' | 'finished'

interface PlayerState {
  address: string
  score: number
  answered?: boolean
  correct?: boolean | null
}

interface Question {
  round: number
  total: number
  a: number
  b: number
  op: string
  timeMs: number
}

// ── Helpers ────────────────────────────────────────────────────────────────
const ROUND_TIME_S = 12
const BOT_ADDR = '0xB07B07B07B07B07B07B07B07B07B07B07B07B07B'

function displayName(addr: string): string {
  if (addr === BOT_ADDR) return '🤖 Bot'
  if (addr === 'YOU') return 'You'
  return getUsername(addr)
}
const TOTAL_BOT_ROUNDS = 10

function makeLocalQ(round: number): Question {
  const ops = ['+', '-', '*']
  const op = ops[Math.floor(Math.random() * ops.length)]
  let a: number, b: number
  if (op === '+') { a = Math.floor(Math.random() * 50) + 1; b = Math.floor(Math.random() * 50) + 1 }
  else if (op === '-') { a = Math.floor(Math.random() * 50) + 20; b = Math.floor(Math.random() * 20) + 1 }
  else { a = Math.floor(Math.random() * 12) + 1; b = Math.floor(Math.random() * 12) + 1 }
  return { round, total: TOTAL_BOT_ROUNDS, a, b, op, timeMs: ROUND_TIME_S * 1000 }
}

function solveQ(q: Question): number {
  if (q.op === '+') return q.a + q.b
  if (q.op === '-') return q.a - q.b
  return q.a * q.b
}

// ── Component ──────────────────────────────────────────────────────────────
export default function Game() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { address } = useAccount()

  const isBotMode = location.state?.bot === true
  const isHost    = location.state?.host    ?? false
  const entryFee  = location.state?.entry   ?? 1
  const myAddr    = isBotMode ? (address || 'YOU') : (address ?? '')

  // ── State ──────────────────────────────────────────────────────────────
  const [phase, setPhase]         = useState<Phase>(isBotMode ? 'countdown' : 'waiting')
  const [countdown, setCountdown] = useState(3)
  const [question, setQuestion]   = useState<Question | null>(null)
  const [players, setPlayers]     = useState<PlayerState[]>(
    isBotMode
      ? [{ address: myAddr, score: 0 }, { address: BOT_ADDR, score: 0 }]
      : myAddr ? [{ address: myAddr, score: 0 }] : []
  )
  const [timeLeft, setTimeLeft]   = useState(ROUND_TIME_S)
  const [input, setInput]         = useState('')
  const [roundAnswer, setRoundAnswer] = useState<number | null>(null)
  const [gameOver, setGameOver]   = useState<{
    winner: string; pot: string;
    scores: Array<{ address: string; score: number; rank: number }>
  } | null>(null)
  const [error, setError]         = useState('')
  const [canStart, setCanStart]   = useState(false)
  const [botThinking, setBotThinking] = useState(false)

  const inputRef   = useRef<HTMLInputElement>(null)
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const botRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scoresRef  = useRef<PlayerState[]>(players)

  useEffect(() => { scoresRef.current = players }, [players])

  // ── Bot mode ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isBotMode) return

    // Countdown 3→2→1 then start
    let n = 3
    setCountdown(n)
    const cd = setInterval(() => {
      n--
      if (n <= 0) {
        clearInterval(cd)
        startBotRound(1)
      } else {
        setCountdown(n)
      }
    }, 1000)
    return () => { clearInterval(cd); clearBotTimer() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function clearBotTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (botRef.current) clearTimeout(botRef.current)
  }

  function startBotRound(round: number) {
    const q = makeLocalQ(round)
    setQuestion(q)
    setPhase('playing')
    setInput('')
    setRoundAnswer(null)
    setBotThinking(false)
    setPlayers(prev => prev.map(p => ({ ...p, answered: false, correct: null })))
    setTimeLeft(ROUND_TIME_S)

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current!); endBotRound(q); return 0 }
        return t - 1
      })
    }, 1000)

    // Bot answers after random delay with 70% accuracy
    const delay = 2500 + Math.random() * 5000
    setBotThinking(true)
    botRef.current = setTimeout(() => {
      setBotThinking(false)
      const correct = Math.random() < 0.70
      const botAnswer = correct ? solveQ(q) : solveQ(q) + (Math.random() < 0.5 ? 1 : -1)
      setPlayers(prev => {
        const updated = prev.map(p =>
          p.address === BOT_ADDR
            ? { ...p, answered: true, correct, score: correct ? p.score + 1 : p.score }
            : p
        )
        scoresRef.current = updated
        return updated
      })
      // If player already answered, end round
      const playerDone = scoresRef.current.find(p => p.address === myAddr)?.answered
      if (playerDone) endBotRound(q)
      void botAnswer
    }, delay)

    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function endBotRound(q: Question) {
    clearBotTimer()
    setPhase('round_end')
    setRoundAnswer(solveQ(q))
    setTimeout(() => {
      const cur = scoresRef.current
      if (q.round >= q.total) {
        finishBotGame(cur)
      } else {
        startBotRound(q.round + 1)
      }
    }, 2000)
  }

  function finishBotGame(finalPlayers: PlayerState[]) {
    const sorted = [...finalPlayers].sort((a, b) => b.score - a.score)
    const winner = sorted[0].address
    setPhase('finished')
    setGameOver({
      winner,
      pot: '0.00',
      scores: sorted.map((p, i) => ({ address: p.address, score: p.score, rank: i + 1 })),
    })
  }

  function handleBotSubmit() {
    if (!question) return
    const val = parseInt(input, 10)
    if (isNaN(val)) return
    const correct = val === solveQ(question)
    clearTimeout(botRef.current!)
    setBotThinking(false)
    setPlayers(prev => {
      const updated = prev.map(p =>
        p.address === myAddr
          ? { ...p, answered: true, correct, score: correct ? p.score + 1 : p.score }
          : p
      )
      scoresRef.current = updated
      return updated
    })
    // Check if bot already answered
    const botDone = scoresRef.current.find(p => p.address === BOT_ADDR)?.answered
    if (botDone) endBotRound(question)
  }

  // ── Multiplayer socket setup ───────────────────────────────────────────
  useEffect(() => {
    if (isBotMode) return
    const socket = connectSocket()

    if (myAddr) {
      socket.emit('room:join', { code: roomCode, address: myAddr }, (res: { ok?: boolean; error?: string; room?: { players: PlayerState[] } }) => {
        if (res.error && res.error !== 'Already in room') setError(res.error)
        if (res.room) setPlayers(res.room.players)
      })
    }

    socket.on('room:update', (room: { players: PlayerState[]; status: string }) => {
      setPlayers(room.players)
      setCanStart(room.players.length >= 2 && room.status === 'waiting')
    })
    socket.on('game:countdown', (n: number) => { setPhase('countdown'); setCountdown(n) })
    socket.on('game:question', (q: Question) => {
      setPhase('playing'); setQuestion(q); setInput(''); setRoundAnswer(null)
      setPlayers(prev => prev.map(p => ({ ...p, answered: false, correct: null })))
      setTimeLeft(Math.round(q.timeMs / 1000))
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeLeft(t => { if (t <= 1) { clearInterval(timerRef.current!); return 0 } return t - 1 })
      }, 1000)
      setTimeout(() => inputRef.current?.focus(), 50)
    })
    socket.on('game:player_answered', (data: { address: string; correct: boolean; scores: PlayerState[] }) => {
      setPlayers(data.scores.map(p => ({
        ...p, answered: p.address === data.address ? true : undefined,
        correct: p.address === data.address ? data.correct : undefined,
      })))
    })
    socket.on('game:round_end', (data: { answer: number; scores: PlayerState[] }) => {
      if (timerRef.current) clearInterval(timerRef.current)
      setPhase('round_end'); setRoundAnswer(data.answer); setPlayers(data.scores)
    })
    socket.on('game:over', (data: { winner: string; pot: string; scores: Array<{ address: string; score: number; rank: number }> }) => {
      if (timerRef.current) clearInterval(timerRef.current)
      localStorage.removeItem('ag_active_room')
      setPhase('finished'); setGameOver(data)
    })
    socket.on('game:player_left', (data: { address: string }) => {
      setPlayers(prev => prev.filter(p => p.address !== data.address))
    })

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      socket.off('room:update'); socket.off('game:countdown'); socket.off('game:question')
      socket.off('game:player_answered'); socket.off('game:round_end')
      socket.off('game:over'); socket.off('game:player_left')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, myAddr])

  // ── Multiplayer actions ───────────────────────────────────────────────
  function handleStart() {
    connectSocket().emit('room:start', { code: roomCode })
  }

  function handleSubmit() {
    if (isBotMode) { handleBotSubmit(); return }
    if (!question) return
    const val = parseInt(input, 10)
    if (isNaN(val)) return
    connectSocket().emit('game:answer', { code: roomCode, answer: val })
  }

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)
  const timerColor    = timeLeft <= 3 ? '#ef4444' : timeLeft <= 6 ? '#f59e0b' : '#22c55e'
  const myPlayer      = players.find(p => p.address === myAddr)

  // ── Waiting phase ─────────────────────────────────────────────────────
  if (phase === 'waiting') return (
    <Center>
      <div style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
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
        <Spinner />
      </div>
    </Center>
  )

  // ── Countdown phase ───────────────────────────────────────────────────
  if (phase === 'countdown') return (
    <Center>
      <div style={{ textAlign: 'center' }}>
        {isBotMode && <div style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '20px', padding: '6px 16px', marginBottom: '20px', color: '#a78bfa', fontSize: '0.8rem', fontWeight: 700, display: 'inline-block' }}>🤖 PRACTICE vs BOT</div>}
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
        <div style={{ fontSize: '3.5rem', marginBottom: '8px' }}>🏆</div>
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
          {gameOver.scores.map((p, i) => {
            return (
              <div key={p.address} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: i < gameOver.scores.length - 1 ? '1px solid #0d0d14' : 'none', background: p.address === myAddr ? 'rgba(124,58,237,0.08)' : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, color: i === 0 ? '#f59e0b' : '#64748b', width: '24px', fontSize: '0.9rem' }}>#{p.rank}</span>
                  <img src={getAvatarUrl(p.address)} alt="avatar" width={32} height={32} style={{ borderRadius: '50%', border: `2px solid ${getAvatarColor(p.address)}`, background: '#1e1e30', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: p.address === myAddr ? '#a78bfa' : '#e2e8f0', fontSize: '0.9rem' }}>
                    {displayName(p.address)} {p.address === myAddr && '(you)'}
                  </span>
                </div>
                <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, color: i === 0 ? '#f59e0b' : '#94a3b8' }}>{p.score}/{question?.total ?? TOTAL_BOT_ROUNDS}</span>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {isBotMode
            ? <button onClick={() => navigate('/game/practice', { state: { bot: true, entry: 0 } })} style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '10px', padding: '12px 24px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem' }}>Play Again</button>
            : <button onClick={() => navigate('/lobby/math-arena')} style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '10px', padding: '12px 24px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem' }}>Play Again</button>
          }
          <button onClick={() => navigate('/lobby/math-arena')} style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '10px', padding: '12px 24px', color: '#94a3b8', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
            {isBotMode ? 'Play for Real →' : 'Home'}
          </button>
        </div>
      </div>
    </Center>
  )

  // ── Playing / Round end ───────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '20px 16px' }}>

      {isBotMode && (
        <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '8px', padding: '6px 14px', marginBottom: '16px', fontSize: '0.8rem', color: '#a78bfa', textAlign: 'center', fontWeight: 600 }}>
          🤖 Practice Mode — No real money involved
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
        {phase === 'playing' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(1.8rem,6vw,2.8rem)', fontWeight: 900, color: timerColor, lineHeight: 1 }}>{timeLeft}</div>
            <div style={{ fontSize: '0.6rem', color: '#64748b', letterSpacing: '0.1em' }}>SEC</div>
          </div>
        )}
        {!isBotMode && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.9rem' }}>💵 ${(entryFee * players.length * 0.85).toFixed(2)} pot</p>
            <p style={{ color: '#64748b', fontSize: '0.78rem' }}>entry: ${entryFee}</p>
          </div>
        )}
      </div>

      {/* Timer bar */}
      {phase === 'playing' && (
        <div style={{ height: '4px', background: '#1e1e30', borderRadius: '2px', marginBottom: '20px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(timeLeft / ROUND_TIME_S) * 100}%`, background: timerColor, borderRadius: '2px', transition: 'width 1s linear, background 0.5s' }} />
        </div>
      )}

      {/* Question box */}
      {question && (
        <div style={{
          background: '#12121a',
          border: `2px solid ${feedback_color(myPlayer, phase)}`,
          borderRadius: '16px', padding: 'clamp(24px,5vw,44px) clamp(16px,4vw,32px)',
          textAlign: 'center', marginBottom: '18px', transition: 'border-color 0.2s',
        }}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(2rem,8vw,4.5rem)', fontWeight: 900, marginBottom: '24px', color: '#e2e8f0' }}>
            {question.a} {question.op} {question.b} = ?
          </div>

          {phase === 'round_end' ? (
            <div>
              <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.1rem', color: '#f59e0b', marginBottom: '4px' }}>
                Answer: <strong>{roundAnswer}</strong>
              </p>
              <p style={{ color: '#64748b', fontSize: '0.85rem' }}>{question.round < question.total ? 'Next round…' : 'Game over!'}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', maxWidth: '300px', margin: '0 auto' }}>
              <input
                ref={inputRef}
                type="number"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                disabled={!!myPlayer?.answered}
                placeholder={myPlayer?.answered ? 'Submitted ✓' : 'Your answer'}
                style={{ flex: 1, background: '#0a0a0f', border: `2px solid ${myPlayer?.correct === true ? '#22c55e' : myPlayer?.correct === false ? '#ef4444' : '#2a2a40'}`, borderRadius: '10px', padding: '12px 14px', color: '#e2e8f0', fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(1rem,4vw,1.3rem)', textAlign: 'center', outline: 'none' }}
              />
              <button
                onClick={handleSubmit}
                disabled={!!myPlayer?.answered}
                style={{ background: myPlayer?.answered ? '#1e1e30' : 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '10px', padding: '12px 20px', color: myPlayer?.answered ? '#64748b' : '#fff', fontWeight: 700, cursor: myPlayer?.answered ? 'not-allowed' : 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem' }}
              >
                {myPlayer?.answered ? (myPlayer.correct ? '✓' : '✗') : 'GO'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Scoreboard */}
      <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '10px 18px', borderBottom: '1px solid #1e1e30', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.68rem', color: '#64748b', letterSpacing: '0.1em' }}>SCOREBOARD</span>
          {isBotMode && botThinking && <span style={{ color: '#64748b', fontSize: '0.78rem' }}>🤖 thinking…</span>}
        </div>
        {sortedPlayers.map((p, i) => (
            <div key={p.address} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: i < sortedPlayers.length - 1 ? '1px solid #0d0d14' : 'none', background: p.address === myAddr ? 'rgba(124,58,237,0.06)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#64748b', fontSize: '0.78rem', width: '18px' }}>#{i + 1}</span>
                <img src={getAvatarUrl(p.address)} alt="avatar" width={28} height={28} style={{ borderRadius: '50%', border: `2px solid ${getAvatarColor(p.address)}`, background: '#1e1e30', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: p.address === myAddr ? '#a78bfa' : '#94a3b8', fontSize: '0.88rem' }}>
                  {displayName(p.address)} {p.address === myAddr && '(you)'}
                </span>
                {p.answered && <span style={{ fontSize: '0.8rem', color: p.correct ? '#22c55e' : '#ef4444' }}>{p.correct ? '✓' : '✗'}</span>}
              </div>
              <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, color: i === 0 ? '#f59e0b' : '#e2e8f0', fontSize: '0.9rem' }}>{p.score}</span>
            </div>
        ))}
      </div>

      <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.78rem', marginTop: '10px' }}>
        Press <kbd style={{ background: '#1e1e30', borderRadius: '4px', padding: '1px 5px', fontSize: '0.72rem' }}>Enter</kbd> to submit
      </p>
    </div>
  )
}

function feedback_color(p: PlayerState | undefined, phase: Phase) {
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
