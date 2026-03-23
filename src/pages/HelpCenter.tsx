import { useState } from 'react'

interface Article {
  title: string
  answer: string
}

interface Category {
  name: string
  articles: Article[]
}

const CATEGORIES: Category[] = [
  {
    name: 'Getting Started',
    articles: [
      {
        title: 'How to connect your wallet',
        answer:
          'Click Connect Wallet in the top right. Choose your wallet provider (MetaMask, WalletConnect). Approve the connection. Make sure you are on the Polygon network. If prompted to switch networks, click Switch Network.',
      },
      {
        title: 'How to play your first game',
        answer:
          'Go to the home page. Select a game from the tabs at the top. Set your entry fee. Click Play Now to join the matchmaking queue, or Create Room to create a private room and invite a friend.',
      },
      {
        title: 'What do I need to get started',
        answer:
          'A web3 wallet (MetaMask or WalletConnect-compatible), USDT on Polygon for entry fees, and a small amount of MATIC for gas fees (usually less than $0.01 per transaction).',
      },
    ],
  },
  {
    name: 'Deposits and Withdrawals',
    articles: [
      {
        title: 'How deposits work',
        answer:
          'There is no deposit flow. Your connected wallet is your balance. When you join a game, you approve a USDT transfer to the escrow smart contract. Funds move only when you confirm.',
      },
      {
        title: 'How withdrawals work',
        answer:
          'Winnings are sent automatically to your wallet by the smart contract when the game ends. You do not need to request a withdrawal. The transaction is on-chain and takes a few seconds.',
      },
      {
        title: 'Why did my transaction fail',
        answer:
          'Common reasons: insufficient MATIC for gas, USDT approval not granted, or network congestion. Try again after a short wait. Make sure you have at least 0.1 MATIC in your wallet.',
      },
      {
        title: 'How long do transactions take',
        answer:
          'Polygon transactions confirm in 2 to 5 seconds under normal conditions. Occasionally during high network load it may take up to 30 seconds.',
      },
    ],
  },
  {
    name: 'Games',
    articles: [
      {
        title: 'How Coin Flip works',
        answer:
          'Two players each pick Heads or Tails. A verifiable random result is generated. The player who guessed correctly wins the pot minus the platform fee. Games are best of 5 rounds.',
      },
      {
        title: "How Liar's Dice works",
        answer:
          "Each player starts with 5 dice. Dice are rolled and kept hidden. Players take turns bidding on the total count of a face value across all dice. Call liar to challenge the last bid. If the bid is correct, the challenger loses a die. If incorrect, the bidder loses a die. Last player with dice wins.",
      },
      {
        title: 'How Highest Unique works',
        answer:
          'All players secretly pick a number from 1 to 20. After all players submit, numbers are revealed. The player with the highest number that no other player also picked wins. If all unique numbers tie, the pot rolls to the next round.',
      },
      {
        title: 'How Lowest Unique works',
        answer:
          'Same as Highest Unique, but the winner is the player with the lowest number that no other player also picked.',
      },
      {
        title: 'How Pattern Memory works',
        answer:
          'A grid of colored tiles flashes a sequence. After the sequence, players must click the tiles in the correct order. Fastest and most accurate player wins each round.',
      },
      {
        title: 'How Math Arena works',
        answer:
          'Players are shown math problems simultaneously. First player to submit the correct answer wins the point. Most points after the set number of rounds wins.',
      },
    ],
  },
  {
    name: 'Account',
    articles: [
      {
        title: 'How to view my game history',
        answer:
          'Go to your Profile page. The History section shows all past games with entry fee, result, and payout.',
      },
      {
        title: 'How to change my username',
        answer:
          'Go to Profile and click on your username to edit it. Usernames must be between 3 and 20 characters.',
      },
      {
        title: 'How the referral program works',
        answer:
          'Go to your Profile page and copy your referral link. Share it with friends. When they join using your link and play matches, you earn bonus match credits. Credits appear in your Quest panel.',
      },
    ],
  },
  {
    name: 'Bonuses',
    articles: [
      {
        title: 'What are bonus credits',
        answer:
          'Bonus credits are earned by completing quest tiers (playing a set number of matches at a given entry fee level). They can be used as entry fees for future games but cannot be withdrawn as USDT.',
      },
      {
        title: 'When do bonuses expire',
        answer:
          'Bonus credits expire 48 hours after they are unlocked. Use them before they expire. You will see the expiry time in your Quest panel.',
      },
      {
        title: 'Can I stack multiple bonuses',
        answer:
          'No. Only one bonus tier can be active per entry fee level at a time. Complete or let the current tier expire before the next one activates.',
      },
    ],
  },
  {
    name: 'Technical',
    articles: [
      {
        title: 'Which network should I use',
        answer:
          'Polygon Mainnet. Chain ID 137. If your wallet is on a different network, you will be prompted to switch automatically.',
      },
      {
        title: 'MetaMask not connecting',
        answer:
          'Try refreshing the page. Make sure MetaMask is unlocked. If using a browser extension, disable other extensions that may conflict.',
      },
      {
        title: 'Transaction stuck or pending',
        answer:
          'On Polygon this is rare but can happen during network spikes. Wait 5 minutes. If still pending, you can speed up or cancel the transaction in MetaMask settings.',
      },
      {
        title: 'Game result seems wrong',
        answer:
          'Contact support with your room code. We keep signed game logs for 90 days and can investigate any dispute.',
      },
    ],
  },
]

