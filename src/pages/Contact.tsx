import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

interface Message {
  id: number
  from: 'aria' | 'user'
  text: string
}

const RULES: { keywords: string[]; response: string }[] = [
  {
    keywords: ['deposit', 'add money', 'add funds'],
    response:
      'To deposit, simply connect your wallet using the Connect Wallet button. Your USDT balance on Polygon is your playing balance. No separate deposit step is needed. When you join a game, you will be asked to approve the USDT transfer.',
  },
  {
    keywords: ['withdraw', 'withdrawal', 'cash out'],
    response:
      'Winnings are sent automatically to your wallet by the smart contract when a game ends. You do not need to request a withdrawal. It happens instantly on-chain.',
  },
  {
    keywords: ['bonus', 'quest'],
    response:
      'Bonuses are earned by completing match milestones. For example, 15 matches at $1 entry unlocks $1.20 in bonus credits. Bonuses are non-withdrawable and expire after 48 hours.',
  },
  {
    keywords: ['referral', 'refer', 'invite'],
    response:
      'Go to your Profile page and copy your referral link. When friends join through your link and play matches, you earn bonus match credits.',
  },
  {
    keywords: ['coin flip'],
    response:
      'Coin Flip is a best-of-5 game. Two players pick Heads or Tails. A verifiable random result picks the winner each round. The player who wins more rounds takes the pot.',
  },
  {
    keywords: ['liar dice', "liars dice", "liar's dice"],
    response:
      "In Liar's Dice, players roll hidden dice and take turns bidding on the total count of a face. Challenge a bid by calling liar. If the bid was correct, the challenger loses a die. Last player with dice wins.",
  },
  {
    keywords: ['highest unique', 'lowest unique'],
    response:
      'In Highest Unique, all players secretly pick a number from 1 to 20. The player with the highest number that nobody else also picked wins. Lowest Unique works the same but for the lowest number.',
  },
  {
    keywords: ['network', 'polygon', 'matic', 'chain'],
    response:
      'Arena Games runs on Polygon Mainnet (Chain ID 137). You need a small amount of MATIC for gas fees and USDT on Polygon for entry fees.',
  },
  {
    keywords: ['disconnect', 'disconnected', 'kicked'],
    response:
      'If a player disconnects within the first 10 seconds of a game, both players receive a full refund. After that, the disconnecting player forfeits the match.',
  },
  {
    keywords: ['entry fee', 'fee', 'cost'],
    response:
      'Entry fees range from $0.50 to $50 USDT. You choose the fee when creating a room. Arena takes a small platform fee from winnings, shown before you confirm.',
  },
  {
    keywords: ['safe', 'secure', 'hack', 'trust'],
    response:
      'Funds are held in an audited smart contract on Polygon, not by Arena Games. We do not have custody of your USDT. The contract is publicly verifiable on Polygonscan.',
  },
  {
    keywords: ['dispute', 'wrong', 'result', 'incorrect'],
    response:
      'If you believe a game result is incorrect, please provide your room code. We keep signed game logs for 90 days and investigate all disputes.',
  },
  {
    keywords: ['hello', 'hi', 'hey', 'help'],
    response:
      'Hello! I am ARIA, the Arena Games AI assistant. I can help with deposits, withdrawals, game rules, bonuses, referrals, technical issues, and more. What would you like to know?',
  },
  {
    keywords: ['human', 'agent', 'person', 'real'],
    response:
      'For complex issues, you can email us at support@joinarena.space. Include your wallet address and room code if relevant. We respond within 24 hours.',
  },
]

const FALLBACK =
  "I am not sure about that specific question. You can browse the Help Center for articles, or email support@joinarena.space with your wallet address and we will get back to you within 24 hours."

const GREETING =
  'Hello! I am ARIA, the Arena Games AI assistant. I can help with deposits, withdrawals, game rules, bonuses, referrals, and technical questions. What can I help you with today?'

const QUICK_REPLIES = ['How do I deposit', 'How do bonuses work', 'Game rules']

function getAriaResponse(text: string): string {
  const lower = text.toLowerCase()
  for (const rule of RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return rule.response
    }
  }
  // Special case: "game rules" quick reply
  if (lower.includes('game rules') || lower.includes('rules')) {
    return "We offer seven games: Coin Flip, Liar's Dice, Pattern Memory, Math Arena, Reaction Grid, Highest Unique, and Lowest Unique. Ask me about any specific game and I will explain how it works."
  }
  return FALLBACK
}

let msgIdCounter = 0
function nextId() {
  return ++msgIdCounter
}

