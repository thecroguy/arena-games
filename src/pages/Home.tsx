import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

// ── Ticker data ────────────────────────────────────────────────────────────
const TICKER = [
  { user:'Kira_X',     game:'Coin Flip',      amount:'$18.70',  icon:'🪙' },
  { user:'NovaBet',    game:'Math Arena',     amount:'$42.50',  icon:'✚'  },
  { user:'0xShadow',   game:"Liar's Dice",    amount:'$85.00',  icon:'🎲' },
  { user:'CryptoAce',  game:'Reaction Grid',  amount:'$21.25',  icon:'⊞'  },
  { user:'Riven88',    game:'Highest Unique', amount:'$63.75',  icon:'↑'  },
  { user:'BlockBet',   game:'Coin Flip',      amount:'$42.50',  icon:'🪙' },
  { user:'Apex_V',     game:"Liar's Dice",    amount:'$127.50', icon:'🎲' },
  { user:'Mxlk',      game:'Pattern Memory', amount:'$17.00',  icon:'🧠' },
  { user:'ZeroG',      game:'Lowest Unique',  amount:'$8.50',   icon:'↓'  },
  { user:'SolKing',    game:'Math Arena',     amount:'$25.50',  icon:'✚'  },
]

// ── Game definitions ────────────────────────────────────────────────────────
const GAMES = [
  {
    id: 'coin-flip',
    title: 'Coin Flip',
    emoji: '🪙',
    short: 'COIN FLIP',
    desc: '1v1 pure tension. Pick Heads or Tails — best of 5. No skill edge, just nerve.',
    tags: ['1v1', 'Fast', 'Luck'],
    players: '2',
    glow: '#f59e0b', glowRgb: '245,158,11',
    bgGrad: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.05) 100%)',
    hot: true,
    botMode: true,
  },
  {
    id: 'math-arena',
    title: 'Math Arena',
    emoji: '✚',
    short: 'MATH',
    desc: 'Speed math — first correct answer scores. 100% pure skill, zero luck.',
    tags: ['Skill', 'Speed'],
    players: '2–10',
    glow: '#7c3aed', glowRgb: '124,58,237',
    bgGrad: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(124,58,237,0.04) 100%)',
    hot: false,
    botMode: true,
  },
  {
    id: 'reaction-grid',
    title: 'Reaction Grid',
    emoji: '⊞',
    short: 'REACTION',
    desc: 'A cell lights up — click it before anyone else. Pure reaction speed.',
    tags: ['Reflex', 'Speed'],
    players: '2–10',
    glow: '#f59e0b', glowRgb: '245,158,11',
    bgGrad: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.03) 100%)',
    hot: false,
    botMode: true,
  },
  {
    id: 'liars-dice',
    title: "Liar's Dice",
    emoji: '🎲',
    short: "LIAR'S DICE",
    desc: 'Hidden dice. Bluff your bids, call LIAR! Deception is the only weapon.',
    tags: ['Bluff', 'Strategy'],
    players: '2–6',
    glow: '#f97316', glowRgb: '249,115,22',
    bgGrad: 'linear-gradient(135deg, rgba(249,115,22,0.14) 0%, rgba(249,115,22,0.04) 100%)',
    hot: false,
    botMode: true,
  },
  {
    id: 'pattern-memory',
    title: 'Pattern Memory',
    emoji: '🧠',
    short: 'MEMORY',
    desc: 'Tiles flash briefly — memorize every one, then tap them from memory.',
    tags: ['Memory', 'Focus'],
    players: '2–10',
    glow: '#a855f7', glowRgb: '168,85,247',
    bgGrad: 'linear-gradient(135deg, rgba(168,85,247,0.14) 0%, rgba(168,85,247,0.04) 100%)',
    hot: false,
    botMode: true,
  },
  {
    id: 'highest-unique',
    title: 'Highest Unique',
    emoji: '↑',
    short: 'HI UNIQUE',
    desc: 'Pick the highest number nobody else picks. Read the crowd. Outsmart them.',
    tags: ['Strategy', 'Psychology'],
    players: '3–20',
    glow: '#22c55e', glowRgb: '34,197,94',
    bgGrad: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(34,197,94,0.03) 100%)',
    hot: false,
    botMode: true,
  },
  {
    id: 'lowest-unique',
    title: 'Lowest Unique',
    emoji: '↓',
    short: 'LO UNIQUE',
    desc: 'Pick the lowest number nobody else picks. Contrarian thinking wins here.',
    tags: ['Strategy', 'Bluff'],
    players: '3–20',
    glow: '#ec4899', glowRgb: '236,72,153',
    bgGrad: 'linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(236,72,153,0.03) 100%)',
    hot: false,
    botMode: true,
  },
]

