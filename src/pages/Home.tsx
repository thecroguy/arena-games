import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAccount, useWriteContract, useChainId, useSwitchChain, useSignMessage, usePublicClient } from 'wagmi'
import { parseUnits } from 'viem'
import { connectSocket } from '../utils/socket'
import { getUsername } from '../utils/profile'
import { SUPPORTED_CHAINS, type SupportedChain } from '../utils/chains'
import { getEscrowAddress, getRoomId, ESCROW_ABI, USDT_APPROVE_ABI } from '../utils/escrow'

// ── Animated game icons ──────────────────────────────────────────────────────
// animate=false used in small contexts (tabs, wins list) to stop distraction

function IconCoin({ size = 44, animate = true }: { size?: number; animate?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, #fde68a 0%, #f59e0b 52%, #92400e 100%)',
      boxShadow: animate ? `0 0 ${size * 0.45}px rgba(245,158,11,0.6), inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.3)` : `0 0 ${size * 0.18}px rgba(245,158,11,0.3)`,
      border: '2px solid rgba(251,191,36,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, position: 'relative', overflow: 'hidden',
      animation: animate ? 'coin-spin 2.2s linear infinite' : 'none',
    }}>
      <div style={{ position: 'absolute', inset: '18%', borderRadius: '50%', border: '1px solid rgba(120,53,15,0.45)' }} />
      <span style={{ fontFamily: 'Orbitron,sans-serif', fontWeight: 900, fontSize: size * 0.26, color: '#78350f', position: 'relative', zIndex: 1 }}>H|T</span>
    </div>
  )
}

function IconMath({ size = 44, animate = true }: { size?: number; animate?: boolean }) {
  const fs = size * 0.22
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      background: 'linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)',
      boxShadow: `0 0 ${animate ? size * 0.38 : size * 0.15}px rgba(124,58,237,${animate ? 0.5 : 0.25})`,
      display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr',
      padding: size * 0.14, gap: size * 0.07, flexShrink: 0,
      animation: animate ? 'math-pulse 2s ease-in-out infinite' : 'none',
    }}>
      {['+', '−', '×', '='].map((op, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'center',
          background: 'rgba(255,255,255,0.12)', borderRadius: size * 0.06,
          fontSize: fs, fontWeight: 900, color: 'rgba(255,255,255,0.92)',
          fontFamily: 'serif', lineHeight: 1,
        }}>{op}</div>
      ))}
    </div>
  )
}

function IconGrid({ size = 44, animate = true }: { size?: number; animate?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      background: 'linear-gradient(145deg, #0891b2 0%, #164e63 100%)',
      boxShadow: `0 0 ${animate ? size * 0.38 : size * 0.15}px rgba(6,182,212,${animate ? 0.45 : 0.2})`,
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: size * 0.1, padding: size * 0.13, flexShrink: 0,
    }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          borderRadius: size * 0.07,
          background: 'rgba(103,232,249,0.3)',
          animation: animate ? `cell-flash 2.4s ${i * 0.6}s ease-in-out infinite` : 'none',
        }} />
      ))}
    </div>
  )
}

function IconDice({ size = 44, animate = true }: { size?: number; animate?: boolean }) {
  const d = size * 0.11
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      background: 'linear-gradient(145deg, #fb923c 0%, #9a3412 100%)',
      boxShadow: `0 0 ${animate ? size * 0.38 : size * 0.15}px rgba(249,115,22,${animate ? 0.45 : 0.2})`,
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr 1fr',
      padding: size * 0.13, gap: d, flexShrink: 0,
      animation: animate ? 'dice-dots 2s steps(1) infinite' : 'none',
    }}>
      {[1,0,1,0,1,0,1,0,1].map((on, i) => (
        <div key={i} style={{ borderRadius: '50%', background: on ? 'rgba(255,255,255,0.92)' : 'transparent' }} />
      ))}
    </div>
  )
}

function IconMemory({ size = 44, animate = true }: { size?: number; animate?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      background: 'linear-gradient(145deg, #a855f7 0%, #581c87 100%)',
      boxShadow: `0 0 ${animate ? size * 0.38 : size * 0.15}px rgba(168,85,247,${animate ? 0.45 : 0.2})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      animation: animate ? 'math-pulse 2.4s ease-in-out infinite' : 'none',
    }}>
      <svg width={size * 0.68} height={size * 0.62} viewBox="0 0 36 32" fill="none">
        {/* Brain — two lobes with center stem */}
        <path d="M18 28 C18 28 10 26 7 21 C4 16 5 10 9 7 C11 5 14 5 16 7 C16 4 20 4 20 7 C22 5 25 5 27 7 C31 10 32 16 29 21 C26 26 18 28 18 28Z"
          fill="rgba(233,213,255,0.88)" style={{ animation: animate ? 'node-pulse 2.4s ease-in-out infinite' : 'none' }} />
        {/* Center divide */}
        <line x1="18" y1="7" x2="18" y2="27" stroke="rgba(139,92,246,0.55)" strokeWidth="1.2" strokeLinecap="round"/>
        {/* Wrinkle lines left */}
        <path d="M10 14 Q13 12 12 17" stroke="rgba(139,92,246,0.45)" strokeWidth="1" fill="none" strokeLinecap="round"/>
        {/* Wrinkle lines right */}
        <path d="M26 14 Q23 12 24 17" stroke="rgba(139,92,246,0.45)" strokeWidth="1" fill="none" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

function IconArrowUp({ size = 44, animate = true }: { size?: number; animate?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      background: 'linear-gradient(145deg, #22c55e 0%, #14532d 100%)',
      boxShadow: `0 0 ${animate ? size * 0.38 : size * 0.15}px rgba(34,197,94,${animate ? 0.45 : 0.2})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      animation: animate ? 'arrow-up 1.8s ease-in-out infinite' : 'none',
    }}>
      <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none">
        <path d="M12 5l7 7h-4v7H9v-7H5l7-7z" fill="rgba(255,255,255,0.9)" />
      </svg>
    </div>
  )
}

function IconArrowDown({ size = 44, animate = true }: { size?: number; animate?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      background: 'linear-gradient(145deg, #ec4899 0%, #831843 100%)',
      boxShadow: `0 0 ${animate ? size * 0.38 : size * 0.15}px rgba(236,72,153,${animate ? 0.45 : 0.2})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      animation: animate ? 'arrow-down 1.8s ease-in-out infinite' : 'none',
    }}>
      <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none">
        <path d="M12 19l-7-7h4V5h6v7h4l-7 7z" fill="rgba(255,255,255,0.9)" />
      </svg>
    </div>
  )
}

function GameIcon({ id, size = 44, animate = true }: { id: string; size?: number; animate?: boolean }) {
  if (id === 'coin-flip')      return <IconCoin size={size} animate={animate} />
  if (id === 'math-arena')     return <IconMath size={size} animate={animate} />
  if (id === 'reaction-grid')  return <IconGrid size={size} animate={animate} />
  if (id === 'liars-dice')     return <IconDice size={size} animate={animate} />
  if (id === 'pattern-memory') return <IconMemory size={size} animate={animate} />
  if (id === 'highest-unique') return <IconArrowUp size={size} animate={animate} />
  return <IconArrowDown size={size} animate={animate} />
}

// ── Live game preview scenes (inside carousel cards) ─────────────────────────

function GridFloor({ color }: { color: string }) {
  return (
    <div style={{
      position:'absolute', bottom:0, left:0, right:0, height:'55%',
      backgroundImage:`linear-gradient(${color}18 1px,transparent 1px),linear-gradient(90deg,${color}18 1px,transparent 1px)`,
      backgroundSize:'22px 22px',
      transform:'perspective(120px) rotateX(38deg)',
      transformOrigin:'bottom center',
      pointerEvents:'none',
    }}/>
  )
}

function CoinPreview({ glow, glowRgb }: { glow:string; glowRgb:string }) {
  type CPhase = 'pick' | 'flip' | 'result'
  const [phase, setPhase] = useState<CPhase>('pick')
  const [pick,   setPick]   = useState<'H'|'T'>('H')
  const [result, setResult] = useState<'H'|'T'>('H')

  useEffect(() => {
    if (phase === 'pick') {
      const t = setTimeout(() => {
        setPick(Math.random() > 0.5 ? 'H' : 'T')
        setResult(Math.random() > 0.5 ? 'H' : 'T')
        setPhase('flip')
      }, 1200)
      return () => clearTimeout(t)
    }
    if (phase === 'flip') {
      const t = setTimeout(() => setPhase('result'), 1000)
      return () => clearTimeout(t)
    }
    if (phase === 'result') {
      const t = setTimeout(() => setPhase('pick'), 1500)
      return () => clearTimeout(t)
    }
  }, [phase])

  const won = result === pick
  return (
    <div style={{ position:'relative', width:'100%', height:'100%', overflow:'hidden', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
      <GridFloor color={glow} />
      <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 50% 40%, rgba(${glowRgb},0.18) 0%, transparent 65%)`, pointerEvents:'none' }}/>
      {/* Round label — top */}
      <div style={{ position:'absolute', top:'10px', left:0, right:0, textAlign:'center', fontFamily:'Orbitron,sans-serif', fontSize:'0.44rem', color:`rgba(${glowRgb},0.4)`, letterSpacing:'0.1em', zIndex:1 }}>ROUND 3 / 5</div>
      {/* Coin — true center */}
      <div style={{ zIndex:1, filter:`drop-shadow(0 0 18px rgba(${glowRgb},0.7))`, marginBottom:'14px' }}>
        <IconCoin size={62} animate={phase === 'flip'} />
      </div>
      {/* Bottom slot: pick chips OR result — fixed 36px height so nothing shifts */}
      <div style={{ position:'relative', height:'36px', width:'100%', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1 }}>
        <div style={{ position:'absolute', inset:0, display:'flex', justifyContent:'center', alignItems:'center', gap:'6px',
          opacity: phase === 'pick' ? 1 : 0, transition:'opacity 0.2s', pointerEvents:'none' }}>
          {(['H','T'] as const).map(s => (
            <div key={s} style={{ width:'28px', height:'28px', borderRadius:'7px', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Orbitron,sans-serif', fontWeight:900, fontSize:'0.7rem', background: s === pick ? glow : 'rgba(255,255,255,0.05)', color: s === pick ? '#000' : '#64748b', border:`1px solid ${s === pick ? glow : 'rgba(255,255,255,0.08)'}` }}>{s}</div>
          ))}
        </div>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', gap:'3px',
          opacity: phase === 'result' ? 1 : 0, transition:'opacity 0.25s', pointerEvents:'none' }}>
          <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.95rem', fontWeight:900, color: won ? '#22c55e' : '#ef4444' }}>{result}</div>
          <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.44rem', fontWeight:900, letterSpacing:'0.12em', color: won ? '#22c55e' : '#ef4444' }}>{won ? 'WIN' : 'LOSE'}</div>
        </div>
      </div>
    </div>
  )
}

