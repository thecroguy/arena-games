import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function useLightTheme() {
  useEffect(() => {
    const prev = { bg: document.body.style.background, color: document.body.style.color }
    const root = document.getElementById('root')
    const prevRoot = root ? root.style.background : ''
    document.body.style.background = '#f8fafc'
    document.body.style.color = '#1e293b'
    if (root) root.style.background = '#f8fafc'
    return () => {
      document.body.style.background = prev.bg
      document.body.style.color = prev.color
      if (root) root.style.background = prevRoot
    }
  }, [])
}

interface Article { title: string; answer: string }
interface Category { name: string; icon: string; color: string; articles: Article[] }

const CATEGORIES: Category[] = [
  {
    name: 'Getting Started', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', color: '#3b82f6',
    articles: [
      { title: 'How to connect your wallet', answer: 'Click Connect Wallet in the top right corner. Choose your provider from the list (MetaMask, WalletConnect, Coinbase Wallet). Approve the connection request in your wallet app. Make sure you are on Polygon Mainnet (Chain ID 137). If you are on the wrong network, the app will show a Switch Network button automatically.' },
      { title: 'How to play your first game', answer: 'From the home page, select a game using the tabs at the top of the card. Choose your entry fee from the selector. Click Play Now to enter the matchmaking queue, or Create Room to set up a private room and share the link with a friend. Confirm the USDT transfer in your wallet when prompted.' },
      { title: 'What do I need to get started', answer: 'You need three things: a web3 wallet (MetaMask or WalletConnect-compatible), USDT on Polygon Mainnet for entry fees (minimum $0.50), and a small amount of MATIC for gas fees (usually less than $0.01 per transaction). No sign-up, no email, no KYC.' },
      { title: 'How to get USDT on Polygon', answer: 'You can bridge USDT from Ethereum to Polygon using the official Polygon Bridge at wallet.polygon.technology. Alternatively, purchase USDT directly on Polygon through centralized exchanges that support Polygon withdrawals, such as Binance or OKX.' },
      { title: 'How to get MATIC for gas fees', answer: 'MATIC is available on most centralized exchanges. Withdraw directly to your Polygon wallet address. You only need a small amount: 0.1 MATIC is enough for dozens of transactions.' },
    ],
  },
  {
    name: 'Deposits and Withdrawals', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6', color: '#10b981',
    articles: [
      { title: 'How deposits work', answer: 'There is no deposit page or deposit form. Your connected wallet balance is your playing balance. When you join a game, you approve a specific USDT amount to be transferred to the escrow smart contract. This approval step is shown in your wallet and requires your explicit confirmation. Nothing moves until you approve.' },
      { title: 'How withdrawals work', answer: 'Withdrawals are automatic. When a game ends and the result is submitted to the smart contract by the server, the contract instantly sends the winning pot minus the platform fee to the winner\'s wallet. No button to click, no wait, no request to submit. It is on-chain and happens in seconds.' },
      { title: 'Why did my transaction fail', answer: 'Common reasons: (1) Not enough MATIC for gas. Keep at least 0.1 MATIC in your wallet. (2) USDT approval rejected or set to zero. Retry the approval step. (3) Network congestion on Polygon. Wait 30 seconds and try again. (4) Insufficient USDT balance for the entry fee selected. Check your balance.' },
      { title: 'How long do transactions take', answer: 'Polygon transactions confirm in 2 to 5 seconds under normal conditions. During occasional network congestion, it may take up to 30 seconds. If a transaction shows as pending for more than 5 minutes, you can increase the gas fee or cancel the transaction from MetaMask transaction settings.' },
      { title: 'Can I cancel a pending transaction', answer: 'Yes. In MetaMask, go to Activity, find the pending transaction, click Speed Up or Cancel. Cancellation sends a zero-value transaction with higher gas to override the original. This works as long as the original has not yet been mined.' },
    ],
  },
  {
    name: 'Games', icon: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z', color: '#f59e0b',
    articles: [
      { title: 'How Coin Flip works', answer: 'Two players each choose Heads or Tails before the flip. A verifiably random result is generated using a committed seed. The player who guessed correctly wins the round. Games are best of 5 rounds. The first player to win 3 rounds takes the pot minus the platform fee.' },
      { title: "How Liar's Dice works", answer: "Each player starts with 5 dice. Dice are rolled secretly and hidden in your cup. Players take turns making bids, for example: \"I believe there are at least three 4s across all cups combined.\" Any player can call Liar on the current bid. If the bid was true, the challenger loses a die. If the bid was false, the bidder loses a die. The last player with dice wins the pot." },
      { title: 'How Pattern Memory works', answer: 'A grid of colored tiles is shown. The grid flashes a sequence of highlighted tiles. After the sequence ends, players must click the tiles in the exact order they were highlighted. Accuracy and speed are both scored. The player with the most correct sequences after the set number of rounds wins.' },
      { title: 'How Math Arena works', answer: 'All players are shown the same math problem at the same moment. The first player to submit the correct answer wins the point. Problems range from basic arithmetic to more complex calculations depending on the round. The player with the most points after all rounds wins the pot.' },
      { title: 'How Reaction Grid works', answer: 'A grid of cells is displayed. One cell lights up at a time. All players see the same highlight simultaneously. The first player to click the highlighted cell wins that round point. Speed and reaction time determine the winner. Most points after all rounds wins the pot.' },
      { title: 'How Highest Unique works', answer: 'All players secretly pick a number from 1 to 20. After all players have submitted (or the timer runs out), all chosen numbers are revealed simultaneously. The player who chose the highest number that no other player also chose wins the pot. If there are no unique numbers, the round repeats.' },
      { title: 'How Lowest Unique works', answer: 'Same as Highest Unique, but the player who chose the lowest number that no one else also chose wins. This rewards contrarian thinking: picking 1 is bold but if anyone else also picks 1, both are disqualified from winning.' },
    ],
  },
  {
    name: 'Account and Profile', icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z', color: '#8b5cf6',
    articles: [
      { title: 'How to view my game history', answer: 'Click Profile in the top navigation bar. The History section on your profile page shows all past games including the game type, entry fee, opponent, result (win or loss), and the amount paid out.' },
      { title: 'How to change my username', answer: 'Go to your Profile page. Click on your current username or the edit icon next to it. Type your new username and confirm. Usernames must be between 3 and 20 characters and can include letters, numbers, and underscores.' },
      { title: 'How the referral program works', answer: 'On your Profile page, find the Referral section and copy your unique referral link. Share this link with friends. When someone signs up through your link and completes paid matches, you earn bonus match credits. Credits appear in your Quest panel on the home page.' },
      { title: 'What does my profile show', answer: 'Your profile shows your wallet address, username, total matches played, win rate, total wagered, biggest win, referral link, and full game history. Stats update after each completed match.' },
    ],
  },
  {
    name: 'Bonuses and Quests', icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', color: '#f97316',
    articles: [
      { title: 'What are bonus credits', answer: 'Bonus credits are earned by completing quest milestones. A quest milestone is reaching a set number of matches played at a specific entry fee level within a calendar month. For example, playing 15 matches at $1 entry unlocks $1.20 in bonus credits. Bonus credits can be used as entry fees for future games but cannot be withdrawn.' },
      { title: 'How to claim a bonus', answer: 'Bonuses are credited automatically when you hit a tier milestone. You will see a notification in the Quest panel on the home page. The credits will be usable immediately for your next game entry.' },
      { title: 'When do bonuses expire', answer: 'Each bonus credit award expires 48 hours after it is unlocked. The expiry time is shown in your Quest panel. If you do not use the credits within 48 hours, they are forfeited. There is no extension.' },
      { title: 'Can I stack multiple bonuses', answer: 'No. Only one bonus tier per entry fee level can be active at a time. If you unlock the next tier before the current one expires, the system activates the new tier only after the current one is used or expires.' },
      { title: 'What is a quest tier', answer: 'Each entry fee level (currently $1 and $5) has four quest tiers: Bronze (5 matches), Silver (15 matches), Gold (30 matches), and Elite (50 matches). The tier counts reset at the start of each calendar month. Reaching each tier unlocks a bonus credit reward for that entry level.' },
    ],
  },
  {
    name: 'Technical', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', color: '#64748b',
    articles: [
      { title: 'Which network should I use', answer: 'Polygon Mainnet only. Chain ID: 137. RPC URL: https://polygon-rpc.com. If your wallet is connected to Ethereum mainnet or any other chain, the app will show a Switch Network button. Click it to switch automatically.' },
      { title: 'MetaMask not connecting', answer: 'Try these steps: (1) Refresh the page and try again. (2) Make sure MetaMask is unlocked (not showing a password prompt). (3) Disable browser extensions that may intercept wallet connections. (4) Clear your browser cache and reconnect. (5) Try a different browser.' },
      { title: 'WalletConnect not working', answer: 'Make sure your phone and the device you are browsing on are both connected to the internet. The WalletConnect QR code expires after 60 seconds. If it times out, click Try Again to generate a new code. Update your mobile wallet app to the latest version if problems persist.' },
      { title: 'Transaction stuck or pending', answer: 'On Polygon this is rare. Wait 5 minutes. If still pending: in MetaMask, go to Settings, then Advanced, then click Reset Account (this only clears the pending transaction queue, it does not affect your funds). Then resubmit the transaction.' },
      { title: 'Game result seems wrong', answer: 'Contact support at support@joinarena.space with your room code and wallet address. We retain signed game logs for 90 days and will review your dispute within 48 hours. Do not wait, disputes must be submitted within 90 days of the game date.' },
      { title: 'The page is loading slowly', answer: 'Arena Games connects to the Polygon network and a real-time WebSocket server. Slow loading can happen if the Polygon RPC is congested. Try refreshing. If the issue persists, check the Polygon network status at polygonscan.com.' },
    ],
  },
]

