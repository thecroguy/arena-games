import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { connectSocket } from '../utils/socket'
import { getUsername } from '../utils/profile'


// ── Ticker ──────────────────────────────────────────────────────────────────
const TICKER = [
  { user:'Kira_X',    game:'Coin Flip',      amount:'$18.70', icon:'🪙' },
  { user:'NovaBet',   game:'Math Arena',     amount:'$42.50', icon:'✚'  },
  { user:'0xShadow',  game:"Liar's Dice",    amount:'$85.00', icon:'🎲' },
  { user:'CryptoAce', game:'Reaction Grid',  amount:'$21.25', icon:'⊞'  },
  { user:'Riven88',   game:'Highest Unique', amount:'$63.75', icon:'↑'  },
  { user:'BlockBet',  game:'Coin Flip',      amount:'$42.50', icon:'🪙' },
  { user:'Apex_V',    game:"Liar's Dice",    amount:'$127.50',icon:'🎲' },
  { user:'SolKing',   game:'Math Arena',     amount:'$25.50', icon:'✚'  },
]

// ── Games ───────────────────────────────────────────────────────────────────
const GAMES = [
  { id:'coin-flip',      emoji:'🪙', title:'Coin Flip',      short:'COIN FLIP',   glow:'#f59e0b', rgb:'245,158,11', tags:['1v1','Fast'],       active:24, hot:true,  botMode:true, desc:'Pick Heads or Tails — best of 5 rounds.' },
  { id:'math-arena',     emoji:'✚',  title:'Math Arena',     short:'MATH',        glow:'#7c3aed', rgb:'124,58,237', tags:['Skill','Speed'],     active:31, hot:false, botMode:true, desc:'Speed math, first correct answer scores.' },
  { id:'liars-dice',     emoji:'🎲', title:"Liar's Dice",    short:"LIAR'S DICE", glow:'#f97316', rgb:'249,115,22', tags:['Bluff','Strategy'],  active:42, hot:false, botMode:true, desc:'Hidden dice. Bluff bids, call LIAR!' },
  { id:'reaction-grid',  emoji:'⊞',  title:'Reaction Grid',  short:'REACTION',    glow:'#06b6d4', rgb:'6,182,212',  tags:['Reflex','Speed'],    active:18, hot:false, botMode:true, desc:'Click the lit cell before anyone else.' },
  { id:'pattern-memory', emoji:'🧠', title:'Pattern Memory', short:'MEMORY',      glow:'#a855f7', rgb:'168,85,247', tags:['Memory','Focus'],    active:15, hot:false, botMode:true, desc:'Memorize flashing tiles, tap them back.' },
  { id:'highest-unique', emoji:'↑',  title:'Highest Unique', short:'HI-UNIQUE',   glow:'#22c55e', rgb:'34,197,94',  tags:['Strategy','Mind'],   active:57, hot:false, botMode:true, desc:'Highest unique number each round wins.' },
  { id:'lowest-unique',  emoji:'↓',  title:'Lowest Unique',  short:'LO-UNIQUE',   glow:'#ec4899', rgb:'236,72,153', tags:['Bluff','Strategy'],  active:39, hot:false, botMode:true, desc:'Lowest unique number each round wins.' },
]

// ── Article placeholders ─────────────────────────────────────────────────────
const ARTICLES = [
  { tag:'GUIDE',   title:'How to win at Highest Unique — the psychology behind crowd-reading',   time:'5 min read', color:'#22c55e' },
  { tag:'UPDATE',  title:'Coin Flip is now live — 1v1 instant match, best of 5 rounds',          time:'2 min read', color:'#f59e0b' },
  { tag:'STRATEGY',title:"Liar's Dice deep dive — when to bluff and when to call",               time:'8 min read', color:'#f97316' },
]

type ChatMsg = { username: string; message: string; ts: number }
type ActivityItem = { text: string; ts: number }

