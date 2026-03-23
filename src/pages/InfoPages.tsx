import { useNavigate } from 'react-router-dom'

// ── Shared layout ─────────────────────────────────────────────────────────────

function BackBtn() {
  const nav = useNavigate()
  return (
    <button
      onClick={() => nav(-1)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#6b7280', fontSize: '0.82rem', fontWeight: 600,
        padding: '0 0 0 2px', marginBottom: '28px',
        transition: 'color .14s',
      }}
      onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
      onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Back
    </button>
  )
}

function PageHero({ label, title, sub }: { label: string; title: string; sub: string }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fff7ed 100%)',
      borderRadius: '16px', padding: '32px 36px', marginBottom: '36px',
      border: '1px solid #fde68a',
    }}>
      <div style={{
        display: 'inline-block', fontFamily: 'Orbitron, sans-serif',
        fontSize: '0.55rem', fontWeight: 800, color: '#d97706',
        letterSpacing: '0.12em', background: '#fef3c7',
        border: '1px solid #fcd34d', borderRadius: '4px',
        padding: '3px 9px', marginBottom: '12px', textTransform: 'uppercase',
      }}>{label}</div>
      <h1 style={{
        fontFamily: 'Orbitron, sans-serif', fontWeight: 900,
        fontSize: 'clamp(1.2rem, 3vw, 1.7rem)', color: '#111827',
        letterSpacing: '0.02em', margin: '0 0 10px',
      }}>{title}</h1>
      <p style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{sub}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div style={{ width: '3px', height: '20px', background: '#f59e0b', borderRadius: '2px', flexShrink: 0 }} />
        <h2 style={{
          fontFamily: 'Orbitron, sans-serif', fontWeight: 800,
          fontSize: '0.82rem', color: '#1f2937', letterSpacing: '0.06em',
          textTransform: 'uppercase', margin: 0,
        }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: '#374151', fontSize: '0.88rem', lineHeight: 1.85, margin: 0 }}>{children}</p>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e5e7eb',
      borderRadius: '12px', padding: '18px 22px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>{children}</div>
  )
}

function wrap(content: React.ReactNode) {
  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh', padding: '36px 20px 80px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        {content}
      </div>
    </div>
  )
}

// ── About ─────────────────────────────────────────────────────────────────────

export function About() {
  return wrap(<>
    <BackBtn />
    <PageHero label="Company" title="About Arena Games" sub="A decentralized, skill-based gaming platform built on Polygon where players compete for real USDT." />

    <Section title="What We Build">
      <Body>
        Arena Games is a competitive gaming platform where players wager USDT against each other across seven distinct game formats. Entry fees are held in a publicly auditable smart contract on Polygon and released automatically to the winner when the game concludes. There is no custodian, no intermediary, and no manual payout step.
      </Body>
    </Section>

    <Section title="Our Games">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[
          { name: 'Coin Flip',       desc: 'Best-of-5 rounds. Pick Heads or Tails. Verifiably random result each round.' },
          { name: "Liar's Dice",     desc: 'Classic bluffing game. Roll hidden dice, bid on totals, call liar to challenge.' },
          { name: 'Pattern Memory',  desc: 'A tile sequence flashes on screen. Recreate it faster and more accurately than your opponents.' },
          { name: 'Math Arena',      desc: 'Mental arithmetic race. First correct answer wins the point. Most points wins the pot.' },
          { name: 'Reaction Grid',   desc: 'Tap the highlighted cell before anyone else. Pure speed and reflexes.' },
          { name: 'Highest Unique',  desc: 'Pick the highest number that nobody else picks. Strategic number selection.' },
          { name: 'Lowest Unique',   desc: 'Pick the lowest number that nobody else picks. Contrarian thinking wins here.' },
        ].map(g => (
          <Card key={g.name}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 800, fontSize: '0.72rem', color: '#d97706', marginBottom: '5px', letterSpacing: '0.04em' }}>{g.name}</div>
            <div style={{ color: '#374151', fontSize: '0.85rem', lineHeight: 1.6 }}>{g.desc}</div>
          </Card>
        ))}
      </div>
    </Section>

    <Section title="How the Escrow Works">
      <Body>
        When you create or join a game room, USDT is transferred from your wallet to our audited escrow smart contract on Polygon. The contract holds the funds for the duration of the game. When the server submits the signed game result, the contract releases funds to the winner instantly. Arena Games charges a small platform fee on winnings, displayed before you confirm any game.
      </Body>
    </Section>

    <Section title="Our Mission">
      <Body>
        We believe competitive games should be transparent, fast, and accessible. No sign-up forms, no bank accounts, no withdrawal queues. Connect your wallet and play. The smart contract enforces the rules. You keep your winnings.
      </Body>
    </Section>

    <Section title="Platform Fee">
      <Body>
        Arena Games takes a small percentage of the winning pot to sustain platform development, infrastructure, and support. The exact fee is always shown to you before you confirm entry into a game. There are no hidden charges.
      </Body>
    </Section>

    <Section title="Contact">
      <Body>
        For questions, disputes, or business inquiries, reach us at support@joinarena.space or through the Contact page.
      </Body>
    </Section>
  </>)
}

