import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const TICKER = [
  { user:'Kira_X',     game:'Coin Flip',      amount:'$18.70',  icon:'🪙' },
  { user:'NovaBet',    game:'Math Arena',     amount:'$42.50',  icon:'✚'  },
  { user:'0xShadow',   game:"Liar's Dice",    amount:'$85.00',  icon:'🎲' },
  { user:'CryptoAce',  game:'Reaction Grid',  amount:'$21.25',  icon:'⊞'  },
  { user:'Riven88',    game:'Highest Unique', amount:'$63.75',  icon:'↑'  },
  { user:'BlockBet',   game:'Coin Flip',      amount:'$42.50',  icon:'🪙' },
  { user:'Apex_V',     game:"Liar's Dice",    amount:'$127.50', icon:'🎲' },
  { user:'Mxlk',       game:'Pattern Memory', amount:'$17.00',  icon:'🧠' },
  { user:'ZeroG',      game:'Lowest Unique',  amount:'$8.50',   icon:'↓'  },
  { user:'SolKing',    game:'Math Arena',     amount:'$25.50',  icon:'✚'  },
]

const GAMES = [
  {
    id: 'coin-flip',
    title: 'Coin Flip',
    emoji: '🪙',
    short: 'COIN FLIP',
    desc: '1v1 pure tension. Pick Heads or Tails — best of 5 rounds. No edge, just nerve.',
    tags: ['1v1', 'Fast', 'Luck'],
    players: '2', maxPot: '$85',
    activePlayers: 24,
    glow: '#f59e0b', glowRgb: '245,158,11',
    bgFrom: '#f59e0b', bgTo: '#d97706',
    hot: true, botMode: true,
  },
  {
    id: 'math-arena',
    title: 'Math Arena',
    emoji: '✚',
    short: 'MATH',
    desc: 'Speed math — first correct answer scores. 100% pure skill, zero luck.',
    tags: ['Skill', 'Speed'],
    players: '2–10', maxPot: '$382',
    activePlayers: 31,
    glow: '#7c3aed', glowRgb: '124,58,237',
    bgFrom: '#7c3aed', bgTo: '#06b6d4',
    hot: false, botMode: true,
  },
  {
    id: 'reaction-grid',
    title: 'Reaction Grid',
    emoji: '⊞',
    short: 'REACTION',
    desc: 'A cell lights up — click it before anyone else. Pure reaction speed.',
    tags: ['Reflex', 'Speed'],
    players: '2–10', maxPot: '$382',
    activePlayers: 18,
    glow: '#f59e0b', glowRgb: '245,158,11',
    bgFrom: '#f59e0b', bgTo: '#ef4444',
    hot: false, botMode: true,
  },
  {
    id: 'liars-dice',
    title: "Liar's Dice",
    emoji: '🎲',
    short: "LIAR'S DICE",
    desc: 'Hidden dice. Bluff your bids, call LIAR! Deception is the only weapon.',
    tags: ['Bluff', 'Strategy'],
    players: '2–6', maxPot: '$229',
    activePlayers: 42,
    glow: '#f97316', glowRgb: '249,115,22',
    bgFrom: '#f97316', bgTo: '#ef4444',
    hot: false, botMode: true,
  },
  {
    id: 'pattern-memory',
    title: 'Pattern Memory',
    emoji: '🧠',
    short: 'MEMORY',
    desc: 'Tiles flash briefly — memorize every one, then tap them from memory.',
    tags: ['Memory', 'Focus'],
    players: '2–10', maxPot: '$382',
    activePlayers: 15,
    glow: '#a855f7', glowRgb: '168,85,247',
    bgFrom: '#a855f7', bgTo: '#7c3aed',
    hot: false, botMode: true,
  },
  {
    id: 'highest-unique',
    title: 'Highest Unique',
    emoji: '↑',
    short: 'HI UNIQUE',
    desc: 'Pick the highest number nobody else picks. Read the crowd. Outsmart them.',
    tags: ['Strategy', 'Mind'],
    players: '3–20', maxPot: '$765',
    activePlayers: 57,
    glow: '#22c55e', glowRgb: '34,197,94',
    bgFrom: '#22c55e', bgTo: '#06b6d4',
    hot: false, botMode: true,
  },
  {
    id: 'lowest-unique',
    title: 'Lowest Unique',
    emoji: '↓',
    short: 'LO UNIQUE',
    desc: 'Pick the lowest number nobody else picks. Contrarian thinking wins here.',
    tags: ['Strategy', 'Bluff'],
    players: '3–20', maxPot: '$765',
    activePlayers: 39,
    glow: '#ec4899', glowRgb: '236,72,153',
    bgFrom: '#ec4899', bgTo: '#7c3aed',
    hot: false, botMode: true,
  },
]