function getAllArticles() {
  return CATEGORIES.flatMap(c => c.articles.map(a => ({ ...a, category: c.name, color: c.color })))
}

interface ArticleItemProps {
  title: string; answer: string; isOpen: boolean
  onToggle: () => void; badge?: string; badgeColor?: string
}

function ArticleItem({ title, answer, isOpen, onToggle, badge, badgeColor }: ArticleItemProps) {
  return (
    <div style={{
      background: '#ffffff',
      border: `1px solid ${isOpen ? '#fcd34d' : '#e2e8f0'}`,
      borderRadius: '12px',
      overflow: 'hidden',
      transition: 'border-color .15s',
      boxShadow: isOpen ? '0 2px 16px rgba(245,158,11,0.1)' : '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <button onClick={onToggle} style={{
        width: '100%', background: 'transparent', border: 'none',
        cursor: 'pointer', padding: '16px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '12px', textAlign: 'left',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          {badge && badgeColor && (
            <span style={{
              background: `${badgeColor}16`, color: badgeColor,
              border: `1px solid ${badgeColor}28`,
              fontSize: '0.6rem', fontWeight: 700,
              padding: '2px 8px', borderRadius: '5px', whiteSpace: 'nowrap', flexShrink: 0,
            }}>{badge}</span>
          )}
          <span style={{ color: '#0f172a', fontSize: '0.88rem', fontWeight: 600, lineHeight: 1.45, fontFamily: 'system-ui,sans-serif' }}>{title}</span>
        </div>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, transition: 'transform .22s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M5 7.5l5 5 5-5" stroke={isOpen ? '#f59e0b' : '#94a3b8'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {isOpen && (
        <div style={{ padding: '0 18px 18px', borderTop: '1px solid #fef3c7', background: '#fffdf7' }}>
          <p style={{ margin: '14px 0 0', color: '#475569', fontSize: '0.84rem', lineHeight: 1.85, fontFamily: 'system-ui,sans-serif' }}>{answer}</p>
        </div>
      )}
    </div>
  )
}