// ── Fairness ──────────────────────────────────────────────────────────────────

export function Fairness() {
  return wrap(<>
    <BackBtn />
    <PageHero label="Trust" title="Fairness and Transparency" sub="Every game on Arena is designed so that neither Arena Games nor any third party can influence the outcome." />

    <Section title="The Escrow Model">
      <Body>
        All entry fees are locked in a publicly verifiable smart contract on Polygon the moment a game begins. The contract address is visible on every game room page. Funds cannot be moved or returned until the game server submits a cryptographically signed result. No one, including Arena staff, can release funds arbitrarily.
      </Body>
    </Section>

    <Section title="How Each Game Ensures Fairness">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[
          { name: 'Coin Flip', detail: 'The flip result is generated using a verifiable random seed committed before the round starts and revealed after both players have submitted their choice. The seed is logged and players can verify it post-game.' },
          { name: "Liar's Dice", detail: 'Dice rolls use a per-round committed random seed shared between the server and both players. The seed is revealed at the end of each challenge. No player or the server can alter rolls after commitment.' },
          { name: 'Pattern Memory', detail: 'The tile sequence is generated from a single server-side seed and broadcast identically to all players at the same time. No player has any advantage over another.' },
          { name: 'Math Arena', detail: 'Questions are generated server-side from a fixed seed determined before the round begins. Both players receive the same questions at the same moment. Server timestamps determine who answered first.' },
          { name: 'Reaction Grid', detail: 'Target cell positions are generated from a shared seed computed before the round. All players see the same grid highlight at the same moment. Latency adjustments are applied equally.' },
          { name: 'Highest Unique and Lowest Unique', detail: "Players submit their chosen number privately. Submissions are hashed and stored until all players have submitted or the time window closes. Numbers are then revealed simultaneously. No player can see another's choice before submitting." },
        ].map(g => (
          <Card key={g.name}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 800, fontSize: '0.72rem', color: '#d97706', marginBottom: '6px', letterSpacing: '0.04em' }}>{g.name}</div>
            <div style={{ color: '#374151', fontSize: '0.84rem', lineHeight: 1.75 }}>{g.detail}</div>
          </Card>
        ))}
      </div>
    </Section>

    <Section title="Smart Contract Verification">
      <Body>
        Our escrow contract is deployed on Polygon Mainnet and is publicly readable on Polygonscan. The contract source code and ABI are available for independent review. Any developer can verify that funds flow only from players to contract and then to winner, with no owner withdrawal function.
      </Body>
    </Section>

    <Section title="Server-Side Integrity">
      <Body>
        All game sessions are logged with signed payloads. The server signs every game-critical event with a private key. These signatures are stored for 90 days and can be produced as evidence in any dispute. We cannot alter a signed log after the fact.
      </Body>
    </Section>

    <Section title="Dispute Resolution">
      <Body>
        If you believe a game result is incorrect, contact support within 90 days with your room code and wallet address. We will retrieve the signed game log, verify all player actions, and respond within 48 hours. If a server error caused an incorrect result, a full refund is issued.
      </Body>
    </Section>
  </>)
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

import { useState } from 'react'

