import { Link, useNavigate } from 'react-router-dom'

// ── SVG icons ─────────────────────────────────────────────────────────────
function GameIcon({ id, color }: { id: string; color: string }) {
  const s = { width: 52, height: 52, fill: 'none', stroke: color, strokeWidth: 1.8,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (id === 'math-arena') return (
    <svg {...s} viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="4"/>
      <path d="M8 12h8M12 8v8"/>
    </svg>
  )
  if (id === 'pattern-memory') return (
    <svg {...s} viewBox="0 0 24 24">
      <rect x="2" y="2" width="4" height="4" rx="1"/>
      <rect x="10" y="2" width="4" height="4" rx="1" fill={color} fillOpacity="0.3"/>
      <rect x="18" y="2" width="4" height="4" rx="1"/>
      <rect x="2" y="10" width="4" height="4" rx="1" fill={color} fillOpacity="0.3"/>
      <rect x="10" y="10" width="4" height="4" rx="1"/>
      <rect x="18" y="10" width="4" height="4" rx="1" fill={color} fillOpacity="0.3"/>
      <rect x="2" y="18" width="4" height="4" rx="1"/>
      <rect x="10" y="18" width="4" height="4" rx="1"/>
      <rect x="18" y="18" width="4" height="4" rx="1" fill={color} fillOpacity="0.3"/>
      <path d="M6 4h4M14 4h4M6 12h4M14 12h4" strokeOpacity="0.4"/>
    </svg>
  )
  if (id === 'reaction-grid') return (
    <svg {...s} viewBox="0 0 24 24">
      <rect x="2" y="2" width="9" height="9" rx="2" strokeOpacity="0.35"/>
      <rect x="13" y="2" width="9" height="9" rx="2" strokeOpacity="0.35"/>
      <rect x="2" y="13" width="9" height="9" rx="2" strokeOpacity="0.35"/>
      <rect x="13" y="13" width="9" height="9" rx="2" fill={color} fillOpacity="0.2"/>
      <circle cx="17.5" cy="17.5" r="2.5" fill={color}/>
    </svg>
  )
  if (id === 'highest-unique') return (
    <svg {...s} viewBox="0 0 24 24">
      <rect x="2" y="13" width="5" height="8" rx="1"/>
      <rect x="9.5" y="8" width="5" height="13" rx="1"/>
      <rect x="17" y="2" width="5" height="19" rx="1"/>
      <path d="M4.5 13l5-7 5 4 5-8" strokeOpacity="0.7"/>
    </svg>
  )
  if (id === 'lowest-unique') return (
    <svg {...s} viewBox="0 0 24 24">
      <path d="M21 6H3l6 6H5l7 8 7-8h-4z"/>
    </svg>
  )
  if (id === 'liars-dice') return (
    <svg {...s} viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <circle cx="8" cy="8" r="1.5" fill={color}/>
      <circle cx="16" cy="8" r="1.5" fill={color}/>
      <circle cx="12" cy="12" r="1.5" fill={color}/>
      <circle cx="8" cy="16" r="1.5" fill={color}/>
      <circle cx="16" cy="16" r="1.5" fill={color}/>
    </svg>
  )
  return <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>
}

const GAMES = [
  {
    id: 'math-arena',
    title: 'Math Arena',
    desc: 'Speed math quiz — first correct answer scores. No luck, 100% skill.',
    tags: ['Skill', 'Speed', 'Quiz'],
    entry: '$0.50 – $50',
    players: '2–10',
    status: 'live' as const,
    glow: '#7c3aed', glowRgb: '124,58,237',
    botMode: true,
  },
  {
    id: 'pattern-memory',
    title: 'Pattern Memory 🧠',
    desc: 'Memorize a sequence of digits, then type it from memory. First correct scores.',
    tags: ['Memory', 'Skill', 'Speed'],
    entry: '$0.50 – $50',
    players: '2–10',
    status: 'live' as const,
    glow: '#a855f7', glowRgb: '168,85,247',
    botMode: true,
  },
  {
    id: 'reaction-grid',
    title: 'Reaction Grid',
    desc: 'A cell lights up — click it before anyone else. Pure reaction speed.',
    tags: ['Reaction', 'Speed'],
    entry: '$1 – $50',
    players: '2–10',
    status: 'live' as const,
    glow: '#f59e0b', glowRgb: '245,158,11',
    botMode: true,
  },
  {
    id: 'highest-unique',
    title: 'Highest Unique',
    desc: 'Pick the highest number nobody else picks. Read the crowd, outsmart them.',
    tags: ['Strategy', 'Bluff'],
    entry: '$1 – $50',
    players: '2–20',
    status: 'live' as const,
    glow: '#22c55e', glowRgb: '34,197,94',
    botMode: true,
  },
  {
    id: 'lowest-unique',
    title: 'Lowest Unique',
    desc: 'Pick the lowest number nobody else picks. Fewer players, sharper edge.',
    tags: ['Strategy', 'Bluff'],
    entry: '$1 – $50',
    players: '2–20',
    status: 'live' as const,
    glow: '#ec4899', glowRgb: '236,72,153',
    botMode: true,
  },
  {
    id: 'liars-dice',
    title: "Liar's Dice 🎲",
    desc: 'Each player gets 3 dice. Bid on totals, call LIAR! on bluffs. Classic casino bluffing game.',
    tags: ['Bluff', 'Dice', 'Strategy'],
    entry: '$1 – $50',
    players: '2–6',
    status: 'live' as const,
    glow: '#f97316', glowRgb: '249,115,22',
    botMode: true,
  },
]

const STEPS = [
  {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
        <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
      </svg>
    ),
    title: 'Connect Wallet',
    desc: 'MetaMask, Coinbase, WalletConnect all supported. Use USDT on any major network.',
  },
  {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="1.8" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="4"/>
        <path d="M8 12h8M12 8v8"/>
      </svg>
    ),
    title: 'Join a Room',
    desc: 'Pick any of 6 live games, choose your entry fee, and join or create a room.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" height="40" viewBox="0 -960 960 960" width="40" fill="#F19E39">
        <path d="M536.5-543.5Q560-567 560-600t-23.5-56.5Q513-680 480-680t-56.5 23.5Q400-633 400-600t23.5 56.5Q447-520 480-520t56.5-23.5ZM280-120v-80h160v-124q-49-11-87.5-41.5T296-442q-75-9-125.5-65.5T120-640v-40q0-33 23.5-56.5T200-760h80v-80h400v80h80q33 0 56.5 23.5T840-680v40q0 76-50.5 132.5T664-442q-18 46-56.5 76.5T520-324v124h160v80H280Zm0-408v-152h-80v40q0 38 22 68.5t58 43.5Zm285 93q35-35 35-85v-240H360v240q0 50 35 85t85 35q50 0 85-35Zm115-93q36-13 58-43.5t22-68.5v-40h-80v152Zm-200-52Z"/>
      </svg>
    ),
    title: 'Win the Pot',
    desc: 'Outplay your opponents. Winner claims 85% of the entire pot instantly.',
  },
]

