import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'

// ── Force light background while any info page is mounted ─────────────────────
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

// ── Shared components ─────────────────────────────────────────────────────────

function BackBtn() {
  const nav = useNavigate()
  return (
    <button onClick={() => nav(-1)} style={{
      display: 'inline-flex', alignItems: 'center', gap: '7px',
      background: 'white', border: '1px solid #e2e8f0',
      borderRadius: '10px', padding: '8px 16px',
      cursor: 'pointer', color: '#64748b',
      fontSize: '0.83rem', fontWeight: 600,
      fontFamily: 'system-ui, sans-serif',
      marginBottom: '36px',
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
  )
}

function PageWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#f8fafc', minHeight: '100vh',
      padding: '40px 20px 100px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        {children}
      </div>
    </div>
  )
}

function Hero({ badge, title, sub }: { badge: string; title: string; sub: string }) {
  return (
    <div style={{
      background: 'white', borderRadius: '20px',
      padding: '44px 48px', marginBottom: '48px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Amber accent stripe */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #f59e0b, #f97316, #ef4444)' }} />
      <span style={{
        display: 'inline-block', background: '#fef3c7',
        color: '#b45309', border: '1px solid #fde68a',
        borderRadius: '6px', padding: '4px 12px',
        fontSize: '0.62rem', fontWeight: 800,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        marginBottom: '18px',
      }}>{badge}</span>
      <h1 style={{
        color: '#0f172a', fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
        fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15,
        margin: '0 0 14px', fontFamily: 'system-ui, sans-serif',
      }}>{title}</h1>
      <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.7, margin: 0 }}>{sub}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ width: '4px', height: '24px', background: 'linear-gradient(180deg,#f59e0b,#f97316)', borderRadius: '2px', flexShrink: 0 }} />
        <h2 style={{
          color: '#0f172a', fontSize: '0.78rem', fontWeight: 800,
          letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0,
          fontFamily: 'system-ui, sans-serif',
        }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: 1.9, margin: 0, fontFamily: 'system-ui, sans-serif' }}>
      {children}
    </p>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px',
      padding: '20px 24px', marginBottom: '10px',
      boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
    }}>{children}</div>
  )
}

// ── About ─────────────────────────────────────────────────────────────────────

export function About() {
  useLightTheme()
  return (
    <PageWrap>
      <BackBtn />
      <Hero badge="Company" title="About Arena Games"
        sub="A decentralized, skill-based competitive gaming platform built on Polygon where players compete for real USDT with full on-chain transparency." />

      <Section title="What We Build">
        <Body>Arena Games is a peer-to-peer competitive platform where players wager USDT across seven game formats. Entry fees are locked in an audited smart contract the moment a game begins and released automatically to the winner. There is no custodian, no manual payout, and no intermediary. The smart contract enforces every rule.</Body>
      </Section>

      <Section title="Our Games">
        {[
          { name: 'Coin Flip',       desc: 'Best-of-5 rounds. Pick Heads or Tails before each flip. Verifiably random result each round. Fastest game on the platform.' },
          { name: "Liar's Dice",     desc: "Classic bluffing game. Roll hidden dice, bid on totals across all cups, call Liar to challenge. Last player with dice wins." },
          { name: 'Pattern Memory',  desc: 'A tile grid flashes a sequence. Recreate it faster and more accurately than your opponents to win each round.' },
          { name: 'Math Arena',      desc: 'Mental arithmetic race. Same problem shown to all players simultaneously. First correct answer wins the point. Most points wins the pot.' },
          { name: 'Reaction Grid',   desc: 'One cell lights up at a time on a grid. Click it before anyone else. Pure speed and reflexes.' },
          { name: 'Highest Unique',  desc: 'Secretly pick the highest number that nobody else also picks. Strategy meets psychology.' },
          { name: 'Lowest Unique',   desc: 'Pick the lowest unique number. Contrarian thinking wins. Rewards players who predict what others will avoid.' },
        ].map(g => (
          <Card key={g.name}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', marginTop: '8px', flexShrink: 0 }} />
              <div>
                <div style={{ color: '#b45309', fontSize: '0.78rem', fontWeight: 700, marginBottom: '5px', fontFamily: 'system-ui,sans-serif' }}>{g.name}</div>
                <div style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.65, fontFamily: 'system-ui,sans-serif' }}>{g.desc}</div>
              </div>
            </div>
          </Card>
        ))}
      </Section>

      <Section title="How the Escrow Works">
        <Body>When you join a game, you approve a USDT transfer to our audited escrow contract on Polygon. The contract holds funds until the server submits the cryptographically signed result. Funds are then sent to the winner in the same transaction. Arena charges a small platform fee on winnings, always displayed before you confirm.</Body>
      </Section>

      <Section title="Our Mission">
        <Body>We believe competitive games should be transparent, instant, and accessible. No sign-up forms, no bank accounts, no withdrawal queues. Connect a wallet and play. The contract enforces every rule and you keep your winnings.</Body>
      </Section>

      <Section title="Contact">
        <Body>Questions, disputes, or business inquiries: <strong>support@joinarena.space</strong> or through the <Link to="/contact" style={{ color: '#f59e0b', fontWeight: 600 }}>Contact page</Link>.</Body>
      </Section>
    </PageWrap>
  )
}