const FAQ_ITEMS = [
  { section: 'Getting Started', q: 'What do I need to play?', a: 'A web3 wallet such as MetaMask or any WalletConnect-compatible wallet, USDT on the Polygon network for entry fees, and a small amount of MATIC (usually less than $0.01 per game) for gas fees. No sign-up, no email, no KYC required.' },
  { section: 'Getting Started', q: 'Which network does Arena Games use?', a: 'Polygon Mainnet, Chain ID 137. If your wallet is connected to a different network when you try to play, the app will prompt you to switch automatically.' },
  { section: 'Getting Started', q: 'How do I connect my wallet?', a: 'Click the Connect Wallet button in the top right corner of any page. Select your wallet provider. Approve the connection request. If you are on the wrong network, click Switch Network when prompted.' },
  { section: 'Getting Started', q: 'Can I play on mobile?', a: 'Yes. Arena Games works on mobile browsers. For the best experience we recommend using MetaMask Mobile or any browser with built-in WalletConnect support on iOS or Android.' },
  { section: 'Deposits and Withdrawals', q: 'How do I deposit?', a: 'There is no separate deposit step. Your connected wallet is your balance. When you join a game, you will be asked to approve a USDT transfer to the escrow contract. Funds only leave your wallet when you confirm that transaction.' },
  { section: 'Deposits and Withdrawals', q: 'How do I withdraw my winnings?', a: 'Winnings are sent directly to your wallet by the smart contract the moment the game ends. You do not need to request a withdrawal or click anything. The transaction is on-chain and usually confirms within 5 seconds.' },
  { section: 'Deposits and Withdrawals', q: 'Why did my transaction fail?', a: 'The most common reasons are: not enough MATIC for gas (keep at least 0.1 MATIC in your wallet), the USDT approval was rejected or set to zero, or network congestion on Polygon caused a timeout. Try again after a short wait.' },
  { section: 'Deposits and Withdrawals', q: 'How long do transactions take?', a: 'Polygon transactions typically confirm in 2 to 5 seconds. During rare network congestion events it can take up to 30 seconds. If a transaction is stuck for more than 5 minutes, you can speed it up or cancel it in your wallet settings.' },
  { section: 'Games', q: 'What games are available?', a: 'Coin Flip, Liar\'s Dice, Pattern Memory, Math Arena, Reaction Grid, Highest Unique, and Lowest Unique. Each game supports different player counts and entry fee levels.' },
  { section: 'Games', q: 'How does Coin Flip work?', a: 'Two players each pick Heads or Tails before the flip. A verifiably random result is generated. The player who guessed correctly wins the round. Games are played as best of 5 rounds. The player who wins 3 rounds takes the pot.' },
  { section: 'Games', q: "How does Liar's Dice work?", a: "Each player starts with 5 dice that are rolled and kept hidden. Players take turns bidding on how many dice of a certain face value exist across all players' cups. Any player can call liar on the previous bid. If the bid was correct, the challenger loses a die. If the bid was incorrect, the bidder loses a die. The last player with dice wins." },
  { section: 'Games', q: 'How does Highest Unique work?', a: 'All players secretly pick a number between 1 and 20. Once all picks are submitted, every number is revealed at the same time. The player who picked the highest number that no one else also picked wins the pot. If no unique numbers exist, the round is repeated.' },
  { section: 'Games', q: 'How does Lowest Unique work?', a: 'Same concept as Highest Unique, but the winner is the player who picked the lowest number that no other player also chose.' },
  { section: 'Games', q: 'What is the platform fee?', a: 'Arena Games deducts a small percentage from the winning pot. The exact fee is shown to you before you confirm entry into any game. There are no hidden fees.' },
  { section: 'Bonuses and Referrals', q: 'What is the bonus system?', a: 'By playing a set number of matches at a given entry fee level, you unlock bonus credits. For example, 15 matches at $1 entry unlocks $1.20 in bonus credits. These credits can be used as entry fees in future games but cannot be withdrawn as USDT.' },
  { section: 'Bonuses and Referrals', q: 'When do bonuses expire?', a: 'Bonus credits expire 48 hours after they are unlocked. The expiry time is shown in your Quest panel. Use them before they expire or they will be forfeited.' },
  { section: 'Bonuses and Referrals', q: 'Can I stack bonuses?', a: 'No. Only one active bonus tier is allowed per entry fee level at a time. Once the current tier is used or expires, the next tier becomes available.' },
  { section: 'Bonuses and Referrals', q: 'How does the referral program work?', a: 'Go to your Profile page and copy your unique referral link. Share it with friends. When a friend joins Arena Games through your link and completes matches, you earn bonus match credits. There is no limit on how many people you can refer.' },
  { section: 'Safety and Security', q: 'Are my funds safe?', a: 'Funds are held in an audited smart contract on Polygon, not by Arena Games. We do not have custody of your USDT at any point. The contract code is publicly readable on Polygonscan. We cannot move your funds.' },
  { section: 'Safety and Security', q: 'What happens if I disconnect mid-game?', a: 'If you disconnect within the first 10 seconds of a game, both players receive a full refund from the escrow contract. After the 10-second window, the game proceeds and a disconnect is treated as a forfeit.' },
  { section: 'Safety and Security', q: 'What if the game result seems wrong?', a: 'Contact support with your room code within 90 days. We retain signed server logs for all games and will investigate within 48 hours. If a server error caused an incorrect result, a full refund is processed.' },
  { section: 'Safety and Security', q: 'Is Arena Games legal to use in my country?', a: 'Arena Games is not available in the United States, United Kingdom, France, Netherlands, or other jurisdictions where skill gaming or wagering is prohibited by law. It is your responsibility to verify that using Arena Games is permitted in your jurisdiction.' },
]