export default function HelpCenter() {
  useLightTheme()
  const nav = useNavigate()
  const [search, setSearch] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)

  const allArticles = getAllArticles()
  const isSearching = search.trim().length > 0
  const filtered = isSearching
    ? allArticles.filter(a => a.title.toLowerCase().includes(search.toLowerCase()) || a.answer.toLowerCase().includes(search.toLowerCase()))
    : []

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Hero card */}
      <div style={{ background: '#f8fafc', padding: '40px 20px 0' }}>
        <div style={{ maxWidth: '780px', margin: '0 auto' }}>
          <button onClick={() => nav(-1)} style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            background: 'white', border: '1px solid #e2e8f0',
            borderRadius: '10px', padding: '8px 16px',
            cursor: 'pointer', color: '#64748b',
            fontSize: '0.83rem', fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
            marginBottom: '28px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            transition: 'all .14s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#1e293b' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12.5L5.5 8 10 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>

          {/* Title card */}
          <div style={{
            background: 'white', borderRadius: '20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            overflow: 'hidden', marginBottom: '32px',
          }}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #f59e0b, #f97316)' }} />
            <div style={{ padding: '32px 32px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{
                    display: 'inline-block',
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    borderRadius: '8px', padding: '4px 12px',
                    fontSize: '0.65rem', fontWeight: 800,
                    letterSpacing: '0.1em', color: '#92400e',
                    textTransform: 'uppercase', marginBottom: '14px',
                  }}>Help Center</div>
                  <h1 style={{
                    fontFamily: 'Orbitron, sans-serif', fontWeight: 900,
                    fontSize: 'clamp(1.3rem, 3.5vw, 1.8rem)',
                    color: '#0f172a', margin: '0 0 10px',
                    letterSpacing: '0.01em', lineHeight: 1.2,
                  }}>Find answers fast.</h1>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0, lineHeight: 1.6 }}>
                    Browse by category or search across all articles below.
                  </p>
                </div>
                {/* Search */}
                <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <circle cx="11" cy="11" r="8" stroke="#94a3b8" strokeWidth="2"/>
                    <path d="M21 21l-4.35-4.35" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <input
                    type="text" placeholder="Search articles..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: '#f8fafc', border: '1px solid #e2e8f0',
                      borderRadius: '10px', padding: '11px 16px 11px 42px',
                      fontSize: '0.88rem', color: '#1e293b',
                      fontFamily: 'inherit', outline: 'none',
                      transition: 'border-color .14s',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#fcd34d')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '0 20px 80px' }}>

        {/* Search results */}
        {isSearching && (
          <div>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '14px', fontWeight: 500 }}>
              {filtered.length === 0
                ? 'No results found. Try different keywords.'
                : `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${search}"`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filtered.map(a => {
                const k = `search-${a.title}`
                return (
                  <ArticleItem key={k} title={a.title} answer={a.answer}
                    badge={a.category} badgeColor={a.color}
                    isOpen={openKey === k}
                    onToggle={() => setOpenKey(openKey === k ? null : k)} />
                )
              })}
            </div>
          </div>
        )}

        {/* Category list */}
        {!isSearching && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {CATEGORIES.map(cat => (
              <div key={cat.name}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '8px',
                    background: `${cat.color}12`, border: `1px solid ${cat.color}24`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d={cat.icon} stroke={cat.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <h2 style={{
                    margin: 0, color: '#0f172a',
                    fontFamily: 'system-ui,sans-serif', fontWeight: 800,
                    fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1,
                  }}>{cat.name}</h2>
                  <div style={{ height: '1px', flex: 1, background: '#e2e8f0' }} />
                  <span style={{
                    background: '#f1f5f9', color: '#64748b',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.72rem', borderRadius: '20px', padding: '2px 10px',
                  }}>{cat.articles.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {cat.articles.map(a => {
                    const k = `${cat.name}-${a.title}`
                    return (
                      <ArticleItem key={k} title={a.title} answer={a.answer}
                        isOpen={openKey === k}
                        onToggle={() => setOpenKey(openKey === k ? null : k)} />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer CTA */}
        <div style={{
          marginTop: '48px', padding: '28px 28px',
          background: 'white',
          border: '1px solid #fde68a',
          borderRadius: '16px',
          boxShadow: '0 2px 12px rgba(245,158,11,0.08)',
          textAlign: 'center',
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{
            color: '#92400e', fontSize: '0.75rem', fontWeight: 800,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            fontFamily: 'system-ui,sans-serif', marginBottom: '6px',
          }}>Still need help?</div>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '18px', fontFamily: 'system-ui,sans-serif' }}>
            ARIA can answer most questions instantly.
          </p>
          <button onClick={() => nav('/contact')} style={{
            background: 'linear-gradient(135deg,#f97316,#ef4444)',
            color: 'white', border: 'none', borderRadius: '10px',
            padding: '11px 28px',
            fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem',
            fontWeight: 800, letterSpacing: '0.07em', cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(249,115,22,0.35)',
            transition: 'transform .14s, box-shadow .14s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(249,115,22,0.45)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(249,115,22,0.35)' }}
          >
            Chat with ARIA
          </button>
        </div>
      </div>
    </div>
  )
}
