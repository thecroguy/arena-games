import { Link, useNavigate } from 'react-router-dom'

const GAMES = [
  {
    id: 'math-arena',
    title: 'Math Arena',
    emoji: '🧮',
    desc: 'Speed math quiz — first correct answer scores. 100% skill, zero luck.',
    tags: ['Skill', 'Speed', 'Quiz'],
    entry: '$0.50 – $50',
    players: '2–10',
    status: 'live' as const,
    glow: '#7c3aed',
    glowRgb: '124,58,237',
  },
  {
    id: 'unique-bid',
    title: 'Highest Unique Bid',
    emoji: '🎯',
    desc: 'Submit the highest number nobody else picked. Read the heatmap, beat the crowd.',
    tags: ['Strategy', 'Bluff'],
    entry: '$1 – $100',
    players: '2–50',
    status: 'soon' as const,
    glow: '#06b6d4',
    glowRgb: '6,182,212',
  },
  {
    id: 'tiled-grid',
    title: 'Tiled Grid',
    emoji: '⚡',
    desc: 'Race to claim unique tiles on a shared grid in 30 seconds. Reaction speed wins.',
    tags: ['Reaction', 'Speed'],
    entry: '$1 – $50',
    players: '2–30',
    status: 'soon' as const,
    glow: '#f59e0b',
    glowRgb: '245,158,11',
  },
  {
    id: 'last-standing',
    title: 'Last Unique Standing',
    emoji: '🏆',
    desc: 'Pick a number each round — duplicates get eliminated. Last unique player wins.',
    tags: ['Elimination', 'Strategy'],
    entry: '$1 – $50',
    players: '3–20',
    status: 'soon' as const,
    glow: '#22c55e',
    glowRgb: '34,197,94',
  },
  {
    id: 'reverse-auction',
    title: 'Reverse Auction',
    emoji: '📈',
    desc: 'Bid on a rising price ladder. Highest unique bid wins. Read velocity, spot gaps.',
    tags: ['Auction', 'Bluff'],
    entry: '$1 – $100',
    players: '2–40',
    status: 'soon' as const,
    glow: '#ec4899',
    glowRgb: '236,72,153',
  },
  {
    id: 'color-rush',
    title: 'Color & Number Rush',
    emoji: '🌈',
    desc: 'Pick the rarest color+number combo from a 5×10 matrix. Jackpot rollover mechanic.',
    tags: ['Jackpot', 'Contrarian'],
    entry: '$0.50 – $20',
    players: '2–100',
    status: 'soon' as const,
    glow: '#a78bfa',
    glowRgb: '167,139,250',
  },
]

