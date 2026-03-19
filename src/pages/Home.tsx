import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { connectSocket } from '../utils/socket'
import { getUsername } from '../utils/profile'

const GAMES = [
  { id:'coin-flip',      emoji:'🪙', title:'Coin Flip',      short:'COIN FLIP',   desc:'Pick Heads or Tails — best of 5 rounds.',       tags:['1v1','Fast'],      players:'2',    maxPot:'$85',  activePlayers:24, glow:'#f59e0b', glowRgb:'245,158,11', bgFrom:'#f59e0b', bgTo:'#d97706', hot:true  },
  { id:'math-arena',     emoji:'✚',  title:'Math Arena',     short:'MATH',        desc:'First correct answer scores. Pure skill.',        tags:['Skill','Speed'],   players:'2–10', maxPot:'$382', activePlayers:31, glow:'#7c3aed', glowRgb:'124,58,237', bgFrom:'#7c3aed', bgTo:'#06b6d4', hot:false },
  { id:'reaction-grid',  emoji:'⊞',  title:'Reaction Grid',  short:'REACTION',    desc:'Click the lit cell before anyone else.',          tags:['Reflex'],          players:'2–10', maxPot:'$382', activePlayers:18, glow:'#06b6d4', glowRgb:'6,182,212',  bgFrom:'#06b6d4', bgTo:'#7c3aed', hot:false },
  { id:'liars-dice',     emoji:'🎲', title:"Liar's Dice",    short:"LIAR'S DICE", desc:'Bluff your bids, call LIAR to win.',              tags:['Bluff','Strategy'],players:'2–6',  maxPot:'$229', activePlayers:42, glow:'#f97316', glowRgb:'249,115,22', bgFrom:'#f97316', bgTo:'#ef4444', hot:false },
  { id:'pattern-memory', emoji:'🧠', title:'Pattern Memory', short:'MEMORY',      desc:'Memorize flashing tiles, then tap them.',        tags:['Memory'],          players:'2–10', maxPot:'$382', activePlayers:15, glow:'#a855f7', glowRgb:'168,85,247', bgFrom:'#a855f7', bgTo:'#7c3aed', hot:false },
  { id:'highest-unique', emoji:'↑',  title:'Highest Unique', short:'HI UNIQUE',   desc:'Pick the highest number nobody else picks.',     tags:['Strategy'],        players:'3–20', maxPot:'$765', activePlayers:57, glow:'#22c55e', glowRgb:'34,197,94',  bgFrom:'#22c55e', bgTo:'#06b6d4', hot:false },
  { id:'lowest-unique',  emoji:'↓',  title:'Lowest Unique',  short:'LO UNIQUE',   desc:'Pick the lowest number nobody else picks.',      tags:['Bluff'],           players:'3–20', maxPot:'$765', activePlayers:39, glow:'#ec4899', glowRgb:'236,72,153', bgFrom:'#ec4899', bgTo:'#7c3aed', hot:false },
]

const RECENT_WINS = [
  { user:'Kira_X',    game:'🪙', amount:'+$18.70', t:'2s ago' },
  { user:'0xShadow',  game:'🎲', amount:'+$85.00', t:'14s ago' },
  { user:'NovaBet',   game:'✚',  amount:'+$42.50', t:'31s ago' },
  { user:'CryptoAce', game:'⊞',  amount:'+$21.25', t:'1m ago' },
  { user:'Apex_V',    game:'🎲', amount:'+$127.50',t:'2m ago' },
  { user:'Riven88',   game:'↑',  amount:'+$63.75', t:'3m ago' },
  { user:'Mxlk',      game:'🧠', amount:'+$17.00', t:'4m ago' },
  { user:'SolKing',   game:'✚',  amount:'+$25.50', t:'5m ago' },
]

type ChatMsg      = { username: string; message: string; ts: number }
type ActivityItem = { text: string; ts: number }

