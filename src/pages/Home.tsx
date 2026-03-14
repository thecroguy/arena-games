import { Link } from 'react-router-dom'

const GAMES = [
  {
    id: 'math-arena',
    title: 'Math Arena',
    emoji: '🧮',
    desc: 'Speed math quiz — first correct answer scores. 100% skill, zero luck. Best for legal advertising.',
    tags: ['Skill', 'Speed', 'Quiz'],
    entry: '$0.50 – $50',
    players: '2–10',
    status: 'live' as const,
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
  },
]

export default function Home() {
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h1 style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '16px',
        }}>
          Compete. Win Crypto.
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto' }}>
          Skill-based multiplayer games on Polygon. Connect your wallet, deposit USDT, winner takes the pot.
        </p>
        <div style={{
          display: 'flex',
          gap: '24px',
          justifyContent: 'center',
          marginTop: '24px',
          fontSize: '0.9rem',
          color: '#64748b',
        }}>
          <span>⛓️ Polygon Network</span>
          <span>💵 USDT Only</span>
          <span>🔒 Smart Contract Escrow</span>
          <span>💸 15% Rake</span>
        </div>
      </div>

      {/* Game Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '20px',
      }}>
        {GAMES.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  )
}

function GameCard({ game }: { game: typeof GAMES[0] }) {
  const isLive = game.status === 'live'

  const card = (
    <div style={{
      background: '#12121a',
      border: `1px solid ${isLive ? '#7c3aed' : '#1e1e30'}`,
      borderRadius: '16px',
      overflow: 'hidden',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: isLive ? 'pointer' : 'default',
      opacity: isLive ? 1 : 0.6,
      textDecoration: 'none',
      color: 'inherit',
      display: 'block',
    }}
    onMouseEnter={e => {
      if (!isLive) return
      ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'
      ;(e.currentTarget as HTMLElement).style.boxShadow = '0 16px 48px rgba(124,58,237,0.3)'
    }}
    onMouseLeave={e => {
      ;(e.currentTarget as HTMLElement).style.transform = ''
      ;(e.currentTarget as HTMLElement).style.boxShadow = ''
    }}
    >
      <div style={{
        padding: '28px 24px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '2.5rem' }}>{game.emoji}</span>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            padding: '4px 10px',
            borderRadius: '20px',
            background: isLive ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
            color: isLive ? '#22c55e' : '#f59e0b',
            border: `1px solid ${isLive ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
          }}>
            {isLive ? '● LIVE' : 'COMING SOON'}
          </span>
        </div>

        <div>
          <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>
            {game.title}
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5 }}>{game.desc}</p>
        </div>

        <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: '#64748b' }}>
          <span>👥 {game.players} players</span>
          <span>💵 {game.entry}</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {game.tags.map(tag => (
            <span key={tag} style={{
              fontSize: '0.72rem',
              padding: '3px 10px',
              borderRadius: '20px',
              background: 'rgba(6,182,212,0.1)',
              border: '1px solid rgba(6,182,212,0.2)',
              color: '#06b6d4',
              fontWeight: 600,
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )

  return isLive
    ? <Link to={`/lobby/${game.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>{card}</Link>
    : card
}
