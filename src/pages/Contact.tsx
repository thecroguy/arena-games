import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface Message { id: number; from: 'aria' | 'user'; text: string; article?: { label: string; path: string } }

const RULES: { keywords: string[]; response: string; article?: { label: string; path: string } }[] = [
  { keywords: ['deposit', 'add money', 'add funds', 'fund'],
    response: 'There is no separate deposit step. Your USDT balance on Polygon is your playing balance. When you join a game, you approve a specific USDT transfer to the escrow contract directly from your wallet. Nothing moves until you confirm it.',
    article: { label: 'How deposits work', path: '/help' } },
  { keywords: ['withdraw', 'withdrawal', 'cash out', 'cashout', 'payout'],
    response: 'Withdrawals are automatic. When a game ends, the smart contract sends winnings directly to your wallet within seconds. No buttons to click, no request needed. If you won, the funds arrive in your wallet automatically.',
    article: { label: 'How withdrawals work', path: '/help' } },
  { keywords: ['bonus', 'quest', 'reward', 'credit'],
    response: 'Bonuses are earned by hitting match milestones at a given entry fee. For example: 15 matches at $1 entry unlocks $1.20 in bonus credits. These credits can be used as entry fees but cannot be withdrawn. They expire 48 hours after unlocking.',
    article: { label: 'Bonuses and Quests guide', path: '/help' } },
  { keywords: ['referral', 'refer', 'invite', 'friend'],
    response: 'Go to your Profile page and copy your unique referral link. Share it with friends. When someone plays their first match through your link, you earn bonus match credits. There is no limit on referrals.',
    article: { label: 'How the referral program works', path: '/help' } },
  { keywords: ['coin flip', 'coinflip'],
    response: 'Coin Flip is a best-of-5 game. Two players each pick Heads or Tails before the flip. A verifiably random result determines the winner of each round. First to win 3 rounds takes the pot minus the platform fee.',
    article: { label: 'How Coin Flip works', path: '/help' } },
  { keywords: ['liar', "liar's dice", 'liars dice'],
    response: "In Liar's Dice, each player starts with 5 hidden dice. Players take turns bidding on the total count of a face value across all dice. Any player can call Liar. If the bid was true, the challenger loses a die. If false, the bidder does. Last player with dice wins.",
    article: { label: "How Liar's Dice works", path: '/help' } },
  { keywords: ['highest unique', 'lowest unique', 'unique'],
    response: 'In Highest Unique, all players secretly pick a number from 1 to 20. Numbers are revealed simultaneously. The player with the highest number that nobody else also picked wins. Lowest Unique works the same way but rewards the lowest unique pick instead.',
    article: { label: 'How Highest / Lowest Unique works', path: '/help' } },
  { keywords: ['math', 'math arena'],
    response: 'In Math Arena, all players are shown the same math problem at the same moment. The first player to submit the correct answer wins the point. Most points after all rounds wins the pot.',
    article: { label: 'How Math Arena works', path: '/help' } },
  { keywords: ['memory', 'pattern'],
    response: 'In Pattern Memory, a grid of tiles flashes a sequence. After the sequence ends, players must click the tiles in the exact order shown. The fastest and most accurate player wins.',
    article: { label: 'How Pattern Memory works', path: '/help' } },
  { keywords: ['reaction', 'reaction grid'],
    response: 'In Reaction Grid, one cell in a grid lights up at a time. The first player to click the highlighted cell wins the round point. Pure speed and reflexes.',
    article: { label: 'How Reaction Grid works', path: '/help' } },
  { keywords: ['network', 'polygon', 'matic', 'chain'],
    response: 'Arena Games runs on Polygon Mainnet (Chain ID 137). You need a small amount of MATIC for gas fees (usually less than $0.01 per transaction) and USDT on Polygon for entry fees. The app will prompt you to switch networks automatically.',
    article: { label: 'Which network should I use', path: '/help' } },
  { keywords: ['disconnect', 'disconnected', 'kicked', 'internet'],
    response: 'If a player disconnects within the first 10 seconds of a game, both players receive a full refund from the escrow contract. After the 10-second window, the disconnecting player forfeits the match.',
    article: { label: 'Terms of Service', path: '/terms' } },
  { keywords: ['entry fee', 'fee', 'cost', 'price', 'how much'],
    response: 'Entry fees range from $0.50 to $50 USDT per game. You choose the fee when creating a room, or match with someone at their listed fee. Arena takes a small platform fee from winnings, always shown before you confirm.',
    article: { label: 'FAQ: What is the platform fee?', path: '/faq' } },
  { keywords: ['safe', 'secure', 'hack', 'trust', 'legit', 'scam'],
    response: 'Funds are held in an audited smart contract on Polygon. Arena Games never has custody of your USDT. The contract code is publicly readable on Polygonscan. We cannot move your funds. You confirm every transaction in your own wallet.',
    article: { label: 'Fairness and transparency', path: '/fairness' } },
  { keywords: ['failed', 'fail', 'transaction', 'pending', 'stuck', 'gas', 'rejected'],
    response: 'Common reasons for transaction failures: (1) Not enough MATIC for gas — keep at least 0.1 MATIC in your wallet. (2) USDT approval was rejected — retry the approval step. (3) Network congestion on Polygon — wait 30 seconds and try again. (4) Insufficient USDT balance for the selected entry fee. If stuck as pending, go to MetaMask Settings, Advanced, then Reset Account.',
    article: { label: 'Why did my transaction fail?', path: '/help' } },
  { keywords: ['dispute', 'wrong', 'result', 'incorrect', 'error', 'bug'],
    response: 'If you believe a game result is incorrect, email support@joinarena.space with your room code and wallet address. We keep signed game logs for 90 days and will investigate within 48 hours.',
    article: { label: 'Game result seems wrong', path: '/help' } },
  { keywords: ['hello', 'hi', 'hey', 'start'],
    response: 'Hello! I am ARIA, the Arena Games AI assistant. I can answer questions about deposits, withdrawals, game rules, bonuses, referrals, and technical issues. What would you like to know?' },
  { keywords: ['okay', 'ok', 'thanks', 'thank you', 'thank', 'great', 'got it', 'understood', 'perfect', 'cool', 'nice', 'awesome'],
    response: 'Glad I could help! If you have any other questions, I am always here. Good luck at the tables.' },
  { keywords: ['human', 'agent', 'person', 'real person', 'email'],
    response: 'For issues that need a human, email us at support@joinarena.space. Include your wallet address and room code if relevant. We respond within 24 hours.' },
  { keywords: ['game', 'rule', 'rules', 'games', 'play'],
    response: 'Arena Games has seven game formats: Coin Flip, Liar\'s Dice, Pattern Memory, Math Arena, Reaction Grid, Highest Unique, and Lowest Unique. Each is a real-time skill game where you compete against another player for a USDT prize pot.',
    article: { label: 'Browse all game guides', path: '/help' } },
  { keywords: ['start', 'begin', 'how to', 'new', 'first time', 'getting started'],
    response: 'To get started: connect your wallet (MetaMask or WalletConnect), make sure you have USDT on Polygon Mainnet and a small amount of MATIC for gas, then choose a game and entry fee from the home page. No sign-up required.',
    article: { label: 'Getting started guide', path: '/help' } },
]