export default function Contact() {
  const [messages, setMessages] = useState<Message[]>([
    { id: nextId(), from: 'aria', text: GREETING },
  ])
  const [input, setInput] = useState('')
  const [quickRepliesUsed, setQuickRepliesUsed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const userMsg: Message = { id: nextId(), from: 'user', text: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setQuickRepliesUsed(true)

    setTimeout(() => {
      const reply: Message = { id: nextId(), from: 'aria', text: getAriaResponse(trimmed) }
      setMessages(prev => [...prev, reply])
    }, 600)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') sendMessage(input)
  }

  const handleQuickReply = (text: string) => {
    sendMessage(text)
    inputRef.current?.focus()
  }

  return (
    <div style={{ background: '#06060e', minHeight: '100vh', padding: '40px 20px 80px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* Page heading */}
        <h1
          style={{
            fontFamily: 'Orbitron, sans-serif',
            color: '#e2e8f0',
            fontSize: '1.6rem',
            letterSpacing: '0.04em',
            fontWeight: 700,
            marginBottom: '8px',
          }}
        >
          Contact and Support
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '36px', lineHeight: 1.6 }}>
          ARIA is our AI assistant and can answer most questions instantly.
        </p>

        {/* Two-column layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)',
            gap: '24px',
            alignItems: 'start',
          }}
          className="contact-layout"
        >
          {/* Left column: info card */}
          <div
            style={{
              background: '#0d0d1a',
              border: '1px solid #1a1a2e',
              borderRadius: '14px',
              padding: '24px',
            }}
          >
            <h2
              style={{
                fontFamily: 'Orbitron, sans-serif',
                color: '#e2e8f0',
                fontSize: '0.78rem',
                letterSpacing: '0.08em',
                fontWeight: 700,
                textTransform: 'uppercase',
                marginBottom: '20px',
              }}
            >
              Support Info
            </h2>

            <InfoRow label="Availability" value="24/7 via ARIA" />
            <InfoRow label="Email" value="support@joinarena.space" />

            <div style={{ borderTop: '1px solid #1a1a2e', margin: '20px 0' }} />

            <p
              style={{
                fontSize: '0.75rem',
                color: '#475569',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Resources
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link
                to="/help"
                style={{
                  fontSize: '0.85rem',
                  color: '#f59e0b',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>&#9654;</span>
                Help Center
              </Link>
              <Link
                to="/faq"
                style={{
                  fontSize: '0.85rem',
                  color: '#f59e0b',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>&#9654;</span>
                FAQ
              </Link>
            </div>
          </div>

          {/* Right column: ARIA chat */}
          <div
            style={{
              background: '#0d0d1a',
              border: '1px solid #1a1a2e',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Chat header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #1a1a2e',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <AriaAvatar />
              <div>
                <p
                  style={{
                    fontFamily: 'Orbitron, sans-serif',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#e2e8f0',
                    letterSpacing: '0.06em',
                  }}
                >
                  ARIA
                </p>
                <p style={{ fontSize: '0.72rem', color: '#22c55e' }}>Online</p>
              </div>
            </div>

            {/* Messages */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                minHeight: '340px',
                maxHeight: '460px',
              }}
            >
              {messages.map(msg => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start',
                    gap: '10px',
                    alignItems: 'flex-end',
                  }}
                >
                  {msg.from === 'aria' && (
                    <div style={{ flexShrink: 0 }}>
                      <AriaAvatar small />
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: '78%',
                      background: msg.from === 'user' ? '#f59e0b' : '#141428',
                      color: msg.from === 'user' ? '#0a0a0f' : '#94a3b8',
                      borderRadius: msg.from === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      padding: '10px 14px',
                      fontSize: '0.84rem',
                      lineHeight: 1.65,
                      border: msg.from === 'aria' ? '1px solid #1e1e38' : 'none',
                      fontWeight: msg.from === 'user' ? 600 : 400,
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {/* Quick replies */}
              {!quickRepliesUsed && messages.length === 1 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                  {QUICK_REPLIES.map(qr => (
                    <button
                      key={qr}
                      onClick={() => handleQuickReply(qr)}
                      style={{
                        background: 'none',
                        border: '1px solid rgba(245,158,11,0.35)',
                        borderRadius: '20px',
                        padding: '6px 14px',
                        color: '#f59e0b',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        transition: 'background 0.15s',
                      }}
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div
              style={{
                padding: '14px 16px',
                borderTop: '1px solid #1a1a2e',
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
              }}
            >
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask ARIA anything..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  flex: 1,
                  background: '#0a0a14',
                  border: '1px solid #1e1e30',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  color: '#e2e8f0',
                  fontSize: '0.85rem',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                style={{
                  background: input.trim() ? '#f59e0b' : '#1a1a2e',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  color: input.trim() ? '#0a0a0f' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: input.trim() ? 'pointer' : 'default',
                  fontFamily: 'Orbitron, sans-serif',
                  letterSpacing: '0.04em',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Mobile responsive style */}
        <style>{`
          @media (max-width: 640px) {
            .contact-layout {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </div>
  )
}

function AriaAvatar({ small }: { small?: boolean }) {
  const size = small ? 28 : 36
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '8px',
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Orbitron, sans-serif',
        fontWeight: 700,
        color: '#ffffff',
        fontSize: small ? '0.55rem' : '0.65rem',
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}
    >
      AR
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <p style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>{value}</p>
    </div>
  )
}
