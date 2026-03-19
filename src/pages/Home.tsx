import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { connectSocket } from '../utils/socket'
import { getUsername } from '../utils/profile'

// ─── Animated game icons (no emoji) ─────────────────────────────────────────

function IconCoin({ size = 44, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, #fde68a 0%, #f59e0b 50%, #92400e 100%)',
      boxShadow: `0 0 ${size * 0.4}px rgba(245,158,11,0.55), inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.3)`,
      border: '2px solid rgba(251,191,36,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, position: 'relative', overflow: 'hidden',
      animation: spin ? 'coin-spin 2s linear infinite' : 'none',
    }}>
      <div style={{ position: 'absolute', inset: '18%', borderRadius: '50%', border: '1px solid rgba(120,53,15,0.45)' }} />
      <span style={{ fontFamily: 'Orbitron,sans-serif', fontWeight: 900, fontSize: size * 0.26, color: '#78350f', letterSpacing: '0.02em', position: 'relative', zIndex: 1 }}>H|T</span>
    </div>
  )
}

function IconMath({ size = 44 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      background: 'linear-gradient(145deg, #8b5cf6 0%, #4c1d95 100%)',
      boxShadow: `0 0 ${size * 0.38}px rgba(124,58,237,0.5), inset 0 1px 3px rgba(255,255,255,0.15)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      animation: 'math-pulse 2s ease-in-out infinite',
    }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="white">
        <rect x="11" y="3" width="2" height="18" rx="1" />
        <rect x="3" y="11" width="18" height="2" rx="1" />
      </svg>
    </div>
  )
}

function IconGrid({ size = 44 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      background: 'linear-gradient(145deg, #0891b2 0%, #164e63 100%)',
      boxShadow: `0 0 ${size * 0.38}px rgba(6,182,212,0.45), inset 0 1px 3px rgba(255,255,255,0.12)`,
      display: 'grid', gridTemplateColumns: '1fr 1fr',
      gap: size * 0.1, padding: size * 0.13, flexShrink: 0,
    }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          borderRadius: size * 0.07,
          background: 'rgba(103,232,249,0.35)',
          animation: `cell-flash 2.4s ${i * 0.6}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  )
}

function IconDice({ size = 44 }: { size?: number }) {
  const d = size * 0.12
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      background: 'linear-gradient(145deg, #fb923c 0%, #9a3412 100%)',
      boxShadow: `0 0 ${size * 0.38}px rgba(249,115,22,0.45), inset 0 1px 3px rgba(255,255,255,0.15)`,
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr 1fr',
      padding: size * 0.13, gap: d, flexShrink: 0,
      animation: 'dice-tilt 3s ease-in-out infinite',
    }}>
      {[1,0,1,0,1,0,1,0,1].map((on, i) => (
        <div key={i} style={{ borderRadius: '50%', background: on ? 'rgba(255,255,255,0.9)' : 'transparent' }} />
      ))}
    </div>
  )
}

