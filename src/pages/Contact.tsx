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
    <div style={{ background: '#f9fafb', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg,#1a0a2e 0%,#0a1628 50%,#06060e 100%)', padding: '36px 20px 44px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <button onClick={() => nav(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '20px', transition: 'all .14s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back
          </button>
          <h1 style={{ fontFamily: 'Orbitron,sans-serif', fontWeight: 900, fontSize: 'clamp(1.2rem,3vw,1.7rem)', color: '#ffffff', letterSpacing: '0.02em', marginBottom: '8px' }}>Contact and Support</h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>ARIA can answer most questions instantly. For complex issues, email support@joinarena.space.</p>
        </div>
      </div>

      {/* Two columns */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 20px 60px', display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <style>{`@media(max-width:680px){.contact-left{display:none!important;}}`}</style>

        {/* Left info */}
        <div className="contact-left" style={{ width: '220px', flexShrink: 0 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: 'linear-gradient(145deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>
              <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.72rem', fontWeight: 900, color: 'white' }}>AR</span>
            </div>
            <div style={{ fontFamily: 'Orbitron,sans-serif', fontWeight: 800, fontSize: '0.72rem', color: '#111827', letterSpacing: '0.06em', marginBottom: '4px' }}>ARIA</div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.5, marginBottom: '14px' }}>Arena Games AI assistant. Available 24 hours a day, 7 days a week.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
              <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 600 }}>Online now</span>
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '0.68rem', fontFamily: 'Orbitron,sans-serif', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.1em', marginBottom: '14px', textTransform: 'uppercase' }}>Resources</div>
            {[
              { label: 'Help Center', path: '/help' },
              { label: 'FAQ', path: '/faq' },
              { label: 'Fairness Policy', path: '/fairness' },
            ].map(r => (
              <button key={r.path} onClick={() => nav(r.path)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer', color: '#374151', fontSize: '0.83rem', width: '100%', borderBottom: '1px solid #f3f4f6' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f59e0b')}
                onMouseLeave={e => (e.currentTarget.style.color = '#374151')}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {r.label}
              </button>
            ))}
            <div style={{ marginTop: '14px', fontSize: '0.76rem', color: '#9ca3af', lineHeight: 1.5 }}>
              Email:<br />
              <span style={{ color: '#374151', fontWeight: 600 }}>support@joinarena.space</span>
            </div>
          </div>
        </div>

        {/* Chat */}
        <div style={{ flex: 1, minWidth: '280px', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', height: '560px' }}>

          {/* Chat header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(145deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 10px rgba(124,58,237,0.3)' }}>
              <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.62rem', fontWeight: 900, color: 'white' }}>AR</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>ARIA</div>
              <div style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                Online
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: '8px' }}>
                {m.from === 'aria' && (
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(145deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.46rem', fontWeight: 900, color: 'white' }}>AR</span>
                  </div>
                )}
                <div style={{
                  maxWidth: '72%', padding: '10px 14px', borderRadius: m.from === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.from === 'user' ? 'linear-gradient(135deg,#f97316,#ef4444)' : '#f8f9fa',
                  border: m.from === 'aria' ? '1px solid #e5e7eb' : 'none',
                  color: m.from === 'user' ? '#ffffff' : '#1f2937',
                  fontSize: '0.84rem', lineHeight: 1.7,
                  boxShadow: m.from === 'user' ? '0 2px 8px rgba(249,115,22,0.3)' : '0 1px 3px rgba(0,0,0,0.06)',
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {typing && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(145deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.46rem', fontWeight: 900, color: 'white' }}>AR</span>
                </div>
                <div style={{ padding: '10px 16px', background: '#f8f9fa', border: '1px solid #e5e7eb', borderRadius: '14px 14px 14px 4px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#9ca3af', animation: `typing-dot 1.2s ease-in-out ${i*0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick replies — only show if just the greeting message */}
          {messages.length === 1 && !typing && (
            <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: '6px', flexShrink: 0 }}>
              {QUICK_REPLIES.map(q => (
                <button key={q} onClick={() => send(q)} style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '20px', padding: '6px 13px', fontSize: '0.78rem', color: '#374151', cursor: 'pointer', fontWeight: 500, transition: 'all .14s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.borderColor = '#fcd34d'; e.currentTarget.style.color = '#92400e' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#374151' }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: '10px', flexShrink: 0, alignItems: 'center' }}>
            <input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send(input)}
              placeholder="Ask ARIA anything..."
              style={{ flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 14px', fontSize: '0.85rem', color: '#111827', outline: 'none', fontFamily: 'inherit' }}
            />
            <button onClick={() => send(input)} disabled={!input.trim()} style={{ background: input.trim() ? 'linear-gradient(135deg,#f97316,#ef4444)' : '#f3f4f6', border: 'none', borderRadius: '10px', padding: '10px 18px', cursor: input.trim() ? 'pointer' : 'default', color: input.trim() ? 'white' : '#9ca3af', fontFamily: 'Orbitron,sans-serif', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.05em', transition: 'all .14s', boxShadow: input.trim() ? '0 2px 10px rgba(249,115,22,0.3)' : 'none' }}>
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