function getResponse(input: string): { text: string; article?: { label: string; path: string } } {
  const lower = input.toLowerCase()
  for (const rule of RULES) {
    if (rule.keywords.some(k => lower.includes(k))) return { text: rule.response, article: rule.article }
  }
  return { text: 'I am not sure about that specific question. Browse the Help Center for detailed articles, or email support@joinarena.space with your wallet address and we will get back to you within 24 hours.', article: { label: 'Browse the Help Center', path: '/help' } }
}

const QUICK_REPLIES = ['How do I deposit?', 'How do bonuses work?', 'My transaction failed', 'Game rules']

function AriaAvatar({ size = 36 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28),
      background: 'linear-gradient(145deg, #7c3aed, #a855f7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, boxShadow: `0 2px 12px rgba(124,58,237,0.35)`,
    }}>
      <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: size * 0.21, fontWeight: 900, color: 'white' }}>AR</span>
    </div>
  )
}

export default function Contact() {
  const nav = useNavigate()
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, from: 'aria', text: 'Hello! I am ARIA, the Arena Games AI assistant. I can help with deposits, withdrawals, game rules, bonuses, referrals, and technical questions. What can I help you with today?' },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  function send(text: string) {
    const t = text.trim()
    if (!t) return
    setMessages(prev => [...prev, { id: nextId.current++, from: 'user', text: t }])
    setInput('')
    setTyping(true)
    setTimeout(() => {
      const { text: responseText, article } = getResponse(t)
      setMessages(prev => [...prev, { id: nextId.current++, from: 'aria', text: responseText, article }])
      setTyping(false)
    }, 650)
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes typing-dot {
          0%,80%,100%{transform:scale(1);opacity:.3}
          40%{transform:scale(1.4);opacity:1}
        }
        @media(max-width:700px){ .contact-sidebar { display:none !important; } }
      `}</style>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #0f0820 0%, #080d1a 60%, #06060e 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '44px 20px 48px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-80px', right: '10%', width: '250px', height: '250px', background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '960px', margin: '0 auto', position: 'relative' }}>
          <button onClick={() => nav(-1)} style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '9px', padding: '8px 16px', cursor: 'pointer',
            color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, marginBottom: '28px', transition: 'all .14s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#e2e8f0' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 12.5L5.5 8 10 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <AriaAvatar size={52} />
            <div>
              <div style={{
                display: 'inline-block', background: 'rgba(124,58,237,0.12)',
                border: '1px solid rgba(124,58,237,0.25)', borderRadius: '8px',
                padding: '3px 12px', fontSize: '0.6rem', fontWeight: 800,
                letterSpacing: '0.1em', color: '#c4b5fd', textTransform: 'uppercase', marginBottom: '8px',
              }}>Support</div>
              <h1 style={{
                fontFamily: 'Orbitron, sans-serif', fontWeight: 900,
                fontSize: 'clamp(1.3rem, 3.5vw, 1.9rem)',
                color: '#f1f5f9', margin: '0 0 6px',
              }}>Talk to ARIA</h1>
              <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>
                ARIA answers most questions instantly. Complex issues: support@joinarena.space
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 20px 60px', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

        {/* Sidebar */}
        <div className="contact-sidebar" style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* ARIA info card */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '20px',
          }}>
            <AriaAvatar size={44} />
            <div style={{ marginTop: '14px', color: '#f1f5f9', fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>ARIA</div>
            <div style={{ color: '#64748b', fontSize: '0.78rem', lineHeight: 1.6, marginBottom: '14px' }}>
              Arena Games AI assistant. Available 24 hours a day, 7 days a week.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
              <span style={{ color: '#4ade80', fontSize: '0.74rem', fontWeight: 600 }}>Online now</span>
            </div>
          </div>

          {/* Resources card */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '18px',
          }}>
            <div style={{ color: '#475569', fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>Resources</div>
            {[
              { label: 'Help Center', path: '/help' },
              { label: 'FAQ', path: '/faq' },
              { label: 'Fairness Policy', path: '/fairness' },
            ].map(r => (
              <button key={r.path} onClick={() => nav(r.path)} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '9px 0', background: 'none', border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer', width: '100%',
                color: '#94a3b8', fontSize: '0.83rem', transition: 'color .14s',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fbbf24')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {r.label}
              </button>
            ))}
            <div style={{ marginTop: '14px', fontSize: '0.72rem', color: '#475569', lineHeight: 1.7 }}>
              Email support:<br />
              <span style={{ color: '#818cf8', fontWeight: 600, fontSize: '0.78rem' }}>support@joinarena.space</span>
            </div>
          </div>
        </div>

        {/* Chat window */}
        <div style={{
          flex: 1, minWidth: 0,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '18px', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', height: '560px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
        }}>

          {/* Chat header */}
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
            background: 'rgba(255,255,255,0.02)',
          }}>
            <AriaAvatar size={38} />
            <div>
              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.9rem' }}>ARIA</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#4ade80', fontSize: '0.73rem', fontWeight: 600 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px #22c55e' }} />
                Online
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '20px 16px',
            display: 'flex', flexDirection: 'column', gap: '16px',
          }}>
            {messages.map(m => (
              <div key={m.id} style={{
                display: 'flex',
                justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end', gap: '10px',
              }}>
                {m.from === 'aria' && <AriaAvatar size={30} />}
                <div style={{ maxWidth: '74%', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: m.from === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: m.from === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: m.from === 'user'
                      ? 'linear-gradient(135deg,#f97316,#ef4444)'
                      : 'rgba(255,255,255,0.06)',
                    border: m.from === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    color: m.from === 'user' ? '#ffffff' : '#cbd5e1',
                    fontSize: '0.85rem', lineHeight: 1.7,
                    boxShadow: m.from === 'user' ? '0 4px 16px rgba(249,115,22,0.3)' : 'none',
                  }}>
                    {m.text}
                  </div>
                  {m.from === 'aria' && m.article && (
                    <button onClick={() => nav(m.article!.path)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                      borderRadius: '20px', padding: '5px 12px',
                      cursor: 'pointer', color: '#fbbf24',
                      fontSize: '0.73rem', fontWeight: 600, transition: 'all .14s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.15)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.08)' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M2 8h12M8 2l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {m.article.label}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {typing && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                <AriaAvatar size={30} />
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '18px 18px 18px 4px',
                  display: 'flex', gap: '5px', alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: '6px', height: '6px', borderRadius: '50%', background: '#475569',
                      animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick replies */}
          {messages.length === 1 && !typing && (
            <div style={{
              padding: '0 14px 12px', display: 'flex', flexWrap: 'wrap', gap: '6px', flexShrink: 0,
            }}>
              {QUICK_REPLIES.map(q => (
                <button key={q} onClick={() => send(q)} style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '20px', padding: '6px 14px', cursor: 'pointer',
                  color: '#94a3b8', fontSize: '0.78rem', fontWeight: 500, transition: 'all .14s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'; e.currentTarget.style.color = '#fbbf24' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94a3b8' }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div style={{
            padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', gap: '10px', flexShrink: 0, alignItems: 'center',
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send(input)}
              placeholder="Ask ARIA anything..."
              style={{
                flex: 1, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                padding: '11px 15px', fontSize: '0.85rem',
                color: '#e2e8f0', fontFamily: 'inherit',
                outline: 'none', transition: 'border-color .14s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim()}
              style={{
                background: input.trim() ? 'linear-gradient(135deg,#f97316,#ef4444)' : 'rgba(255,255,255,0.05)',
                border: input.trim() ? 'none' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px', padding: '11px 22px',
                cursor: input.trim() ? 'pointer' : 'default',
                color: input.trim() ? 'white' : '#475569',
                fontFamily: 'Orbitron,sans-serif', fontSize: '0.6rem',
                fontWeight: 800, letterSpacing: '0.06em', transition: 'all .14s',
                boxShadow: input.trim() ? '0 2px 12px rgba(249,115,22,0.35)' : 'none',
              }}>
              SEND
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
