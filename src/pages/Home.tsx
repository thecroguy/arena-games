import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { connectSocket } from '../utils/socket'
import { getUsername } from '../utils/profile'

const TICKER = [
  { user:'Kira_X',    game:'Coin Flip',      amount:'$18.70',  icon:'🪙' },
  { user:'NovaBet',   game:'Math Arena',     amount:'$42.50',  icon:'✚'  },
  { user:'0xShadow',  game:"Liar's Dice",    amount:'$85.00',  icon:'🎲' },
  { user:'CryptoAce', game:'Reaction Grid',  amount:'$21.25',  icon:'⊞'  },
  { user:'Riven88',   game:'Highest Unique', amount:'$63.75',  icon:'↑'  },
  { user:'BlockBet',  game:'Coin Flip',      amount:'$42.50',  icon:'🪙' },
  { user:'Apex_V',    game:"Liar's Dice",    amount:'$127.50', icon:'🎲' },
  { user:'Mxlk',      game:'Pattern Memory', amount:'$17.00',  icon:'🧠' },
  { user:'ZeroG',     game:'Lowest Unique',  amount:'$8.50',   icon:'↓'  },
  { user:'SolKing',   game:'Math Arena',     amount:'$25.50',  icon:'✚'  },
]

const GAMES = [
  { id:'coin-flip',      emoji:'🪙', title:'Coin Flip',      short:'COIN FLIP',   desc:'1v1 pure tension. Pick Heads or Tails — best of 5 rounds. No edge, just nerve.',         tags:['1v1','Fast','Luck'],      players:'2',    maxPot:'$85',  activePlayers:24, glow:'#f59e0b', glowRgb:'245,158,11', bgFrom:'#f59e0b', bgTo:'#d97706', hot:true,  botMode:true },
  { id:'math-arena',     emoji:'✚',  title:'Math Arena',     short:'MATH',        desc:'Speed math — first correct answer scores. 100% pure skill, zero luck.',                   tags:['Skill','Speed'],         players:'2–10', maxPot:'$382', activePlayers:31, glow:'#7c3aed', glowRgb:'124,58,237', bgFrom:'#7c3aed', bgTo:'#06b6d4', hot:false, botMode:true },
  { id:'reaction-grid',  emoji:'⊞',  title:'Reaction Grid',  short:'REACTION',    desc:'A cell lights up — click it before anyone else. Pure reaction speed.',                   tags:['Reflex','Speed'],        players:'2–10', maxPot:'$382', activePlayers:18, glow:'#06b6d4', glowRgb:'6,182,212',  bgFrom:'#06b6d4', bgTo:'#7c3aed', hot:false, botMode:true },
  { id:'liars-dice',     emoji:'🎲', title:"Liar's Dice",    short:"LIAR'S DICE", desc:"Hidden dice. Bluff your bids, call LIAR! Deception is the only weapon.",                tags:['Bluff','Strategy'],      players:'2–6',  maxPot:'$229', activePlayers:42, glow:'#f97316', glowRgb:'249,115,22', bgFrom:'#f97316', bgTo:'#ef4444', hot:false, botMode:true },
  { id:'pattern-memory', emoji:'🧠', title:'Pattern Memory', short:'MEMORY',      desc:'Tiles flash briefly — memorize every one, then tap them from memory.',                   tags:['Memory','Focus'],        players:'2–10', maxPot:'$382', activePlayers:15, glow:'#a855f7', glowRgb:'168,85,247', bgFrom:'#a855f7', bgTo:'#7c3aed', hot:false, botMode:true },
  { id:'highest-unique', emoji:'↑',  title:'Highest Unique', short:'HI UNIQUE',   desc:'Pick the highest number nobody else picks. Read the crowd. Outsmart them.',              tags:['Strategy','Mind'],       players:'3–20', maxPot:'$765', activePlayers:57, glow:'#22c55e', glowRgb:'34,197,94',  bgFrom:'#22c55e', bgTo:'#06b6d4', hot:false, botMode:true },
  { id:'lowest-unique',  emoji:'↓',  title:'Lowest Unique',  short:'LO UNIQUE',   desc:'Pick the lowest number nobody else picks. Contrarian thinking wins here.',               tags:['Strategy','Bluff'],      players:'3–20', maxPot:'$765', activePlayers:39, glow:'#ec4899', glowRgb:'236,72,153', bgFrom:'#ec4899', bgTo:'#7c3aed', hot:false, botMode:true },
]