function MathPreview({ glow, glowRgb }: { glow:string; glowRgb:string }) {
  type MPhase = 'question' | 'wrong' | 'correct'
  const [phase, setPhase] = useState<MPhase>('question')
  const [q, setQ]         = useState({ a:14, b:8, op:'+', ans:22 })
  const [shown, setShown] = useState('')

  function nextQ() {
    const ops = ['+', '-', 'x'] as const
    const op  = ops[Math.floor(Math.random() * 3)]
    let a = Math.floor(Math.random() * 15) + 3
    let b = Math.floor(Math.random() * 12) + 2
    if (op === '-' && a < b) [a, b] = [b, a]
    const ans = op === '+' ? a + b : op === '-' ? a - b : a * b
    setQ({ a, b, op, ans })
    setShown('')
    setPhase('question')
  }

  useEffect(() => {
    if (phase === 'question') {
      const t = setTimeout(() => {
        // show wrong answer first
        const wrong = q.ans + (Math.random() > 0.5 ? 1 : -2)
        setShown(String(wrong))
        setPhase('wrong')
      }, 1600)
      return () => clearTimeout(t)
    }
    if (phase === 'wrong') {
      const t = setTimeout(() => {
        setShown(String(q.ans))
        setPhase('correct')
      }, 900)
      return () => clearTimeout(t)
    }
    if (phase === 'correct') {
      const t = setTimeout(nextQ, 1300)
      return () => clearTimeout(t)
    }
  }, [phase, q])

  const questionStr = `${q.a} ${q.op} ${q.b} =`
  const ansColor = phase === 'correct' ? '#22c55e' : phase === 'wrong' ? '#ef4444' : `rgba(${glowRgb},0.4)`
  const ansText  = phase === 'question' ? '?' : shown

  return (
    <div style={{ position:'relative', width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
      <GridFloor color={glow} />
      <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 50% 40%, rgba(${glowRgb},0.14) 0%, transparent 60%)`, pointerEvents:'none' }}/>
      <div style={{ position:'absolute', top:'10px', left:0, right:0, textAlign:'center', fontFamily:'Orbitron,sans-serif', fontSize:'0.44rem', color:`rgba(${glowRgb},0.4)`, letterSpacing:'0.1em', zIndex:1 }}>SPEED ROUND</div>

      {/* Question + Answer — locked center block, never changes height */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'6px', zIndex:1 }}>
        <div style={{ fontFamily:'Orbitron,sans-serif', fontWeight:900, fontSize:'1.4rem', color:'#fff', textShadow:`0 0 18px rgba(${glowRgb},0.7)`, letterSpacing:'0.04em' }}>
          {questionStr}
        </div>
        <div style={{ fontFamily:'Orbitron,sans-serif', fontWeight:900, fontSize:'1.8rem', color: ansColor, textShadow:`0 0 22px ${ansColor}`, letterSpacing:'0.04em', minWidth:'60px', textAlign:'center', transition:'color .2s, text-shadow .2s' }}>
          {ansText}
        </div>
      </div>

      {/* Result badge — absolute below the center block, never shifts content */}
      <div style={{ position:'absolute', bottom:'16px', left:0, right:0, display:'flex', justifyContent:'center', zIndex:1,
        opacity: phase !== 'question' ? 1 : 0, transition:'opacity 0.18s', pointerEvents:'none' }}>
        <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.5rem', fontWeight:900, letterSpacing:'0.14em',
          color: phase === 'correct' ? '#22c55e' : '#ef4444', padding:'3px 10px', borderRadius:'6px',
          background: phase === 'correct' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          border:`1px solid ${phase === 'correct' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
          {phase === 'correct' ? 'CORRECT' : 'WRONG'}
        </div>
      </div>
    </div>
  )
}

function ReactionPreview({ glow, glowRgb }: { glow:string; glowRgb:string }) {
  type RPhase = 'wait' | 'flash' | 'tapped'
  const [phase,  setPhase]  = useState<RPhase>('wait')
  const [target, setTarget] = useState(4)
  const [ms,     setMs]     = useState(0)

  useEffect(() => {
    if (phase === 'wait') {
      const t = setTimeout(() => { setTarget(Math.floor(Math.random() * 9)); setPhase('flash') }, 1300)
      return () => clearTimeout(t)
    }
    if (phase === 'flash') {
      const t = setTimeout(() => { setMs(Math.floor(Math.random() * 200) + 80); setPhase('tapped') }, 850)
      return () => clearTimeout(t)
    }
    if (phase === 'tapped') {
      const t = setTimeout(() => setPhase('wait'), 1100)
      return () => clearTimeout(t)
    }
  }, [phase])

  return (
    <div style={{ position:'relative', width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'10px', overflow:'hidden' }}>
      <GridFloor color={glow} />
      <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 50% 40%, rgba(${glowRgb},0.12) 0%, transparent 60%)`, pointerEvents:'none' }}/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'5px', zIndex:1 }}>
        {[0,1,2,3,4,5,6,7,8].map(i => {
          const isTarget  = i === target && phase !== 'wait'
          const isTapped  = isTarget && phase === 'tapped'
          return (
            <div key={i} style={{ width:'28px', height:'28px', borderRadius:'6px', transition:'all .15s',
              background: isTapped ? '#22c55e' : isTarget ? glow : `rgba(${glowRgb},0.08)`,
              border:`1px solid ${isTapped ? '#22c55e' : isTarget ? glow : `rgba(${glowRgb},0.15)`}`,
              boxShadow: isTarget ? `0 0 12px rgba(${glowRgb},0.7)` : 'none',
            }}/>
          )
        })}
      </div>
      <div style={{ position:'absolute', top:'10px', left:0, right:0, textAlign:'center', fontFamily:'Orbitron,sans-serif', fontSize:'0.44rem', color:`rgba(${glowRgb},0.5)`, letterSpacing:'0.1em', zIndex:1 }}>{phase === 'flash' ? 'TAP!' : 'REACTION GRID'}</div>
      <div style={{ position:'absolute', bottom:'16px', left:0, right:0, textAlign:'center', zIndex:1, pointerEvents:'none', opacity: phase === 'tapped' ? 1 : 0, transition:'opacity 0.15s' }}>
        <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.6rem', fontWeight:900, color:'#22c55e' }}>{ms}ms</span>
      </div>
    </div>
  )
}

function DicePreview({ glow, glowRgb }: { glow:string; glowRgb:string }) {
  type DPhase = 'roll' | 'bid' | 'challenge' | 'result'
  const DOT_PATTERNS: Record<number,number[]> = {
    1:[0,0,0,0,1,0,0,0,0], 2:[1,0,0,0,0,0,0,0,1], 3:[1,0,0,0,1,0,0,0,1],
    4:[1,0,1,0,0,0,1,0,1], 5:[1,0,1,0,1,0,1,0,1], 6:[1,0,1,1,0,1,1,0,1],
  }
  const [phase, setPhase] = useState<DPhase>('roll')
  const [dice,  setDice]  = useState([3,5,2])
  const [bid,   setBid]   = useState({ qty:2, face:3 })
  const [won,   setWon]   = useState(true)

  function nextRound() {
    setDice([Math.ceil(Math.random()*6), Math.ceil(Math.random()*6), Math.ceil(Math.random()*6)])
    setBid({ qty:Math.floor(Math.random()*3)+1, face:Math.ceil(Math.random()*6) })
    setWon(Math.random() > 0.4)
    setPhase('roll')
  }

  useEffect(() => {
    if (phase === 'roll')      { const t = setTimeout(() => setPhase('bid'),       1100); return () => clearTimeout(t) }
    if (phase === 'bid')       { const t = setTimeout(() => setPhase('challenge'),  1000); return () => clearTimeout(t) }
    if (phase === 'challenge') { const t = setTimeout(() => setPhase('result'),      700); return () => clearTimeout(t) }
    if (phase === 'result')    { const t = setTimeout(nextRound,                    1400); return () => clearTimeout(t) }
  }, [phase])

  return (
    <div style={{ position:'relative', width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px', overflow:'hidden' }}>
      <GridFloor color={glow} />
      <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 50% 40%, rgba(${glowRgb},0.12) 0%, transparent 60%)`, pointerEvents:'none' }}/>
      <div style={{ display:'flex', alignItems:'center', gap:'6px', zIndex:1 }}>
        {dice.map((d, fi) => (
          <div key={fi} style={{ width:'38px', height:'38px', borderRadius:'8px', background:`linear-gradient(145deg,rgba(${glowRgb},0.7),rgba(${glowRgb},0.3))`, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', padding:'5px', gap:'3px', animation: phase === 'roll' ? `dice-bob 0.4s ${fi*0.1}s ease-in-out infinite` : 'none' }}>
            {(DOT_PATTERNS[d] || DOT_PATTERNS[1]).map((on, di) => (
              <div key={di} style={{ borderRadius:'50%', background: on ? 'rgba(255,255,255,0.9)' : 'transparent' }}/>
            ))}
          </div>
        ))}
      </div>
      {/* Phase labels — absolute slot, never shift the dice */}
      <div style={{ position:'absolute', bottom:'18%', left:0, right:0, display:'flex', justifyContent:'center', zIndex:1, pointerEvents:'none' }}>
        {phase === 'bid'       && <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.7rem', fontWeight:900, color:`rgba(${glowRgb},0.9)` }}>BID: {bid.qty}x{bid.face}s</div>}
        {phase === 'challenge' && <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.72rem', fontWeight:900, color:'#f97316', letterSpacing:'0.08em' }}>LIAR!</div>}
        {phase === 'result'    && <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.58rem', fontWeight:900, letterSpacing:'0.08em', color: won?'#22c55e':'#ef4444', padding:'2px 9px', borderRadius:'5px', background: won?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)', border:`1px solid ${won?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.3)'}` }}>{won ? 'CALLED IT!' : 'WRONG CALL'}</div>}
      </div>
      <div style={{ position:'absolute', top:'10px', left:0, right:0, textAlign:'center', fontFamily:'Orbitron,sans-serif', fontSize:'0.44rem', color:`rgba(${glowRgb},0.5)`, letterSpacing:'0.1em', zIndex:1 }}>LIAR'S DICE</div>
    </div>
  )
}

function MemoryPreview({ glow, glowRgb }: { glow:string; glowRgb:string }) {
  type MmPhase = 'show' | 'hide' | 'recall' | 'result'
  const [phase,   setPhase]   = useState<MmPhase>('show')
  const [pattern, setPattern] = useState([0,4,8,2])
  const [recalled,setRecalled]= useState<number[]>([])
  const [correct, setCorrect] = useState(true)

  function nextRound() {
    const count = 4
    const p: number[] = []
    while (p.length < count) { const n = Math.floor(Math.random()*9); if (!p.includes(n)) p.push(n) }
    setPattern(p)
    setRecalled([])
    setCorrect(Math.random() > 0.3)
    setPhase('show')
  }

  useEffect(() => {
    if (phase === 'show')   { const t = setTimeout(() => setPhase('hide'),   1400); return () => clearTimeout(t) }
    if (phase === 'hide')   { const t = setTimeout(() => setPhase('recall'),   700); return () => clearTimeout(t) }
    if (phase === 'result') { const t = setTimeout(nextRound,                 1300); return () => clearTimeout(t) }
  }, [phase])

  useEffect(() => {
    if (phase !== 'recall') return
    let i = 0
    const iv = setInterval(() => {
      i++
      const tiles = correct ? pattern : [...pattern.slice(0,-1), (pattern[pattern.length-1]+2)%9]
      setRecalled(tiles.slice(0, i))
      if (i >= pattern.length) { clearInterval(iv); setTimeout(() => setPhase('result'), 200) }
    }, 380)
    return () => clearInterval(iv)
  }, [phase])

  return (
    <div style={{ position:'relative', width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'10px', overflow:'hidden' }}>
      <GridFloor color={glow} />
      <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 50% 40%, rgba(${glowRgb},0.12) 0%, transparent 60%)`, pointerEvents:'none' }}/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'5px', zIndex:1 }}>
        {[0,1,2,3,4,5,6,7,8].map(i => {
          const inPat = pattern.includes(i)
          const inRec = recalled.includes(i)
          const bg = (phase==='show'&&inPat) ? glow : ((phase==='recall'||phase==='result')&&inRec) ? (correct?glow:'#ef4444') : `rgba(${glowRgb},0.08)`
          const br = (phase==='show'&&inPat) ? glow : ((phase==='recall'||phase==='result')&&inRec) ? (correct?glow:'#ef4444') : `rgba(${glowRgb},0.15)`
          return <div key={i} style={{ width:'28px', height:'28px', borderRadius:'7px', background:bg, border:`1px solid ${br}`, transition:'all .2s' }}/>
        })}
      </div>
      {/* Result label — absolute, never shifts the grid */}
      <div style={{ position:'absolute', bottom:'18%', left:0, right:0, display:'flex', justifyContent:'center', zIndex:1, pointerEvents:'none',
        opacity: phase==='result' ? 1 : 0, transition:'opacity 0.18s' }}>
        <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.5rem', fontWeight:900, letterSpacing:'0.1em',
          color:correct?'#22c55e':'#ef4444', padding:'2px 9px', borderRadius:'5px',
          background:correct?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)',
          border:`1px solid ${correct?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.3)'}` }}>{correct?'PERFECT':'MISSED'}</div>
      </div>
      <div style={{ position:'absolute', top:'10px', left:0, right:0, textAlign:'center', fontFamily:'Orbitron,sans-serif', fontSize:'0.44rem', color:`rgba(${glowRgb},0.5)`, letterSpacing:'0.1em', zIndex:1 }}>{phase==='show'?'MEMORIZE':phase==='hide'?'...':phase==='recall'?'RECALL':''}</div>
    </div>
  )
}

function UniquePreview({ glow, glowRgb, isHigh }: { glow:string; glowRgb:string; isHigh:boolean }) {
  type UPhase = 'picking' | 'reveal' | 'winner'
  const [phase,  setPhase]  = useState<UPhase>('picking')
  const [picks,  setPicks]  = useState<number[]>([3,3,5,7,8,9])
  const [winner, setWinner] = useState(isHigh ? 9 : 1)

  function nextRound() {
    const arr: number[] = []
    for (let i = 0; i < 5; i++) arr.push(Math.floor(Math.random()*7)+(isHigh?2:1))
    const w = isHigh ? 9 : 1
    arr.push(w)
    setPicks(arr.sort(() => Math.random()-0.5))
    setWinner(w)
    setPhase('picking')
  }

  useEffect(() => {
    if (phase === 'picking') { const t = setTimeout(() => setPhase('reveal'),  1400); return () => clearTimeout(t) }
    if (phase === 'reveal')  { const t = setTimeout(() => setPhase('winner'),   800); return () => clearTimeout(t) }
    if (phase === 'winner')  { const t = setTimeout(nextRound,                 1500); return () => clearTimeout(t) }
  }, [phase])

  const counts: Record<number,number> = {}
  picks.forEach(p => { counts[p] = (counts[p]||0)+1 })

  return (
    <div style={{ position:'relative', width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px', overflow:'hidden' }}>
      <GridFloor color={glow} />
      <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 50% 40%, rgba(${glowRgb},0.12) 0%, transparent 60%)`, pointerEvents:'none' }}/>
      {phase === 'picking'
        ? <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', justifyContent:'center', maxWidth:'110px', zIndex:1 }}>
            {picks.map((_,i) => (
              <div key={i} style={{ width:'24px', height:'24px', borderRadius:'6px', background:`rgba(${glowRgb},0.1)`, border:`1px solid rgba(${glowRgb},0.18)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.58rem', color:`rgba(${glowRgb},0.3)` }}>?</span>
              </div>
            ))}
          </div>
        : <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'4px', zIndex:1 }}>
            {[1,2,3,4,5,6,7,8,9].map(n => {
              const isW = n===winner && phase==='winner'
              const has = !!counts[n]
              const dup = has && counts[n]>1
              return (
                <div key={n} style={{ width:'26px', height:'26px', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Orbitron,sans-serif', fontWeight:900, fontSize:'0.65rem', transition:'all .2s',
                  background: isW ? glow : has ? (dup?'rgba(239,68,68,0.15)':`rgba(${glowRgb},0.18)`) : 'rgba(255,255,255,0.03)',
                  color:       isW ? '#fff' : has ? (dup?'#ef4444':`rgba(${glowRgb},0.9)`) : '#1e2030',
                  border:`1px solid ${isW ? glow : has ? (dup?'rgba(239,68,68,0.3)':`rgba(${glowRgb},0.3)`) : 'rgba(255,255,255,0.04)'}`,
                  boxShadow:   isW ? `0 0 14px rgba(${glowRgb},0.7)` : 'none',
                  animation:   isW ? 'unique-pulse 0.8s ease-in-out infinite' : 'none',
                }}>{n}</div>
              )
            })}
          </div>
      }
      {/* Winner label — absolute, never shifts the grid */}
      <div style={{ position:'absolute', bottom:'18%', left:0, right:0, textAlign:'center', zIndex:1, pointerEvents:'none',
        opacity: phase==='winner' ? 1 : 0, transition:'opacity 0.18s' }}>
        <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.5rem', fontWeight:900, color:'#22c55e', letterSpacing:'0.1em' }}>UNIQUE WIN!</span>
      </div>
      <div style={{ position:'absolute', top:'10px', left:0, right:0, textAlign:'center', fontFamily:'Orbitron,sans-serif', fontSize:'0.44rem', color:`rgba(${glowRgb},0.4)`, letterSpacing:'0.1em', zIndex:1 }}>{isHigh?'HIGHEST UNIQUE':'LOWEST UNIQUE'}</div>
    </div>
  )
}

