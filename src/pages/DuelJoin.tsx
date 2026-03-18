import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'
const GAME_NAMES: Record<string, string> = {
  'math-arena': 'Math Arena',
  'pattern-memory': 'Pattern Memory',
  'reaction-grid': 'Reaction Grid',
  'highest-unique': 'Highest Unique',
  'lowest-unique': 'Lowest Unique',
  'liars-dice': "Liar's Dice",
}

export default function DuelJoin() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const [room, setRoom] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!roomCode) return
    fetch(`${SERVER_URL}/api/room/${roomCode.toUpperCase()}`)
      .then(r => r.json())
      .then(data => { setRoom(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [roomCode])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '80px', color: '#64748b', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem' }}>
      Loading duel…
    </div>
  )

  if (!room?.found) return (
    <div style={{ maxWidth: '440px', margin: '80px auto', textAlign: 'center', padding: '24px' }}>
      <p style={{ fontSize: '2rem', marginBottom: '12px' }}>⚔️</p>
      <h2 style={{ fontFamily: 'Orbitron, sans-serif', color: '#e2e8f0', marginBottom: '8px', fontSize: '1.2rem' }}>Duel Expired</h2>
      <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '0.88rem' }}>This challenge is no longer available.</p>
      <button onClick={() => navigate('/')}
        style={{ background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', border: 'none', borderRadius: '10px', padding: '12px 28px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.88rem' }}>
        Browse Arena →
      </button>
    </div>
  )

  const pot = room.entryFee * room.max
  const winnerGets = (pot * 0.85).toFixed(2)
  const gameName = GAME_NAMES[room.gameMode] || room.gameMode

  return (
    <div style={{ maxWidth: '440px', margin: '60px auto', padding: '24px' }}>
      <div style={{ background: '#12121a', border: '1px solid rgba(249,115,22,0.4)', borderRadius: '20px', padding: '32px', textAlign: 'center' }}>
        <p style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⚔️</p>
        <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.4rem', color: '#f97316', marginBottom: '4px' }}>ARENA DUEL</h1>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '24px' }}>
          {room.hostName || 'A player'} challenges you
        </p>

        <div style={{ background: '#0a0a0f', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          {[
            ['Game', gameName],
            ['Entry Fee', `$${room.entryFee} USDT`],
            ['Total Pot', `$${pot.toFixed(2)} USDT`],
            ['Winner Takes', `$${winnerGets} USDT`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1e1e30' }}>
              <span style={{ color: '#64748b', fontSize: '0.88rem' }}>{k}</span>
              <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.88rem' }}>{v}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate(`/lobby/${room.gameMode}`, { state: { autoJoin: room.code, autoFee: room.entryFee, autoChainId: room.chainId || 137 } })}
          style={{ width: '100%', background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: '12px', padding: '16px', color: '#fff', fontWeight: 800, fontSize: '1rem', fontFamily: 'Orbitron, sans-serif', cursor: 'pointer', marginBottom: '12px', letterSpacing: '0.04em' }}>
          Accept Challenge →
        </button>
        <button
          onClick={() => navigate(`/lobby/${room.gameMode}`)}
          style={{ width: '100%', background: 'transparent', border: '1px solid #1e1e30', borderRadius: '12px', padding: '12px', color: '#64748b', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}>
          View Lobby
        </button>
      </div>
    </div>
  )
}