const ARTICLES = [
  { tag:'GUIDE',    color:'#22c55e', cRgb:'34,197,94',   title:'How to win at Highest Unique — the psychology of crowd-reading', time:'5 min' },
  { tag:'UPDATE',   color:'#f59e0b', cRgb:'245,158,11',  title:'Coin Flip is live — 1v1 instant match, best of 5 rounds',       time:'2 min' },
  { tag:'STRATEGY', color:'#f97316', cRgb:'249,115,22',  title:"Liar's Dice deep dive — when to bluff and when to call LIAR",   time:'8 min' },
]

type ChatMsg      = { username: string; message: string; ts: number }
type ActivityItem = { text: string; ts: number }

export default function Home() {
  const navigate      = useNavigate()
  const { address }   = useAccount()
  const myName        = address ? getUsername(address) : 'Guest'

  const [activeGame, setActiveGame] = useState(GAMES[0])
  const [playerCount, setPlayerCount] = useState(GAMES[0].activePlayers)
  const [sideTab, setSideTab]   = useState<'games'|'chat'|'activity'>('games')
  const [chat, setChat]         = useState<ChatMsg[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [chatInput, setChatInput] = useState('')
  const [mobTab, setMobTab]     = useState<'info'|'chat'|'activity'>('info')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // live player drift
  useEffect(() => {
    setPlayerCount(activeGame.activePlayers)
    const t = setInterval(() => setPlayerCount(n => Math.max(2, n + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 3))), 3500)
    return () => clearInterval(t)
  }, [activeGame])

  // socket
  useEffect(() => {
    const s = connectSocket()
    s.on('chat:message',    (m: ChatMsg)          => setChat(p => [...p, m].slice(-60)))
    s.on('activity:update', (f: ActivityItem[])   => setActivity(f))
    s.on('online:count',    (n: number)            => setOnlineCount(n))
    s.emit('chat:history',  (h: ChatMsg[])         => setChat(h))
    s.emit('activity:get',  (f: ActivityItem[])    => setActivity(f))
    return () => { s.off('chat:message'); s.off('activity:update'); s.off('online:count') }
  }, [])

  useEffect(() => {
    if (sideTab === 'chat' || mobTab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat, sideTab, mobTab])

  function sendChat() {
    const msg = chatInput.trim().slice(0, 200)
    if (!msg || !address) return
    connectSocket().emit('global:chat:send', { username: myName, message: msg })
    setChatInput('')
  }

  const chatContent = (
    <>
      <div style={{ flex:1, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:'7px' }}>
        {chat.length === 0
          ? <div style={{ textAlign:'center', color:'#2d2d42', fontSize:'0.72rem', marginTop:'30px' }}>Connecting…</div>
          : chat.map((m, i) => {
              const isMe = m.username === myName
              const cols = ['#7c3aed','#06b6d4','#f59e0b','#22c55e','#ec4899','#f97316']
              const col  = cols[m.username.charCodeAt(0) % cols.length]
              return (
                <div key={i} style={{ display:'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap:'6px', alignItems:'flex-end' }}>
                  {!isMe && <div style={{ width:'24px', height:'24px', borderRadius:'7px', background:`${col}22`, border:`1px solid ${col}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.58rem', fontWeight:800, color:col, flexShrink:0 }}>{m.username.slice(0,2).toUpperCase()}</div>}
                  <div style={{ maxWidth:'82%' }}>
                    {!isMe && <div style={{ fontSize:'0.52rem', color:col, fontWeight:700, marginBottom:'2px', paddingLeft:'2px' }}>{m.username}</div>}
                    <div style={{ padding:'6px 10px', borderRadius: isMe ? '11px 11px 3px 11px' : '11px 11px 11px 3px', fontSize:'0.72rem', lineHeight:1.45, background: isMe ? 'linear-gradient(135deg,rgba(124,58,237,0.35),rgba(6,182,212,0.22))' : 'rgba(255,255,255,0.04)', color: isMe ? '#e2e8f0' : '#94a3b8', border: isMe ? '1px solid rgba(124,58,237,0.28)' : '1px solid rgba(255,255,255,0.05)', wordBreak:'break-word' }}>
                      {m.message}
                    </div>
                  </div>
                </div>
              )
            })
        }
        <div ref={chatEndRef}/>
      </div>
      <div style={{ padding:'8px 10px', borderTop:'1px solid #0f0f1e', flexShrink:0 }}>
        <div style={{ display:'flex', gap:'5px', background:'rgba(255,255,255,0.03)', border:'1px solid #141428', borderRadius:'9px', padding:'5px 7px' }}>
          <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key==='Enter' && sendChat()}
            placeholder={address ? 'Say something…' : 'Connect wallet to chat'} disabled={!address}
            style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#e2e8f0', fontSize:'0.72rem', minWidth:0 }}/>
          <button onClick={sendChat} disabled={!address||!chatInput.trim()}
            style={{ background:'linear-gradient(135deg,#7c3aed,#06b6d4)', border:'none', borderRadius:'6px', padding:'4px 10px', color:'#fff', fontSize:'0.65rem', fontWeight:700, cursor: address&&chatInput.trim() ? 'pointer':'default', opacity: address&&chatInput.trim() ? 1 : 0.3 }}>↑</button>
        </div>
      </div>
    </>
  )

  const activityContent = (
    <div style={{ flex:1, overflowY:'auto', padding:'8px 12px', display:'flex', flexDirection:'column', gap:'0' }}>
      {activity.length === 0
        ? <div style={{ textAlign:'center', color:'#2d2d42', fontSize:'0.72rem', marginTop:'30px' }}>No activity yet…</div>
        : [...activity].reverse().map((a, i) => (
            <div key={i} style={{ display:'flex', gap:'8px', alignItems:'flex-start', padding:'8px 0', borderBottom:'1px solid #0c0c14' }}>
              <span style={{ fontSize:'0.85rem', flexShrink:0 }}>{a.text.includes('won') ? '🏆' : a.text.includes('joined') ? '🎮' : a.text.includes('created')||a.text.includes('opened') ? '👤' : '⚡'}</span>
              <span style={{ fontSize:'0.67rem', color:'#475569', lineHeight:1.5 }}>{a.text}</span>
            </div>
          ))
      }
    </div>
  )

  return (
    <div style={{ background:'#08080f', minHeight:'100vh', color:'#e2e8f0', display:'flex', flexDirection:'column' }}>
      <style>{`
        @keyframes ticker-scroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes pulse-dot     { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.5)} }
        @keyframes hot-badge     { 0%,100%{opacity:1;box-shadow:0 0 6px rgba(239,68,68,0.5)} 50%{opacity:.7;box-shadow:0 0 16px rgba(239,68,68,0.9)} }
        @keyframes slide-in      { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
        @keyframes scan-line     { 0%{top:-4px} 100%{top:105%} }
        @keyframes border-glow   { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes float-emoji   { 0%,100%{transform:translateY(0) rotate(-5deg)} 50%{transform:translateY(-10px) rotate(5deg)} }
        @keyframes art-shimmer   { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }

        .game-tab  { transition:all .16s; cursor:pointer; border:none; }
        .play-btn  { transition:all .16s; cursor:pointer; }
        .side-row  { transition:all .16s; cursor:pointer; }
        .art-card  { transition:transform .18s,box-shadow .18s; cursor:pointer; }
        .tab-btn   { transition:all .15s; cursor:pointer; border:none; }
        .mob-tab-btn { transition:all .15s; cursor:pointer; border:none; }

        @media (hover:hover) {
          .game-tab:hover  { background:rgba(255,255,255,0.07)!important; }
          .play-btn:hover  { filter:brightness(1.15); transform:translateY(-1px); }
          .bot-btn:hover   { background:rgba(124,58,237,0.2)!important; }
          .side-row:hover  { background:rgba(255,255,255,0.05)!important; border-color:rgba(255,255,255,0.12)!important; }
          .art-card:hover  { transform:translateY(-4px)!important; box-shadow:0 8px 32px rgba(0,0,0,0.3)!important; }
          .mob-tab-btn:hover { background:rgba(255,255,255,0.05)!important; }
        }
        .game-tab:active  { transform:scale(0.94); }
        .play-btn:active  { transform:scale(0.96); }
        ::-webkit-scrollbar { display:none; }
        * { scrollbar-width:none; }
      `}</style>

      {/* ── Ticker ──────────────────────────────────────────────────── */}
      <div style={{ background:'rgba(34,197,94,0.04)', borderBottom:'1px solid rgba(34,197,94,0.07)', overflow:'hidden', height:'30px', display:'flex', alignItems:'center', flexShrink:0 }}>
        <div style={{ flexShrink:0, padding:'0 14px', display:'flex', alignItems:'center', gap:'5px', borderRight:'1px solid rgba(34,197,94,0.12)' }}>
          <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.4s ease-in-out infinite' }}/>
          <span style={{ fontSize:'0.58rem', fontFamily:'Orbitron,sans-serif', fontWeight:700, color:'#22c55e', letterSpacing:'0.1em' }}>LIVE</span>
        </div>
        <div style={{ overflow:'hidden', flex:1 }}>
          <div style={{ display:'inline-flex', animation:'ticker-scroll 22s linear infinite', whiteSpace:'nowrap' }}>
            {[...TICKER,...TICKER].map((w,i) => (
              <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'0 20px', fontSize:'0.68rem', borderRight:'1px solid #0e0e18' }}>
                <span style={{ color:'#94a3b8', fontWeight:700 }}>{w.user}</span>
                <span style={{ color:'#475569' }}>won</span>
                <span style={{ color:'#22c55e', fontWeight:800 }}>{w.amount}</span>
                <span style={{ color:'#2a2a3a' }}>· {w.icon} {w.game}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── HUD bar ─────────────────────────────────────────────────── */}
      <div style={{ background:'#0a0a14', borderBottom:'1px solid #0f0f1e', display:'flex', alignItems:'center', height:'38px', padding:'0 clamp(10px,2.5vw,24px)', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex' }}>
          {[
            { l:'GAMES',   v:'7',                   c:'#7c3aed' },
            { l:'LIVE',    v:`${playerCount+180}`,  c:'#22c55e', dot:true },
            { l:'CHAINS',  v:'6',                   c:'#06b6d4' },
            { l:'WINNER',  v:'85%',                 c:'#f59e0b' },
          ].map((s,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'0 clamp(8px,1.8vw,18px)', borderRight:i<3?'1px solid #0f0f1e':'none' }}>
              {s.dot && <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.8s ease-in-out infinite' }}/>}
              <span style={{ fontSize:'0.5rem', color:'#2d3748', fontFamily:'Orbitron,sans-serif', letterSpacing:'0.08em' }}>{s.l}</span>
              <span style={{ fontSize:'0.78rem', fontWeight:900, color:s.c, fontFamily:'Orbitron,sans-serif' }}>{s.v}</span>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
          <span style={{ width:'4px', height:'4px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.6s ease-in-out infinite' }}/>
          <span style={{ fontSize:'0.52rem', color:'#22c55e', fontFamily:'Orbitron,sans-serif', fontWeight:700 }}>{onlineCount||'—'} online</span>
        </div>
      </div>

      {/* ── Main content (fills remaining height) ─────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Game tabs */}
        <div style={{ display:'flex', gap:'5px', overflowX:'auto', padding:'10px clamp(10px,2.5vw,24px) 0', flexShrink:0 }}>
          {GAMES.map(g => {
            const active = activeGame.id === g.id
            return (
              <button key={g.id} className="game-tab"
                onClick={() => setActiveGame(g)}
                style={{
                  flexShrink:0, display:'flex', alignItems:'center', gap:'6px',
                  padding:'7px 14px', borderRadius:'9px 9px 0 0',
                  background: active ? '#0c0c17' : 'rgba(255,255,255,0.018)',
                  borderTop: `2px solid ${active ? g.glow : 'transparent'}`,
                  borderLeft:`1px solid ${active ? `rgba(${g.glowRgb},0.22)` : 'transparent'}`,
                  borderRight:`1px solid ${active ? `rgba(${g.glowRgb},0.22)` : 'transparent'}`,
                  borderBottom: active ? '1px solid #0c0c17' : '1px solid transparent',
                  color: active ? g.glow : '#374151',
                  fontFamily:'Orbitron,sans-serif', fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.06em',
                  marginBottom:'-1px', position:'relative', zIndex: active ? 2 : 1,
                }}>
                <span style={{ fontSize:'0.9rem' }}>{g.emoji}</span>
                {g.short}
                {g.hot && <span style={{ fontSize:'0.46rem', padding:'2px 4px', borderRadius:'4px', background:'rgba(239,68,68,0.18)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', animation:'hot-badge 1.6s ease-in-out infinite' }}>HOT</span>}
              </button>
            )
          })}
        </div>

        {/* Panel area */}
        <div style={{ flex:1, borderTop:'1px solid #0f0f1e', display:'grid', gridTemplateColumns:'minmax(0,1fr) clamp(240px,24vw,320px)', overflow:'hidden' }} className="panel-grid">
          <style>{`
            @media(max-width:800px){
              .panel-grid{grid-template-columns:1fr!important; overflow:visible!important;}
              .right-panel{display:none!important;}
              .mob-bottom{display:flex!important;}
            }
            @media(min-width:801px){
              .mob-bottom{display:none!important;}
            }
          `}</style>

          {/* ── Left: featured card ──────────────────────────────── */}
          <div style={{ overflowY:'auto', padding:'clamp(10px,1.5vw,18px) clamp(10px,2vw,20px)', display:'flex', flexDirection:'column', gap:'14px' }}>

            {/* Featured card */}
            <div key={activeGame.id} style={{ position:'relative', borderRadius:'18px', overflow:'hidden', border:`1px solid rgba(${activeGame.glowRgb},0.22)`, background:'#0c0c17', animation:'slide-in .22s ease-out', flexShrink:0 }}>
              <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse at 65% 35%, rgba(${activeGame.glowRgb},0.13) 0%, transparent 62%)`, pointerEvents:'none' }}/>
              <div style={{ position:'absolute', left:0, right:0, height:'2px', background:`linear-gradient(90deg,transparent,rgba(${activeGame.glowRgb},0.65),transparent)`, animation:'scan-line 4s linear infinite', pointerEvents:'none', zIndex:1 }}/>
              <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(255,255,255,0.025) 1px,transparent 1px)', backgroundSize:'22px 22px', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:`linear-gradient(90deg,transparent,${activeGame.glow},transparent)`, animation:'border-glow 2.5s ease-in-out infinite' }}/>

              <div style={{ position:'relative', zIndex:2, padding:'clamp(16px,2.2vw,28px)', display:'flex', flexDirection:'column', gap:'0' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'8px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                    <div style={{ width:'58px', height:'58px', borderRadius:'14px', flexShrink:0, background:`linear-gradient(135deg,rgba(${activeGame.glowRgb},0.25),rgba(${activeGame.glowRgb},0.07))`, border:`1px solid rgba(${activeGame.glowRgb},0.32)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2rem', boxShadow:`0 0 22px rgba(${activeGame.glowRgb},0.25)`, animation:'float-emoji 3s ease-in-out infinite' }}>
                      {activeGame.emoji}
                    </div>
                    <div>
                      <h1 style={{ fontFamily:'Orbitron,sans-serif', fontWeight:900, fontSize:'clamp(1.1rem,2.5vw,1.75rem)', margin:0, lineHeight:1.1, background:`linear-gradient(135deg,#fff 30%,${activeGame.glow})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                        {activeGame.title}
                      </h1>
                      <div style={{ display:'flex', gap:'5px', marginTop:'5px', flexWrap:'wrap' }}>
                        {activeGame.tags.map(t => (
                          <span key={t} style={{ fontSize:'0.58rem', fontWeight:700, padding:'2px 8px', borderRadius:'20px', background:`rgba(${activeGame.glowRgb},0.12)`, color:activeGame.glow, border:`1px solid rgba(${activeGame.glowRgb},0.22)`, letterSpacing:'0.05em' }}>{t}</span>
                        ))}
                        {activeGame.hot && <span style={{ fontSize:'0.58rem', fontWeight:700, padding:'2px 8px', borderRadius:'20px', background:'rgba(239,68,68,0.13)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.28)', animation:'hot-badge 1.6s ease-in-out infinite' }}>🔥 HOT</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'5px', padding:'4px 10px', borderRadius:'8px', background:'rgba(34,197,94,0.07)', border:'1px solid rgba(34,197,94,0.16)' }}>
                    <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.4s ease-in-out infinite' }}/>
                    <span style={{ fontSize:'0.58rem', fontFamily:'Orbitron,sans-serif', fontWeight:700, color:'#22c55e', letterSpacing:'0.08em' }}>LIVE</span>
                  </div>
                </div>

                <p style={{ color:'#64748b', fontSize:'0.86rem', lineHeight:1.65, marginBottom:'18px', maxWidth:'520px' }}>{activeGame.desc}</p>

                <div style={{ display:'flex', gap:'7px', flexWrap:'wrap', marginBottom:'20px' }}>
                  {[
                    { label:'PLAYERS', value:activeGame.players },
                    { label:'MAX POT', value:activeGame.maxPot, hi:true },
                    { label:'ACTIVE',  value:`${playerCount}`, pulse:true },
                    { label:'ENTRY',   value:'$0.5–$50' },
                  ].map((s,i) => (
                    <div key={i} style={{ padding:'8px 13px', borderRadius:'10px', background: s.hi ? `rgba(${activeGame.glowRgb},0.1)` : 'rgba(255,255,255,0.03)', border: s.hi ? `1px solid rgba(${activeGame.glowRgb},0.22)` : '1px solid #0f0f1e', display:'flex', flexDirection:'column', gap:'2px', minWidth:'78px' }}>
                      <span style={{ fontSize:'0.5rem', color:'#374151', fontFamily:'Orbitron,sans-serif', letterSpacing:'0.1em' }}>{s.label}</span>
                      <span style={{ fontSize:'0.82rem', fontWeight:800, color: s.hi ? activeGame.glow : '#e2e8f0', fontFamily:'Orbitron,sans-serif', display:'flex', alignItems:'center', gap:'4px' }}>
                        {s.pulse && <span style={{ width:'4px', height:'4px', borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse-dot 1.6s ease-in-out infinite' }}/>}
                        {s.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display:'flex', gap:'9px', flexWrap:'wrap', alignItems:'center' }}>
                  <button className="play-btn" onClick={() => navigate(`/lobby/${activeGame.id}`)}
                    style={{ background:`linear-gradient(135deg,${activeGame.bgFrom},${activeGame.bgTo})`, border:'none', borderRadius:'10px', padding:'12px 30px', color:'#fff', fontFamily:'Orbitron,sans-serif', fontWeight:900, fontSize:'0.86rem', cursor:'pointer', letterSpacing:'0.07em', boxShadow:`0 0 28px rgba(${activeGame.glowRgb},0.45),0 4px 14px rgba(0,0,0,0.4)` }}>
                    PLAY NOW →
                  </button>
                  <button className="bot-btn play-btn" onClick={() => navigate('/game/practice', { state:{ bot:true, entry:0, gameMode:activeGame.id } })}
                    style={{ background:'rgba(124,58,237,0.07)', border:'1px solid rgba(124,58,237,0.18)', borderRadius:'10px', padding:'12px 18px', color:'#a78bfa', fontWeight:700, fontSize:'0.78rem', cursor:'pointer', fontFamily:'Orbitron,sans-serif' }}>
                    vs Bot
                  </button>
                  <span style={{ fontSize:'0.62rem', color:'#1e2030' }}>No wallet needed</span>
                </div>
              </div>
              <div style={{ position:'absolute', right:'-14px', bottom:'-8px', fontSize:'130px', opacity:0.04, pointerEvents:'none', userSelect:'none', lineHeight:1 }}>{activeGame.emoji}</div>
            </div>

            {/* Articles strip */}
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'9px' }}>
                <span style={{ fontFamily:'Orbitron,sans-serif', fontWeight:900, fontSize:'0.6rem', color:'#374151', letterSpacing:'0.12em' }}>ARENA INTEL</span>
                <span style={{ fontSize:'0.52rem', padding:'2px 7px', background:'rgba(124,58,237,0.1)', color:'#a78bfa', borderRadius:'20px', border:'1px solid rgba(124,58,237,0.18)', fontWeight:700 }}>ARTICLES</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'8px' }}>
                {ARTICLES.map((a, i) => (
                  <div key={i} className="art-card"
                    style={{ background:'#0c0c17', border:'1px solid #111120', borderRadius:'12px', padding:'13px', position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:`linear-gradient(90deg,transparent,${a.color},transparent)`, animation:'art-shimmer 3s ease-in-out infinite' }}/>
                    <span style={{ fontSize:'0.5rem', padding:'2px 7px', borderRadius:'20px', background:`rgba(${a.cRgb},0.1)`, color:a.color, border:`1px solid rgba(${a.cRgb},0.22)`, fontWeight:700, fontFamily:'Orbitron,sans-serif', letterSpacing:'0.06em' }}>{a.tag}</span>
                    <div style={{ marginTop:'8px', fontSize:'0.75rem', color:'#94a3b8', lineHeight:1.5, fontWeight:600, marginBottom:'6px' }}>{a.title}</div>
                    <div style={{ fontSize:'0.58rem', color:'#2d2d42' }}>📖 {a.time} read</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right panel ──────────────────────────────────────── */}
          <div className="right-panel" style={{ borderLeft:'1px solid #0f0f1e', display:'flex', flexDirection:'column', overflow:'hidden' }}>

            {/* Tab header */}
            <div style={{ display:'flex', alignItems:'center', padding:'10px 10px', gap:'3px', borderBottom:'1px solid #0f0f1e', flexShrink:0 }}>
              {(['games','chat','activity'] as const).map(t => (
                <button key={t} className="tab-btn"
                  onClick={() => setSideTab(t)}
                  style={{ padding:'5px 9px', borderRadius:'7px', fontSize:'0.56rem', fontFamily:'Orbitron,sans-serif', fontWeight:700, letterSpacing:'0.04em', background: sideTab===t ? 'rgba(124,58,237,0.2)' : 'transparent', color: sideTab===t ? '#a78bfa' : '#374151', border: sideTab===t ? '1px solid rgba(124,58,237,0.28)' : '1px solid transparent' }}>
                  {t === 'games' ? '🎮 GAMES' : t === 'chat' ? '💬 CHAT' : '⚡ LIVE'}
                </button>
              ))}
            </div>

            {/* GAMES tab */}
            {sideTab === 'games' && (
              <div style={{ flex:1, overflowY:'auto', padding:'8px 10px', display:'flex', flexDirection:'column', gap:'5px' }}>
                {GAMES.filter(g => g.id !== activeGame.id).map(g => (
                  <button key={g.id} className="side-row"
                    onClick={() => setActiveGame(g)}
                    style={{ display:'flex', alignItems:'center', gap:'9px', padding:'9px 10px', background:'rgba(255,255,255,0.02)', border:`1px solid rgba(${g.glowRgb},0.1)`, borderRadius:'11px', cursor:'pointer', textAlign:'left', width:'100%' }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:`rgba(${g.glowRgb},0.12)`, border:`1px solid rgba(${g.glowRgb},0.18)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', flexShrink:0 }}>{g.emoji}</div>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.62rem', fontWeight:700, color:'#94a3b8', letterSpacing:'0.02em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{g.title}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:'4px', marginTop:'2px' }}>
                        <span style={{ width:'4px', height:'4px', borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse-dot 1.8s ease-in-out infinite' }}/>
                        <span style={{ fontSize:'0.56rem', color:'#374151' }}>{g.activePlayers} active</span>
                      </div>
                    </div>
                    {g.hot && <span style={{ fontSize:'0.46rem', padding:'2px 4px', borderRadius:'4px', background:'rgba(239,68,68,0.14)', color:'#ef4444', flexShrink:0, border:'1px solid rgba(239,68,68,0.22)' }}>HOT</span>}
                    <span style={{ color:`rgba(${g.glowRgb},0.55)`, fontSize:'0.8rem', flexShrink:0 }}>›</span>
                  </button>
                ))}
                {/* platform stats */}
                <div style={{ marginTop:'4px', padding:'11px', background:'rgba(124,58,237,0.04)', border:'1px solid rgba(124,58,237,0.1)', borderRadius:'10px' }}>
                  <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.48rem', color:'#374151', letterSpacing:'0.12em', marginBottom:'7px' }}>PLATFORM</div>
                  {[{ l:'Total wagered', v:'$284,710', c:'#a78bfa' }, { l:'Games played', v:'18,432', c:'#06b6d4' }, { l:'Biggest pot', v:'$1,275', c:'#f59e0b' }].map(s => (
                    <div key={s.l} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid #0c0c14' }}>
                      <span style={{ fontSize:'0.6rem', color:'#374151' }}>{s.l}</span>
                      <span style={{ fontSize:'0.62rem', fontWeight:700, color:s.c, fontFamily:'Orbitron,sans-serif' }}>{s.v}</span>
                    </div>
                  ))}
                  <Link to="/leaderboard" style={{ display:'block', textAlign:'center', marginTop:'7px', fontSize:'0.6rem', color:'#374151', textDecoration:'none', fontWeight:600 }}>🏆 Leaderboard →</Link>
                </div>
              </div>
            )}

            {/* CHAT tab */}
            {sideTab === 'chat' && <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>{chatContent}</div>}

            {/* ACTIVITY tab */}
            {sideTab === 'activity' && <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>{activityContent}</div>}
          </div>
        </div>

        {/* ── Mobile bottom panel ────────────────────────────────────── */}
        <div className="mob-bottom" style={{ borderTop:'1px solid #0f0f1e', flexDirection:'column', flexShrink:0 }}>
          {/* Tabs */}
          <div style={{ display:'flex', borderBottom:'1px solid #0f0f1e' }}>
            {(['info','chat','activity'] as const).map(t => (
              <button key={t} className="mob-tab-btn"
                onClick={() => setMobTab(t)}
                style={{ flex:1, padding:'9px 0', background: mobTab===t ? 'rgba(124,58,237,0.1)' : 'transparent', borderBottom: mobTab===t ? '2px solid #7c3aed' : '2px solid transparent', color: mobTab===t ? '#a78bfa' : '#374151', fontSize:'0.6rem', fontFamily:'Orbitron,sans-serif', fontWeight:700, letterSpacing:'0.04em' }}>
                {t === 'info' ? '🎮 GAMES' : t === 'chat' ? '💬 CHAT' : '⚡ LIVE'}
              </button>
            ))}
          </div>
          {/* Panel content */}
          <div style={{ height:'260px', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            {mobTab === 'info' && (
              <div style={{ flex:1, overflowY:'auto', padding:'8px 12px', display:'flex', flexDirection:'column', gap:'5px' }}>
                {GAMES.filter(g => g.id !== activeGame.id).map(g => (
                  <button key={g.id} className="side-row"
                    onClick={() => setActiveGame(g)}
                    style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 10px', background:'rgba(255,255,255,0.02)', border:`1px solid rgba(${g.glowRgb},0.1)`, borderRadius:'11px', cursor:'pointer', textAlign:'left', width:'100%' }}>
                    <div style={{ width:'30px', height:'30px', borderRadius:'8px', background:`rgba(${g.glowRgb},0.12)`, border:`1px solid rgba(${g.glowRgb},0.18)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.95rem', flexShrink:0 }}>{g.emoji}</div>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.62rem', fontWeight:700, color:'#94a3b8' }}>{g.title}</div>
                      <div style={{ fontSize:'0.56rem', color:'#374151', marginTop:'1px' }}>{g.activePlayers} active</div>
                    </div>
                    <span style={{ color:`rgba(${g.glowRgb},0.55)`, fontSize:'0.8rem', flexShrink:0 }}>›</span>
                  </button>
                ))}
              </div>
            )}
            {mobTab === 'chat' && <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>{chatContent}</div>}
            {mobTab === 'activity' && <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>{activityContent}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