function getAllArticles(): (Article & { category: string })[] {
  return CATEGORIES.flatMap(c => c.articles.map(a => ({ ...a, category: c.name })))
}

export default function HelpCenter() {
  const [search, setSearch] = useState('')
  const [openArticle, setOpenArticle] = useState<string | null>(null)

  const allArticles = getAllArticles()
  const isSearching = search.trim().length > 0
  const filtered = isSearching
    ? allArticles.filter(
        a =>
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.answer.toLowerCase().includes(search.toLowerCase()),
      )
    : []

  const toggleArticle = (key: string) => {
    setOpenArticle(prev => (prev === key ? null : key))
  }

  return (
    <div style={{ background: '#06060e', minHeight: '100vh', padding: '40px 20px 80px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1
            style={{
              fontFamily: 'Orbitron, sans-serif',
              color: '#e2e8f0',
              fontSize: '1.6rem',
              letterSpacing: '0.04em',
              fontWeight: 700,
              marginBottom: '12px',
            }}
          >
            Help Center
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '28px' }}>
            Find answers to common questions about Arena Games.
          </p>

          {/* Search */}
          <div style={{ position: 'relative', maxWidth: '520px', margin: '0 auto' }}>
            <input
              type="text"
              placeholder="Search for help..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                background: '#0d0d1a',
                border: '1px solid #1e1e30',
                borderRadius: '12px',
                padding: '14px 20px 14px 48px',
                color: '#e2e8f0',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#475569',
                fontSize: '1rem',
                pointerEvents: 'none',
              }}
            >
              &#9906;
            </span>
          </div>
        </div>

        {/* Search results */}
        {isSearching && (
          <div style={{ marginBottom: '40px' }}>
            {filtered.length === 0 ? (
              <p style={{ color: '#475569', fontSize: '0.85rem', textAlign: 'center' }}>
                No articles matched your search. Try different keywords.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '4px' }}>
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                </p>
                {filtered.map(a => {
                  const key = `search-${a.title}`
                  const isOpen = openArticle === key
                  return (
                    <ArticleItem
                      key={key}
                      articleKey={key}
                      title={a.title}
                      answer={a.answer}
                      badge={a.category}
                      isOpen={isOpen}
                      onToggle={() => toggleArticle(key)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Categories */}
        {!isSearching && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {CATEGORIES.map(cat => (
              <div key={cat.name}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '14px',
                  }}
                >
                  <h2
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      color: '#e2e8f0',
                      fontSize: '0.82rem',
                      letterSpacing: '0.08em',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      margin: 0,
                    }}
                  >
                    {cat.name}
                  </h2>
                  <div
                    style={{
                      flex: 1,
                      height: '1px',
                      background: '#1a1a2e',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: '#475569',
                      background: '#0d0d1a',
                      border: '1px solid #1a1a2e',
                      borderRadius: '20px',
                      padding: '2px 10px',
                    }}
                  >
                    {cat.articles.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {cat.articles.map(a => {
                    const key = `${cat.name}-${a.title}`
                    const isOpen = openArticle === key
                    return (
                      <ArticleItem
                        key={key}
                        articleKey={key}
                        title={a.title}
                        answer={a.answer}
                        isOpen={isOpen}
                        onToggle={() => toggleArticle(key)}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface ArticleItemProps {
  articleKey: string
  title: string
  answer: string
  badge?: string
  isOpen: boolean
  onToggle: () => void
}

function ArticleItem({ title, answer, badge, isOpen, onToggle }: ArticleItemProps) {
  return (
    <div
      style={{
        background: '#0d0d1a',
        border: `1px solid ${isOpen ? 'rgba(245,158,11,0.25)' : '#1a1a2e'}`,
        borderRadius: '10px',
        overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          {badge && (
            <span
              style={{
                fontSize: '0.62rem',
                color: '#f59e0b',
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: '4px',
                padding: '2px 7px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                letterSpacing: '0.03em',
              }}
            >
              {badge}
            </span>
          )}
          <span
            style={{
              fontSize: '0.85rem',
              color: '#e2e8f0',
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            {title}
          </span>
        </div>
        <span
          style={{
            color: '#475569',
            fontSize: '0.7rem',
            flexShrink: 0,
            transition: 'transform 0.2s',
            display: 'inline-block',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          &#9660;
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            padding: '0 18px 16px',
            borderTop: '1px solid #1a1a2e',
          }}
        >
          <p
            style={{
              fontSize: '0.85rem',
              color: '#94a3b8',
              lineHeight: 1.8,
              margin: '14px 0 0',
            }}
          >
            {answer}
          </p>
        </div>
      )}
    </div>
  )
}