// ── Fake live stats (rotate every few seconds) ─────────────────────────────
const LIVE_STATS = [
  { label: 'Active Games', value: '14' },
  { label: 'Active Games', value: '17' },
  { label: 'Active Games', value: '11' },
]

export default function Home() {
  const navigate = useNavigate()
  const [activeGame, setActiveGame] = useState(GAMES[0])
  const [statIdx, setStatIdx] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const t = setInterval(() => setStatIdx(i => (i + 1) % LIVE_STATS.length), 3000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ background: '#08080f', minHeight: '100vh', color: '#e2e8f0' }}>
      <style>{`
        @keyframes ticker-scroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }
        @keyframes hot-badge { 0%,100%{opacity:1} 50%{opacity:.65} }
        @keyframes slide-in { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
        @keyframes glow-ring { 0%,100%{box-shadow:0 0 20px rgba(124,58,237,0.25)} 50%{box-shadow:0 0 36px rgba(124,58,237,0.5)} }
        @keyframes stat-flip { 0%{opacity:0;transform:translateY(6px)} 30%,70%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-6px)} }
        .game-tab { transition: all .18s; cursor: pointer; }
        .game-tab:active { transform: scale(0.95); }
        .play-btn { transition: all .18s; }
        .play-btn:active { transform: scale(0.95); }
        @media (hover: hover) {
          .game-tab:hover { background: rgba(255,255,255,0.06) !important; }
          .play-btn:hover { filter: brightness(1.15); }
          .bot-btn:hover { background: rgba(124,58,237,0.2) !important; }
          .lb-link:hover { color: #a78bfa !important; }
        }
      `}</style>

      {/* ── Live wins ticker ───────────────────────────────────────────── */}
      <div style={{ background: 'rgba(34,197,94,0.04)', borderBottom: '1px solid rgba(34,197,94,0.08)', overflow: 'hidden', height: '34px', display: 'flex', alignItems: 'center' }}>
        <div style={{ flexShrink: 0, padding: '0 12px', fontSize: '0.65rem', fontFamily: 'Orbitron, sans-serif', fontWeight: 700, color: '#22c55e', letterSpacing: '0.08em', borderRight: '1px solid rgba(34,197,94,0.2)', whiteSpace: 'nowrap' }}>
          🏆 LIVE WINS
        </div>
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div style={{ display: 'inline-flex', animation: 'ticker-scroll 24s linear infinite', whiteSpace: 'nowrap' }}>
            {[...TICKER, ...TICKER].map((w, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0 24px', fontSize: '0.72rem', color: '#64748b', borderRight: '1px solid #12121a' }}>
                <span style={{ color: '#22c55e', fontWeight: 700 }}>{w.user}</span>
                <span>won</span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>{w.amount}</span>
                <span style={{ opacity: 0.5 }}>·</span>
                <span style={{ color: '#94a3b8' }}>{w.icon} {w.game}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────────── */}
      <div style={{ background: '#0b0b14', borderBottom: '1px solid #13131f', padding: '0 clamp(12px,4vw,32px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', height: '44px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0' }}>
            {[
              { label: 'GAMES', value: '7 LIVE', color: '#22c55e' },
              { label: 'CHAINS', value: '6', color: '#a78bfa' },
              { label: 'TOKEN', value: 'USDT', color: '#06b6d4' },
              { label: 'RAKE', value: '15%', color: '#f59e0b' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 20px', borderRight: i < 3 ? '1px solid #1a1a28' : 'none' }}>
                <span style={{ fontSize: '0.6rem', color: '#475569', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em' }}>{s.label}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: s.color, fontFamily: 'Orbitron, sans-serif' }}>{s.value}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'block', animation: 'pulse-dot 1.8s ease-in-out infinite' }} />
            <span style={{ color: '#22c55e', fontWeight: 700, fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', letterSpacing: '0.06em', overflow: 'hidden' }}>
              <span key={statIdx} style={{ display: 'inline-block', animation: 'stat-flip 3s ease-in-out' }}>
                {LIVE_STATS[statIdx].value} {LIVE_STATS[statIdx].label.toUpperCase()}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Main layout ────────────────────────────────────────────────── */}
      <div style={{ padding: 'clamp(16px,3vw,28px) clamp(12px,4vw,32px)', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: '20px' }}>

        {/* ── Game tabs row ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
          {GAMES.map(g => (
            <button key={g.id} className="game-tab"
              onClick={() => setActiveGame(g)}
              style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: '7px',
                padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                background: activeGame.id === g.id ? `rgba(${g.glowRgb},0.18)` : 'rgba(255,255,255,0.03)',
                borderBottom: activeGame.id === g.id ? `2px solid ${g.glow}` : '2px solid transparent',
                color: activeGame.id === g.id ? g.glow : '#64748b',
                fontFamily: 'Orbitron, sans-serif', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em',
                transition: 'all .18s',
              }}>
              <span style={{ fontSize: '1rem' }}>{g.emoji}</span>
              {g.short}
              {g.hot && <span style={{ fontSize: '0.55rem', padding: '2px 5px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '4px', animation: 'hot-badge 1.4s ease-in-out infinite' }}>HOT</span>}
            </button>
          ))}
        </div>

        {/* ── Featured game panel + side list ────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) clamp(240px,22vw,340px)', gap: '16px' }} className="home-grid">
          <style>{`
            @media (max-width: 768px) { .home-grid { grid-template-columns: 1fr !important; } .side-list { display: none !important; } }
          `}</style>

          {/* Featured panel */}
          <div key={activeGame.id} style={{
            background: activeGame.bgGrad, border: `1px solid rgba(${activeGame.glowRgb},0.3)`,
            borderRadius: '20px', padding: 'clamp(24px,4vw,40px)', position: 'relative', overflow: 'hidden',
            boxShadow: `0 8px 48px rgba(${activeGame.glowRgb},0.12)`,
            animation: mounted ? 'slide-in 0.25s ease-out' : 'none',
            minHeight: '320px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            {/* Top accent line */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, transparent, ${activeGame.glow}, transparent)` }} />
            {/* BG emoji watermark */}
            <div style={{ position: 'absolute', right: '-10px', top: '50%', transform: 'translateY(-50%)', fontSize: '140px', opacity: 0.05, pointerEvents: 'none', userSelect: 'none' }}>{activeGame.emoji}</div>

            <div>
              {/* Tags + HOT */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                {activeGame.hot && (
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', animation: 'hot-badge 1.4s ease-in-out infinite' }}>🔥 HOT</span>
                )}
                {activeGame.tags.map(t => (
                  <span key={t} style={{ fontSize: '0.65rem', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: `rgba(${activeGame.glowRgb},0.12)`, color: activeGame.glow, border: `1px solid rgba(${activeGame.glowRgb},0.25)` }}>{t}</span>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>● LIVE</span>
              </div>

              {/* Emoji + Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: `rgba(${activeGame.glowRgb},0.15)`, border: `1px solid rgba(${activeGame.glowRgb},0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', flexShrink: 0 }}>
                  {activeGame.emoji}
                </div>
                <div>
                  <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 'clamp(1.4rem,3vw,2rem)', color: '#fff', margin: 0, lineHeight: 1.1 }}>
                    {activeGame.title}
                  </h1>
                  <p style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '4px' }}>
                    {activeGame.players} players · USDT entry
                  </p>
                </div>
              </div>

              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.65, maxWidth: '480px', marginBottom: '28px' }}>
                {activeGame.desc}
              </p>
            </div>

            {/* CTA buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="play-btn"
                onClick={() => navigate(`/lobby/${activeGame.id}`)}
                style={{
                  background: `linear-gradient(135deg, rgba(${activeGame.glowRgb},0.9), rgba(6,182,212,0.85))`,
                  border: 'none', borderRadius: '12px', padding: '14px 32px', color: '#fff',
                  fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: '0.9rem',
                  cursor: 'pointer', letterSpacing: '0.06em',
                  boxShadow: `0 0 28px rgba(${activeGame.glowRgb},0.35)`,
                }}>
                PLAY NOW →
              </button>
              {activeGame.botMode && (
                <button className="bot-btn play-btn"
                  onClick={() => navigate('/game/practice', { state: { bot: true, entry: 0, gameMode: activeGame.id } })}
                  style={{
                    background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)',
                    borderRadius: '12px', padding: '14px 24px', color: '#a78bfa',
                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                  }}>
                  Try vs Bot
                </button>
              )}
            </div>
          </div>

          {/* Side game list */}
          <div className="side-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.6rem', color: '#475569', letterSpacing: '0.12em', marginBottom: '4px' }}>ALL GAMES</p>
            {GAMES.filter(g => g.id !== activeGame.id).map(g => (
              <button key={g.id} className="game-tab"
                onClick={() => setActiveGame(g)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                  background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(${g.glowRgb},0.15)`,
                  borderRadius: '12px', cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'all .18s',
                }}>
                <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{g.emoji}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.72rem', fontWeight: 700, color: '#cbd5e1', letterSpacing: '0.04em' }}>{g.title}</div>
                  <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '2px' }}>{g.players} players</div>
                </div>
                {g.hot && <span style={{ marginLeft: 'auto', fontSize: '0.55rem', padding: '2px 6px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: '4px', flexShrink: 0 }}>HOT</span>}
                <span style={{ color: g.glow, fontSize: '0.9rem', marginLeft: g.hot ? '0' : 'auto', flexShrink: 0 }}>›</span>
              </button>
            ))}
            <Link to="/leaderboard" className="lb-link" style={{ display: 'block', textAlign: 'center', padding: '10px', fontSize: '0.75rem', color: '#475569', textDecoration: 'none', marginTop: '4px', fontWeight: 600, transition: 'color .15s' }}>
              🏆 Leaderboard →
            </Link>
          </div>
        </div>

        {/* ── Mobile: compact game grid ───────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: '10px' }} className="mobile-game-grid">
          <style>{`@media (min-width: 769px){ .mobile-game-grid { display: none !important; } }`}</style>
          {GAMES.filter(g => g.id !== activeGame.id).map(g => (
            <button key={g.id} onClick={() => setActiveGame(g)}
              style={{
                background: `rgba(${g.glowRgb},0.07)`, border: `1px solid rgba(${g.glowRgb},0.2)`,
                borderRadius: '14px', padding: '16px 12px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
              }}>
              <span style={{ fontSize: '1.8rem' }}>{g.emoji}</span>
              <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.6rem', fontWeight: 700, color: g.glow, letterSpacing: '0.05em' }}>{g.short}</span>
            </button>
          ))}
        </div>

        {/* ── How it works ────────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid #111120', paddingTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }} className="how-grid">
          <style>{`@media (max-width: 540px){ .how-grid { grid-template-columns: 1fr !important; } }`}</style>
          {[
            { n: '01', icon: '💳', title: 'Connect', desc: 'Any EVM wallet. MetaMask, Coinbase, WalletConnect.' },
            { n: '02', icon: '🎮', title: 'Play', desc: 'Pick a game, pay USDT entry, compete against real players.' },
            { n: '03', icon: '💰', title: 'Win', desc: 'Winner claims 85% of the pot. Instant on-chain payout.' },
          ].map(s => (
            <div key={s.n} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #13131f', borderRadius: '14px', padding: '20px' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.55rem', color: '#2d2d48', letterSpacing: '0.15em', marginBottom: '10px' }}>{s.n}</div>
              <div style={{ fontSize: '1.6rem', marginBottom: '8px' }}>{s.icon}</div>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '6px', letterSpacing: '0.05em' }}>{s.title.toUpperCase()}</div>
              <div style={{ color: '#475569', fontSize: '0.8rem', lineHeight: 1.55 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