export default function Home() {
  const navigate    = useNavigate()
  const { address } = useAccount()
  const myName      = address ? getUsername(address) : 'Guest'

  const [activeGame, setActiveGame] = useState(GAMES[0])
  const [playerCount, setPlayerCount] = useState(GAMES[0].activePlayers)
  const [chat, setChat]         = useState<ChatMsg[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [chatInput, setChatInput] = useState('')
  const [rightTab, setRightTab] = useState<'wins'|'activity'>('wins')
  const chatEndRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [chat])

  function sendChat() {
    const msg = chatInput.trim().slice(0, 200)
    if (!msg || !address) return
    connectSocket().emit('global:chat:send', { username: myName, message: msg })
    setChatInput('')
  }

  return (
    <div style={{ background:'#08080f', height:'calc(100vh - 60px)', color:'#e2e8f0', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <style>{`
        @keyframes pulse-dot   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.6)} }
        @keyframes hot-badge   { 0%,100%{box-shadow:0 0 6px rgba(239,68,68,0.5)} 50%{box-shadow:0 0 16px rgba(239,68,68,0.9)} }
        @keyframes scan-line   { 0%{top:-4px} 100%{top:105%} }
        @keyframes border-glow { 0%,100%{opacity:.35} 50%{opacity:1} }
        @keyframes float-emoji { 0%,100%{transform:translateY(0) rotate(-4deg)} 50%{transform:translateY(-8px) rotate(4deg)} }
        @keyframes ticker-in   { from{opacity:0;transform:translateX(12px)} to{opacity:1;transform:translateX(0)} }

        .g-tab   { cursor:pointer; border:none; transition:all .14s; }
        .g-tab:active { transform:scale(.93); }
        .play-btn { cursor:pointer; border:none; transition:all .14s; }
        .play-btn:active { transform:scale(.96); }
        .chat-row { transition:background .12s; }
        .r-tab    { cursor:pointer; border:none; transition:all .13s; }

        @media (hover:hover) {
          .g-tab:hover    { background:rgba(255,255,255,0.07)!important; color:#94a3b8!important; }
          .play-btn:hover { filter:brightness(1.14); transform:translateY(-1px); }
          .bot-btn:hover  { background:rgba(124,58,237,0.2)!important; }
          .r-tab:hover    { background:rgba(255,255,255,0.04)!important; }
        }
        ::-webkit-scrollbar { display:none; }
        * { scrollbar-width:none; }

        @media (max-width:700px) {
          .left-chat  { display:none!important; }
          .right-feed { display:none!important; }
          .center-col { padding:10px 10px 0!important; }
          .mob-chat   { display:flex!important; }
        }
        @media (min-width:701px) {
          .mob-chat { display:none!important; }
        }
      `}</style>

      {/* ── Top: live multipliers ticker ─────────────────────────── */}
      <div style={{ background:'#070710', borderBottom:'1px solid #0d0d1e', display:'flex', alignItems:'center', height:'34px', flexShrink:0, gap:'0', overflowX:'auto' }}>
        <div style={{ flexShrink:0, padding:'0 14px', display:'flex', alignItems:'center', gap:'5px', borderRight:'1px solid #0d0d1e', height:'100%' }}>
          <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.4s infinite' }}/>
          <span style={{ fontSize:'0.56rem', fontFamily:'Orbitron,sans-serif', color:'#22c55e', fontWeight:700, letterSpacing:'0.1em' }}>LIVE</span>
          <span style={{ fontSize:'0.56rem', color:'#22c55e', fontFamily:'Orbitron,sans-serif', marginLeft:'4px', fontWeight:900 }}>{onlineCount||'—'}</span>
        </div>
        {RECENT_WINS.map((w, i) => (
          <div key={i} style={{ flexShrink:0, display:'flex', alignItems:'center', gap:'6px', padding:'0 16px', height:'100%', borderRight:'1px solid #0d0d1e', animation:'ticker-in .3s ease-out' }}>
            <span style={{ fontSize:'0.9rem' }}>{w.game}</span>
            <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.6rem', fontWeight:700, color:'#94a3b8' }}>{w.user}</span>
            <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.65rem', fontWeight:900, color:'#22c55e' }}>{w.amount}</span>
            <span style={{ fontSize:'0.52rem', color:'#1e2030' }}>{w.t}</span>
          </div>
        ))}
      </div>

      {/* ── Body: 3-col ──────────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>

        {/* LEFT — persistent chat */}
        <div className="left-chat" style={{ width:'220px', flexShrink:0, borderRight:'1px solid #0d0d1e', display:'flex', flexDirection:'column', background:'#070710' }}>
          <div style={{ padding:'9px 12px', borderBottom:'1px solid #0d0d1e', display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
            <span style={{ width:'4px', height:'4px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.6s infinite' }}/>
            <span style={{ fontSize:'0.56rem', fontFamily:'Orbitron,sans-serif', color:'#374151', fontWeight:700, letterSpacing:'0.08em' }}>GENERAL CHAT</span>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'8px 10px', display:'flex', flexDirection:'column', gap:'5px' }}>
            {chat.length === 0
              ? <div style={{ textAlign:'center', color:'#1e2030', fontSize:'0.7rem', marginTop:'20px' }}>Connecting…</div>
              : chat.map((m, i) => {
                  const isMe = m.username === myName
                  const cols = ['#7c3aed','#06b6d4','#f59e0b','#22c55e','#ec4899','#f97316']
                  const col  = cols[m.username.charCodeAt(0) % cols.length]
                  return (
                    <div key={i} className="chat-row" style={{ display:'flex', gap:'7px', alignItems:'flex-start', padding:'4px 0' }}>
                      <div style={{ width:'22px', height:'22px', borderRadius:'6px', background:`${col}20`, border:`1px solid ${col}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.55rem', fontWeight:800, color:col, flexShrink:0, marginTop:'1px' }}>{m.username.slice(0,2).toUpperCase()}</div>
                      <div style={{ minWidth:0 }}>
                        <span style={{ fontSize:'0.58rem', color:col, fontWeight:700 }}>{isMe ? 'You' : m.username}</span>
                        <div style={{ fontSize:'0.7rem', color:'#64748b', lineHeight:1.4, wordBreak:'break-word' }}>{m.message}</div>
                      </div>
                    </div>
                  )
                })
            }
            <div ref={chatEndRef}/>
          </div>
          <div style={{ padding:'8px 10px', borderTop:'1px solid #0d0d1e', flexShrink:0 }}>
            <div style={{ display:'flex', gap:'5px', background:'rgba(255,255,255,0.025)', border:'1px solid #111122', borderRadius:'8px', padding:'5px 8px' }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key==='Enter' && sendChat()}
                placeholder={address ? 'Message…' : 'Connect to chat'} disabled={!address}
                style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#e2e8f0', fontSize:'0.7rem', minWidth:0 }}/>
              <button onClick={sendChat} disabled={!address||!chatInput.trim()}
                style={{ background:'linear-gradient(135deg,#7c3aed,#06b6d4)', border:'none', borderRadius:'5px', padding:'3px 9px', color:'#fff', fontSize:'0.65rem', fontWeight:700, cursor: address&&chatInput.trim()?'pointer':'default', opacity:address&&chatInput.trim()?1:0.3 }}>↑</button>
            </div>
          </div>
        </div>

        {/* CENTER — game selector + play area */}
        <div className="center-col" style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', overflow:'hidden', padding:'14px 16px 0' }}>

          {/* Game tabs */}
          <div style={{ display:'flex', gap:'4px', overflowX:'auto', flexShrink:0, paddingBottom:'12px' }}>
            {GAMES.map(g => {
              const active = activeGame.id === g.id
              return (
                <button key={g.id} className="g-tab"
                  onClick={() => setActiveGame(g)}
                  style={{
                    flexShrink:0, display:'flex', alignItems:'center', gap:'5px',
                    padding:'7px 13px', borderRadius:'9px',
                    background: active ? `rgba(${g.glowRgb},0.15)` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${active ? `rgba(${g.glowRgb},0.35)` : '#0d0d1e'}`,
                    color: active ? g.glow : '#374151',
                    fontFamily:'Orbitron,sans-serif', fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.05em',
                    boxShadow: active ? `0 0 14px rgba(${g.glowRgb},0.18)` : 'none',
                  }}>
                  <span style={{ fontSize:'0.88rem' }}>{g.emoji}</span>
                  {g.short}
                  <span style={{ fontSize:'0.5rem', color: active ? `rgba(${g.glowRgb},0.8)` : '#1e2030', fontWeight:600 }}>{g.activePlayers}</span>
                  {g.hot && <span style={{ fontSize:'0.44rem', padding:'1px 4px', borderRadius:'4px', background:'rgba(239,68,68,0.16)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.28)', animation:'hot-badge 1.6s infinite' }}>HOT</span>}
                </button>
              )
            })}
          </div>

          {/* Play area */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'10px', overflowY:'auto', paddingBottom:'14px', minHeight:0 }}>

            {/* Main game panel */}
            <div style={{ position:'relative', borderRadius:'16px', overflow:'hidden', border:`1px solid rgba(${activeGame.glowRgb},0.2)`, background:'#0b0b16', flexShrink:0 }}>
              <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse at 70% 40%, rgba(${activeGame.glowRgb},0.11) 0%, transparent 60%)`, pointerEvents:'none' }}/>
              <div style={{ position:'absolute', left:0, right:0, height:'2px', background:`linear-gradient(90deg,transparent,rgba(${activeGame.glowRgb},0.7),transparent)`, animation:'scan-line 4s linear infinite', pointerEvents:'none', zIndex:1 }}/>
              <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(255,255,255,0.02) 1px,transparent 1px)', backgroundSize:'24px 24px', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:'1px', background:`linear-gradient(90deg,transparent,${activeGame.glow},transparent)`, animation:'border-glow 2.5s ease-in-out infinite' }}/>

              <div style={{ position:'relative', zIndex:2, padding:'clamp(14px,2vw,26px)', display:'flex', gap:'20px', alignItems:'center', flexWrap:'wrap' }}>
                {/* Icon */}
                <div style={{ width:'70px', height:'70px', borderRadius:'16px', flexShrink:0, background:`linear-gradient(135deg,rgba(${activeGame.glowRgb},0.22),rgba(${activeGame.glowRgb},0.05))`, border:`1px solid rgba(${activeGame.glowRgb},0.3)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2.2rem', boxShadow:`0 0 26px rgba(${activeGame.glowRgb},0.22)`, animation:'float-emoji 3s ease-in-out infinite' }}>
                  {activeGame.emoji}
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:'160px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'9px', marginBottom:'5px' }}>
                    <h2 style={{ fontFamily:'Orbitron,sans-serif', fontWeight:900, fontSize:'clamp(1rem,2.2vw,1.6rem)', margin:0, background:`linear-gradient(135deg,#fff 40%,${activeGame.glow})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                      {activeGame.title}
                    </h2>
                    <div style={{ display:'flex', alignItems:'center', gap:'4px', padding:'3px 8px', borderRadius:'6px', background:'rgba(34,197,94,0.07)', border:'1px solid rgba(34,197,94,0.15)', flexShrink:0 }}>
                      <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.4s infinite' }}/>
                      <span style={{ fontSize:'0.55rem', fontFamily:'Orbitron,sans-serif', fontWeight:700, color:'#22c55e' }}>LIVE</span>
                    </div>
                  </div>
                  <p style={{ color:'#4b5563', fontSize:'0.82rem', lineHeight:1.55, margin:'0 0 12px', maxWidth:'400px' }}>{activeGame.desc}</p>
                  <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                    {activeGame.tags.map(t => <span key={t} style={{ fontSize:'0.56rem', fontWeight:700, padding:'2px 8px', borderRadius:'20px', background:`rgba(${activeGame.glowRgb},0.1)`, color:activeGame.glow, border:`1px solid rgba(${activeGame.glowRgb},0.2)`, letterSpacing:'0.05em' }}>{t}</span>)}
                    {activeGame.hot && <span style={{ fontSize:'0.56rem', fontWeight:700, padding:'2px 8px', borderRadius:'20px', background:'rgba(239,68,68,0.12)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.25)', animation:'hot-badge 1.6s infinite' }}>🔥 HOT</span>}
                  </div>
                </div>

                {/* Stats + actions */}
                <div style={{ display:'flex', flexDirection:'column', gap:'10px', flexShrink:0, alignItems:'flex-end' }}>
                  <div style={{ display:'flex', gap:'6px' }}>
                    {([
                      { l:'POT',    v:activeGame.maxPot, hi:true,  pulse:false },
                      { l:'ACTIVE', v:`${playerCount}`,  hi:false, pulse:true  },
                      { l:'ENTRY',  v:'$0.5+',           hi:false, pulse:false },
                    ] as { l:string; v:string; hi:boolean; pulse:boolean }[]).map((s,i) => (
                      <div key={i} style={{ padding:'7px 11px', borderRadius:'9px', background: s.hi ? `rgba(${activeGame.glowRgb},0.1)` : 'rgba(255,255,255,0.025)', border: s.hi ? `1px solid rgba(${activeGame.glowRgb},0.2)` : '1px solid #0f0f1e', display:'flex', flexDirection:'column', gap:'2px', minWidth:'60px', textAlign:'center' }}>
                        <span style={{ fontSize:'0.46rem', color:'#374151', fontFamily:'Orbitron,sans-serif', letterSpacing:'0.1em' }}>{s.l}</span>
                        <span style={{ fontSize:'0.78rem', fontWeight:800, color: s.hi ? activeGame.glow : '#e2e8f0', fontFamily:'Orbitron,sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:'3px' }}>
                          {s.pulse && <span style={{ width:'4px', height:'4px', borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse-dot 1.6s infinite' }}/>}
                          {s.v}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:'7px' }}>
                    <button className="play-btn" onClick={() => navigate(`/lobby/${activeGame.id}`)}
                      style={{ background:`linear-gradient(135deg,${activeGame.bgFrom},${activeGame.bgTo})`, borderRadius:'9px', padding:'10px 24px', color:'#fff', fontFamily:'Orbitron,sans-serif', fontWeight:900, fontSize:'0.82rem', letterSpacing:'0.07em', boxShadow:`0 0 24px rgba(${activeGame.glowRgb},0.4)` }}>
                      PLAY NOW →
                    </button>
                    <button className="bot-btn play-btn" onClick={() => navigate('/game/practice', { state:{ bot:true, entry:0, gameMode:activeGame.id } })}
                      style={{ background:'rgba(124,58,237,0.07)', border:'1px solid rgba(124,58,237,0.18)', borderRadius:'9px', padding:'10px 14px', color:'#a78bfa', fontWeight:700, fontSize:'0.75rem', fontFamily:'Orbitron,sans-serif' }}>
                      vs Bot
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ position:'absolute', right:'-10px', bottom:'-6px', fontSize:'120px', opacity:0.035, pointerEvents:'none', userSelect:'none', lineHeight:1 }}>{activeGame.emoji}</div>
            </div>

            {/* Other games grid */}
            <div>
              <div style={{ fontSize:'0.52rem', fontFamily:'Orbitron,sans-serif', color:'#374151', letterSpacing:'0.12em', fontWeight:700, marginBottom:'8px' }}>ALL GAMES</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'7px' }}>
                {GAMES.filter(g => g.id !== activeGame.id).map(g => (
                  <button key={g.id} className="g-tab"
                    onClick={() => setActiveGame(g)}
                    style={{ display:'flex', alignItems:'center', gap:'10px', padding:'11px 12px', background:`rgba(${g.glowRgb},0.04)`, border:`1px solid rgba(${g.glowRgb},0.12)`, borderRadius:'12px', textAlign:'left', width:'100%' }}>
                    <div style={{ width:'36px', height:'36px', borderRadius:'9px', background:`rgba(${g.glowRgb},0.14)`, border:`1px solid rgba(${g.glowRgb},0.2)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem', flexShrink:0 }}>{g.emoji}</div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.6rem', fontWeight:700, color:'#64748b', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{g.title}</div>
                      <div style={{ fontSize:'0.55rem', color:'#1e2030', marginTop:'2px', display:'flex', alignItems:'center', gap:'3px' }}>
                        <span style={{ width:'3px', height:'3px', borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse-dot 1.8s infinite' }}/>
                        {g.activePlayers} playing
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — live feed */}
        <div className="right-feed" style={{ width:'210px', flexShrink:0, borderLeft:'1px solid #0d0d1e', display:'flex', flexDirection:'column', background:'#070710' }}>
          {/* Tab */}
          <div style={{ display:'flex', borderBottom:'1px solid #0d0d1e', flexShrink:0 }}>
            {(['wins','activity'] as const).map(t => (
              <button key={t} className="r-tab"
                onClick={() => setRightTab(t)}
                style={{ flex:1, padding:'9px 0', background:'transparent', borderBottom:`2px solid ${rightTab===t?'#7c3aed':'transparent'}`, color: rightTab===t ? '#a78bfa' : '#374151', fontSize:'0.54rem', fontFamily:'Orbitron,sans-serif', fontWeight:700, letterSpacing:'0.05em' }}>
                {t === 'wins' ? '🏆 WINS' : '⚡ FEED'}
              </button>
            ))}
          </div>

          {rightTab === 'wins' && (
            <div style={{ flex:1, overflowY:'auto', padding:'6px 0' }}>
              {RECENT_WINS.map((w, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 12px', borderBottom:'1px solid #0a0a12' }}>
                  <div style={{ width:'28px', height:'28px', borderRadius:'7px', background:'rgba(34,197,94,0.07)', border:'1px solid rgba(34,197,94,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.9rem', flexShrink:0 }}>{w.game}</div>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.58rem', fontWeight:700, color:'#94a3b8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{w.user}</div>
                    <div style={{ fontSize:'0.52rem', color:'#374151' }}>{w.t}</div>
                  </div>
                  <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.6rem', fontWeight:900, color:'#22c55e', flexShrink:0 }}>{w.amount}</span>
                </div>
              ))}
              {/* Platform stats */}
              <div style={{ margin:'10px', padding:'10px', background:'rgba(124,58,237,0.04)', border:'1px solid rgba(124,58,237,0.1)', borderRadius:'10px' }}>
                {[{ l:'Total wagered', v:'$284K', c:'#a78bfa' }, { l:'Games today', v:'1,843', c:'#06b6d4' }, { l:'Top pot', v:'$1,275', c:'#f59e0b' }].map(s => (
                  <div key={s.l} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid #0c0c14' }}>
                    <span style={{ fontSize:'0.58rem', color:'#374151' }}>{s.l}</span>
                    <span style={{ fontSize:'0.6rem', fontWeight:700, color:s.c, fontFamily:'Orbitron,sans-serif' }}>{s.v}</span>
                  </div>
                ))}
                <Link to="/leaderboard" style={{ display:'block', textAlign:'center', marginTop:'7px', fontSize:'0.6rem', color:'#374151', textDecoration:'none', fontWeight:700 }}>🏆 Leaderboard →</Link>
              </div>
            </div>
          )}

          {rightTab === 'activity' && (
            <div style={{ flex:1, overflowY:'auto', padding:'6px 0' }}>
              {activity.length === 0
                ? <div style={{ textAlign:'center', color:'#1e2030', fontSize:'0.7rem', marginTop:'20px' }}>No activity yet…</div>
                : [...activity].reverse().map((a, i) => (
                    <div key={i} style={{ display:'flex', gap:'8px', alignItems:'flex-start', padding:'7px 12px', borderBottom:'1px solid #0a0a12' }}>
                      <span style={{ fontSize:'0.82rem', flexShrink:0 }}>{a.text.includes('won')?'🏆':a.text.includes('joined')?'🎮':a.text.includes('created')||a.text.includes('opened')?'👤':'⚡'}</span>
                      <span style={{ fontSize:'0.64rem', color:'#374151', lineHeight:1.5 }}>{a.text}</span>
                    </div>
                  ))
              }
            </div>
          )}
        </div>

        {/* MOBILE bottom chat strip */}
        <div className="mob-chat" style={{ position:'fixed', bottom:0, left:0, right:0, background:'#070710', borderTop:'1px solid #0d0d1e', flexDirection:'column', zIndex:50, maxHeight:'40vh' }}>
          <div style={{ display:'flex', alignItems:'center', padding:'6px 12px', gap:'6px', borderBottom:'1px solid #0d0d1e' }}>
            <span style={{ width:'4px', height:'4px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.6s infinite' }}/>
            <span style={{ fontSize:'0.54rem', fontFamily:'Orbitron,sans-serif', color:'#374151', fontWeight:700 }}>CHAT</span>
            <span style={{ fontSize:'0.54rem', color:'#1e2030', marginLeft:'auto' }}>{onlineCount||'—'} online</span>
          </div>
          <div style={{ height:'120px', overflowY:'auto', padding:'6px 12px', display:'flex', flexDirection:'column', gap:'4px' }}>
            {chat.slice(-10).map((m, i) => {
              const cols = ['#7c3aed','#06b6d4','#f59e0b','#22c55e','#ec4899','#f97316']
              const col  = cols[m.username.charCodeAt(0) % cols.length]
              return (
                <div key={i} style={{ display:'flex', gap:'5px' }}>
                  <span style={{ fontSize:'0.58rem', color:col, fontWeight:700, flexShrink:0 }}>{m.username}:</span>
                  <span style={{ fontSize:'0.65rem', color:'#4b5563', wordBreak:'break-word' }}>{m.message}</span>
                </div>
              )
            })}
          </div>
          <div style={{ padding:'6px 10px', borderTop:'1px solid #0d0d1e' }}>
            <div style={{ display:'flex', gap:'5px', background:'rgba(255,255,255,0.025)', border:'1px solid #111122', borderRadius:'7px', padding:'5px 8px' }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key==='Enter' && sendChat()}
                placeholder={address ? 'Message…' : 'Connect to chat'} disabled={!address}
                style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#e2e8f0', fontSize:'0.7rem', minWidth:0 }}/>
              <button onClick={sendChat} disabled={!address||!chatInput.trim()}
                style={{ background:'linear-gradient(135deg,#7c3aed,#06b6d4)', border:'none', borderRadius:'5px', padding:'3px 9px', color:'#fff', fontSize:'0.65rem', fontWeight:700, cursor:address&&chatInput.trim()?'pointer':'default', opacity:address&&chatInput.trim()?1:0.3 }}>↑</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