// ── Fairness ──────────────────────────────────────────────────────────────────

export function Fairness() {
  useLightTheme()
  return (
    <PageWrap>
      <BackBtn />
      <Hero badge="Trust" title="Fairness and Transparency"
        sub="Every game is designed so that neither Arena Games nor any third party can influence the outcome. Here is exactly how we ensure this." />

      <Section title="The Escrow Model">
        <Body>All entry fees are transferred to a publicly verifiable smart contract on Polygon when a game begins. The contract address is visible on every game room page. Funds cannot be moved until the server submits a cryptographically signed result. Arena Games staff cannot release or redirect funds manually under any circumstances.</Body>
      </Section>

      <Section title="Per-Game Fairness">
        {[
          { name: 'Coin Flip', detail: 'Results use a verifiable random seed committed before players pick and revealed after. Both players can verify the seed post-game by checking the signed server log.' },
          { name: "Liar's Dice", detail: 'Each round uses a committed per-round seed for dice rolls. The seed is revealed at the end of each challenge. No one can alter dice values after the commitment.' },
          { name: 'Pattern Memory', detail: 'The tile sequence comes from one server-side seed broadcast identically to all players at the same millisecond. No player has any timing advantage.' },
          { name: 'Math Arena', detail: 'Questions are generated from a fixed seed determined before the round starts. All players see the same problem at the same time. Server timestamps decide who answered first.' },
          { name: 'Reaction Grid', detail: 'Target positions come from a shared seed computed before the round. Server-side latency compensation is applied equally to all players.' },
          { name: 'Highest and Lowest Unique', detail: "Picks are hashed and stored until all players submit or the timer closes. Numbers reveal simultaneously. No player can see another's choice before submitting." },
        ].map(g => (
          <Card key={g.name}>
            <div style={{ color: '#b45309', fontSize: '0.78rem', fontWeight: 700, marginBottom: '8px', fontFamily: 'system-ui,sans-serif' }}>{g.name}</div>
            <div style={{ color: '#475569', fontSize: '0.87rem', lineHeight: 1.75, fontFamily: 'system-ui,sans-serif' }}>{g.detail}</div>
          </Card>
        ))}
      </Section>

      <Section title="Smart Contract Verification">
        <Body>Our escrow contract is deployed on Polygon Mainnet and fully readable on Polygonscan. The ABI and source code are available for independent review. Any developer can verify that funds flow only from players to contract and then to winner, with no owner withdrawal function in the contract.</Body>
      </Section>

      <Section title="Dispute Resolution">
        <Body>If you believe a result was incorrect, email support@joinarena.space within 90 days with your room code. We retrieve the signed game log, verify all player actions and timestamps, and respond within 48 hours. If a verified server error caused an incorrect result, a full refund is processed.</Body>
      </Section>
    </PageWrap>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

const FAQS = [
  { s: 'Getting Started',
    items: [
      { q: 'What do I need to play?', a: "A web3 wallet (MetaMask or WalletConnect-compatible), USDT on Polygon for entry fees, and a small amount of MATIC for gas (under $0.01 per game). No sign-up, no email, no KYC required." },
      { q: 'Which network does Arena Games use?', a: 'Polygon Mainnet, Chain ID 137. If your wallet is on a different network, the app will prompt you to switch automatically.' },
      { q: 'How do I connect my wallet?', a: 'Click Connect Wallet in the top right. Select your wallet provider. Approve the connection. If on the wrong network, click Switch Network when the app prompts you.' },
      { q: 'Can I play on mobile?', a: 'Yes. Arena Games works on mobile browsers. Best experience in MetaMask Mobile or any WalletConnect-compatible browser on iOS or Android.' },
      { q: 'How do I get USDT on Polygon?', a: 'Bridge from Ethereum using the official Polygon Bridge at wallet.polygon.technology, or withdraw directly to your Polygon wallet from exchanges like Binance, OKX, or Bybit that support Polygon withdrawals.' },
    ],
  },
  { s: 'Deposits and Withdrawals',
    items: [
      { q: 'How do I deposit?', a: 'There is no deposit page. Your wallet balance is your balance. When you join a game, you approve a USDT transfer to the escrow contract. Funds only move when you confirm in your wallet.' },
      { q: 'How do I withdraw my winnings?', a: 'Winnings go directly to your wallet the moment the game ends. The smart contract sends them automatically. No request, no button, no wait.' },
      { q: 'Why did my transaction fail?', a: 'Most common reasons: not enough MATIC for gas (keep at least 0.1 MATIC), USDT approval was rejected, or network congestion. Try again after 30 seconds.' },
      { q: 'How long do transactions take?', a: 'Polygon transactions confirm in 2 to 5 seconds normally. During rare congestion it can take up to 30 seconds. If stuck over 5 minutes, speed up or cancel from your wallet settings.' },
    ],
  },
  { s: 'Games',
    items: [
      { q: 'What games are available?', a: "Coin Flip, Liar's Dice, Pattern Memory, Math Arena, Reaction Grid, Highest Unique, and Lowest Unique. Each supports different player counts and entry fee levels." },
      { q: 'How does Coin Flip work?', a: 'Two players pick Heads or Tails. A verifiably random result decides each round. Best of 5 rounds. First to 3 wins takes the pot minus the platform fee.' },
      { q: "How does Liar's Dice work?", a: "Each player has 5 hidden dice. Players take turns bidding on total face counts across all cups. Any player can call Liar. Correct bid: challenger loses a die. Wrong bid: bidder loses a die. Last player with dice wins." },
      { q: 'How does Highest Unique work?', a: 'All players secretly pick a number 1 to 20. All picks reveal simultaneously. Highest number that nobody else also picked wins. No unique numbers: round repeats.' },
      { q: 'What is the platform fee?', a: 'A percentage of the winning pot, always shown before you confirm entry. No hidden fees, ever.' },
    ],
  },
  { s: 'Bonuses and Referrals',
    items: [
      { q: 'What is the bonus system?', a: 'Reach match milestones at a given entry fee level to unlock bonus credits. Example: 15 matches at $1 entry unlocks $1.20. Credits are usable as entry fees but cannot be withdrawn.' },
      { q: 'When do bonuses expire?', a: '48 hours after being unlocked. The expiry time is shown in the Quest panel on the home page. Unused bonuses are forfeited.' },
      { q: 'Can I stack bonuses?', a: 'No. One active tier per entry fee level at a time. The next tier activates once the current one is used or expires.' },
      { q: 'How does the referral program work?', a: 'Copy your referral link from your Profile page. When friends join through your link and play matches, you earn bonus match credits. No cap on referrals.' },
    ],
  },
  { s: 'Safety and Security',
    items: [
      { q: 'Are my funds safe?', a: 'Funds are in an audited smart contract on Polygon, not held by Arena Games. We cannot move your funds. The contract is publicly readable on Polygonscan.' },
      { q: 'What happens if I disconnect mid-game?', a: 'Disconnect within the first 10 seconds: both players get a full refund. After 10 seconds: disconnect is treated as a forfeit.' },
      { q: 'What if the game result seems wrong?', a: 'Email support@joinarena.space with your room code within 90 days. We keep signed logs for all games and respond within 48 hours.' },
      { q: 'Is Arena Games legal in my country?', a: 'Arena Games is not available in the US, UK, France, Netherlands, or other jurisdictions where skill wagering is prohibited. Verify your local laws before playing.' },
    ],
  },
]

export function FaqPage() {
  useLightTheme()
  const [open, setOpen] = useState<string | null>(null)

  return (
    <PageWrap>
      <BackBtn />
      <Hero badge="FAQ" title="Frequently Asked Questions"
        sub="Everything you need to know about Arena Games, your funds, bonuses, and how games work." />

      {FAQS.map(sec => (
        <Section key={sec.s} title={sec.s}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sec.items.map(item => {
              const key = `${sec.s}-${item.q}`
              const isOpen = open === key
              return (
                <div key={key} style={{
                  background: 'white', borderRadius: '14px', overflow: 'hidden',
                  border: `1px solid ${isOpen ? '#fcd34d' : '#e2e8f0'}`,
                  boxShadow: isOpen ? '0 4px 20px rgba(245,158,11,0.12)' : '0 1px 4px rgba(0,0,0,0.05)',
                  transition: 'all .18s',
                }}>
                  <button onClick={() => setOpen(isOpen ? null : key)} style={{
                    width: '100%', background: 'transparent', border: 'none',
                    cursor: 'pointer', padding: '18px 22px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px',
                    textAlign: 'left',
                  }}>
                    <span style={{ color: '#0f172a', fontSize: '0.92rem', fontWeight: 600, lineHeight: 1.45, fontFamily: 'system-ui,sans-serif' }}>{item.q}</span>
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none"
                      style={{ flexShrink: 0, transition: 'transform .22s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      <path d="M5.5 8.25l5.5 5.5 5.5-5.5" stroke={isOpen ? '#f59e0b' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 22px 20px', borderTop: '1px solid #fef9ec', background: '#fffdf7' }}>
                      <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.85, margin: '16px 0 0', fontFamily: 'system-ui,sans-serif' }}>{item.a}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Section>
      ))}
    </PageWrap>
  )
}

// ── Privacy ───────────────────────────────────────────────────────────────────

export function Privacy() {
  useLightTheme()
  return (
    <PageWrap>
      <BackBtn />
      <Hero badge="Legal" title="Privacy Policy" sub="Last updated March 2026. This policy explains what data we collect, how we use it, and your rights as a user." />
      <Section title="What We Collect"><Body>We collect wallet addresses (required to play), game activity records (match results, entry fees, timestamps), referral relationships, and support correspondence if you contact us. We do not collect your name, email, phone number, or physical address unless you voluntarily provide them in a support request.</Body></Section>
      <Section title="How We Use Your Data"><Body>Data is used to operate matchmaking and payout systems, prevent fraud and detect cheating, calculate and distribute referral bonus credits, and respond to disputes and support requests. We do not sell your data to any third party and do not use it for advertising.</Body></Section>
      <Section title="On-Chain Data"><Body>All transactions on Polygon are publicly visible on Polygonscan. This includes wallet-to-contract transfers and contract-to-wallet payouts. This data is outside our control by the nature of the blockchain. We cannot delete or obscure on-chain records.</Body></Section>
      <Section title="Cookies and Local Storage"><Body>We use localStorage to cache your wallet authentication signature so you do not need to sign on every game. We use sessionStorage to track referral links. We do not use tracking cookies, advertising cookies, or third-party analytics.</Body></Section>
      <Section title="Data Retention"><Body>Signed game logs are retained for 90 days for dispute resolution. Off-chain profile data is kept while your wallet is active on the platform. You may request deletion of off-chain data at any time. On-chain records cannot be deleted.</Body></Section>
      <Section title="Your Rights"><Body>Request a copy or deletion of your off-chain data by emailing support@joinarena.space with your wallet address. We process requests within 30 days.</Body></Section>
      <Section title="Contact"><Body>Privacy questions: <strong>support@joinarena.space</strong>. Include your wallet address and a description of your request.</Body></Section>
    </PageWrap>
  )
}

// ── Terms ─────────────────────────────────────────────────────────────────────

export function Terms() {
  useLightTheme()
  return (
    <PageWrap>
      <BackBtn />
      <Hero badge="Legal" title="Terms of Service" sub="Last updated March 2026. By connecting your wallet and using Arena Games, you agree to these terms in full." />
      <Section title="Eligibility"><Body>You must be at least 18 years of age. You must not be in a restricted jurisdiction. By connecting your wallet, you confirm both. It is your sole responsibility to verify that using Arena Games is lawful where you are located.</Body></Section>
      <Section title="Restricted Jurisdictions"><Body>Arena Games is not available to residents of the United States, United Kingdom, France, Netherlands, Germany, Spain, Singapore, Iran, North Korea, or any other jurisdiction where online skill wagering is prohibited by law.</Body></Section>
      <Section title="How the Platform Works"><Body>Arena Games is a peer-to-peer competitive gaming platform. Entry fees go to an escrow smart contract and are paid to the winner automatically. Arena provides the game server, matchmaking, and contract infrastructure. The platform does not take the other side of any wager.</Body></Section>
      <Section title="Platform Fee"><Body>A fee is deducted from the winning pot. The exact percentage is displayed on the game card before you confirm entry. By confirming, you agree to the stated fee. Fees are not refundable in the event of a loss.</Body></Section>
      <Section title="Bonus Credits"><Body>Bonus credits are non-withdrawable and expire 48 hours after being unlocked. Only one active tier per entry fee level is allowed at a time. Bonuses reset on the first of each calendar month and have no cash value.</Body></Section>
      <Section title="Disconnections and Refunds"><Body>Disconnect within the first 10 seconds of a game: both players receive a full refund. After 10 seconds: a disconnect is treated as a forfeit. Refunds for verified Arena server errors will be processed within 48 hours.</Body></Section>
      <Section title="Prohibited Conduct"><Body>You may not use bots, scripts, or automation to play games. You may not collude with other players to manipulate results. Wallets found cheating will be permanently blocked from the escrow contract.</Body></Section>
      <Section title="Liability"><Body>Arena Games is not liable for losses from wallet issues, network failures, or smart contract bugs outside our reasonable control. Competitive games involve the risk of losing your entry fee, accepted voluntarily when you play.</Body></Section>
      <Section title="Disputes"><Body>Submit disputes to support@joinarena.space within 90 days of the game with your room code and wallet address. We respond within 48 hours. Game logs are retained for 90 days only.</Body></Section>
    </PageWrap>
  )
}

// ── AML ───────────────────────────────────────────────────────────────────────

export function AmlPolicy() {
  useLightTheme()
  return (
    <PageWrap>
      <BackBtn />
      <Hero badge="Compliance" title="AML Policy" sub="Last updated March 2026. Arena Games is committed to preventing money laundering and illegal financial activity on the platform." />
      <Section title="Purpose"><Body>This policy outlines how Arena Games prevents its platform from being used for money laundering, terrorist financing, or other illegal financial activity. We cooperate fully with relevant regulatory authorities.</Body></Section>
      <Section title="Restricted Jurisdictions">
        <Body>Arena Games does not serve users in the following jurisdictions:</Body>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px', marginBottom: '14px' }}>
          {['United States','United Kingdom','France','Netherlands','Germany','Spain','Singapore','Iran','North Korea','Syria','Cuba','Sudan','Myanmar'].map(j => (
            <span key={j} style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '5px 12px', fontSize: '0.82rem', color: '#9f1239', fontWeight: 600, fontFamily: 'system-ui,sans-serif' }}>{j}</span>
          ))}
        </div>
        <Body>Accessing the platform from any of these jurisdictions violates these terms and may violate local law.</Body>
      </Section>
      <Section title="No Fiat Deposits"><Body>Arena Games does not accept fiat currency. All transactions are on the Polygon blockchain using USDT. Every transaction is publicly auditable on Polygonscan.</Body></Section>
      <Section title="Wallet Screening"><Body>Wallet addresses may be screened against OFAC SDN, EU Consolidated Sanctions, and other recognized databases. Flagged wallets will be blocked from games and funds may be held pending compliance review.</Body></Section>
      <Section title="Suspicious Activity"><Body>We monitor for patterns consistent with money laundering including rapid fund cycling, unusual win/loss patterns, and wallets linked to known illicit activity. Suspicious activity will be reported to relevant authorities.</Body></Section>
      <Section title="Contact"><Body>Compliance inquiries: <strong>support@joinarena.space</strong>. Include your wallet address and a description of your inquiry.</Body></Section>
    </PageWrap>
  )
}