const STEPS = [
  { icon: '🔗', title: 'Connect Wallet', desc: 'Link your Polygon wallet — MetaMask, Coinbase, WalletConnect all supported.' },
  { icon: '🎮', title: 'Join a Room', desc: 'Pick a game, choose your entry fee, and join or create a room.' },
  { icon: '🏆', title: 'Win the Pot', desc: 'Outplay your opponents. Winner claims 85% of the pot instantly.' },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh' }}>
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .game-card:hover .card-glow { opacity: 1 !important; }
        .game-card:hover { transform: translateY(-6px) !important; }
        .practice-btn:hover { background: rgba(124,58,237,0.25) !important; border-color: rgba(124,58,237,0.6) !important; }
        .play-btn:hover { box-shadow: 0 0 24px rgba(124,58,237,0.6) !important; }
      `}</style>

      {/* Hero */}
      <div style={{ position: 'relative', textAlign: 'center', padding: '80px 24px 60px', overflow: 'hidden' }}>
        {/* Background glow blobs */}
        <div style={{ position: 'absolute', top: '10%', left: '20%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', borderRadius: '50%', animation: 'pulse-glow 4s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '20%', right: '15%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', borderRadius: '50%', animation: 'pulse-glow 4s ease-in-out infinite 2s', pointerEvents: 'none' }} />

        {/* Live badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '20px', padding: '6px 16px', marginBottom: '24px', fontSize: '0.8rem', color: '#22c55e', fontWeight: 700, letterSpacing: '0.05em' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 8px #22c55e', animation: 'pulse-glow 1.5s ease-in-out infinite' }} />
          LIVE ON POLYGON
        </div>

        <h1 style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 'clamp(2.2rem, 6vw, 4.5rem)',
          fontWeight: 900,
          lineHeight: 1.1,
          marginBottom: '20px',
          background: 'linear-gradient(135deg, #ffffff 0%, #a78bfa 40%, #06b6d4 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Compete.<br />Win Crypto.
        </h1>

        <p style={{ color: '#94a3b8', fontSize: '1.15rem', maxWidth: '520px', margin: '0 auto 32px', lineHeight: 1.6 }}>
          Skill-based multiplayer games on Polygon.<br />
          Connect your wallet, beat the competition, take the pot.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '40px' }}>
          <button
            onClick={() => navigate('/lobby/math-arena')}
            className="play-btn"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '12px', padding: '14px 32px', color: '#fff', fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', letterSpacing: '0.05em', boxShadow: '0 0 32px rgba(124,58,237,0.4)', transition: 'box-shadow 0.2s' }}
          >
            Play Now →
          </button>
          <button
            onClick={() => navigate('/game/practice', { state: { bot: true, entry: 0 } })}
            className="practice-btn"
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '12px', padding: '14px 32px', color: '#a78bfa', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            🤖 Practice vs Bot
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '32px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { label: 'Games Live', value: '1', color: '#22c55e' },
            { label: 'Network', value: 'Polygon', color: '#a78bfa' },
            { label: 'Token', value: 'USDT', color: '#06b6d4' },
            { label: 'Rake', value: '15%', color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: '1.3rem', color: s.color }}>{s.value}</div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', letterSpacing: '0.08em', marginTop: '2px' }}>{s.label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Games Grid */}
      <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1.4rem', color: '#e2e8f0', letterSpacing: '0.05em' }}>
            GAME MODES
          </h2>
          <p style={{ color: '#64748b', marginTop: '6px' }}>More games launching soon — vote for your favourite</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '20px' }}>
          {GAMES.map(game => <GameCard key={game.id} game={game} />)}
        </div>
      </div>

      {/* How it works */}
      <div style={{ borderTop: '1px solid #1e1e30', borderBottom: '1px solid #1e1e30', background: '#0d0d14', padding: '72px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1.4rem', color: '#e2e8f0', marginBottom: '8px', letterSpacing: '0.05em' }}>HOW IT WORKS</h2>
          <p style={{ color: '#64748b', marginBottom: '48px' }}>Three steps to start competing</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
            {STEPS.map((step, i) => (
              <div key={i} style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', padding: '32px 24px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '-14px', left: '24px', background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', borderRadius: '8px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: '0.75rem', color: '#fff' }}>{i + 1}</div>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{step.icon}</div>
                <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: '#e2e8f0', marginBottom: '8px', letterSpacing: '0.05em' }}>{step.title.toUpperCase()}</h3>
                <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{ textAlign: 'center', padding: '72px 24px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px', animation: 'float 3s ease-in-out infinite', display: 'inline-block' }}>🏆</div>
        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: '#e2e8f0', marginBottom: '12px' }}>
          Ready to Compete?
        </h2>
        <p style={{ color: '#64748b', marginBottom: '28px', fontSize: '1rem' }}>
          Start with bot practice — no wallet needed
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/lobby/math-arena" style={{ textDecoration: 'none', background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', borderRadius: '12px', padding: '13px 28px', color: '#fff', fontWeight: 700, fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', letterSpacing: '0.05em', boxShadow: '0 0 32px rgba(124,58,237,0.35)' }}>
            Enter Lobby
          </Link>
          <Link to="/leaderboard" style={{ textDecoration: 'none', background: '#12121a', border: '1px solid #1e1e30', borderRadius: '12px', padding: '13px 28px', color: '#94a3b8', fontWeight: 700, fontSize: '0.9rem' }}>
            View Leaderboard
          </Link>
        </div>
      </div>
    </div>
  )
}

function GameCard({ game }: { game: typeof GAMES[0] }) {
  const navigate = useNavigate()
  const isLive = game.status === 'live'

  return (
    <div
      className="game-card"
      style={{
        position: 'relative',
        background: 'rgba(18,18,26,0.8)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${isLive ? `rgba(${game.glowRgb},0.4)` : '#1e1e30'}`,
        borderRadius: '18px',
        overflow: 'hidden',
        transition: 'transform 0.25s, box-shadow 0.25s',
        cursor: isLive ? 'pointer' : 'default',
        opacity: isLive ? 1 : 0.55,
        boxShadow: isLive ? `0 4px 32px rgba(${game.glowRgb},0.1)` : 'none',
      }}
      onMouseEnter={e => {
        if (!isLive) return
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-6px)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = `0 16px 48px rgba(${game.glowRgb},0.25)`
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.transform = ''
        ;(e.currentTarget as HTMLElement).style.boxShadow = isLive ? `0 4px 32px rgba(${game.glowRgb},0.1)` : 'none'
      }}
    >
      {/* Top glow bar */}
      {isLive && (
        <div style={{ height: '2px', background: `linear-gradient(90deg, transparent, rgba(${game.glowRgb},0.8), transparent)` }} />
      )}

      <div style={{ padding: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span style={{ fontSize: '2.8rem', lineHeight: 1 }}>{game.emoji}</span>
          <span style={{
            fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em',
            padding: '4px 10px', borderRadius: '20px',
            background: isLive ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
            color: isLive ? '#22c55e' : '#f59e0b',
            border: `1px solid ${isLive ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
          }}>
            {isLive ? '● LIVE' : 'SOON'}
          </span>
        </div>

        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px', color: '#e2e8f0' }}>
          {game.title}
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.55, marginBottom: '16px' }}>
          {game.desc}
        </p>

        {/* Tags */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {game.tags.map(tag => (
            <span key={tag} style={{
              fontSize: '0.7rem', padding: '3px 10px', borderRadius: '20px', fontWeight: 600,
              background: `rgba(${game.glowRgb},0.1)`,
              border: `1px solid rgba(${game.glowRgb},0.25)`,
              color: game.glow,
            }}>{tag}</span>
          ))}
        </div>

        {/* Info row */}
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: '#475569', marginBottom: isLive ? '18px' : '0' }}>
          <span>👥 {game.players}</span>
          <span>💵 {game.entry}</span>
        </div>

        {/* CTA buttons — live only */}
        {isLive && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => navigate(`/lobby/${game.id}`)}
              style={{ flex: 1, background: `linear-gradient(135deg, rgba(${game.glowRgb},0.9), rgba(6,182,212,0.9))`, border: 'none', borderRadius: '9px', padding: '11px', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.04em' }}
            >
              PLAY NOW
            </button>
            <button
              onClick={() => navigate('/game/practice', { state: { bot: true, entry: 0 } })}
              style={{ flex: 1, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '9px', padding: '11px', color: '#a78bfa', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.18)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.08)' }}
            >
              🤖 VS BOT
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