export default function Home() {
  const navigate  = useNavigate()
  const { address } = useAccount()
  const myName    = address ? getUsername(address) : 'Guest'

  // chat + activity
  const [chat, setChat]       = useState<ChatMsg[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [chatInput, setChatInput] = useState('')
  const [tab, setTab]         = useState<'chat'|'activity'>('chat')
  const chatEndRef            = useRef<HTMLDivElement>(null)

  // live active player drift
  const [activeCounts, setActiveCounts] = useState(() => Object.fromEntries(GAMES.map(g => [g.id, g.active])))

  useEffect(() => {
    const t = setInterval(() => {
      setActiveCounts(prev => {
        const next = { ...prev }
        GAMES.forEach(g => { next[g.id] = Math.max(2, next[g.id] + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 3)) })
        return next
      })
    }, 4000)
    return () => clearInterval(t)
  }, [])

  // socket
  useEffect(() => {
    const socket = connectSocket()
    socket.on('chat:message',   (msg: ChatMsg)        => setChat(p => [...p, msg].slice(-60)))
    socket.on('activity:update',(feed: ActivityItem[]) => setActivity(feed))
    socket.on('online:count',   (n: number)            => setOnlineCount(n))
    socket.emit('chat:history',    (h: ChatMsg[])        => setChat(h))
    socket.emit('activity:get',    (f: ActivityItem[])   => setActivity(f))
    return () => {
      socket.off('chat:message'); socket.off('activity:update'); socket.off('online:count')
    }
  }, [])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [chat])

  function sendChat() {
    const msg = chatInput.trim().slice(0, 200)
    if (!msg) return
    connectSocket().emit('global:chat:send', { username: myName, message: msg })
    setChatInput('')
  }

  const totalActive = Object.values(activeCounts).reduce((a, b) => a + b, 0)

  return (
    <div style={{ background:'#08080f', minHeight:'100vh', color:'#e2e8f0' }}>
      <style>{`
        @keyframes ticker-scroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes pulse-dot     { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.5)} }
        @keyframes hot-flash     { 0%,100%{opacity:1} 50%{opacity:.6} }
        @keyframes card-in       { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scan          { 0%{top:0%} 100%{top:102%} }

        .g-card  { transition:transform .18s,box-shadow .18s,border-color .18s; cursor:pointer; }
        .chat-send { transition:opacity .15s; cursor:pointer; }
        .tab-btn { transition:all .15s; cursor:pointer; border:none; }
        .art-card { transition:transform .18s; cursor:pointer; }

        @media (hover:hover) {
          .g-card:hover       { transform:translateY(-4px) scale(1.01) !important; }
          .chat-send:hover    { opacity:.8; }
          .art-card:hover     { transform:translateY(-3px) !important; }
        }
        .g-card:active  { transform:scale(0.97) !important; }

        /* hide scrollbar */
        .hide-scroll { scrollbar-width:none; }
        .hide-scroll::-webkit-scrollbar { display:none; }
      `}</style>

      {/* ── Ticker ────────────────────────────────────────────────────── */}
      <div style={{ background:'rgba(34,197,94,0.04)', borderBottom:'1px solid rgba(34,197,94,0.07)', overflow:'hidden', height:'30px', display:'flex', alignItems:'center' }}>
        <div style={{ flexShrink:0, padding:'0 12px', display:'flex', alignItems:'center', gap:'5px', borderRight:'1px solid rgba(34,197,94,0.12)' }}>
          <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.4s ease-in-out infinite' }}/>
          <span style={{ fontSize:'0.58rem', fontFamily:'Orbitron,sans-serif', fontWeight:700, color:'#22c55e', letterSpacing:'0.1em', whiteSpace:'nowrap' }}>LIVE WINS</span>
        </div>
        <div style={{ overflow:'hidden', flex:1 }}>
          <div style={{ display:'inline-flex', animation:'ticker-scroll 22s linear infinite', whiteSpace:'nowrap' }}>
            {[...TICKER,...TICKER].map((w,i) => (
              <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'0 20px', fontSize:'0.68rem', borderRight:'1px solid #0e0e18' }}>
                <span style={{ color:'#94a3b8', fontWeight:700 }}>{w.user}</span>
                <span style={{ color:'#475569' }}>→</span>
                <span style={{ color:'#22c55e', fontWeight:800 }}>{w.amount}</span>
                <span style={{ color:'#2d2d42' }}>· {w.icon} {w.game}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <div style={{ background:'#0a0a14', borderBottom:'1px solid #0f0f1e', display:'flex', alignItems:'center', height:'40px', padding:'0 clamp(10px,2.5vw,24px)', gap:0, justifyContent:'space-between' }}>
        <div style={{ display:'flex', height:'100%' }}>
          {[
            { l:'GAMES LIVE', v:'7',              c:'#7c3aed' },
            { l:'PLAYERS',    v:`${totalActive + 180}`, c:'#22c55e', dot:true },
            { l:'NETWORKS',   v:'6 CHAINS',       c:'#06b6d4' },
            { l:'WINNER POT', v:'85%',             c:'#f59e0b' },
          ].map((s,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'7px', padding:'0 clamp(8px,1.8vw,18px)', borderRight:i<3?'1px solid #0f0f1e':'none' }}>
              {s.dot && <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.8s ease-in-out infinite' }}/>}
              <span style={{ fontSize:'0.52rem', color:'#2a2a40', fontFamily:'Orbitron,sans-serif', letterSpacing:'0.1em', whiteSpace:'nowrap' }}>{s.l}</span>
              <span style={{ fontSize:'0.78rem', fontWeight:900, color:s.c, fontFamily:'Orbitron,sans-serif', whiteSpace:'nowrap' }}>{s.v}</span>
            </div>
          ))}
        </div>
        <Link to="/leaderboard" style={{ textDecoration:'none', fontSize:'0.62rem', color:'#2d2d42', fontFamily:'Orbitron,sans-serif', fontWeight:700, letterSpacing:'0.06em', whiteSpace:'nowrap' }}>
          🏆 LEADERBOARD →
        </Link>
      </div>

      {/* ── Body: 2-col ───────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 300px', minHeight:'calc(100vh - 112px)' }} className="body-grid">
        <style>{`
          @media(max-width:900px){ .body-grid{grid-template-columns:1fr!important} .chat-col{display:none!important} }
          @media(max-width:580px){ .games-grid{grid-template-columns:repeat(2,1fr)!important} }
        `}</style>

        {/* ── LEFT: games + articles ────────────────────────────────── */}
        <div style={{ padding:'clamp(12px,2vw,22px) clamp(10px,2vw,20px)', display:'flex', flexDirection:'column', gap:'20px', borderRight:'1px solid #0f0f1e', overflowY:'auto' }} className="hide-scroll">

          {/* Section header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ fontFamily:'Orbitron,sans-serif', fontWeight:900, fontSize:'0.72rem', color:'#e2e8f0', letterSpacing:'0.1em' }}>PICK YOUR GAME</span>
              <span style={{ fontSize:'0.58rem', padding:'2px 8px', background:'rgba(34,197,94,0.1)', color:'#22c55e', borderRadius:'20px', border:'1px solid rgba(34,197,94,0.2)', fontWeight:700 }}>7 LIVE</span>
            </div>
            <span style={{ fontSize:'0.62rem', color:'#2d2d42', fontFamily:'Orbitron,sans-serif', letterSpacing:'0.06em' }}>USDT · ANY CHAIN</span>
          </div>

          {/* Game cards grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }} className="games-grid">
            {GAMES.map((g, idx) => (
              <div key={g.id} className="g-card"
                style={{
                  background:'#0c0c17', border:`1px solid rgba(${g.rgb},0.2)`,
                  borderRadius:'16px', overflow:'hidden', position:'relative',
                  boxShadow:`0 4px 20px rgba(${g.rgb},0.07)`,
                  animation:`card-in .25s ease-out ${idx*0.04}s both`,
                }}>
                {/* Top accent */}
                <div style={{ height:'2px', background:`linear-gradient(90deg,transparent,rgba(${g.rgb},0.8),transparent)` }}/>
                {/* Scan line */}
                <div style={{ position:'absolute', left:0, right:0, height:'1px', background:`rgba(${g.rgb},0.3)`, animation:`scan ${3+idx*0.4}s linear infinite`, pointerEvents:'none' }}/>

                <div style={{ padding:'14px 12px' }}>
                  {/* Top row */}
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'10px' }}>
                    <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:`rgba(${g.rgb},0.12)`, border:`1px solid rgba(${g.rgb},0.25)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', boxShadow:`0 0 14px rgba(${g.rgb},0.2)` }}>
                      {g.emoji}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px' }}>
                      {g.hot && <span style={{ fontSize:'0.5rem', padding:'2px 6px', background:'rgba(239,68,68,0.15)', color:'#ef4444', borderRadius:'4px', border:'1px solid rgba(239,68,68,0.3)', fontWeight:700, animation:'hot-flash 1.5s ease-in-out infinite' }}>🔥</span>}
                      <div style={{ display:'flex', alignItems:'center', gap:'3px' }}>
                        <span style={{ width:'4px', height:'4px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.8s ease-in-out infinite' }}/>
                        <span style={{ fontSize:'0.58rem', color:'#22c55e', fontWeight:700 }}>{activeCounts[g.id]}</span>
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <div style={{ fontFamily:'Orbitron,sans-serif', fontWeight:800, fontSize:'0.72rem', color:'#e2e8f0', marginBottom:'5px', letterSpacing:'0.04em', lineHeight:1.2 }}>{g.title}</div>

                  {/* Desc */}
                  <div style={{ fontSize:'0.68rem', color:'#475569', lineHeight:1.5, marginBottom:'10px', minHeight:'2.8em' }}>{g.desc}</div>

                  {/* Tags */}
                  <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', marginBottom:'12px' }}>
                    {g.tags.map(t => (
                      <span key={t} style={{ fontSize:'0.55rem', padding:'2px 7px', borderRadius:'20px', background:`rgba(${g.rgb},0.1)`, color:g.glow, border:`1px solid rgba(${g.rgb},0.2)`, fontWeight:600 }}>{t}</span>
                    ))}
                  </div>

                  {/* Buttons */}
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={() => navigate(`/lobby/${g.id}`)}
                      style={{ flex:1, padding:'9px 0', borderRadius:'9px', border:'none', cursor:'pointer', background:`linear-gradient(135deg,rgba(${g.rgb},0.85),rgba(${g.rgb},0.6))`, color:'#fff', fontFamily:'Orbitron,sans-serif', fontWeight:800, fontSize:'0.6rem', letterSpacing:'0.06em', boxShadow:`0 0 16px rgba(${g.rgb},0.3)` }}>
                      PLAY
                    </button>
                    {g.botMode && (
                      <button onClick={() => navigate('/game/practice', { state:{ bot:true, entry:0, gameMode:g.id } })}
                        style={{ padding:'9px 10px', borderRadius:'9px', border:'1px solid rgba(124,58,237,0.2)', cursor:'pointer', background:'rgba(124,58,237,0.06)', color:'#a78bfa', fontSize:'0.6rem', fontWeight:700 }}>
                        BOT
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Articles section ────────────────────────────────── */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
              <span style={{ fontFamily:'Orbitron,sans-serif', fontWeight:900, fontSize:'0.7rem', color:'#e2e8f0', letterSpacing:'0.1em' }}>ARENA INTEL</span>
              <span style={{ fontSize:'0.58rem', padding:'2px 8px', background:'rgba(124,58,237,0.1)', color:'#a78bfa', borderRadius:'20px', border:'1px solid rgba(124,58,237,0.2)', fontWeight:700 }}>ARTICLES</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'10px' }}>
              {ARTICLES.map((a, i) => (
                <div key={i} className="art-card"
                  style={{ background:'#0c0c17', border:'1px solid #111120', borderRadius:'14px', padding:'16px', cursor:'pointer', position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:`linear-gradient(90deg,transparent,${a.color},transparent)` }}/>
                  <span style={{ fontSize:'0.55rem', padding:'2px 8px', borderRadius:'20px', background:`rgba(${a.color === '#22c55e' ? '34,197,94' : a.color === '#f59e0b' ? '245,158,11' : '249,115,22'},0.12)`, color:a.color, border:`1px solid rgba(${a.color === '#22c55e' ? '34,197,94' : a.color === '#f59e0b' ? '245,158,11' : '249,115,22'},0.25)`, fontWeight:700, fontFamily:'Orbitron,sans-serif', letterSpacing:'0.06em' }}>
                    {a.tag}
                  </span>
                  <div style={{ marginTop:'10px', fontSize:'0.8rem', color:'#94a3b8', lineHeight:1.5, fontWeight:600, marginBottom:'8px' }}>{a.title}</div>
                  <div style={{ fontSize:'0.62rem', color:'#2d2d42' }}>{a.time} · Coming soon</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Chat sidebar ───────────────────────────────────── */}
        <div className="chat-col" style={{ display:'flex', flexDirection:'column', background:'#09090f', borderLeft:'1px solid #0f0f1e' }}>

          {/* Chat header */}
          <div style={{ padding:'12px 14px', borderBottom:'1px solid #0f0f1e', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div style={{ display:'flex', gap:'4px' }}>
              {(['chat','activity'] as const).map(t => (
                <button key={t} className="tab-btn"
                  onClick={() => setTab(t)}
                  style={{ padding:'5px 12px', borderRadius:'7px', fontSize:'0.62rem', fontFamily:'Orbitron,sans-serif', fontWeight:700, letterSpacing:'0.05em', background: tab===t ? 'rgba(124,58,237,0.2)' : 'transparent', color: tab===t ? '#a78bfa' : '#2d2d42', border: tab===t ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent' }}>
                  {t === 'chat' ? '💬 CHAT' : '⚡ LIVE'}
                </button>
              ))}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
              <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.6s ease-in-out infinite' }}/>
              <span style={{ fontSize:'0.6rem', color:'#22c55e', fontFamily:'Orbitron,sans-serif', fontWeight:700 }}>{onlineCount || '—'}</span>
            </div>
          </div>

          {/* Chat / Activity feed */}
          <div style={{ flex:1, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:'8px' }} className="hide-scroll">
            {tab === 'chat' ? (
              chat.length === 0
                ? <div style={{ textAlign:'center', color:'#1e1e30', fontSize:'0.75rem', marginTop:'40px' }}>Connecting to chat…</div>
                : chat.map((m, i) => {
                    const isMe = m.username === myName
                    const colors = ['#7c3aed','#06b6d4','#f59e0b','#22c55e','#ec4899','#f97316']
                    const col    = colors[m.username.charCodeAt(0) % colors.length]
                    return (
                      <div key={i} style={{ display:'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap:'7px', alignItems:'flex-end' }}>
                        {!isMe && (
                          <div style={{ width:'26px', height:'26px', borderRadius:'8px', background:`rgba(${col === '#7c3aed' ? '124,58,237' : col === '#06b6d4' ? '6,182,212' : col === '#f59e0b' ? '245,158,11' : col === '#22c55e' ? '34,197,94' : col === '#ec4899' ? '236,72,153' : '249,115,22'},0.2)`, border:`1px solid ${col}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.62rem', fontWeight:800, color:col, flexShrink:0 }}>
                            {m.username.slice(0,2).toUpperCase()}
                          </div>
                        )}
                        <div style={{ maxWidth:'80%' }}>
                          {!isMe && <div style={{ fontSize:'0.55rem', color:col, fontWeight:700, marginBottom:'2px', paddingLeft:'2px' }}>{m.username}</div>}
                          <div style={{ padding:'7px 10px', borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px', fontSize:'0.73rem', lineHeight:1.45, background: isMe ? 'linear-gradient(135deg,rgba(124,58,237,0.35),rgba(6,182,212,0.25))' : 'rgba(255,255,255,0.04)', color: isMe ? '#e2e8f0' : '#94a3b8', border: isMe ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.05)', wordBreak:'break-word' }}>
                            {m.message}
                          </div>
                        </div>
                      </div>
                    )
                  })
            ) : (
              activity.length === 0
                ? <div style={{ textAlign:'center', color:'#1e1e30', fontSize:'0.75rem', marginTop:'40px' }}>No activity yet…</div>
                : [...activity].reverse().map((a, i) => (
                    <div key={i} style={{ display:'flex', gap:'8px', alignItems:'flex-start', padding:'7px 0', borderBottom:'1px solid #0c0c16' }}>
                      <span style={{ fontSize:'0.9rem', flexShrink:0, marginTop:'1px' }}>
                        {a.text.includes('won') ? '🏆' : a.text.includes('joined') ? '🎮' : a.text.includes('opened') || a.text.includes('created') ? '👤' : '⚡'}
                      </span>
                      <span style={{ fontSize:'0.68rem', color:'#475569', lineHeight:1.5 }}>{a.text}</span>
                    </div>
                  ))
            )}
            <div ref={chatEndRef}/>
          </div>

          {/* Chat input */}
          <div style={{ padding:'10px 12px', borderTop:'1px solid #0f0f1e', flexShrink:0 }}>
            <div style={{ display:'flex', gap:'6px', background:'rgba(255,255,255,0.03)', border:'1px solid #1a1a28', borderRadius:'10px', padding:'6px 8px', transition:'border-color .2s' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = '#1a1a28')}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder={address ? 'Say something…' : 'Connect wallet to chat'}
                disabled={!address}
                style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#e2e8f0', fontSize:'0.75rem', minWidth:0 }}
              />
              <button className="chat-send" onClick={sendChat} disabled={!address || !chatInput.trim()}
                style={{ background:'linear-gradient(135deg,#7c3aed,#06b6d4)', border:'none', borderRadius:'7px', padding:'5px 10px', color:'#fff', fontSize:'0.65rem', fontWeight:700, cursor: address ? 'pointer' : 'default', opacity: address && chatInput.trim() ? 1 : 0.35 }}>
                ↑
              </button>
            </div>
            {!address && <div style={{ textAlign:'center', fontSize:'0.6rem', color:'#2d2d42', marginTop:'5px' }}>Connect wallet to chat</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
