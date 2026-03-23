import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface Message { id: number; from: 'aria' | 'user'; text: string }

const RULES: { keywords: string[]; response: string }[] = [
  { keywords: ['deposit', 'add money', 'add funds', 'fund'],
    response: 'There is no separate deposit step. Your USDT balance on Polygon is your playing balance. When you join a game, you approve a specific USDT transfer to the escrow contract directly from your wallet. Nothing moves until you confirm it.' },
  { keywords: ['withdraw', 'withdrawal', 'cash out', 'cashout', 'payout'],
    response: 'Withdrawals are automatic. When a game ends, the smart contract sends winnings directly to your wallet within seconds. No buttons to click, no request needed. If you won, the funds arrive in your wallet automatically.' },
  { keywords: ['bonus', 'quest', 'reward', 'credit'],
    response: 'Bonuses are earned by hitting match milestones at a given entry fee. For example: 15 matches at $1 entry unlocks $1.20 in bonus credits. These credits can be used as entry fees for future games but cannot be withdrawn. They expire 48 hours after unlocking.' },
  { keywords: ['referral', 'refer', 'invite', 'friend'],
    response: 'Go to your Profile page and copy your unique referral link. Share it with friends. When someone plays their first match through your link, you earn bonus match credits. There is no limit on referrals.' },
  { keywords: ['coin flip', 'coinflip'],
    response: 'Coin Flip is a best-of-5 game. Two players each pick Heads or Tails before the flip. A verifiably random result determines the winner of each round. First to win 3 rounds takes the pot minus the platform fee.' },
  { keywords: ['liar', "liar's dice", 'liars dice'],
    response: "In Liar's Dice, each player starts with 5 hidden dice. Players take turns bidding on the total count of a face value across all dice. Any player can call Liar. If the bid was true, the challenger loses a die. If false, the bidder does. Last player with dice wins." },
  { keywords: ['highest unique', 'lowest unique', 'unique'],
    response: 'In Highest Unique, all players secretly pick a number from 1 to 20. Numbers are revealed simultaneously. The player with the highest number that nobody else also picked wins. Lowest Unique works the same way but rewards the lowest unique pick instead.' },
  { keywords: ['math', 'math arena'],
    response: 'In Math Arena, all players are shown the same math problem at the same moment. The first player to submit the correct answer wins the point. Most points after all rounds wins the pot.' },
  { keywords: ['memory', 'pattern'],
    response: 'In Pattern Memory, a grid of tiles flashes a sequence. After the sequence ends, players must click the tiles in the exact order shown. The fastest and most accurate player wins.' },
  { keywords: ['reaction', 'reaction grid'],
    response: 'In Reaction Grid, one cell in a grid lights up at a time. The first player to click the highlighted cell wins the round point. Pure speed and reflexes.' },
  { keywords: ['network', 'polygon', 'matic', 'chain', 'chain id'],
    response: 'Arena Games runs on Polygon Mainnet (Chain ID 137). You need a small amount of MATIC for gas fees (usually less than $0.01 per transaction) and USDT on Polygon for entry fees. The app will prompt you to switch networks automatically.' },
  { keywords: ['disconnect', 'disconnected', 'kicked', 'internet'],
    response: 'If a player disconnects within the first 10 seconds of a game, both players receive a full refund from the escrow contract. After the 10-second window, the disconnecting player forfeits the match.' },
  { keywords: ['entry fee', 'fee', 'cost', 'price', 'how much'],
    response: 'Entry fees range from $0.50 to $50 USDT per game. You choose the fee when creating a room, or match with someone at their listed fee. Arena takes a small platform fee from winnings, always shown before you confirm.' },
  { keywords: ['safe', 'secure', 'hack', 'trust', 'legit', 'scam'],
    response: 'Funds are held in an audited smart contract on Polygon. Arena Games never has custody of your USDT. The contract code is publicly readable on Polygonscan. We cannot move your funds. You confirm every transaction in your own wallet.' },
  { keywords: ['dispute', 'wrong', 'result', 'incorrect', 'error', 'bug'],
    response: 'If you believe a game result is incorrect, email support@joinarena.space with your room code and wallet address. We keep signed game logs for 90 days and will investigate within 48 hours.' },
  { keywords: ['hello', 'hi', 'hey', 'help', 'start', 'assist'],
    response: 'Hello! I am ARIA, the Arena Games AI assistant. I can answer questions about deposits, withdrawals, game rules, bonuses, referrals, and technical issues. What would you like to know?' },
  { keywords: ['human', 'agent', 'person', 'real person', 'email'],
    response: 'For issues that need a human, email us at support@joinarena.space. Include your wallet address and room code if relevant. We respond within 24 hours.' },
]