// fake rotating pot values for the featured panel

export default function Home() {
  const navigate = useNavigate()
  const [activeGame, setActiveGame] = useState(GAMES[0])
  const [playerCount, setPlayerCount] = useState(activeGame.activePlayers)

  // fake live pot + player drift
  useEffect(() => {
    setPlayerCount(activeGame.activePlayers)
    const t = setInterval(() => {
      setPlayerCount(n => n + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 3))
    }, 3500)
    return () => clearInterval(t)
  }, [activeGame])

  return (
    <div style={{ background: '#08080f', minHeight: '100vh', color: '#e2e8f0' }}>
      <style>{`
        @keyframes ticker-scroll  { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes pulse-dot      { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.5)} }
        @keyframes hot-badge      { 0%,100%{opacity:1;box-shadow:0 0 6px rgba(239,68,68,0.5)} 50%{opacity:.7;box-shadow:0 0 14px rgba(239,68,68,0.9)} }
        @keyframes slide-in       { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
        @keyframes pot-pop        { 0%{opacity:0;transform:scale(0.85) translateY(4px)} 60%{transform:scale(1.06)} 100%{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes scan-line      { 0%{top:-4px} 100%{top:105%} }
        @keyframes border-glow    { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes count-pop      { 0%{transform:scale(1)} 50%{transform:scale(1.18)} 100%{transform:scale(1)} }
        @keyframes float-emoji    { 0%,100%{transform:translateY(0) rotate(-6deg)} 50%{transform:translateY(-12px) rotate(6deg)} }

        .game-tab   { transition:all .16s; cursor:pointer; border:none; }
        .play-btn   { transition:all .16s; cursor:pointer; }
        .side-row   { transition:all .16s; cursor:pointer; }

        @media (hover:hover) {
          .game-tab:hover  { background:rgba(255,255,255,0.07) !important; }
          .play-btn:hover  { filter:brightness(1.15); transform:translateY(-1px); }
          .bot-btn:hover   { background:rgba(124,58,237,0.2) !important; }
          .side-row:hover  { background:rgba(255,255,255,0.05) !important; border-color:rgba(255,255,255,0.12) !important; }
          .lb-link:hover   { color:#a78bfa !important; }
        }
        .game-tab:active  { transform:scale(0.94); }
        .play-btn:active  { transform:scale(0.96); }

        ::-webkit-scrollbar { display:none; }
      `}</style>

      {/* ── Ticker ─────────────────────────────────────────────────────── */}
      <div style={{ background:'rgba(34,197,94,0.04)', borderBottom:'1px solid rgba(34,197,94,0.08)', overflow:'hidden', height:'32px', display:'flex', alignItems:'center' }}>
        <div style={{ flexShrink:0, padding:'0 14px', fontSize:'0.6rem', fontFamily:'Orbitron,sans-serif', fontWeight:700, color:'#22c55e', letterSpacing:'0.1em', borderRight:'1px solid rgba(34,197,94,0.15)', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:'6px' }}>
          <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse-dot 1.4s ease-in-out infinite' }}/>
          LIVE
        </div>
        <div style={{ overflow:'hidden', flex:1 }}>
          <div style={{ display:'inline-flex', animation:'ticker-scroll 22s linear infinite', whiteSpace:'nowrap' }}>
            {[...TICKER,...TICKER].map((w,i) => (
              <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'0 22px', fontSize:'0.7rem', color:'#475569', borderRight:'1px solid #0f0f1a' }}>
                <span style={{ color:'#94a3b8', fontWeight:700 }}>{w.user}</span>
                <span style={{ color:'#475569' }}>won</span>
                <span style={{ color:'#22c55e', fontWeight:800 }}>{w.amount}</span>
                <span style={{ opacity:.35 }}>·</span>
                <span style={{ color:'#475569' }}>{w.icon} {w.game}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── HUD stats bar ──────────────────────────────────────────────── */}
      <div style={{ background:'#0a0a14', borderBottom:'1px solid #111120', padding:'0 clamp(12px,3vw,28px)' }}>
        <div style={{ display:'flex', alignItems:'center', height:'42px', justifyContent:'space-between' }}>
          <div style={{ display:'flex' }}>
            {[
              { label:'GAMES', value:'7', color:'#7c3aed' },
              { label:'LIVE NOW', value:`${playerCount + 180}`, color:'#22c55e', pulse:true },
              { label:'CHAINS',  value:'6', color:'#06b6d4' },
              { label:'WINNER',  value:'85%', color:'#f59e0b' },
            ].map((s,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'7px', padding:'0 clamp(10px,2vw,20px)', borderRight:i<3?'1px solid #111120':'none' }}>
                {s.pulse && <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.6s ease-in-out infinite', flexShrink:0 }}/>}
                <span style={{ fontSize:'0.55rem', color:'#2d2d48', fontFamily:'Orbitron,sans-serif', letterSpacing:'0.1em' }}>{s.label}</span>
                <span style={{ fontSize:'0.82rem', fontWeight:900, color:s.color, fontFamily:'Orbitron,sans-serif' }}>{s.value}</span>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ fontSize:'0.6rem', color:'#2d2d48', fontFamily:'Orbitron,sans-serif', letterSpacing:'0.08em' }}>USDT · POLYGON · BSC · ETH</span>
          </div>
        </div>
      </div>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <div style={{ padding:'clamp(14px,2.5vw,24px) clamp(12px,3vw,28px)', display:'grid', gridTemplateColumns:'minmax(0,1fr)', gap:'16px' }}>

        {/* Game mode tabs */}
        <div style={{ display:'flex', gap:'6px', overflowX:'auto', scrollbarWidth:'none', paddingBottom:'2px' }}>
          {GAMES.map(g => {
            const active = activeGame.id === g.id
            return (
              <button key={g.id} className="game-tab"
                onClick={() => setActiveGame(g)}
                style={{
                  flexShrink:0, display:'flex', alignItems:'center', gap:'7px',
                  padding:'8px 18px', borderRadius:'10px',
                  background: active ? `rgba(${g.glowRgb},0.16)` : 'rgba(255,255,255,0.025)',
                  borderBottom: active ? `2px solid ${g.glow}` : '2px solid transparent',
                  color: active ? g.glow : '#475569',
                  fontFamily:'Orbitron,sans-serif', fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.06em',
                  boxShadow: active ? `0 4px 20px rgba(${g.glowRgb},0.2)` : 'none',
                }}>
                <span style={{ fontSize:'1rem' }}>{g.emoji}</span>
                {g.short}
                {g.hot && <span style={{ fontSize:'0.5rem', padding:'2px 6px', borderRadius:'4px', background:'rgba(239,68,68,0.18)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', animation:'hot-badge 1.6s ease-in-out infinite' }}>HOT</span>}
              </button>
            )
          })}
        </div>

        {/* Main 2-col */}
        <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) clamp(220px,21vw,320px)', gap:'14px' }} className="home-grid">
          <style>{`@media(max-width:768px){.home-grid{grid-template-columns:1fr!important}.side-col{display:none!important}}`}</style>

          {/* ── Featured game card ───────────────────────────── */}
          <div key={activeGame.id} style={{
            position:'relative', borderRadius:'20px', overflow:'hidden',
            border:`1px solid rgba(${activeGame.glowRgb},0.25)`,
            background:'#0c0c17',
            animation:'slide-in .2s ease-out',
            minHeight:'clamp(320px,40vh,480px)',
            display:'flex', flexDirection:'column',
          }}>
            {/* Gradient bg wash */}
            <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse at 70% 40%, rgba(${activeGame.glowRgb},0.12) 0%, transparent 65%)`, pointerEvents:'none' }}/>
            {/* Animated scanline */}
            <div style={{ position:'absolute', left:0, right:0, height:'3px', background:`linear-gradient(90deg,transparent,rgba(${activeGame.glowRgb},0.6),transparent)`, animation:'scan-line 4s linear infinite', pointerEvents:'none', zIndex:1 }}/>
            {/* Dot-grid pattern */}
            <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(255,255,255,0.03) 1px,transparent 1px)', backgroundSize:'24px 24px', pointerEvents:'none' }}/>
            {/* Top bar */}
            <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:`linear-gradient(90deg,transparent,${activeGame.glow},transparent)`, animation:'border-glow 2.5s ease-in-out infinite' }}/>

            {/* Content */}
            <div style={{ position:'relative', zIndex:2, padding:'clamp(20px,3vw,36px)', flex:1, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              {/* Top row */}
              <div>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                    {/* Big emoji */}
                    <div style={{
                      width:'68px', height:'68px', borderRadius:'18px', flexShrink:0,
                      background:`linear-gradient(135deg,rgba(${activeGame.glowRgb},0.25),rgba(${activeGame.glowRgb},0.08))`,
                      border:`1px solid rgba(${activeGame.glowRgb},0.35)`,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2.2rem',
                      boxShadow:`0 0 24px rgba(${activeGame.glowRgb},0.25)`,
                      animation:'float-emoji 3s ease-in-out infinite',
                    }}>
                      {activeGame.emoji}
                    </div>
                    <div>
                      <h1 style={{ fontFamily:'Orbitron,sans-serif', fontWeight:900, fontSize:'clamp(1.3rem,3vw,2rem)', margin:0, lineHeight:1.1, background:`linear-gradient(135deg,#fff 30%,${activeGame.glow})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                        {activeGame.title}
                      </h1>
                      <div style={{ display:'flex', gap:'6px', marginTop:'7px', flexWrap:'wrap' }}>
                        {activeGame.tags.map(t => (
                          <span key={t} style={{ fontSize:'0.62rem', fontWeight:700, padding:'3px 10px', borderRadius:'20px', background:`rgba(${activeGame.glowRgb},0.12)`, color:activeGame.glow, border:`1px solid rgba(${activeGame.glowRgb},0.25)`, letterSpacing:'0.05em' }}>{t}</span>
                        ))}
                        {activeGame.hot && (
                          <span style={{ fontSize:'0.62rem', fontWeight:700, padding:'3px 10px', borderRadius:'20px', background:'rgba(239,68,68,0.14)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', animation:'hot-badge 1.6s ease-in-out infinite' }}>🔥 HOT</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Live indicator */}
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 12px', borderRadius:'8px', background:'rgba(34,197,94,0.07)', border:'1px solid rgba(34,197,94,0.18)' }}>
                    <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.4s ease-in-out infinite' }}/>
                    <span style={{ fontSize:'0.62rem', fontFamily:'Orbitron,sans-serif', fontWeight:700, color:'#22c55e', letterSpacing:'0.08em' }}>LIVE</span>
                  </div>
                </div>

                <p style={{ color:'#64748b', fontSize:'0.9rem', lineHeight:1.7, marginBottom:'24px', maxWidth:'520px' }}>
                  {activeGame.desc}
                </p>

                {/* Game HUD stats */}
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'28px' }}>
                  {[
                    { label:'PLAYERS', value:activeGame.players, icon:'👥' },
                    { label:'MAX POT', value:activeGame.maxPot, icon:'💰', highlight:true },
                    { label:'ACTIVE', value:`${playerCount}`, icon:'🔴', pulse:true },
                    { label:'ENTRY', value:'$0.5–$50', icon:'💵' },
                  ].map((s,i) => (
                    <div key={i} style={{
                      padding:'10px 16px', borderRadius:'12px',
                      background: s.highlight ? `rgba(${activeGame.glowRgb},0.1)` : 'rgba(255,255,255,0.03)',
                      border: s.highlight ? `1px solid rgba(${activeGame.glowRgb},0.25)` : '1px solid #111120',
                      display:'flex', flexDirection:'column', gap:'3px', minWidth:'90px',
                    }}>
                      <span style={{ fontSize:'0.55rem', color:'#2d2d48', fontFamily:'Orbitron,sans-serif', letterSpacing:'0.1em' }}>{s.label}</span>
                      <span style={{ fontSize:'0.88rem', fontWeight:800, color: s.highlight ? activeGame.glow : '#e2e8f0', fontFamily:'Orbitron,sans-serif', display:'flex', alignItems:'center', gap:'5px' }}>
                        {s.pulse && <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse-dot 1.6s ease-in-out infinite' }}/>}
                        {s.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>
                <button className="play-btn"
                  onClick={() => navigate(`/lobby/${activeGame.id}`)}
                  style={{
                    background:`linear-gradient(135deg,${activeGame.bgFrom},${activeGame.bgTo})`,
                    border:'none', borderRadius:'12px', padding:'14px 36px', color:'#fff',
                    fontFamily:'Orbitron,sans-serif', fontWeight:900, fontSize:'0.9rem',
                    cursor:'pointer', letterSpacing:'0.07em',
                    boxShadow:`0 0 32px rgba(${activeGame.glowRgb},0.45), 0 4px 16px rgba(0,0,0,0.4)`,
                  }}>
                  PLAY NOW →
                </button>
                <button className="bot-btn play-btn"
                  onClick={() => navigate('/game/practice', { state:{ bot:true, entry:0, gameMode:activeGame.id } })}
                  style={{
                    background:'rgba(124,58,237,0.07)', border:'1px solid rgba(124,58,237,0.2)',
                    borderRadius:'12px', padding:'14px 22px', color:'#a78bfa',
                    fontWeight:700, fontSize:'0.82rem', cursor:'pointer', fontFamily:'Orbitron,sans-serif', letterSpacing:'0.04em',
                  }}>
                  vs Bot
                </button>
                <span style={{ fontSize:'0.7rem', color:'#2d2d48', marginLeft:'4px' }}>No wallet needed for practice</span>
              </div>
            </div>

            {/* Watermark emoji */}
            <div style={{ position:'absolute', right:'-16px', bottom:'-10px', fontSize:'160px', opacity:0.04, pointerEvents:'none', userSelect:'none', lineHeight:1 }}>{activeGame.emoji}</div>
          </div>

          {/* ── Side game list ─────────────────────────────── */}
          <div className="side-col" style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
            <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.55rem', color:'#2d2d48', letterSpacing:'0.14em', marginBottom:'4px', padding:'0 2px' }}>SELECT GAME</div>
            {GAMES.filter(g => g.id !== activeGame.id).map(g => (
              <button key={g.id} className="side-row"
                onClick={() => setActiveGame(g)}
                style={{
                  display:'flex', alignItems:'center', gap:'12px', padding:'11px 14px',
                  background:'rgba(255,255,255,0.02)', border:`1px solid rgba(${g.glowRgb},0.12)`,
                  borderRadius:'12px', cursor:'pointer', textAlign:'left', width:'100%',
                }}>
                <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:`rgba(${g.glowRgb},0.12)`, border:`1px solid rgba(${g.glowRgb},0.2)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem', flexShrink:0 }}>
                  {g.emoji}
                </div>
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.68rem', fontWeight:700, color:'#94a3b8', letterSpacing:'0.03em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{g.title}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:'5px', marginTop:'3px' }}>
                    <span style={{ width:'4px', height:'4px', borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse-dot 1.8s ease-in-out infinite' }}/>
                    <span style={{ fontSize:'0.6rem', color:'#2d2d48' }}>{g.activePlayers} active</span>
                  </div>
                </div>
                {g.hot && <span style={{ fontSize:'0.5rem', padding:'2px 5px', borderRadius:'4px', background:'rgba(239,68,68,0.15)', color:'#ef4444', flexShrink:0, border:'1px solid rgba(239,68,68,0.25)' }}>HOT</span>}
                <span style={{ color:`rgba(${g.glowRgb},0.6)`, fontSize:'0.85rem', flexShrink:0 }}>›</span>
              </button>
            ))}

            {/* Quick stats card */}
            <div style={{ marginTop:'4px', padding:'14px', background:'rgba(124,58,237,0.05)', border:'1px solid rgba(124,58,237,0.12)', borderRadius:'12px' }}>
              <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.55rem', color:'#2d2d48', letterSpacing:'0.12em', marginBottom:'10px' }}>PLATFORM STATS</div>
              {[
                { label:'Total wagered', value:'$284,710', color:'#a78bfa' },
                { label:'Games played', value:'18,432', color:'#06b6d4' },
                { label:'Biggest pot', value:'$1,275', color:'#f59e0b' },
              ].map(s => (
                <div key={s.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid #0f0f1a' }}>
                  <span style={{ fontSize:'0.68rem', color:'#475569' }}>{s.label}</span>
                  <span style={{ fontSize:'0.72rem', fontWeight:700, color:s.color, fontFamily:'Orbitron,sans-serif' }}>{s.value}</span>
                </div>
              ))}
              <Link to="/leaderboard" className="lb-link" style={{ display:'block', textAlign:'center', marginTop:'10px', fontSize:'0.68rem', color:'#475569', textDecoration:'none', fontWeight:600, transition:'color .15s' }}>
                🏆 View Leaderboard →
              </Link>
            </div>
          </div>
        </div>

        {/* ── Mobile game switcher ─────────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:'8px' }} className="mobile-grid">
          <style>{`@media(min-width:769px){.mobile-grid{display:none!important}}`}</style>
          {GAMES.filter(g => g.id !== activeGame.id).map(g => (
            <button key={g.id} onClick={() => setActiveGame(g)}
              style={{
                background:`rgba(${g.glowRgb},0.07)`, border:`1px solid rgba(${g.glowRgb},0.18)`,
                borderRadius:'14px', padding:'14px 10px', cursor:'pointer',
                display:'flex', flexDirection:'column', alignItems:'center', gap:'7px',
              }}>
              <span style={{ fontSize:'1.6rem' }}>{g.emoji}</span>
              <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.58rem', fontWeight:700, color:g.glow, letterSpacing:'0.04em' }}>{g.short}</span>
              <span style={{ fontSize:'0.6rem', color:'#475569' }}>{g.activePlayers} active</span>
            </button>
          ))}
        </div>

        {/* ── How it works strip ───────────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', paddingTop:'8px', borderTop:'1px solid #0f0f1a' }} className="how-grid">
          <style>{`@media(max-width:540px){.how-grid{grid-template-columns:1fr!important}}`}</style>
          {[
            { n:'01', icon:'💳', title:'CONNECT',  desc:'Any EVM wallet. MetaMask, Coinbase, WalletConnect — one click.' },
            { n:'02', icon:'🎮', title:'COMPETE',  desc:'Pick a game, set your entry, play against real opponents for real USDT.' },
            { n:'03', icon:'🏆', title:'CLAIM',    desc:'Winner claims 85% of the pot directly on-chain. Instant. Trustless.' },
          ].map(s => (
            <div key={s.n} style={{ background:'rgba(255,255,255,0.015)', border:'1px solid #0f0f1a', borderRadius:'14px', padding:'18px 16px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:'10px', right:'12px', fontFamily:'Orbitron,sans-serif', fontSize:'0.55rem', color:'#1a1a28', letterSpacing:'0.15em' }}>{s.n}</div>
              <div style={{ fontSize:'1.5rem', marginBottom:'8px' }}>{s.icon}</div>
              <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.7rem', fontWeight:700, color:'#e2e8f0', marginBottom:'5px', letterSpacing:'0.06em' }}>{s.title}</div>
              <div style={{ color:'#475569', fontSize:'0.78rem', lineHeight:1.55 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