export default function Home() {
  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh' }}>
      <style>{`
        @keyframes pulse-glow { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:.7;transform:scale(1.05)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        .game-card { transition: transform .22s, box-shadow .22s; }
        .game-card:hover { transform: translateY(-6px) !important; }
      `}</style>

      {/* Hero */}
      <div style={{ position: 'relative', textAlign: 'center', padding: 'clamp(56px,10vw,96px) clamp(16px,5vw,40px) clamp(40px,6vw,72px)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '10%', left: '20%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', borderRadius: '50%', animation: 'pulse-glow 4s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '20%', right: '15%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', borderRadius: '50%', animation: 'pulse-glow 4s ease-in-out infinite 2s', pointerEvents: 'none' }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '20px', padding: '6px 16px', marginBottom: '24px', fontSize: '0.8rem', color: '#22c55e', fontWeight: 700, letterSpacing: '0.05em' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 8px #22c55e', animation: 'pulse-glow 1.5s ease-in-out infinite' }} />
          6 GAMES LIVE — USDT ON ANY CHAIN
        </div>

        <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(2.2rem, 6vw, 4.5rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: '20px', background: 'linear-gradient(135deg, #ffffff 0%, #a78bfa 40%, #06b6d4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          Compete.<br />Win Crypto.
        </h1>

        <p style={{ color: '#94a3b8', fontSize: '1.15rem', maxWidth: '520px', margin: '0 auto 32px', lineHeight: 1.6 }}>
          Six skill-based multiplayer games. Pay in USDT on any chain.<br />
          Outplay the competition — winner takes 85% of the pot.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '40px' }}>
          <button
            onClick={() => document.getElementById('games-grid')?.scrollIntoView({ behavior: 'smooth' })}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: '12px', padding: '14px 32px', color: '#fff', fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', letterSpacing: '0.05em', boxShadow: '0 0 32px rgba(124,58,237,0.4)', transition: 'box-shadow 0.2s' }}
          >
            Play Now →
          </button>
          <button
            onClick={() => document.getElementById('games-grid')?.scrollIntoView({ behavior: 'smooth' })}
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '12px', padding: '14px 32px', color: '#a78bfa', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Practice vs Bot
          </button>
        </div>

        <div style={{ display: 'flex', gap: '32px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { label: 'Games Live',  value: '6',     color: '#22c55e' },
            { label: 'Networks',    value: '6 Chains', color: '#a78bfa' },
            { label: 'Token',       value: 'USDT',  color: '#06b6d4' },
            { label: 'Winner Gets', value: '85%',   color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: '1.3rem', color: s.color }}>{s.value}</div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', letterSpacing: '0.08em', marginTop: '2px' }}>{s.label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Games Grid */}
      <div id="games-grid" style={{ maxWidth: '1140px', margin: '0 auto', padding: '0 clamp(16px,4vw,32px) clamp(48px,8vw,80px)' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1.4rem', color: '#e2e8f0', letterSpacing: '0.05em' }}>PICK YOUR GAME</h2>
          <p style={{ color: '#64748b', marginTop: '6px' }}>Six modes. One winner. Your skill decides.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
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
                <div style={{ marginBottom: '12px' }}>{step.icon}</div>
                <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: '#e2e8f0', marginBottom: '8px', letterSpacing: '0.05em' }}>{step.title.toUpperCase()}</h3>
                <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{ textAlign: 'center', padding: '72px 24px' }}>
        <div style={{ marginBottom: '16px', display: 'inline-block', animation: 'float 3s ease-in-out infinite' }}>
          <svg xmlns="http://www.w3.org/2000/svg" height="52" viewBox="0 -960 960 960" width="52" fill="#F19E39">
            <path d="M536.5-543.5Q560-567 560-600t-23.5-56.5Q513-680 480-680t-56.5 23.5Q400-633 400-600t23.5 56.5Q447-520 480-520t56.5-23.5ZM280-120v-80h160v-124q-49-11-87.5-41.5T296-442q-75-9-125.5-65.5T120-640v-40q0-33 23.5-56.5T200-760h80v-80h400v80h80q33 0 56.5 23.5T840-680v40q0 76-50.5 132.5T664-442q-18 46-56.5 76.5T520-324v124h160v80H280Zm0-408v-152h-80v40q0 38 22 68.5t58 43.5Zm285 93q35-35 35-85v-240H360v240q0 50 35 85t85 35q50 0 85-35Zm115-93q36-13 58-43.5t22-68.5v-40h-80v152Zm-200-52Z"/>
          </svg>
        </div>
        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: '#e2e8f0', marginBottom: '12px' }}>
          Ready to Compete?
        </h2>
        <p style={{ color: '#64748b', marginBottom: '28px', fontSize: '1rem' }}>
          Start with free bot practice — no wallet needed
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => document.getElementById('games-grid')?.scrollIntoView({ behavior: 'smooth' })} style={{ textDecoration: 'none', background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', borderRadius: '12px', padding: '13px 28px', color: '#fff', fontWeight: 700, fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', letterSpacing: '0.05em', boxShadow: '0 0 32px rgba(124,58,237,0.35)', border: 'none', cursor: 'pointer' }}>
            Pick a Game
          </button>
          <Link to="/leaderboard" style={{ textDecoration: 'none', background: '#12121a', border: '1px solid #1e1e30', borderRadius: '12px', padding: '13px 28px', color: '#94a3b8', fontWeight: 700, fontSize: '0.9rem' }}>
            Leaderboard
          </Link>
        </div>
      </div>
    </div>
  )
}