function CardPreview({ id, glow, glowRgb }: { id:string; glow:string; glowRgb:string }) {
  if (id === 'coin-flip')      return <CoinPreview glow={glow} glowRgb={glowRgb} />
  if (id === 'math-arena')     return <MathPreview glow={glow} glowRgb={glowRgb} />
  if (id === 'reaction-grid')  return <ReactionPreview glow={glow} glowRgb={glowRgb} />
  if (id === 'liars-dice')     return <DicePreview glow={glow} glowRgb={glowRgb} />
  if (id === 'pattern-memory') return <MemoryPreview glow={glow} glowRgb={glowRgb} />
  if (id === 'highest-unique') return <UniquePreview glow={glow} glowRgb={glowRgb} isHigh={true} />
  return <UniquePreview glow={glow} glowRgb={glowRgb} isHigh={false} />
}

// ── Data ─────────────────────────────────────────────────────────────────────

const GAMES = [
  { id:'coin-flip',      title:'Coin Flip',      short:'COIN FLIP',   desc:'Pick Heads or Tails. Best of 5 rounds. Pure 50/50 with nerve on the line.',        tags:['1v1','Fast'],       players:'2',    maxPot:'$85',  activePlayers:24, glow:'#f59e0b', glowRgb:'245,158,11', bgFrom:'#f59e0b', bgTo:'#d97706', hot:true,  badge:'HOT'      },
  { id:'liars-dice',     title:"Liar's Dice",    short:"LIAR'S DICE", desc:'Hidden dice. Bluff your bids. Call LIAR to eliminate. Deception wins.',             tags:['Bluff','Strategy'], players:'2-6',  maxPot:'$229', activePlayers:42, glow:'#f97316', glowRgb:'249,115,22', bgFrom:'#f97316', bgTo:'#ef4444', hot:true,  badge:'TRENDING' },
  { id:'pattern-memory', title:'Pattern Memory', short:'MEMORY',      desc:'Tiles flash briefly then go dark. Memorize every one and tap them back.',           tags:['Memory'],           players:'2-10', maxPot:'$382', activePlayers:15, glow:'#a855f7', glowRgb:'168,85,247', bgFrom:'#a855f7', bgTo:'#7c3aed', hot:false, badge:''         },
  { id:'math-arena',     title:'Math Arena',     short:'MATH',        desc:'Speed math. First correct answer scores. 100% skill, zero luck.',                   tags:['Skill','Speed'],    players:'2-10', maxPot:'$382', activePlayers:31, glow:'#7c3aed', glowRgb:'124,58,237', bgFrom:'#7c3aed', bgTo:'#06b6d4', hot:false, badge:''         },
  { id:'reaction-grid',  title:'Reaction Grid',  short:'REACTION',    desc:'A cell lights up. Click it before anyone else does.',                                tags:['Reflex'],           players:'2-10', maxPot:'$382', activePlayers:18, glow:'#06b6d4', glowRgb:'6,182,212',  bgFrom:'#06b6d4', bgTo:'#7c3aed', hot:false, badge:''         },
  { id:'highest-unique', title:'Highest Unique', short:'HI UNIQUE',   desc:'Pick the highest number that nobody else picks. Read the crowd. Outsmart them.',    tags:['Strategy'],         players:'3-20', maxPot:'$765', activePlayers:57, glow:'#22c55e', glowRgb:'34,197,94',  bgFrom:'#22c55e', bgTo:'#06b6d4', hot:false, badge:''         },
  { id:'lowest-unique',  title:'Lowest Unique',  short:'LO UNIQUE',   desc:'Pick the lowest number that nobody else picks. Contrarian thinking wins here.',     tags:['Bluff'],            players:'3-20', maxPot:'$765', activePlayers:39, glow:'#ec4899', glowRgb:'236,72,153', bgFrom:'#ec4899', bgTo:'#7c3aed', hot:false, badge:''         },
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

type ChatMsg = { username: string; message: string; ts: number }

const ENTRY_FEES = [0.5, 1, 2, 5, 10, 25, 50]

const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'
void SERVER_URL // used by connectSocket internally

const CHAT_COLORS = ['#7c3aed','#06b6d4','#f59e0b','#22c55e','#ec4899','#f97316']

export default function Home() {
  const navigate    = useNavigate()
  const { address, isConnected } = useAccount()
  const currentChainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const { signMessageAsync } = useSignMessage()
  const publicClient = usePublicClient()
  const authSigRef = useRef<string | null>(null)
  const myName = address ? getUsername(address) : 'Guest'

  const [activeGame, setActiveGame] = useState(GAMES[0])
  const [chat, setChat]         = useState<ChatMsg[]>([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [chatInput, setChatInput] = useState('')
  const [playFee, setPlayFee]   = useState(1)
  const [playMax, setPlayMax]   = useState(5)
  const [lobbyFee, setLobbyFee] = useState(1)
  const [lobbyMax, setLobbyMax] = useState(5)
  const [lobbyOpen, setLobbyOpen] = useState<null|'room'|'duel'>(null)
  const lobbyMode = lobbyOpen ?? 'room'
  const [creating, setCreating]   = useState(false)
  const [payStep, setPayStep]     = useState<'idle'|'switching'|'approving'|'paying'|'creating'>('idle')
  const [createError, setCreateError] = useState('')
  const [selectedChain] = useState<SupportedChain>(SUPPORTED_CHAINS[0])
  const [openSections, setOpenSections] = useState<Record<string,boolean>>({ info:true })
  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  const [winIdx, setWinIdx]     = useState(0)
  const [showWin, setShowWin]   = useState(false)
  const chatEndRef  = useRef<HTMLDivElement>(null)

  function toggleSection(key: string) {
    setOpenSections(p => ({ ...p, [key]: !p[key] }))
  }

  useEffect(() => {
    const [minP] = activeGame.players.includes('-') ? activeGame.players.split('-').map(Number) : [2, 2]
    setLobbyMax(Math.max(minP, activeGame.players === '2' ? 2 : 5))
  }, [activeGame])


  useEffect(() => {
    const s = connectSocket()
    s.on('chat:message',    (m: ChatMsg)   => setChat(p => [...p, m].slice(-80)))
    s.on('online:count',    (n: number)    => setOnlineCount(n))
    s.emit('chat:history',  (h: ChatMsg[]) => setChat(h))
    return () => { s.off('chat:message'); s.off('online:count') }
  }, [])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat])

  // Win toast on featured card — cycles through recent wins
  useEffect(() => {
    const iv = setInterval(() => {
      setWinIdx(i => (i + 1) % RECENT_WINS.length)
      setShowWin(true)
      setTimeout(() => setShowWin(false), 2400)
    }, 5000)
    return () => clearInterval(iv)
  }, [])

  async function getAuthSig() {
    if (!address) return null
    const key = `ag_authsig_${address.toLowerCase()}`
    const cached = authSigRef.current || localStorage.getItem(key)
    if (cached) { authSigRef.current = cached; return cached }
    try {
      const sig = await signMessageAsync({ message: `Arena Games: ${address.toLowerCase()}` })
      localStorage.setItem(key, sig); authSigRef.current = sig; return sig
    } catch { return null }
  }

  async function payAndCreate(overrideFee?: number, overrideMax?: number, overrideMode?: 'room'|'duel') {
    if (!isConnected || !address) { setCreateError('Connect your wallet first'); return }
    setCreating(true); setCreateError(''); setPayStep('idle')
    const authSig = await getAuthSig()
    if (!authSig) { setCreating(false); return }
    const chain = selectedChain
    const fee = overrideFee ?? lobbyFee
    const mode = overrideMode ?? lobbyMode
    const maxP = mode === 'duel' ? 2 : (overrideMax ?? lobbyMax)
    const rType = mode === 'duel' ? 'duel' : 'public'
    try {
      if (currentChainId !== chain.id) {
        setPayStep('switching')
        await switchChainAsync({ chainId: chain.id })
      }
      const escrowAddress = getEscrowAddress(chain.id)
      if (!escrowAddress) throw new Error('Escrow not deployed on this chain')
      const usdtAddress = chain.usdt
      const amount = parseUnits(String(fee), 6)
      const tempCode = `${activeGame.id}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
      const roomId = getRoomId(tempCode)
      setPayStep('approving')
      await writeContractAsync({ address: usdtAddress, abi: USDT_APPROVE_ABI, functionName: 'approve', args: [escrowAddress, amount] })
      setPayStep('paying')
      const tx = await writeContractAsync({ address: escrowAddress, abi: ESCROW_ABI, functionName: 'deposit', args: [roomId, amount] })
      setPayStep('creating')
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: tx })
      connectSocket().emit('room:create', { gameMode: activeGame.id, entry: fee, maxPlayers: maxP, roomType: rType, txHash: tx, chainId: chain.id, address, authSig, roomId },
        (res: { ok?: boolean; error?: string; code?: string }) => {
          setCreating(false); setPayStep('idle')
          if (res.error) setCreateError(res.error)
          else if (res.code) navigate(`/game/${res.code}`)
        }
      )
    } catch (e: unknown) {
      setCreating(false); setPayStep('idle')
      const msg = e instanceof Error ? e.message : String(e)
      setCreateError(msg.includes('rejected') ? 'Transaction rejected.' : 'Transaction failed.')
    }
  }

  function sendChat() {
    const msg = chatInput.trim().slice(0, 200)
    if (!msg || !address) return
    connectSocket().emit('global:chat:send', { username: myName, message: msg })
    setChatInput('')
  }


  const g = activeGame

  return (
    <div className="home-outer" style={{ background:'#08080f', height:'calc(100vh - 60px)', color:'#e2e8f0', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <style>{`
        @keyframes pulse-dot   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.6)} }
        @keyframes border-glow { 0%,100%{opacity:.28} 50%{opacity:.9} }
        @keyframes coin-spin   { 0%{transform:perspective(180px) rotateY(0deg)} 100%{transform:perspective(180px) rotateY(360deg)} }
        @keyframes math-pulse  { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.5) drop-shadow(0 0 10px #a78bfa)} }
        @keyframes cell-flash  { 0%,100%{background:rgba(103,232,249,0.22)} 50%{background:rgba(103,232,249,1);box-shadow:0 0 10px rgba(6,182,212,0.9)} }
        @keyframes dice-dots   { 0%,49%{opacity:1} 50%,74%{opacity:.35} 75%,100%{opacity:1} }
        @keyframes tile-blink  { 0%,100%{opacity:.22} 50%{opacity:1;box-shadow:0 0 7px rgba(168,85,247,0.9)} }
        @keyframes arrow-up    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes arrow-down  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }
        @keyframes hot-badge    { 0%,100%{box-shadow:0 0 4px rgba(239,68,68,0.4)} 50%{box-shadow:0 0 12px rgba(239,68,68,0.9)} }
        @keyframes slide-in     { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
        @keyframes math-appear  { 0%,100%{opacity:.4;transform:scale(0.95)} 45%,55%{opacity:1;transform:scale(1)} }
        @keyframes react-cell   { 0%,100%,30%{background:rgba(var(--cr),0.1);box-shadow:none} 15%{background:rgba(var(--cr),0.95);box-shadow:0 0 14px rgba(var(--cr),0.8)} }
        @keyframes dice-bob     { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-5px) rotate(4deg)} }
        @keyframes mem-tile     { 0%,100%,60%{background:rgba(var(--cm),0.12);box-shadow:none} 20%,40%{background:rgba(var(--cm),0.9);box-shadow:0 0 12px rgba(var(--cm),0.7)} }
        @keyframes unique-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
        @keyframes node-pulse   { 0%,100%{opacity:0.65} 50%{opacity:1} }

        .g-tab,.play-btn,.bot-btn,.r-tab,.c-card,.slide-btn,.send-btn { cursor:pointer; border:none; transition:all .14s; }
        .play-btn:active  { transform:scale(.96); }
        .g-tab:active     { transform:scale(.93); }
        .c-card:active    { transform:scale(.97); }
        .slide-btn:active { transform:scale(.88); }

        @media (hover:hover) {
          .g-tab:hover       { background:rgba(255,255,255,0.06)!important; color:#94a3b8!important; }
          .play-btn:hover    { filter:brightness(1.15); transform:translateY(-1px); }
          .bot-btn:hover     { background:rgba(124,58,237,0.22)!important; }
          .r-tab:hover       { background:rgba(255,255,255,0.05)!important; }
          .c-card:hover      { transform:translateY(-5px) scale(1.02)!important; }
          .slide-btn:hover   { background:rgba(255,255,255,0.1)!important; border-color:rgba(255,255,255,0.15)!important; }
          .send-btn:hover    { filter:brightness(1.15); }
        }
        ::-webkit-scrollbar { display:none; }
        * { scrollbar-width:none; }

        @media (max-width:700px) {
          .left-chat  { display:none!important; }
          .right-feed { display:none!important; }
          .mob-chat   { display:flex!important; }
          .mob-chat-bubble { display:flex!important; }
          .game-main-card { flex-direction:column-reverse!important; min-height:unset!important; }
          .game-card-preview { height:240px!important; width:100%!important; flex:none!important; overflow:hidden!important; }
          .game-card-info { flex:none!important; width:100%!important; }
          .mob-scroll-pad { padding-bottom:80px!important; overflow-y:visible!important; flex:none!important; }
          .home-outer  { height:auto!important; overflow:visible!important; min-height:calc(100vh - 60px); }
          .home-body   { overflow:visible!important; flex:none!important; }
          .home-center { overflow:visible!important; flex:none!important; }
        }
        @keyframes slide-up { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @media (min-width:701px) { .mob-chat { display:none!important; } .mob-chat-bubble { display:none!important; } }
      `}</style>

      {/* ── 3-column body ──────────────────────────────────────── */}
      <div className="home-body" style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>

        {/* LEFT: chat */}
        <div className="left-chat" style={{ width:'270px', flexShrink:0, borderRight:'1px solid #0d0d1e', display:'flex', flexDirection:'column', background:'#06060e' }}>
          <div style={{ padding:'10px 14px', borderBottom:'1px solid #0d0d1e', display:'flex', alignItems:'center', gap:'7px', flexShrink:0 }}>
            <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.6s infinite' }} />
            <span style={{ fontSize:'0.58rem', fontFamily:'Orbitron,sans-serif', color:'#64748b', fontWeight:700, letterSpacing:'0.1em', flex:1 }}>GENERAL CHAT</span>
            <span style={{ fontSize:'0.58rem', color:'#1e2030', fontFamily:'Orbitron,sans-serif' }}>{onlineCount || '--'}</span>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:'6px' }}>
            {chat.length === 0
              ? <div style={{ textAlign:'center', color:'#1e2030', fontSize:'0.72rem', marginTop:'24px' }}>Connecting...</div>
              : chat.map((m, i) => {
                  const isMe = m.username === myName
                  const col  = CHAT_COLORS[m.username.charCodeAt(0) % CHAT_COLORS.length]
                  return (
                    <div key={i} style={{ display:'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap:'6px', alignItems:'flex-end' }}>
                      {/* Avatar — only for others */}
                      {!isMe && (
                        <div style={{
                          width:'26px', height:'26px', borderRadius:'50%',
                          background:`linear-gradient(135deg, ${col}28, ${col}10)`,
                          border:`1.5px solid ${col}50`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:'0.58rem', fontWeight:800, color:col, flexShrink:0,
                        }}>
                          {m.username.slice(0,1).toUpperCase()}
                        </div>
                      )}
                      <div style={{ maxWidth:'80%' }}>
                        {!isMe && <div style={{ fontSize:'0.54rem', color:col, fontWeight:700, marginBottom:'2px', paddingLeft:'3px' }}>{m.username}</div>}
                        <div style={{
                          padding:'7px 11px',
                          borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                          fontSize:'0.72rem', lineHeight:1.45, wordBreak:'break-word',
                          background: isMe
                            ? 'linear-gradient(135deg, rgba(124,58,237,0.38), rgba(6,182,212,0.24))'
                            : 'rgba(255,255,255,0.045)',
                          color: isMe ? '#e2e8f0' : '#94a3b8',
                          border: isMe
                            ? '1px solid rgba(124,58,237,0.3)'
                            : '1px solid rgba(255,255,255,0.06)',
                        }}>
                          {m.message}
                        </div>
                      </div>
                    </div>
                  )
                })
            }
            <div ref={chatEndRef} />
          </div>

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
              <button className="send-btn" onClick={sendChat} disabled={!address || !chatInput.trim()}
                style={{
                  background: address && chatInput.trim() ? 'linear-gradient(135deg,#7c3aed,#06b6d4)' : 'rgba(255,255,255,0.04)',
                  border:'none', borderRadius:'7px', padding:'5px 13px',
                  color: address && chatInput.trim() ? '#fff' : '#64748b',
                  fontSize:'0.6rem', fontWeight:700, cursor: address && chatInput.trim() ? 'pointer' : 'default',
                  fontFamily:'Orbitron,sans-serif', letterSpacing:'0.04em', flexShrink:0,
                }}>
                SEND
              </button>
            </div>
          </div>
        </div>

        {/* CENTER */}
        <div className="home-center" style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Game tabs */}
          <div style={{ display:'flex', gap:'4px', overflowX:'auto', padding:'8px 14px', flexShrink:0, background:'#08080f', borderBottom:'1px solid #0d0d1e', alignItems:'center' }}>
            {GAMES.map(gg => {
              const active = activeGame.id === gg.id
              return (
                <button key={gg.id} className="g-tab"
                  onClick={() => setActiveGame(gg)}
                  style={{
                    flexShrink:0, display:'flex', alignItems:'center', gap:'6px',
                    padding:'5px 12px', borderRadius:'7px', marginBottom:'4px',
                    background: active ? `rgba(${gg.glowRgb},0.1)` : 'transparent',
                    border: active ? `1px solid rgba(${gg.glowRgb},0.45)` : '1px solid transparent',
                    outline: active ? `1px solid rgba(${gg.glowRgb},0.12)` : 'none',
                    outlineOffset: '2px',
                    boxShadow: active ? `0 0 10px rgba(${gg.glowRgb},0.18), inset 0 1px 0 rgba(${gg.glowRgb},0.15)` : 'none',
                    color: active ? gg.glow : '#64748b',
                    fontFamily:'Orbitron,sans-serif', fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.05em',
                    transition:'all .15s',
                  }}>
                  <GameIcon id={gg.id} size={15} animate={false} />
                  {gg.short}
                  {gg.hot && <span style={{ fontSize:'0.44rem', padding:'1px 4px', borderRadius:'4px', background: gg.badge==='HOT' ? 'rgba(239,68,68,0.16)' : 'rgba(249,115,22,0.14)', color: gg.badge==='HOT' ? '#ef4444' : '#fb923c', border:`1px solid ${gg.badge==='HOT' ? 'rgba(239,68,68,0.28)' : 'rgba(249,115,22,0.28)'}`, animation:'hot-badge 1.6s infinite' }}>{gg.badge}</span>}
                </button>
              )
            })}
          </div>

          {/* Scrollable center content */}
          <div className="mob-scroll-pad" style={{ flex:1, overflowY:'auto', padding:'14px 14px', display:'flex', flexDirection:'column', gap:'14px', minHeight:0 }}>

            {/* Featured game card — unified background, no split */}
            <div key={g.id} className="game-main-card" style={{ position:'relative', borderRadius:'18px', overflow:'hidden', border:`1px solid rgba(${g.glowRgb},0.22)`, background:`linear-gradient(120deg, #0d0d1a 0%, #0b0b16 55%, rgba(${g.glowRgb},0.06) 100%)`, animation:'slide-in .2s ease-out', flexShrink:0, minHeight:'320px', display:'flex' }}>
              {/* Top glow line */}
              <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:`linear-gradient(90deg,transparent,${g.glow},transparent)`, animation:'border-glow 2.5s ease-in-out infinite', zIndex:3 }} />
              {/* Ambient glow from right side */}
              <div style={{ position:'absolute', right:0, top:0, bottom:0, width:'45%', background:`radial-gradient(ellipse at 80% 50%, rgba(${g.glowRgb},0.12) 0%, transparent 70%)`, pointerEvents:'none', zIndex:0 }} />

              {/* LEFT: info */}
              <div className="game-card-info" style={{ flex:'0 0 50%', padding:'20px 22px', display:'flex', flexDirection:'column', justifyContent:'space-between', position:'relative', zIndex:2, minWidth:0 }}>
                {/* Title row */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', flexWrap:'wrap' }}>
                    <GameIcon id={g.id} size={32} animate={false} />
                    <h2 style={{ fontFamily:'Orbitron,sans-serif', fontWeight:900, fontSize:'clamp(0.95rem,1.8vw,1.3rem)', margin:0, background:`linear-gradient(135deg,#fff 30%,${g.glow})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                      {g.title}
                    </h2>
                    <div style={{ display:'flex', alignItems:'center', gap:'3px', padding:'2px 7px', borderRadius:'5px', background:'rgba(34,197,94,0.07)', border:'1px solid rgba(34,197,94,0.18)', flexShrink:0 }}>
                      <span style={{ width:'4px', height:'4px', borderRadius:'50%', background:'#22c55e', display:'block', animation:'pulse-dot 1.4s infinite' }} />
                      <span style={{ fontSize:'0.48rem', fontFamily:'Orbitron,sans-serif', fontWeight:700, color:'#22c55e', letterSpacing:'0.06em' }}>LIVE</span>
                    </div>
                    {g.tags.map(t => <span key={t} style={{ fontSize:'0.48rem', fontWeight:700, padding:'2px 6px', borderRadius:'20px', background:`rgba(${g.glowRgb},0.1)`, color:g.glow, border:`1px solid rgba(${g.glowRgb},0.18)` }}>{t}</span>)}
                    {g.hot && <span style={{ fontSize:'0.48rem', fontWeight:700, padding:'2px 6px', borderRadius:'20px', background: g.badge==='HOT' ? 'rgba(239,68,68,0.12)' : 'rgba(249,115,22,0.12)', color: g.badge==='HOT' ? '#ef4444' : '#fb923c', border:`1px solid ${g.badge==='HOT' ? 'rgba(239,68,68,0.22)' : 'rgba(249,115,22,0.25)'}`, animation:'hot-badge 1.6s infinite' }}>{g.badge}</span>}
                  </div>
                  <p style={{ color:'#4b5563', fontSize:'0.74rem', lineHeight:1.5, margin:'0 0 10px' }}>{g.desc}</p>
                </div>

                {/* Fee selector for PLAY NOW */}
                <div style={{ marginBottom:'8px' }}>
                  <div style={{ fontSize:'0.46rem', color:'#64748b', marginBottom:'5px', fontFamily:'Orbitron,sans-serif', letterSpacing:'0.06em' }}>ENTRY FEE</div>
                  <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                    {ENTRY_FEES.map(f => {
                      const active = playFee === f
                      return (
                        <button key={f} className="play-btn"
                          onClick={() => setPlayFee(f)}
                          style={{ padding:'3px 9px', borderRadius:'6px', fontFamily:'Orbitron,sans-serif', fontSize:'0.58rem', fontWeight:700,
                            background: active ? `linear-gradient(135deg,${g.bgFrom},${g.bgTo})` : 'rgba(255,255,255,0.05)',
                            color: active ? '#fff' : '#64748b',
                            border: active ? 'none' : '1px solid rgba(255,255,255,0.09)',
                            boxShadow: active ? `0 0 10px rgba(${g.glowRgb},0.35)` : 'none',
                          }}>
                          ${f}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {/* Player count selector — hidden only for strict 2-player games */}
                {g.players !== '2' && (() => {
                  const [minP, maxP] = g.players.includes('-') ? g.players.split('-').map(Number) : [2, 10]
                  const options = [2,3,4,5,6,8,10].filter(n => n >= minP && n <= maxP)
                  return (
                    <div style={{ marginBottom:'8px' }}>
                      <div style={{ fontSize:'0.46rem', color:'#64748b', marginBottom:'5px', fontFamily:'Orbitron,sans-serif', letterSpacing:'0.06em' }}>PLAYERS</div>
                      <div style={{ display:'flex', gap:'4px' }}>
                        {options.map(n => {
                          const active = playMax === n
                          return (
                            <button key={n} className="play-btn" onClick={() => setPlayMax(n)}
                              style={{ width:'28px', height:'26px', borderRadius:'6px', fontFamily:'Orbitron,sans-serif', fontSize:'0.6rem', fontWeight:700,
                                background: active ? `rgba(${g.glowRgb},0.2)` : 'rgba(255,255,255,0.05)',
                                color: active ? g.glow : '#64748b',
                                border: active ? `1px solid rgba(${g.glowRgb},0.4)` : '1px solid rgba(255,255,255,0.09)',
                              }}>
                              {n}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Buttons */}
                <div style={{ display:'flex', gap:'8px' }}>
                  <button className="play-btn" onClick={() => payAndCreate(playFee, g.players === '2' ? 2 : playMax, 'room')} disabled={creating}
                    style={{ background: creating ? 'rgba(255,255,255,0.07)' : `linear-gradient(135deg,${g.bgFrom},${g.bgTo})`, borderRadius:'10px', padding:'10px 22px', color:'#fff', fontFamily:'Orbitron,sans-serif', fontWeight:900, fontSize:'0.78rem', letterSpacing:'0.08em', boxShadow: creating ? 'none' : `0 0 24px rgba(${g.glowRgb},0.4)`, opacity: creating ? 0.7 : 1 }}>
                    {creating ? (payStep === 'approving' ? 'APPROVING...' : payStep === 'paying' ? 'PAYING...' : payStep === 'creating' ? 'CREATING...' : 'WAITING...') : `PLAY NOW $${playFee}`}
                  </button>
                  <button className="bot-btn play-btn" onClick={() => navigate('/game/practice', { state:{ bot:true, entry:0, gameMode:g.id } })}
                    style={{ background:'rgba(124,58,237,0.07)', border:'1px solid rgba(124,58,237,0.2)', borderRadius:'10px', padding:'10px 14px', color:'#a78bfa', fontWeight:700, fontSize:'0.72rem', fontFamily:'Orbitron,sans-serif' }}>
                    vs Bot
                  </button>
                </div>
                {createError && <div style={{ fontSize:'0.58rem', color:'#ef4444', marginTop:'6px' }}>{createError}</div>}
              </div>

              {/* RIGHT: live preview — no separate background, floats on card */}
              <div className="game-card-preview" style={{ flex:1, position:'relative', overflow:'hidden', zIndex:1 }}>
                <CardPreview id={g.id} glow={g.glow} glowRgb={g.glowRgb} />
                {/* Win toast */}
                <div style={{ position:'absolute', bottom:'10px', right:'10px', display:'inline-flex', alignItems:'center', gap:'6px', padding:'5px 9px', background:`rgba(${g.glowRgb},0.08)`, backdropFilter:'blur(6px)', borderRadius:'8px', border:`1px solid rgba(${g.glowRgb},0.18)`, zIndex:6, transition:'opacity .35s, transform .35s', opacity:showWin?1:0, transform:showWin?'translateY(0)':'translateY(6px)', pointerEvents:'none' }}>
                  <GameIcon id={RECENT_WINS[winIdx].gid} size={20} animate={false} />
                  <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.55rem', fontWeight:700, color:'#64748b', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{RECENT_WINS[winIdx].user}</span>
                  <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.62rem', fontWeight:900, color:'#22c55e', flexShrink:0 }}>{RECENT_WINS[winIdx].amount}</span>
                </div>
              </div>
            </div>

            {/* INLINE LOBBY */}
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>

              {/* DUEL / ROOM — two expand buttons */}
              <div style={{ display:'flex', gap:'6px' }}>
                {(['duel','room'] as const).map(m => {
                  const open = lobbyOpen === m
                  const isDuel = m === 'duel'
                  return (
                    <button key={m} className="play-btn"
                      onClick={() => setLobbyOpen(open ? null : m)}
                      style={{ padding:'6px 14px', fontFamily:'Orbitron,sans-serif', fontWeight:700, fontSize:'0.58rem', letterSpacing:'0.06em', borderRadius:'7px',
                        background: open ? (isDuel ? 'linear-gradient(135deg,#f97316,#ef4444)' : `linear-gradient(135deg,${g.bgFrom},${g.bgTo})`) : 'rgba(255,255,255,0.07)',
                        color: open ? '#fff' : '#94a3b8',
                        border: open ? 'none' : '1px solid rgba(255,255,255,0.13)',
                        boxShadow: open ? (isDuel ? '0 0 12px rgba(249,115,22,0.28)' : `0 0 12px rgba(${g.glowRgb},0.22)`) : 'none',
                        transition:'all .18s',
                      }}>
                      {isDuel ? 'DUEL 1v1' : 'CREATE ROOM'}
                    </button>
                  )
                })}
              </div>

              {/* Expanded panel — slides in */}
              {lobbyOpen !== null && (
                <div style={{ background:'rgba(255,255,255,0.022)', border:`1px solid ${lobbyOpen==='duel'?'rgba(249,115,22,0.25)':`rgba(${g.glowRgb},0.2)`}`, borderRadius:'12px', padding:'14px 16px', animation:'slide-in .18s ease-out' }}>
                  {/* Entry fee */}
                  <div style={{ marginBottom:'10px' }}>
                    <div style={{ fontSize:'0.46rem', color:'#64748b', marginBottom:'5px', fontFamily:'Orbitron,sans-serif', letterSpacing:'0.06em' }}>ENTRY FEE</div>
                    <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                      {ENTRY_FEES.map(f => {
                        const active = lobbyFee===f
                        return (
                          <button key={f} className="play-btn" onClick={() => setLobbyFee(f)}
                            style={{ padding:'4px 10px', borderRadius:'7px', fontFamily:'Orbitron,sans-serif', fontSize:'0.6rem', fontWeight:700,
                              background: active ? (lobbyOpen==='duel' ? 'linear-gradient(135deg,#f97316,#ef4444)' : `linear-gradient(135deg,${g.bgFrom},${g.bgTo})`) : 'rgba(255,255,255,0.05)',
                              color: active ? '#fff' : '#64748b',
                              border: active ? 'none' : '1px solid rgba(255,255,255,0.09)',
                              boxShadow: active ? (lobbyOpen==='duel' ? '0 0 10px rgba(249,115,22,0.4)' : `0 0 10px rgba(${g.glowRgb},0.35)`) : 'none',
                            }}>
                            ${f}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Max players — room only, non-2p games */}
                  {lobbyOpen === 'room' && g.players !== '2' && (
                    <div style={{ marginBottom:'12px' }}>
                      <div style={{ fontSize:'0.46rem', color:'#64748b', marginBottom:'5px', fontFamily:'Orbitron,sans-serif', letterSpacing:'0.06em' }}>MAX PLAYERS</div>
                      <div style={{ display:'flex', gap:'4px' }}>
                        {[2,3,4,5,6,8,10].map(n => {
                          const [minP, maxP] = g.players.includes('-') ? g.players.split('-').map(Number) : [2,10]
                          if (n < minP || n > maxP) return null
                          const active = lobbyMax===n
                          return (
                            <button key={n} className="play-btn" onClick={() => setLobbyMax(n)}
                              style={{ width:'30px', height:'28px', borderRadius:'7px', fontFamily:'Orbitron,sans-serif', fontSize:'0.62rem', fontWeight:700,
                                background: active ? `rgba(${g.glowRgb},0.2)` : 'rgba(255,255,255,0.05)',
                                color: active ? g.glow : '#64748b',
                                border: active ? `1px solid rgba(${g.glowRgb},0.4)` : '1px solid rgba(255,255,255,0.09)',
                              }}>
                              {n}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <button className="play-btn" onClick={() => payAndCreate(lobbyFee, lobbyOpen==='duel' ? 2 : lobbyMax, lobbyOpen)} disabled={creating}
                    style={{ padding:'7px 22px', borderRadius:'8px', color:'#fff', fontFamily:'Orbitron,sans-serif', fontWeight:900, fontSize:'0.62rem', letterSpacing:'0.07em', opacity: creating ? 0.7 : 1,
                      background: creating ? 'rgba(255,255,255,0.07)' : lobbyOpen==='duel' ? 'linear-gradient(135deg,#f97316,#ef4444)' : `linear-gradient(135deg,${g.bgFrom},${g.bgTo})`,
                      boxShadow: creating ? 'none' : lobbyOpen==='duel' ? '0 0 14px rgba(249,115,22,0.3)' : `0 0 14px rgba(${g.glowRgb},0.28)`,
                    }}>
                    {creating
                      ? (payStep==='approving'?'APPROVING...':payStep==='paying'?'PAYING...':payStep==='creating'?'CREATING...':'WAITING...')
                      : lobbyOpen==='duel' ? `CHALLENGE $${lobbyFee}` : `CREATE ROOM $${lobbyFee}`
                    }
                  </button>
                  {createError && <div style={{ fontSize:'0.58rem', color:'#ef4444', marginTop:'8px' }}>{createError}</div>}
                </div>
              )}

            </div>

          </div>
        </div>

        {/* RIGHT: info panel */}
        <div className="right-feed" style={{ width:'210px', flexShrink:0, borderLeft:'1px solid #0d0d1e', display:'flex', flexDirection:'column', background:'#06060e', overflowY:'auto' }}>
          {/* Platform stats */}
          <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid #0d0d1e', flexShrink:0 }}>
            <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.46rem', color:'#1e2030', letterSpacing:'0.14em', marginBottom:'10px' }}>PLATFORM</div>
            {[
              { l:'Online',   v: onlineCount ? String(onlineCount) : '247', c:'#22c55e' },
              { l:'Wagered',  v:'$284K',  c:'#a78bfa' },
              { l:'Games',    v:'1,843',  c:'#06b6d4'  },
              { l:'Big win',  v:'$1,275', c:'#f59e0b'  },
            ].map(s => (
              <div key={s.l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0', borderBottom:'1px solid #0a0a12' }}>
                <span style={{ fontSize:'0.58rem', color:'#64748b' }}>{s.l}</span>
                <span style={{ fontSize:'0.6rem', fontWeight:700, color:s.c, fontFamily:'Orbitron,sans-serif' }}>{s.v}</span>
              </div>
            ))}
          </div>

          {/* Expandable sections */}
          {[
            {
              key:'explore', label:'EXPLORE',
              links:[
                { label:'Leaderboard', to:'/leaderboard' },
                { label:'My Profile',  to:'/profile'     },
                { label:'Wallet',      to:'/wallet'      },
                { label:'History',     to:'/history'     },
              ],
            },
            {
              key:'info', label:'INFO',
              links:[
                { label:'About Arena',    to:'/about'    },
                { label:'Fairness',       to:'/fairness' },
                { label:'FAQ',            to:'/faq'      },
                { label:'Privacy Policy', to:'/privacy'  },
                { label:'Terms',          to:'/terms'    },
                { label:'AML Policy',     to:'/aml'      },
              ],
            },
            {
              key:'support', label:'SUPPORT',
              links:[
                { label:'Help Center', to:'/help'    },
                { label:'Contact',     to:'/contact' },
              ],
            },
          ].map(section => (
            <div key={section.key} style={{ borderBottom:'1px solid #0d0d1e', flexShrink:0 }}>
              <button className="r-tab"
                onClick={() => toggleSection(section.key)}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:'6px', padding:'10px 14px', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}>
                <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.48rem', color:'#64748b', letterSpacing:'0.14em', fontWeight:700, flex:1 }}>{section.label}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transition:'transform .2s', transform: openSections[section.key] ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink:0 }}>
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {openSections[section.key] && (
                <div style={{ paddingBottom:'6px' }}>
                  {section.links.map(link => (
                    <Link key={link.to} to={link.to}
                      style={{ display:'block', padding:'6px 20px', fontSize:'0.62rem', color:'#64748b', textDecoration:'none', transition:'color .12s' }}
                      onMouseEnter={e => (e.currentTarget.style.color='#94a3b8')}
                      onMouseLeave={e => (e.currentTarget.style.color='#64748b')}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Footer note */}
          <div style={{ padding:'14px', marginTop:'auto', flexShrink:0 }}>
            <p style={{ fontSize:'0.52rem', color:'#1e2030', lineHeight:1.6, margin:0 }}>
              By playing you confirm you are not in a restricted jurisdiction. Play responsibly.
            </p>
          </div>
        </div>

        {/* MOBILE: chat FAB */}
        <button className="mob-chat-bubble" onClick={() => setMobileChatOpen(true)}
          style={{ display:'none', position:'fixed', bottom:'24px', right:'18px', width:'44px', height:'44px', borderRadius:'50%', background:'linear-gradient(145deg,#1a0a2e,#0a1628)', border:'1px solid rgba(124,58,237,0.4)', cursor:'pointer', zIndex:60, alignItems:'center', justifyContent:'center', boxShadow:'0 0 20px rgba(124,58,237,0.3), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
            <path d="M18 13a2 2 0 01-2 1.5H6L2 18V4a2 2 0 012-2h12a2 2 0 012 2v9z" fill="url(#cg)" opacity="0.95"/>
            <defs><linearGradient id="cg" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse"><stop stopColor="#a78bfa"/><stop offset="1" stopColor="#22d3ee"/></linearGradient></defs>
          </svg>
          <span style={{ position:'absolute', top:'1px', right:'1px', width:'12px', height:'12px', borderRadius:'50%', background:'#22c55e', border:'2px solid #06060e', boxShadow:'0 0 5px #22c55e' }}/>
        </button>

        {/* MOBILE: chat drawer */}
        {mobileChatOpen && (
          <div className="mob-chat" style={{ display:'contents' }}>
            <div onClick={() => setMobileChatOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(2,2,8,0.8)', zIndex:61 }}/>
            <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:62, height:'64vh', display:'flex', flexDirection:'column', background:'#07070f', animation:'slide-up .2s cubic-bezier(0.4,0,0.2,1)' }}>

              {/* Top accent */}
              <div style={{ height:'2px', flexShrink:0, background:'linear-gradient(90deg,transparent,#7c3aed 30%,#06b6d4 70%,transparent)', animation:'border-glow 2.5s ease-in-out infinite' }}/>

              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', padding:'12px 16px', gap:'10px', flexShrink:0, background:'rgba(255,255,255,0.02)', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'6px', flex:1 }}>
                  <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#22c55e', animation:'pulse-dot 1.4s infinite', boxShadow:'0 0 5px rgba(34,197,94,0.6)', flexShrink:0 }}/>
                  <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.5rem', fontWeight:700, color:'#4a5568', letterSpacing:'0.14em' }}>LIVE CHAT</span>
                </div>
                <span style={{ fontSize:'0.46rem', fontFamily:'Orbitron,sans-serif', color:'#22c55e', background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.15)', borderRadius:'4px', padding:'2px 6px' }}>{onlineCount || 0} online</span>
                <button onClick={() => setMobileChatOpen(false)} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'6px', color:'#4a5568', cursor:'pointer', width:'24px', height:'24px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.9rem', flexShrink:0 }}>×</button>
              </div>

              {/* Messages — compact inline Stake-style */}
              <div style={{ flex:1, overflowY:'auto', padding:'8px 0 4px' }}>
                {chat.length === 0
                  ? <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
                      <span style={{ fontSize:'0.52rem', color:'#1e293b', fontFamily:'Orbitron,sans-serif', letterSpacing:'0.1em' }}>BE THE FIRST TO SAY HI</span>
                    </div>
                  : chat.slice(-60).map((m, i) => {
                    const col = CHAT_COLORS[m.username.charCodeAt(0) % CHAT_COLORS.length]
                    const initials = (m.username.slice(0,2)).toUpperCase()
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'4px 14px', transition:'background .1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                        {/* Avatar */}
                        <div style={{ width:'22px', height:'22px', borderRadius:'6px', background:`${col}18`, border:`1px solid ${col}35`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:'1px' }}>
                          <span style={{ fontSize:'0.4rem', fontWeight:900, color:col, fontFamily:'Orbitron,sans-serif', lineHeight:1 }}>{initials}</span>
                        </div>
                        {/* Content */}
                        <div style={{ flex:1, minWidth:0, lineHeight:1.5 }}>
                          <span style={{ fontSize:'0.58rem', fontWeight:700, color:col, fontFamily:'Orbitron,sans-serif' }}>{m.username} </span>
                          <span style={{ fontSize:'0.7rem', color:'#7c8fa4', wordBreak:'break-word' }}>{m.message}</span>
                        </div>
                      </div>
                    )
                  })
                }
              </div>

              {/* Input */}
              <div style={{ padding:'8px 12px 20px', flexShrink:0, borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display:'flex', alignItems:'center', background:'#0c0c18', border:'1px solid rgba(124,58,237,0.22)', borderRadius:'10px', overflow:'hidden' }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key==='Enter' && sendChat()}
                    placeholder={address ? 'Type a message...' : 'Connect wallet to chat'} disabled={!address}
                    style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#cbd5e1', fontSize:'0.8rem', padding:'11px 14px', minWidth:0 }}/>
                  <button onClick={sendChat} disabled={!address || !chatInput.trim()}
                    style={{ flexShrink:0, padding:'11px 16px', background: address && chatInput.trim() ? 'linear-gradient(135deg,#7c3aed,#06b6d4)' : 'transparent', border:'none', borderLeft:'1px solid rgba(124,58,237,0.15)', cursor: address && chatInput.trim() ? 'pointer' : 'default', transition:'all .15s', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M22 2L11 13" stroke={address && chatInput.trim() ? '#fff' : '#1e293b'} strokeWidth="2" strokeLinecap="round"/>
                      <path d="M22 2L15 22 11 13 2 9l20-7z" stroke={address && chatInput.trim() ? '#fff' : '#1e293b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