function getResponse(input: string): string {
  const lower = input.toLowerCase()
  for (const rule of RULES) {
    if (rule.keywords.some(k => lower.includes(k))) return rule.response
  }
  return 'I am not sure about that specific question. You can browse the Help Center for detailed articles, or email support@joinarena.space with your wallet address and we will get back to you within 24 hours.'
}

const QUICK_REPLIES = ['How do I deposit?', 'How do bonuses work?', 'My transaction failed', 'Game rules']

const CONTACT_CSS = `
  .ct-page, .ct-page * { box-sizing: border-box; }
  .ct-page { background: #f8fafc !important; }
  .ct-card { background: #ffffff !important; border: 1px solid #e2e8f0 !important; }
  .ct-left-text { color: #374151 !important; font-size: 0.83rem !important; font-family: system-ui,sans-serif !important; }
  .ct-left-label { color: #9ca3af !important; font-size: 0.66rem !important; font-weight: 700 !important; letter-spacing: 0.1em !important; text-transform: uppercase !important; font-family: system-ui,sans-serif !important; }
  .ct-left-name { color: #111827 !important; font-weight: 800 !important; font-size: 0.9rem !important; font-family: system-ui,sans-serif !important; }
  .ct-left-sub { color: #6b7280 !important; font-size: 0.78rem !important; line-height: 1.55 !important; font-family: system-ui,sans-serif !important; }
  .ct-online { color: #16a34a !important; font-size: 0.75rem !important; font-weight: 600 !important; font-family: system-ui,sans-serif !important; }
  .ct-email { color: #1e40af !important; font-weight: 600 !important; font-size: 0.8rem !important; font-family: system-ui,sans-serif !important; }
  .ct-res-link { color: #374151 !important; font-size: 0.83rem !important; font-family: system-ui,sans-serif !important; border-bottom: 1px solid #f3f4f6 !important; }
  .ct-res-link:hover { color: #f59e0b !important; }
  .ct-msg-aria { background: #f1f5f9 !important; border: 1px solid #e2e8f0 !important; color: #1e293b !important; font-size: 0.84rem !important; line-height: 1.7 !important; font-family: system-ui,sans-serif !important; }
  .ct-msg-user { background: linear-gradient(135deg,#f97316,#ef4444) !important; color: #ffffff !important; font-size: 0.84rem !important; line-height: 1.7 !important; font-family: system-ui,sans-serif !important; }
  .ct-input { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; color: #111827 !important; font-family: system-ui,sans-serif !important; outline: none !important; }
  .ct-input::placeholder { color: #9ca3af !important; }
  .ct-quick { background: #f1f5f9 !important; border: 1px solid #e2e8f0 !important; color: #374151 !important; font-family: system-ui,sans-serif !important; font-size: 0.78rem !important; font-weight: 500 !important; }
  .ct-quick:hover { background: #fef3c7 !important; border-color: #fcd34d !important; color: #92400e !important; }
  .ct-chat-name { color: #111827 !important; font-weight: 700 !important; font-size: 0.9rem !important; font-family: system-ui,sans-serif !important; }
  .ct-hero-title { color: #ffffff !important; font-weight: 900 !important; font-family: system-ui,sans-serif !important; font-size: clamp(1.2rem,3vw,1.7rem) !important; letter-spacing: -0.01em !important; }
  .ct-hero-sub { color: #94a3b8 !important; font-size: 0.88rem !important; font-family: system-ui,sans-serif !important; }
  .ct-typing { width: 6px !important; height: 6px !important; border-radius: 50% !important; background: #94a3b8 !important; }
`

