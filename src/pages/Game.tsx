import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { connectSocket } from '../utils/socket'

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
function short(addr: string) {
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

const ROUND_TIME_S = 12

export default function Game() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { address } = useAccount()

  const isHost   = location.state?.host    ?? false
  const entryFee = location.state?.entry   ?? 1
  const myAddr   = address ?? ''

  // ── State ────────────────────────────────────────────────────────────────
  const [phase, setPhase]     = useState<Phase>('waiting')
  const [countdown, setCountdown] = useState(3)
  const [question, setQuestion]   = useState<Question | null>(null)
  const [players, setPlayers] = useState<PlayerState[]>(
    myAddr ? [{ address: myAddr, score: 0 }] : []
  )
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME_S)
  const [input, setInput]       = useState('')
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [roundAnswer, setRoundAnswer] = useState<number | null>(null)
  const [gameOver, setGameOver] = useState<{
    winner: string; pot: string;
    scores: Array<{ address: string; score: number; rank: number }>
  } | null>(null)
  const [error, setError] = useState('')
  const [canStart, setCanStart] = useState(false)

  const inputRef  = useRef<HTMLInputElement>(null)
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Socket setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = connectSocket()

    // Join room on mount
    if (myAddr) {
      socket.emit('room:join', { code: roomCode, address: myAddr }, (res: { ok?: boolean; error?: string; room?: { players: PlayerState[] } }) => {
        if (res.error && res.error !== 'Already in room') {
          setError(res.error)
        }
        if (res.room) {
          setPlayers(res.room.players)
        }
      })
    }

    socket.on('room:update', (room: { players: PlayerState[]; status: string }) => {
      setPlayers(room.players)
      setCanStart(room.players.length >= 2 && room.status === 'waiting')
    })

    socket.on('game:countdown', (n: number) => {
      setPhase('countdown')
      setCountdown(n)
    })

    socket.on('game:question', (q: Question) => {
      setPhase('playing')
      setQuestion(q)
      setInput('')
      setFeedback(null)
      setRoundAnswer(null)
      setPlayers(prev => prev.map(p => ({ ...p, answered: false, correct: null })))

      // Client-side countdown timer
      setTimeLeft(Math.round(q.timeMs / 1000))
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { clearInterval(timerRef.current!); return 0 }
          return t - 1
        })
      }, 1000)

      setTimeout(() => inputRef.current?.focus(), 50)
    })

    socket.on('game:player_answered', (data: { address: string; correct: boolean; scores: PlayerState[] }) => {
      setPlayers(data.scores.map(p => ({
        ...p,
        answered: p.address === data.address ? true : undefined,
        correct:  p.address === data.address ? data.correct : undefined,
      })))
    })

    socket.on('game:round_end', (data: { answer: number; scores: PlayerState[] }) => {
      if (timerRef.current) clearInterval(timerRef.current)
      setPhase('round_end')
      setRoundAnswer(data.answer)
      setPlayers(data.scores)
    })

    socket.on('game:over', (data: { winner: string; pot: string; scores: Array<{ address: string; score: number; rank: number }> }) => {
      if (timerRef.current) clearInterval(timerRef.current)
      setPhase('finished')
      setGameOver(data)
    })

    socket.on('game:player_left', (data: { address: string }) => {
      setPlayers(prev => prev.filter(p => p.address !== data.address))
    })

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      socket.off('room:update')
      socket.off('game:countdown')
      socket.off('game:question')
      socket.off('game:player_answered')
      socket.off('game:round_end')
      socket.off('game:over')
      socket.off('game:player_left')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, myAddr])

  // ── Actions ───────────────────────────────────────────────────────────────
  function handleStart() {
    const socket = connectSocket()
    socket.emit('room:start', { code: roomCode })
  }

  function handleSubmit() {
    if (feedback || !question) return
    const val = parseInt(input, 10)
    // Server is authoritative for scoring; just emit the answer
    const socket = connectSocket()
    socket.emit('game:answer', { code: roomCode, answer: val })

    // Optimistic UI
    setFeedback(null) // will be set via game:player_answered
  }

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)
  const timerColor = timeLeft <= 3 ? '#ef4444' : timeLeft <= 6 ? '#f59e0b' : '#22c55e'
  const myPlayer   = players.find(p => p.address === myAddr)

  // ── Waiting phase ─────────────────────────────────────────────────────────
  if (phase === 'waiting') return (
    <Center>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#64748b', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '0.1em', marginBottom: '6px' }}>ROOM</div>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '3rem', fontWeight: 900, letterSpacing: '0.2em', background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          {roomCode}
        </div>
        <p style={{ color: '#94a3b8', marginTop: '12px', marginBottom: '24px' }}>
          {players.length} player{players.length !== 1 ? 's' : ''} in lobby — waiting for more to join…
        </p>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '28px' }}>
          {players.map(p => (
            <div key={p.address} style={{ background: '#12121a', border: `1px solid ${p.address === myAddr ? '#7c3aed' : '#1e1e30'}`, borderRadius: '8px', padding: '8px 16px', fontSize: '0.8rem', color: p.address === myAddr ? '#a78bfa' : '#94a3b8' }}>
              {short(p.address)} {p.address === myAddr && '(you)'}
            </div>
          ))}
          <div style={{ background: '#12121a', border: '1px dashed #1e1e30', borderRadius: '8px', padding: '8px 16px', fontSize: '0.8rem', color: '#2a2a40' }}>
            waiting…
          </div>
        </div>

        {/* Share code */}
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '10px', padding: '14px 20px', marginBottom: '20px', fontSize: '0.85rem', color: '#64748b' }}>
          Share code <strong style={{ color: '#a78bfa', fontFamily: 'Orbitron, sans-serif' }}>{roomCode}</strong> with friends to join
        </div>

        {error && <p style={{ color: '#ef4444', marginBottom: '12px', fontSize: '0.9rem' }}>{error}</p>}

        {isHost && canStart && (
          <button onClick={handleStart} style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '10px', padding: '14px 36px', color: '#fff', fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', letterSpacing: '0.05em' }}>
            Start Game
          </button>
        )}

        {isHost && !canStart && (
          <p style={{ color: '#f59e0b', fontSize: '0.85rem' }}>Need at least 2 players to start</p>
        )}

        <Spinner />
      </div>
    </Center>
  )

  // ── Countdown phase ───────────────────────────────────────────────────────
  if (phase === 'countdown') return (
    <Center>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#64748b', fontFamily: 'Orbitron, sans-serif', marginBottom: '16px', letterSpacing: '0.1em' }}>GAME STARTS IN</p>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9rem', fontWeight: 900, lineHeight: 1, background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          {countdown}
        </div>
        <p style={{ color: '#64748b', marginTop: '16px' }}>Get ready — math arena begins!</p>
      </div>
    </Center>
  )

  // ── Game finished ─────────────────────────────────────────────────────────
  if (phase === 'finished' && gameOver) return (
    <Center>
      <div style={{ textAlign: 'center', maxWidth: '500px', width: '100%' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>🏆</div>
        <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.6rem', fontWeight: 900, background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '4px' }}>
          {gameOver.winner === myAddr ? 'You Won!' : `${short(gameOver.winner)} Wins!`}
        </h1>
        <p style={{ color: gameOver.winner === myAddr ? '#22c55e' : '#94a3b8', fontWeight: 700, fontSize: '1.1rem', marginBottom: '28px' }}>
          {gameOver.winner === myAddr ? `+$${gameOver.pot} USDT` : 'Better luck next time'}
        </p>

        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', overflow: 'hidden', marginBottom: '24px' }}>
          {gameOver.scores.map((p, i) => (
            <div key={p.address} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < gameOver.scores.length - 1 ? '1px solid #0d0d14' : 'none', background: p.address === myAddr ? 'rgba(124,58,237,0.08)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, color: i === 0 ? '#f59e0b' : '#64748b', width: '28px' }}>
                  #{p.rank}
                </span>
                <span style={{ fontWeight: 600, color: p.address === myAddr ? '#a78bfa' : '#e2e8f0' }}>
                  {short(p.address)} {p.address === myAddr && '(you)'}
                </span>
              </div>
              <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, color: i === 0 ? '#f59e0b' : '#94a3b8' }}>
                {p.score}/{question?.total ?? 10}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button onClick={() => navigate('/lobby/math-arena')} style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '10px', padding: '12px 28px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'Orbitron, sans-serif' }}>
            Play Again
          </button>
          <button onClick={() => navigate('/')} style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '10px', padding: '12px 28px', color: '#94a3b8', fontWeight: 700, cursor: 'pointer' }}>
            Home
          </button>
        </div>
      </div>
    </Center>
  )

  // ── Playing / Round end phase ─────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontFamily: 'Orbitron, sans-serif', color: '#64748b', fontSize: '0.75rem', letterSpacing: '0.1em' }}>ROOM {roomCode}</span>
          {question && (
            <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, marginTop: '2px' }}>
              Round {question.round}/{question.total}
            </p>
          )}
        </div>
        {phase === 'playing' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '2.8rem', fontWeight: 900, color: timerColor, lineHeight: 1 }}>{timeLeft}</div>
            <div style={{ fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.1em' }}>SECONDS</div>
          </div>
        )}
        <div style={{ textAlign: 'right' }}>
          <p style={{ color: '#22c55e', fontWeight: 700 }}>💵 ${(entryFee * players.length * 0.85).toFixed(2)} pot</p>
          <p style={{ color: '#64748b', fontSize: '0.8rem' }}>entry: ${entryFee}</p>
        </div>
      </div>

      {/* Timer bar */}
      {phase === 'playing' && (
        <div style={{ height: '4px', background: '#1e1e30', borderRadius: '2px', marginBottom: '28px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(timeLeft / ROUND_TIME_S) * 100}%`, background: timerColor, borderRadius: '2px', transition: 'width 1s linear, background 0.5s' }} />
        </div>
      )}

      {/* Question box */}
      {question && (
        <div style={{
          background: '#12121a',
          border: `2px solid ${phase === 'round_end' ? (roundAnswer !== null && myPlayer ? '#1e1e30' : '#1e1e30') : feedback === 'correct' ? '#22c55e' : feedback === 'wrong' ? '#ef4444' : '#1e1e30'}`,
          borderRadius: '20px',
          padding: '44px 32px',
          textAlign: 'center',
          marginBottom: '24px',
          transition: 'border-color 0.2s',
        }}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', fontWeight: 900, marginBottom: '32px', color: '#e2e8f0' }}>
            {question.a} {question.op} {question.b} = ?
          </div>

          {phase === 'round_end' ? (
            <div>
              <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.2rem', color: '#f59e0b', marginBottom: '6px' }}>
                Answer: <strong>{roundAnswer}</strong>
              </p>
              <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Next round starting…</p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', maxWidth: '320px', margin: '0 auto' }}>
              <input
                ref={inputRef}
                type="number"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                disabled={!!myPlayer?.answered}
                placeholder={myPlayer?.answered ? 'Submitted' : 'Your answer'}
                style={{ flex: 1, background: '#0a0a0f', border: `2px solid ${myPlayer?.correct === true ? '#22c55e' : myPlayer?.correct === false ? '#ef4444' : '#2a2a40'}`, borderRadius: '10px', padding: '14px 18px', color: '#e2e8f0', fontFamily: 'Orbitron, sans-serif', fontSize: '1.3rem', textAlign: 'center', outline: 'none' }}
              />
              <button
                onClick={handleSubmit}
                disabled={!!myPlayer?.answered}
                style={{ background: myPlayer?.answered ? '#1e1e30' : 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '10px', padding: '14px 24px', color: myPlayer?.answered ? '#64748b' : '#fff', fontWeight: 700, cursor: myPlayer?.answered ? 'not-allowed' : 'pointer', fontFamily: 'Orbitron, sans-serif' }}
              >
                {myPlayer?.answered ? (myPlayer.correct ? '✓' : '✗') : 'GO'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Scoreboard */}
      <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #1e1e30', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.72rem', color: '#64748b', letterSpacing: '0.1em' }}>SCOREBOARD</span>
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.72rem', color: '#64748b', letterSpacing: '0.1em' }}>SCORE</span>
        </div>
        {sortedPlayers.map((p, i) => (
          <div key={p.address} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < sortedPlayers.length - 1 ? '1px solid #0d0d14' : 'none', background: p.address === myAddr ? 'rgba(124,58,237,0.06)' : 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#64748b', fontSize: '0.8rem', width: '20px' }}>#{i + 1}</span>
              <span style={{ fontWeight: 600, color: p.address === myAddr ? '#a78bfa' : '#94a3b8', fontSize: '0.9rem' }}>
                {short(p.address)} {p.address === myAddr && '(you)'}
              </span>
              {p.answered && (
                <span style={{ fontSize: '0.8rem', color: p.correct ? '#22c55e' : '#ef4444' }}>
                  {p.correct ? '✓' : '✗'}
                </span>
              )}
            </div>
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, color: i === 0 ? '#f59e0b' : '#e2e8f0' }}>
              {p.score}
            </span>
          </div>
        ))}
      </div>

      <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', marginTop: '12px' }}>
        Press <kbd style={{ background: '#1e1e30', borderRadius: '4px', padding: '2px 6px', fontSize: '0.75rem' }}>Enter</kbd> to submit your answer
      </p>
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '28px' }}>
      <div style={{ width: '28px', height: '28px', border: '3px solid #1e1e30', borderTop: '3px solid #7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