function IconMemory({ size = 44 }: { size?: number }) {
  const pat = [1,0,1,0,1,0,1,0,1]
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      background: 'linear-gradient(145deg, #9333ea 0%, #581c87 100%)',
      boxShadow: `0 0 ${size * 0.38}px rgba(168,85,247,0.45), inset 0 1px 3px rgba(255,255,255,0.12)`,
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr 1fr',
      padding: size * 0.1, gap: size * 0.06, flexShrink: 0,
    }}>
      {pat.map((on, i) => (
        <div key={i} style={{
          borderRadius: size * 0.04,
          background: on ? 'rgba(216,180,254,0.85)' : 'rgba(168,85,247,0.18)',
          animation: `tile-blink 2.8s ${i * 0.28}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  )
}

function IconArrowUp({ size = 44 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      background: 'linear-gradient(145deg, #22c55e 0%, #14532d 100%)',
      boxShadow: `0 0 ${size * 0.38}px rgba(34,197,94,0.45), inset 0 1px 3px rgba(255,255,255,0.12)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      animation: 'arrow-up 1.8s ease-in-out infinite',
    }}>
      <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none">
        <path d="M12 5l7 7h-4v7H9v-7H5l7-7z" fill="rgba(255,255,255,0.9)" />
      </svg>
    </div>
  )
}

function IconArrowDown({ size = 44 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      background: 'linear-gradient(145deg, #ec4899 0%, #831843 100%)',
      boxShadow: `0 0 ${size * 0.38}px rgba(236,72,153,0.45), inset 0 1px 3px rgba(255,255,255,0.12)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      animation: 'arrow-down 1.8s ease-in-out infinite',
    }}>
      <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none">
        <path d="M12 19l-7-7h4V5h6v7h4l-7 7z" fill="rgba(255,255,255,0.9)" />
      </svg>
    </div>
  )
}

function GameIcon({ id, size = 44, spin = false }: { id: string; size?: number; spin?: boolean }) {
  if (id === 'coin-flip')      return <IconCoin size={size} spin={spin} />
  if (id === 'math-arena')     return <IconMath size={size} />
  if (id === 'reaction-grid')  return <IconGrid size={size} />
  if (id === 'liars-dice')     return <IconDice size={size} />
  if (id === 'pattern-memory') return <IconMemory size={size} />
  if (id === 'highest-unique') return <IconArrowUp size={size} />
  return <IconArrowDown size={size} />
}

// ─── Data ───────────────────────────────────────────────────────────────────

const GAMES = [
  { id:'coin-flip',      title:'Coin Flip',      short:'COIN FLIP',   desc:'Pick Heads or Tails. Best of 5 rounds. Pure 50/50 with nerve on the line.',        tags:['1v1','Fast'],       players:'2',    maxPot:'$85',  activePlayers:24, glow:'#f59e0b', glowRgb:'245,158,11', bgFrom:'#f59e0b', bgTo:'#d97706', hot:true  },
  { id:'math-arena',     title:'Math Arena',     short:'MATH',        desc:'Speed math. First correct answer scores. 100% skill, zero luck.',                   tags:['Skill','Speed'],    players:'2-10', maxPot:'$382', activePlayers:31, glow:'#7c3aed', glowRgb:'124,58,237', bgFrom:'#7c3aed', bgTo:'#06b6d4', hot:false },
  { id:'reaction-grid',  title:'Reaction Grid',  short:'REACTION',    desc:'A cell lights up. Click it before anyone else does.',                                tags:['Reflex'],           players:'2-10', maxPot:'$382', activePlayers:18, glow:'#06b6d4', glowRgb:'6,182,212',  bgFrom:'#06b6d4', bgTo:'#7c3aed', hot:false },
  { id:'liars-dice',     title:"Liar's Dice",    short:"LIAR'S DICE", desc:'Hidden dice. Bluff your bids. Call LIAR to eliminate. Deception wins.',             tags:['Bluff','Strategy'], players:'2-6',  maxPot:'$229', activePlayers:42, glow:'#f97316', glowRgb:'249,115,22', bgFrom:'#f97316', bgTo:'#ef4444', hot:false },
  { id:'pattern-memory', title:'Pattern Memory', short:'MEMORY',      desc:'Tiles flash briefly then go dark. Memorize every one and tap them back.',           tags:['Memory'],           players:'2-10', maxPot:'$382', activePlayers:15, glow:'#a855f7', glowRgb:'168,85,247', bgFrom:'#a855f7', bgTo:'#7c3aed', hot:false },
  { id:'highest-unique', title:'Highest Unique', short:'HI UNIQUE',   desc:'Pick the highest number that nobody else picks. Read the crowd. Outsmart them.',    tags:['Strategy'],         players:'3-20', maxPot:'$765', activePlayers:57, glow:'#22c55e', glowRgb:'34,197,94',  bgFrom:'#22c55e', bgTo:'#06b6d4', hot:false },
  { id:'lowest-unique',  title:'Lowest Unique',  short:'LO UNIQUE',   desc:'Pick the lowest number that nobody else picks. Contrarian thinking wins here.',     tags:['Bluff'],            players:'3-20', maxPot:'$765', activePlayers:39, glow:'#ec4899', glowRgb:'236,72,153', bgFrom:'#ec4899', bgTo:'#7c3aed', hot:false },
]

const RECENT_WINS = [
  { user:'Kira_X',    gid:'coin-flip',      amount:'+$18.70', t:'2s ago'  },
  { user:'0xShadow',  gid:'liars-dice',     amount:'+$85.00', t:'14s ago' },
  { user:'NovaBet',   gid:'math-arena',     amount:'+$42.50', t:'31s ago' },
  { user:'CryptoAce', gid:'reaction-grid',  amount:'+$21.25', t:'1m ago'  },
  { user:'Apex_V',    gid:'liars-dice',     amount:'+$127.50',t:'2m ago'  },
  { user:'Riven88',   gid:'highest-unique', amount:'+$63.75', t:'3m ago'  },
  { user:'Mxlk',      gid:'pattern-memory', amount:'+$17.00', t:'4m ago'  },
  { user:'SolKing',   gid:'math-arena',     amount:'+$25.50', t:'5m ago'  },
]

type ChatMsg      = { username: string; message: string; ts: number }
type ActivityItem = { text: string; ts: number }

const CHAT_COLORS = ['#7c3aed','#06b6d4','#f59e0b','#22c55e','#ec4899','#f97316']

export default function Home() {
  const navigate    = useNavigate()
  const { address } = useAccount()
  const myName      = address ? getUsername(address) : 'Guest'

  const [activeGame, setActiveGame] = useState(GAMES[0])
  const [playerCount, setPlayerCount] = useState(GAMES[0].activePlayers)
  const [chat, setChat]       = useState<ChatMsg[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [chatInput, setChatInput] = useState('')
  const [rightTab, setRightTab] = useState<'wins'|'feed'>('wins')
  const chatEndRef  = useRef<HTMLDivElement>(null)
  const carouselRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPlayerCount(activeGame.activePlayers)
    const t = setInterval(() => setPlayerCount(n => Math.max(2, n + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 3))), 3500)
    return () => clearInterval(t)
  }, [activeGame])

  useEffect(() => {
    const s = connectSocket()
    s.on('chat:message',    (m: ChatMsg)        => setChat(p => [...p, m].slice(-80)))
    s.on('activity:update', (f: ActivityItem[]) => setActivity(f))
    s.on('online:count',    (n: number)          => setOnlineCount(n))
    s.emit('chat:history',  (h: ChatMsg[])       => setChat(h))
    s.emit('activity:get',  (f: ActivityItem[])  => setActivity(f))
    return () => { s.off('chat:message'); s.off('activity:update'); s.off('online:count') }
  }, [])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat])

  function sendChat() {
    const msg = chatInput.trim().slice(0, 200)
    if (!msg || !address) return
    connectSocket().emit('global:chat:send', { username: myName, message: msg })
    setChatInput('')
  }

  function slideCarousel(dir: 1 | -1) {
    carouselRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' })
  }

  const g = activeGame

  return (
    <div style={{ background:'#08080f', height:'calc(100vh - 60px)', color:'#e2e8f0', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <style>{`
        @keyframes pulse-dot   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.6)} }
        @keyframes scan-line   { 0%{top:-3px} 100%{top:104%} }
        @keyframes border-glow { 0%,100%{opacity:.3} 50%{opacity:.9} }
        @keyframes coin-spin   { 0%{transform:perspective(180px) rotateY(0deg)} 100%{transform:perspective(180px) rotateY(360deg)} }
        @keyframes math-pulse  { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.4) drop-shadow(0 0 8px #a78bfa)} }
        @keyframes cell-flash  { 0%,100%{background:rgba(103,232,249,0.25)} 50%{background:rgba(103,232,249,0.95);box-shadow:0 0 8px rgba(6,182,212,0.8)} }
        @keyframes dice-tilt   { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(15deg)} }
        @keyframes tile-blink  { 0%,100%{opacity:.25} 50%{opacity:1;box-shadow:0 0 6px rgba(168,85,247,0.8)} }
        @keyframes arrow-up    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes arrow-down  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(5px)} }
        @keyframes card-idle   { 0%,100%{box-shadow:var(--cs)} 50%{box-shadow:var(--cs-hi)} }
        @keyframes hot-badge   { 0%,100%{box-shadow:0 0 5px rgba(239,68,68,0.4)} 50%{box-shadow:0 0 14px rgba(239,68,68,0.9)} }
        @keyframes slide-in    { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }

        .g-tab,.play-btn,.bot-btn,.r-tab,.carousel-card,.slide-btn { cursor:pointer; border:none; transition:all .14s; }
        .play-btn:active   { transform:scale(.96); }
        .g-tab:active      { transform:scale(.93); }
        .carousel-card:active { transform:scale(.97); }
        .slide-btn:active  { transform:scale(.9); }

        @media (hover:hover) {
          .g-tab:hover        { background:rgba(255,255,255,0.06)!important; color:#94a3b8!important; }
          .play-btn:hover     { filter:brightness(1.15); transform:translateY(-1px); }
          .bot-btn:hover      { background:rgba(124,58,237,0.22)!important; }
          .r-tab:hover        { background:rgba(255,255,255,0.04)!important; }
          .carousel-card:hover { transform:translateY(-4px) scale(1.02)!important; }
          .slide-btn:hover    { background:rgba(255,255,255,0.1)!important; }
          .send-btn:hover     { filter:brightness(1.15); }
        }
        ::-webkit-scrollbar { display:none; }
        * { scrollbar-width:none; }

        @media (max-width:700px) {
          .left-chat  { display:none!important; }
          .right-feed { display:none!important; }
          .mob-chat   { display:flex!important; }
        }
        @media (min-width:701px) { .mob-chat { display:none!important; } }
      `}</style>

      {/* ── Recent wins strip ─────────────────────────────────── */}
      <div style={{ background:'#070710', borderBottom:'1px solid #0d0d1e', display:'flex', alignItems:'stretch', height:'36px', flexShrink:0, overflowX:'auto' }}>
        <div style={{ flexShrink:0, padding:'0 14px', display:'flex', alignItems:'center', gap:'6px', borderRight:'1px solid #111125' }}>
          <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.4s infinite' }} />
          <span style={{ fontSize:'0.56rem', fontFamily:'Orbitron,sans-serif', color:'#22c55e', fontWeight:700, letterSpacing:'0.08em' }}>LIVE</span>
          <span style={{ fontSize:'0.62rem', color:'#22c55e', fontFamily:'Orbitron,sans-serif', fontWeight:900, marginLeft:'2px' }}>{onlineCount || '--'}</span>
        </div>
        {RECENT_WINS.map((w, i) => (
          <div key={i} style={{ flexShrink:0, display:'flex', alignItems:'center', gap:'8px', padding:'0 16px', borderRight:'1px solid #0d0d1c' }}>
            <GameIcon id={w.gid} size={18} />
            <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.6rem', fontWeight:700, color:'#64748b' }}>{w.user}</span>
            <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.66rem', fontWeight:900, color:'#22c55e' }}>{w.amount}</span>
            <span style={{ fontSize:'0.52rem', color:'#1e2030' }}>{w.t}</span>
          </div>
        ))}
      </div>

      {/* ── 3-column body ──────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>

        {/* LEFT: chat panel */}
        <div className="left-chat" style={{ width:'270px', flexShrink:0, borderRight:'1px solid #0d0d1e', display:'flex', flexDirection:'column', background:'#06060e' }}>
          <div style={{ padding:'10px 14px', borderBottom:'1px solid #0d0d1e', display:'flex', alignItems:'center', gap:'7px', flexShrink:0 }}>
            <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.6s infinite' }} />
            <span style={{ fontSize:'0.58rem', fontFamily:'Orbitron,sans-serif', color:'#374151', fontWeight:700, letterSpacing:'0.1em', flex:1 }}>GENERAL CHAT</span>
            <span style={{ fontSize:'0.58rem', color:'#1e2030', fontFamily:'Orbitron,sans-serif' }}>{onlineCount || '--'}</span>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:'6px' }}>
            {chat.length === 0
              ? <div style={{ textAlign:'center', color:'#1e2030', fontSize:'0.72rem', marginTop:'24px' }}>Connecting...</div>
              : chat.map((m, i) => {
                  const isMe = m.username === myName
                  const col  = CHAT_COLORS[m.username.charCodeAt(0) % CHAT_COLORS.length]
                  return (
                    <div key={i} style={{ display:'flex', gap:'8px', alignItems:'flex-start' }}>
                      <div style={{ width:'26px', height:'26px', borderRadius:'7px', background:`${col}1a`, border:`1px solid ${col}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.58rem', fontWeight:800, color:col, flexShrink:0, marginTop:'1px' }}>
                        {m.username.slice(0,2).toUpperCase()}
                      </div>
                      <div style={{ minWidth:0 }}>
                        <span style={{ fontSize:'0.6rem', color: isMe ? '#a78bfa' : col, fontWeight:700 }}>{isMe ? 'You' : m.username}</span>
                        <div style={{ fontSize:'0.72rem', color:'#4b5563', lineHeight:1.45, wordBreak:'break-word', marginTop:'1px' }}>{m.message}</div>
                      </div>
                    </div>
                  )
                })
            }
            <div ref={chatEndRef} />
          </div>

          {/* Chat input with send button */}
          <div style={{ padding:'10px 12px', borderTop:'1px solid #0d0d1e', flexShrink:0 }}>
            <div style={{ display:'flex', gap:'6px', background:'rgba(255,255,255,0.028)', border:'1px solid #111125', borderRadius:'10px', padding:'8px 10px', alignItems:'center' }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder={address ? 'Type a message...' : 'Connect wallet to chat'}
                disabled={!address}
                style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#cbd5e1', fontSize:'0.73rem', minWidth:0 }}
              />
              <button
                className="send-btn"
                onClick={sendChat}
                disabled={!address || !chatInput.trim()}
                style={{
                  background: address && chatInput.trim() ? 'linear-gradient(135deg,#7c3aed,#06b6d4)' : 'rgba(255,255,255,0.04)',
                  border: 'none', borderRadius:'7px', padding:'5px 12px',
                  color: address && chatInput.trim() ? '#fff' : '#374151',
                  fontSize:'0.62rem', fontWeight:700, cursor: address && chatInput.trim() ? 'pointer' : 'default',
                  fontFamily:'Orbitron,sans-serif', letterSpacing:'0.04em', flexShrink:0,
                  transition:'all .14s',
                }}
              >
                SEND
              </button>
            </div>
          </div>
        </div>

        {/* CENTER: game area */}
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Game selector tabs */}
          <div style={{ display:'flex', gap:'3px', overflowX:'auto', padding:'10px 14px 0', flexShrink:0, background:'#08080f', borderBottom:'1px solid #0d0d1e' }}>
            {GAMES.map(gg => {
              const active = activeGame.id === gg.id
              return (
                <button key={gg.id} className="g-tab"
                  onClick={() => setActiveGame(gg)}
                  style={{
                    flexShrink:0, display:'flex', alignItems:'center', gap:'6px',
                    padding:'7px 13px 9px', borderRadius:'9px 9px 0 0', marginBottom:'-1px',
                    background: active ? '#0c0c17' : 'transparent',
                    border: `1px solid ${active ? `rgba(${gg.glowRgb},0.28)` : 'transparent'}`,
                    borderBottom: active ? '1px solid #0c0c17' : '1px solid transparent',
                    borderTop: active ? `2px solid ${gg.glow}` : '2px solid transparent',
                    color: active ? gg.glow : '#374151',
                    fontFamily:'Orbitron,sans-serif', fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.05em',
                  }}>
                  <GameIcon id={gg.id} size={16} />
                  {gg.short}
                  <span style={{ fontSize:'0.5rem', color: active ? `rgba(${gg.glowRgb},0.7)` : '#1e2030' }}>{gg.activePlayers}</span>
                  {gg.hot && <span style={{ fontSize:'0.44rem', padding:'1px 4px', borderRadius:'4px', background:'rgba(239,68,68,0.16)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.28)', animation:'hot-badge 1.6s infinite' }}>HOT</span>}
                </button>
              )
            })}
          </div>

          {/* Scrollable content */}
          <div style={{ flex:1, overflowY:'auto', padding:'14px 14px', display:'flex', flexDirection:'column', gap:'14px', minHeight:0 }}>

            {/* Featured game panel */}
            <div key={g.id} style={{ position:'relative', borderRadius:'18px', overflow:'hidden', border:`1px solid rgba(${g.glowRgb},0.22)`, background:'#0b0b16', animation:'slide-in .2s ease-out', flexShrink:0 }}>
              <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse at 70% 40%, rgba(${g.glowRgb},0.12) 0%, transparent 58%)`, pointerEvents:'none' }} />
              <div style={{ position:'absolute', left:0, right:0, height:'2px', background:`linear-gradient(90deg,transparent,rgba(${g.glowRgb},0.75),transparent)`, animation:'scan-line 4s linear infinite', pointerEvents:'none', zIndex:1 }} />
              <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(255,255,255,0.018) 1px,transparent 1px)', backgroundSize:'26px 26px', pointerEvents:'none' }} />
              <div style={{ position:'absolute', top:0, left:0, right:0, height:'1px', background:`linear-gradient(90deg,transparent,${g.glow},transparent)`, animation:'border-glow 2.5s ease-in-out infinite' }} />

              <div style={{ position:'relative', zIndex:2, padding:'clamp(16px,2.2vw,28px)', display:'flex', gap:'clamp(14px,2vw,24px)', alignItems:'center', flexWrap:'wrap' }}>
                <GameIcon id={g.id} size={74} spin={g.id === 'coin-flip'} />

                <div style={{ flex:1, minWidth:'150px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'5px' }}>
                    <h2 style={{ fontFamily:'Orbitron,sans-serif', fontWeight:900, fontSize:'clamp(1rem,2.3vw,1.65rem)', margin:0, background:`linear-gradient(135deg,#fff 35%,${g.glow})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                      {g.title}
                    </h2>
                    <div style={{ display:'flex', alignItems:'center', gap:'4px', padding:'3px 8px', borderRadius:'6px', background:'rgba(34,197,94,0.07)', border:'1px solid rgba(34,197,94,0.16)', flexShrink:0 }}>
                      <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.4s infinite' }} />
                      <span style={{ fontSize:'0.54rem', fontFamily:'Orbitron,sans-serif', fontWeight:700, color:'#22c55e', letterSpacing:'0.06em' }}>LIVE</span>
                    </div>
                  </div>
                  <p style={{ color:'#4b5563', fontSize:'0.83rem', lineHeight:1.6, margin:'0 0 11px', maxWidth:'420px' }}>{g.desc}</p>
                  <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
                    {g.tags.map(t => <span key={t} style={{ fontSize:'0.55rem', fontWeight:700, padding:'2px 8px', borderRadius:'20px', background:`rgba(${g.glowRgb},0.1)`, color:g.glow, border:`1px solid rgba(${g.glowRgb},0.2)`, letterSpacing:'0.05em' }}>{t}</span>)}
                    {g.hot && <span style={{ fontSize:'0.55rem', fontWeight:700, padding:'2px 8px', borderRadius:'20px', background:'rgba(239,68,68,0.12)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.26)', animation:'hot-badge 1.6s infinite' }}>HOT</span>}
                  </div>
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:'10px', flexShrink:0, alignItems:'flex-end' }}>
                  <div style={{ display:'flex', gap:'6px' }}>
                    {([
                      { l:'MAX POT', v:g.maxPot,        hi:true,  pulse:false },
                      { l:'ACTIVE',  v:`${playerCount}`, hi:false, pulse:true  },
                      { l:'ENTRY',   v:'$0.5+',          hi:false, pulse:false },
                    ] as { l:string; v:string; hi:boolean; pulse:boolean }[]).map((s, i) => (
                      <div key={i} style={{ padding:'7px 11px', borderRadius:'9px', background: s.hi ? `rgba(${g.glowRgb},0.1)` : 'rgba(255,255,255,0.024)', border: s.hi ? `1px solid rgba(${g.glowRgb},0.2)` : '1px solid #0e0e1c', display:'flex', flexDirection:'column', gap:'2px', minWidth:'62px', textAlign:'center' }}>
                        <span style={{ fontSize:'0.46rem', color:'#374151', fontFamily:'Orbitron,sans-serif', letterSpacing:'0.1em' }}>{s.l}</span>
                        <span style={{ fontSize:'0.8rem', fontWeight:800, color: s.hi ? g.glow : '#e2e8f0', fontFamily:'Orbitron,sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:'3px' }}>
                          {s.pulse && <span style={{ width:'4px', height:'4px', borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse-dot 1.6s infinite' }} />}
                          {s.v}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:'7px' }}>
                    <button className="play-btn" onClick={() => navigate(`/lobby/${g.id}`)}
                      style={{ background:`linear-gradient(135deg,${g.bgFrom},${g.bgTo})`, borderRadius:'10px', padding:'11px 26px', color:'#fff', fontFamily:'Orbitron,sans-serif', fontWeight:900, fontSize:'0.84rem', letterSpacing:'0.08em', boxShadow:`0 0 26px rgba(${g.glowRgb},0.42)` }}>
                      PLAY NOW
                    </button>
                    <button className="bot-btn play-btn" onClick={() => navigate('/game/practice', { state:{ bot:true, entry:0, gameMode:g.id } })}
                      style={{ background:'rgba(124,58,237,0.07)', border:'1px solid rgba(124,58,237,0.2)', borderRadius:'10px', padding:'11px 16px', color:'#a78bfa', fontWeight:700, fontSize:'0.75rem', fontFamily:'Orbitron,sans-serif' }}>
                      vs Bot
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* All games carousel */}
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
                <span style={{ fontSize:'0.52rem', fontFamily:'Orbitron,sans-serif', color:'#374151', letterSpacing:'0.12em', fontWeight:700, flex:1 }}>ALL GAMES</span>
                <button className="slide-btn" onClick={() => slideCarousel(-1)}
                  style={{ width:'26px', height:'26px', borderRadius:'6px', background:'rgba(255,255,255,0.04)', border:'1px solid #111125', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M7 1L3 5l4 4" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button className="slide-btn" onClick={() => slideCarousel(1)}
                  style={{ width:'26px', height:'26px', borderRadius:'6px', background:'rgba(255,255,255,0.04)', border:'1px solid #111125', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 1l4 4-4 4" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
              <div ref={carouselRef} style={{ display:'flex', gap:'10px', overflowX:'auto', paddingBottom:'4px' }}>
                {GAMES.filter(gg => gg.id !== activeGame.id).map(gg => (
                  <button key={gg.id} className="carousel-card"
                    onClick={() => setActiveGame(gg)}
                    style={{
                      flexShrink:0, width:'155px', height:'190px',
                      background:`linear-gradient(160deg, rgba(${gg.glowRgb},0.09) 0%, #0b0b16 60%)`,
                      border:`1px solid rgba(${gg.glowRgb},0.2)`,
                      borderRadius:'16px', padding:'0',
                      display:'flex', flexDirection:'column', textAlign:'left',
                      position:'relative', overflow:'hidden', cursor:'pointer',
                    }}>
                    {/* Top glow line */}
                    <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:`linear-gradient(90deg,transparent,${gg.glow},transparent)`, opacity:0.7 }} />
                    {/* Dot grid bg */}
                    <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(255,255,255,0.015) 1px,transparent 1px)', backgroundSize:'20px 20px', pointerEvents:'none' }} />
                    {/* Radial glow */}
                    <div style={{ position:'absolute', top:0, left:0, right:0, height:'60%', background:`radial-gradient(ellipse at 50% 0%, rgba(${gg.glowRgb},0.12) 0%, transparent 70%)`, pointerEvents:'none' }} />

                    {/* Icon preview area */}
                    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', zIndex:1 }}>
                      <div style={{ position:'relative' }}>
                        <div style={{ position:'absolute', inset:'-12px', borderRadius:'50%', background:`radial-gradient(circle, rgba(${gg.glowRgb},0.2) 0%, transparent 70%)`, pointerEvents:'none' }} />
                        <GameIcon id={gg.id} size={58} spin={gg.id === 'coin-flip'} />
                      </div>
                    </div>

                    {/* Info bottom */}
                    <div style={{ padding:'10px 12px 12px', position:'relative', zIndex:1, borderTop:`1px solid rgba(${gg.glowRgb},0.1)`, background:'rgba(0,0,0,0.3)' }}>
                      <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.62rem', fontWeight:700, color:'#cbd5e1', letterSpacing:'0.03em', marginBottom:'5px', display:'flex', alignItems:'center', gap:'5px' }}>
                        {gg.title}
                        {gg.hot && <span style={{ fontSize:'0.44rem', padding:'1px 4px', borderRadius:'3px', background:'rgba(239,68,68,0.16)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.26)', animation:'hot-badge 1.6s infinite', flexShrink:0 }}>HOT</span>}
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                          <span style={{ width:'4px', height:'4px', borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse-dot 1.8s infinite' }} />
                          <span style={{ fontSize:'0.56rem', color:'#374151' }}>{gg.activePlayers}</span>
                        </div>
                        <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.62rem', fontWeight:800, color:gg.glow }}>{gg.maxPot}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: live feed */}
        <div className="right-feed" style={{ width:'250px', flexShrink:0, borderLeft:'1px solid #0d0d1e', display:'flex', flexDirection:'column', background:'#06060e' }}>
          <div style={{ display:'flex', borderBottom:'1px solid #0d0d1e', flexShrink:0 }}>
            {(['wins','feed'] as const).map(t => (
              <button key={t} className="r-tab"
                onClick={() => setRightTab(t)}
                style={{ flex:1, padding:'10px 0', background:'transparent', borderBottom:`2px solid ${rightTab===t?'#7c3aed':'transparent'}`, color: rightTab===t ? '#a78bfa' : '#374151', fontSize:'0.56rem', fontFamily:'Orbitron,sans-serif', fontWeight:700, letterSpacing:'0.06em' }}>
                {t === 'wins' ? 'WINS' : 'LIVE FEED'}
              </button>
            ))}
          </div>

          {rightTab === 'wins' && (
            <div style={{ flex:1, overflowY:'auto' }}>
              {RECENT_WINS.map((w, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'9px', padding:'9px 14px', borderBottom:'1px solid #0a0a12' }}>
                  <GameIcon id={w.gid} size={30} />
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.6rem', fontWeight:700, color:'#94a3b8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{w.user}</div>
                    <div style={{ fontSize:'0.52rem', color:'#1e2030', marginTop:'1px' }}>{w.t}</div>
                  </div>
                  <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.62rem', fontWeight:900, color:'#22c55e', flexShrink:0 }}>{w.amount}</span>
                </div>
              ))}
              <div style={{ margin:'10px 12px', padding:'11px', background:'rgba(124,58,237,0.04)', border:'1px solid rgba(124,58,237,0.1)', borderRadius:'10px' }}>
                <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.48rem', color:'#374151', letterSpacing:'0.12em', marginBottom:'8px' }}>PLATFORM STATS</div>
                {[{ l:'Total wagered', v:'$284K', c:'#a78bfa' }, { l:'Games today', v:'1,843', c:'#06b6d4' }, { l:'Biggest pot', v:'$1,275', c:'#f59e0b' }].map(s => (
                  <div key={s.l} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid #0c0c14' }}>
                    <span style={{ fontSize:'0.6rem', color:'#374151' }}>{s.l}</span>
                    <span style={{ fontSize:'0.62rem', fontWeight:700, color:s.c, fontFamily:'Orbitron,sans-serif' }}>{s.v}</span>
                  </div>
                ))}
                <Link to="/leaderboard" style={{ display:'block', textAlign:'center', marginTop:'8px', fontSize:'0.62rem', color:'#374151', textDecoration:'none', fontWeight:700 }}>Leaderboard</Link>
              </div>
            </div>
          )}

          {rightTab === 'feed' && (
            <div style={{ flex:1, overflowY:'auto' }}>
              {activity.length === 0
                ? <div style={{ textAlign:'center', color:'#1e2030', fontSize:'0.7rem', marginTop:'24px' }}>No activity yet...</div>
                : [...activity].reverse().map((a, i) => (
                    <div key={i} style={{ display:'flex', gap:'9px', alignItems:'flex-start', padding:'8px 14px', borderBottom:'1px solid #0a0a12' }}>
                      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#22c55e', flexShrink:0, marginTop:'4px', animation:'pulse-dot 2s infinite' }} />
                      <span style={{ fontSize:'0.66rem', color:'#374151', lineHeight:1.5 }}>{a.text}</span>
                    </div>
                  ))
              }
            </div>
          )}
        </div>

        {/* MOBILE: fixed bottom chat */}
        <div className="mob-chat" style={{ position:'fixed', bottom:0, left:0, right:0, background:'#06060e', borderTop:'1px solid #0d0d1e', flexDirection:'column', zIndex:50, maxHeight:'38vh' }}>
          <div style={{ display:'flex', alignItems:'center', padding:'6px 12px', borderBottom:'1px solid #0d0d1e', gap:'6px' }}>
            <span style={{ width:'4px', height:'4px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.6s infinite' }} />
            <span style={{ fontSize:'0.54rem', fontFamily:'Orbitron,sans-serif', color:'#374151', fontWeight:700, flex:1 }}>CHAT</span>
            <span style={{ fontSize:'0.54rem', color:'#1e2030', fontFamily:'Orbitron,sans-serif' }}>{onlineCount || '--'} online</span>
          </div>
          <div style={{ height:'100px', overflowY:'auto', padding:'6px 12px', display:'flex', flexDirection:'column', gap:'4px' }}>
            {chat.slice(-8).map((m, i) => {
              const col = CHAT_COLORS[m.username.charCodeAt(0) % CHAT_COLORS.length]
              return (
                <div key={i} style={{ display:'flex', gap:'5px' }}>
                  <span style={{ fontSize:'0.58rem', color:col, fontWeight:700, flexShrink:0 }}>{m.username}:</span>
                  <span style={{ fontSize:'0.66rem', color:'#4b5563', wordBreak:'break-word' }}>{m.message}</span>
                </div>
              )
            })}
          </div>
          <div style={{ padding:'7px 10px', borderTop:'1px solid #0d0d1e' }}>
            <div style={{ display:'flex', gap:'6px', background:'rgba(255,255,255,0.025)', border:'1px solid #111125', borderRadius:'8px', padding:'6px 10px', alignItems:'center' }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key==='Enter' && sendChat()}
                placeholder={address ? 'Message...' : 'Connect wallet to chat'} disabled={!address}
                style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#cbd5e1', fontSize:'0.72rem', minWidth:0 }}/>
              <button onClick={sendChat} disabled={!address || !chatInput.trim()}
                style={{ background: address && chatInput.trim() ? 'linear-gradient(135deg,#7c3aed,#06b6d4)' : 'rgba(255,255,255,0.04)', border:'none', borderRadius:'6px', padding:'4px 11px', color: address && chatInput.trim() ? '#fff' : '#374151', fontSize:'0.6rem', fontWeight:700, cursor: address && chatInput.trim() ? 'pointer' : 'default', fontFamily:'Orbitron,sans-serif' }}>
                SEND
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