export default function Contact() {
  const nav = useNavigate()
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, from: 'aria', text: 'Hello! I am ARIA, the Arena Games AI assistant. I can help with deposits, withdrawals, game rules, bonuses, referrals, and technical questions. What can I help you with today?' },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  let nextId = useRef(1)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  function send(text: string) {
    const t = text.trim()
    if (!t) return
    const userMsg: Message = { id: nextId.current++, from: 'user', text: t }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setTyping(true)
    setTimeout(() => {
      const ariaMsg: Message = { id: nextId.current++, from: 'aria', text: getResponse(t) }
      setMessages(prev => [...prev, ariaMsg])
      setTyping(false)
    }, 650)
  }

  return (
    <div className="ct-page" style={{ minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <style>{CONTACT_CSS}</style>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg,#1a0a2e 0%,#0a1628 50%,#06060e 100%)', padding: '36px 20px 44px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <button onClick={() => nav(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '20px', transition: 'all .14s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back
          </button>
          <h1 className="ct-hero-title" style={{ marginBottom:'8px' }}>Contact and Support</h1>
          <p className="ct-hero-sub" style={{ margin:0 }}>ARIA can answer most questions instantly. For complex issues, email support@joinarena.space.</p>
        </div>
      </div>

      {/* Two columns */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 20px 60px', display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <style>{`@media(max-width:680px){.contact-left{display:none!important;}}`}</style>

        {/* Left info */}
        <div className="contact-left" style={{ width:'220px', flexShrink:0 }}>
          <div className="ct-card" style={{ borderRadius:'14px', padding:'20px', boxShadow:'0 1px 6px rgba(0,0,0,0.07)', marginBottom:'12px' }}>
            <div style={{ width:'42px', height:'42px', borderRadius:'12px', background:'linear-gradient(145deg,#7c3aed,#a855f7)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'14px', boxShadow:'0 4px 14px rgba(124,58,237,0.3)' }}>
              <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.7rem', fontWeight:900, color:'white' }}>AR</span>
            </div>
            <div className="ct-left-name" style={{ marginBottom:'5px' }}>ARIA</div>
            <div className="ct-left-sub" style={{ marginBottom:'14px' }}>Arena Games AI assistant. Available 24 hours a day, 7 days a week.</div>
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 6px #22c55e' }} />
              <span className="ct-online">Online now</span>
            </div>
          </div>

          <div className="ct-card" style={{ borderRadius:'14px', padding:'18px', boxShadow:'0 1px 6px rgba(0,0,0,0.07)' }}>
            <div className="ct-left-label" style={{ marginBottom:'14px' }}>Resources</div>
            {[{ label:'Help Center', path:'/help' },{ label:'FAQ', path:'/faq' },{ label:'Fairness Policy', path:'/fairness' }].map(r => (
              <button key={r.path} onClick={() => nav(r.path)} className="ct-res-link"
                style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 0', background:'none', border:'none', cursor:'pointer', width:'100%' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {r.label}
              </button>
            ))}
            <div style={{ marginTop:'14px', fontSize:'0.73rem', color:'#9ca3af', lineHeight:1.6, fontFamily:'system-ui,sans-serif' }}>
              Email support:<br />
              <span className="ct-email">support@joinarena.space</span>
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="ct-card" style={{ flex:1, minWidth:'280px', borderRadius:'16px', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 4px 24px rgba(0,0,0,0.09)', height:'560px' }}>

          {/* Chat header */}
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:'12px', flexShrink:0, background:'#ffffff' }}>
            <div style={{ width:'38px', height:'38px', borderRadius:'11px', background:'linear-gradient(145deg,#7c3aed,#a855f7)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 2px 12px rgba(124,58,237,0.3)' }}>
              <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.62rem', fontWeight:900, color:'white' }}>AR</span>
            </div>
            <div>
              <div className="ct-chat-name">ARIA</div>
              <div className="ct-online" style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#22c55e', display:'inline-block' }} />
                Online
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:'auto', padding:'18px 16px', display:'flex', flexDirection:'column', gap:'14px', background:'#f8fafc' }}>
            {messages.map(m => (
              <div key={m.id} style={{ display:'flex', justifyContent: m.from==='user' ? 'flex-end' : 'flex-start', alignItems:'flex-end', gap:'8px' }}>
                {m.from === 'aria' && (
                  <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'linear-gradient(145deg,#7c3aed,#a855f7)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 2px 8px rgba(124,58,237,0.3)' }}>
                    <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.44rem', fontWeight:900, color:'white' }}>AR</span>
                  </div>
                )}
                <div className={m.from==='user' ? 'ct-msg-user' : 'ct-msg-aria'}
                  style={{ maxWidth:'74%', padding:'11px 15px', borderRadius: m.from==='user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', boxShadow: m.from==='user' ? '0 2px 10px rgba(249,115,22,0.28)' : '0 1px 4px rgba(0,0,0,0.06)' }}>
                  {m.text}
                </div>
              </div>
            ))}
            {typing && (
              <div style={{ display:'flex', alignItems:'flex-end', gap:'8px' }}>
                <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'linear-gradient(145deg,#7c3aed,#a855f7)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.44rem', fontWeight:900, color:'white' }}>AR</span>
                </div>
                <div style={{ padding:'11px 16px', background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:'16px 16px 16px 4px', display:'flex', gap:'5px', alignItems:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
                  {[0,1,2].map(i => (
                    <div className="ct-typing" key={i} style={{ animation:`typing-dot 1.2s ease-in-out ${i*0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick replies */}
          {messages.length === 1 && !typing && (
            <div style={{ padding:'0 14px 12px', display:'flex', flexWrap:'wrap', gap:'6px', flexShrink:0, background:'#f8fafc' }}>
              {QUICK_REPLIES.map(q => (
                <button key={q} onClick={() => send(q)} className="ct-quick"
                  style={{ borderRadius:'20px', padding:'6px 13px', cursor:'pointer', border:'1px solid', transition:'all .14s' }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding:'12px 14px', borderTop:'1px solid #f1f5f9', display:'flex', gap:'10px', flexShrink:0, alignItems:'center', background:'#ffffff' }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send(input)}
              placeholder="Ask ARIA anything..." className="ct-input"
              style={{ flex:1, borderRadius:'10px', padding:'10px 14px', fontSize:'0.85rem', transition:'border-color .14s' }}
            />
            <button onClick={() => send(input)} disabled={!input.trim()}
              style={{ background: input.trim() ? 'linear-gradient(135deg,#f97316,#ef4444)' : '#f1f5f9', border:'none', borderRadius:'10px', padding:'10px 20px', cursor: input.trim() ? 'pointer' : 'default', color: input.trim() ? 'white' : '#9ca3af', fontFamily:'Orbitron,sans-serif', fontSize:'0.6rem', fontWeight:800, letterSpacing:'0.05em', transition:'all .14s', boxShadow: input.trim() ? '0 2px 10px rgba(249,115,22,0.3)' : 'none' }}>
              SEND
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes typing-dot {
          0%,80%,100%{transform:scale(1);opacity:.4}
          40%{transform:scale(1.3);opacity:1}
        }
      `}</style>
    </div>
  )
}