export function FaqPage() {
  const [open, setOpen] = useState<number | null>(null)
  const sections = [...new Set(FAQ_ITEMS.map(f => f.section))]

  return wrap(<>
    <BackBtn />
    <PageHero label="FAQ" title="Frequently Asked Questions" sub="Everything you need to know about Arena Games, your funds, and how games work." />

    {sections.map(sec => (
      <Section key={sec} title={sec}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {FAQ_ITEMS.filter(f => f.section === sec).map((item, i) => {
            const idx = FAQ_ITEMS.indexOf(item)
            const isOpen = open === idx
            return (
              <div key={i} style={{ background: '#ffffff', border: `1px solid ${isOpen ? '#fcd34d' : '#e5e7eb'}`, borderRadius: '10px', overflow: 'hidden', boxShadow: isOpen ? '0 2px 12px rgba(245,158,11,0.1)' : '0 1px 3px rgba(0,0,0,0.04)', transition: 'border-color .15s, box-shadow .15s' }}>
                <button onClick={() => setOpen(isOpen ? null : idx)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '15px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', textAlign: 'left' }}>
                  <span style={{ fontSize: '0.88rem', color: '#111827', fontWeight: 600, lineHeight: 1.4 }}>{item.q}</span>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, transition: 'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <path d="M4.5 6.75L9 11.25l4.5-4.5" stroke={isOpen ? '#f59e0b' : '#9ca3af'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 18px 16px', borderTop: '1px solid #fef3c7' }}>
                    <p style={{ color: '#374151', fontSize: '0.85rem', lineHeight: 1.85, margin: '12px 0 0' }}>{item.a}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>
    ))}
  </>)
}

// ── Privacy ───────────────────────────────────────────────────────────────────

export function Privacy() {
  return wrap(<>
    <BackBtn />
    <PageHero label="Legal" title="Privacy Policy" sub="Last updated March 2026. This policy explains what data we collect and how it is used." />

    <Section title="What We Collect">
      <Body>Arena Games collects the following data to operate the platform: wallet addresses (required to play), game activity records (match results, entry fees, timestamps), referral relationships (who referred whom), and support correspondence if you contact us. We do not collect names, email addresses, phone numbers, or physical addresses unless you voluntarily provide them in a support request.</Body>
    </Section>

    <Section title="How We Use Your Data">
      <Body>We use collected data to: operate matchmaking and payout systems, prevent fraud and detect cheating, calculate and distribute referral bonus credits, respond to disputes and support requests, and improve the platform. We do not sell your data to any third party. We do not use your data for advertising.</Body>
    </Section>

    <Section title="On-Chain Data">
      <Body>All transactions on the Polygon network are publicly visible on Polygonscan. This includes wallet-to-contract transfers and contract-to-wallet payouts. This data is outside our control by nature of the blockchain. We cannot delete or obscure on-chain records.</Body>
    </Section>

    <Section title="Cookies and Storage">
      <Body>We use browser localStorage to cache your wallet authentication signature so you do not need to sign a message every time you play. We also use sessionStorage to track referral links. We do not use tracking cookies, advertising cookies, or any third-party analytics cookies.</Body>
    </Section>

    <Section title="Data Retention">
      <Body>Signed game logs are retained for 90 days for dispute resolution purposes. Off-chain profile data (username, referral history) is retained for as long as your wallet has been active on the platform. You may request deletion of off-chain data by contacting support. On-chain records cannot be deleted.</Body>
    </Section>

    <Section title="Third-Party Services">
      <Body>Arena Games uses Polygon network infrastructure and WebSocket hosting providers to operate. These services process transaction data as part of normal blockchain and server operations. We do not integrate third-party advertising, analytics, or social login services.</Body>
    </Section>

    <Section title="Your Rights">
      <Body>You may request a copy of your off-chain data or deletion of your off-chain profile at any time by contacting support@joinarena.space. Include your wallet address with the request. We will process the request within 30 days.</Body>
    </Section>

    <Section title="Contact">
      <Body>Privacy-related questions can be directed to support@joinarena.space. Please include your wallet address and a clear description of your request.</Body>
    </Section>
  </>)
}

// ── Terms ─────────────────────────────────────────────────────────────────────

export function Terms() {
  return wrap(<>
    <BackBtn />
    <PageHero label="Legal" title="Terms of Service" sub="Last updated March 2026. By using Arena Games, you agree to these terms." />

    <Section title="Eligibility">
      <Body>You must be at least 18 years of age to use Arena Games. You must not be accessing the platform from a restricted jurisdiction. It is your sole responsibility to verify that using Arena Games is lawful in your jurisdiction before playing. By connecting your wallet, you confirm that you meet these requirements.</Body>
    </Section>

    <Section title="Restricted Jurisdictions">
      <Body>Arena Games is not available to residents or users in the United States, United Kingdom, France, Netherlands, Germany, Spain, Singapore, Iran, North Korea, or any other jurisdiction where online skill wagering is prohibited by law. We reserve the right to block access from these regions.</Body>
    </Section>

    <Section title="How the Platform Works">
      <Body>Arena Games is a peer-to-peer competitive gaming platform. Entry fees are transferred to a smart contract escrow when a game begins and paid out to the winner when it ends. Arena Games provides the game server, matchmaking, and smart contract infrastructure. The platform does not take the other side of any wager.</Body>
    </Section>

    <Section title="Platform Fee">
      <Body>A platform fee is deducted from the winning pot to sustain development and operations. The exact fee percentage is displayed on the game card before you confirm entry. By confirming, you agree to the stated fee. Fees are not refundable in the event of a loss.</Body>
    </Section>

    <Section title="Game Rules">
      <Body>The rules for each game are displayed on the game card before joining a room. By joining, you confirm that you understand the rules. Disputes based on misunderstanding of game rules will not result in refunds unless a verified server error caused the outcome.</Body>
    </Section>

    <Section title="Bonus Credits">
      <Body>Bonus credits earned through the quest system are non-withdrawable and can only be used as entry fees for future games. Bonuses expire 48 hours after being unlocked. Only one active bonus tier per entry fee level is allowed at a time. Bonuses reset on the first of each calendar month. Bonus credits have no cash value.</Body>
    </Section>

    <Section title="Disconnections and Refunds">
      <Body>If a player disconnects within the first 10 seconds of a game starting, both players receive a full refund from the escrow contract. After the 10-second window, a disconnect is treated as a forfeit. Refunds for technical issues caused by Arena server errors will be reviewed and processed within 48 hours of a support request.</Body>
    </Section>

    <Section title="Liability">
      <Body>Arena Games is not liable for losses resulting from wallet issues, network failures, browser incompatibility, or smart contract bugs outside our reasonable control. By using the platform, you acknowledge that competitive games involve the risk of losing your entry fee and that this risk is accepted voluntarily.</Body>
    </Section>

    <Section title="Prohibited Conduct">
      <Body>You may not use bots, scripts, or any automated tools to play games or exploit matchmaking. You may not attempt to manipulate game results through collusion with other players. Accounts or wallets found to be cheating will be permanently blocked from the escrow contract and forfeited balances will be donated to a public charity.</Body>
    </Section>

    <Section title="Dispute Process">
      <Body>All disputes must be submitted to support within 90 days of the game date. Contact support@joinarena.space with your room code and wallet address. We will respond within 48 hours. We retain signed game logs for 90 days. After 90 days no dispute can be investigated.</Body>
    </Section>

    <Section title="Changes to Terms">
      <Body>We may update these terms at any time. Changes will be posted to this page with an updated date. Continued use of the platform after changes constitutes acceptance of the new terms.</Body>
    </Section>
  </>)
}

// ── AML Policy ────────────────────────────────────────────────────────────────

export function AmlPolicy() {
  return wrap(<>
    <BackBtn />
    <PageHero label="Compliance" title="AML Policy" sub="Last updated March 2026. Arena Games is committed to preventing money laundering and the financing of illegal activities." />

    <Section title="Purpose">
      <Body>This Anti-Money Laundering policy outlines how Arena Games identifies and prevents the use of its platform for money laundering, terrorist financing, or any other illegal financial activity. We take these obligations seriously and cooperate fully with relevant regulatory authorities.</Body>
    </Section>

    <Section title="Restricted Jurisdictions">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Body>Arena Games does not serve users located in the following jurisdictions:</Body>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
          {['United States', 'United Kingdom', 'France', 'Netherlands', 'Germany', 'Spain', 'Singapore', 'Iran', 'North Korea', 'Syria', 'Cuba', 'Sudan', 'Myanmar'].map(j => (
            <span key={j} style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', padding: '4px 10px', fontSize: '0.8rem', color: '#92400e', fontWeight: 600 }}>{j}</span>
          ))}
        </div>
        <p style={{ color: '#374151', fontSize: '0.85rem', lineHeight: 1.75, margin: '8px 0 0' }}>
          Accessing the platform from any of these jurisdictions is a violation of these terms and may be a violation of local law. We reserve the right to block access and freeze escrow funds associated with wallets from restricted regions pending compliance review.
        </p>
      </div>
    </Section>

    <Section title="No Fiat Deposits">
      <Body>Arena Games does not accept fiat currency deposits of any kind. All transactions are conducted entirely on the Polygon blockchain using USDT. Every transaction is publicly auditable on Polygonscan. The on-chain nature of all activity provides a permanent, tamper-proof record of every entry fee and payout.</Body>
    </Section>

    <Section title="Wallet Screening">
      <Body>Wallet addresses interacting with the Arena Games escrow contract may be screened against known sanctions lists including OFAC SDN, EU Consolidated Sanctions, and other recognized databases. Wallets flagged by these databases will be blocked from participating in games. Funds associated with flagged wallets may be held pending compliance review.</Body>
    </Section>

    <Section title="Suspicious Activity">
      <Body>We monitor for patterns consistent with layering and structuring activity, including rapid cycling of funds through multiple game rooms, unusual patterns of wins or losses inconsistent with the game format, and wallets that have appeared in known illicit transaction databases. Suspicious activity will be reported to relevant authorities in accordance with applicable law.</Body>
    </Section>

    <Section title="Record Keeping">
      <Body>On-chain transaction records are immutable and permanently accessible on the Polygon blockchain. Off-chain game logs, including signed server records, are retained for a minimum of 90 days. We cooperate fully with law enforcement and regulatory investigations by providing available records upon lawful request.</Body>
    </Section>

    <Section title="Contact">
      <Body>For compliance-related inquiries, contact support@joinarena.space. Include your wallet address and a description of your inquiry. Compliance requests are handled separately from standard support and may require additional verification.</Body>
    </Section>
  </>)
}