function GameCard({ game }: { game: typeof GAMES[0] }) {
  const navigate = useNavigate()

  return (
    <div
      className="game-card"
      style={{
        position: 'relative', background: 'rgba(18,18,26,0.8)', backdropFilter: 'blur(12px)',
        border: `1px solid rgba(${game.glowRgb},0.35)`, borderRadius: '18px', overflow: 'hidden',
        cursor: 'pointer', boxShadow: `0 4px 32px rgba(${game.glowRgb},0.08)`,
      }}
    >
      <div style={{ height: '2px', background: `linear-gradient(90deg, transparent, rgba(${game.glowRgb},0.8), transparent)` }} />
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
          <GameIcon id={game.id} color={game.glow} />
          <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', padding: '4px 10px', borderRadius: '20px', background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
            ● LIVE
          </span>
        </div>

        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px', color: '#e2e8f0' }}>
          {game.title}
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.55, marginBottom: '16px' }}>
          {game.desc}
        </p>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {game.tags.map(tag => (
            <span key={tag} style={{ fontSize: '0.7rem', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: `rgba(${game.glowRgb},0.1)`, border: `1px solid rgba(${game.glowRgb},0.25)`, color: game.glow }}>{tag}</span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: '#475569', marginBottom: '18px', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="6" cy="5" r="3"/><path d="M1 14c0-2.8 2.2-5 5-5"/><circle cx="12" cy="6" r="2.5"/><path d="M15 14c0-2.2-1.6-4-3.5-4"/></svg>
            {game.players}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 4v1M8 11v1M5.5 6.5A1.5 1.5 0 0 1 8 5.5h.5a1.5 1.5 0 0 1 0 3h-1a1.5 1.5 0 0 0 0 3H8a1.5 1.5 0 0 0 1.5-1.5"/></svg>
            {game.entry}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => navigate(`/lobby/${game.id}`)}
            style={{ flex: 1, background: `linear-gradient(135deg, rgba(${game.glowRgb},0.9), rgba(6,182,212,0.9))`, border: 'none', borderRadius: '9px', padding: '11px', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.04em' }}
          >
            PLAY NOW
          </button>
          {game.botMode && (
            <button
              onClick={() => navigate('/game/practice', { state: { bot: true, entry: 0, gameMode: game.id } })}
              style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '9px', padding: '11px 14px', color: '#a78bfa', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
            >
              vs Bot
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
