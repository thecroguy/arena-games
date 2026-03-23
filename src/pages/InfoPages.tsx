import React from 'react'

const pageStyle: React.CSSProperties = {
  background: '#06060e',
  minHeight: '100vh',
  padding: '40px 20px 80px',
}

const innerStyle: React.CSSProperties = {
  maxWidth: '760px',
  margin: '0 auto',
}

const h1Style: React.CSSProperties = {
  fontFamily: 'Orbitron, sans-serif',
  color: '#e2e8f0',
  fontSize: '1.6rem',
  letterSpacing: '0.04em',
  marginBottom: '24px',
  fontWeight: 700,
}

const h2Style: React.CSSProperties = {
  fontFamily: 'Orbitron, sans-serif',
  color: '#e2e8f0',
  fontSize: '0.95rem',
  letterSpacing: '0.06em',
  fontWeight: 700,
  marginBottom: '10px',
  marginTop: '36px',
  textTransform: 'uppercase',
}

const dividerStyle: React.CSSProperties = {
  borderTop: '1px solid #0d0d1e',
  margin: '32px 0',
}

const bodyStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#94a3b8',
  lineHeight: 1.8,
  margin: 0,
}

const lastUpdatedStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#475569',
  marginBottom: '28px',
}

// ─── About ───────────────────────────────────────────────────────────────────

export function About() {
  return (
    <div style={pageStyle}>
      <div style={innerStyle}>
        <h1 style={h1Style}>About Arena Games</h1>
        <p style={bodyStyle}>
          Arena Games is a decentralized skill-based competitive gaming platform built on the Polygon
          network. Players compete head-to-head or in groups using USDT as entry fees, which are held
          securely in a smart contract escrow until a winner is determined.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>What We Build</h2>
        <p style={bodyStyle}>
          We offer seven games across different skill categories: Coin Flip (pure chance, fast
          rounds), Liar's Dice (bluffing and probability), Pattern Memory (cognitive recall), Math
          Arena (mental arithmetic), Reaction Grid (speed and reflexes), Highest Unique (strategic
          number selection), and Lowest Unique (contrarian strategy).
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>How It Works</h2>
        <p style={bodyStyle}>
          When a player creates or joins a room, USDT is transferred to our audited escrow smart
          contract on Polygon. The game is played peer-to-peer through our server. When the game
          concludes, the smart contract releases funds to the winner automatically. Arena takes a
          small platform fee on winnings to sustain development.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Our Mission</h2>
        <p style={bodyStyle}>
          To build competitive, transparent, on-chain games where outcomes are determined by skill,
          strategy, and sometimes luck, with no hidden house edge on game results.
        </p>
      </div>
    </div>
  )
}

// ─── Fairness ────────────────────────────────────────────────────────────────

export function Fairness() {
  const gameItems = [
    {
      name: 'Coin Flip',
      desc: 'The result is determined by a verifiable random function. Both players can verify the seed post-game.',
    },
    {
      name: "Liar's Dice",
      desc: 'Entirely player-driven. Dice rolls use a committed random seed revealed at end of round.',
    },
    {
      name: 'Pattern Memory',
      desc: 'A sequence is shown to all players simultaneously from the same server-generated seed.',
    },
    {
      name: 'Math Arena',
      desc: 'Questions are generated server-side from a fixed seed shared with both players.',
    },
    {
      name: 'Reaction Grid',
      desc: 'Target cells are generated from a shared seed. All players see the same sequence.',
    },
    {
      name: 'Highest Unique and Lowest Unique',
      desc: "Players submit privately. Results are revealed simultaneously. No player can see others' choices before submission.",
    },
  ]

  return (
    <div style={pageStyle}>
      <div style={innerStyle}>
        <h1 style={h1Style}>Fairness and Transparency</h1>
        <p style={bodyStyle}>
          Arena Games is committed to provably fair outcomes. Every game is designed so that neither
          Arena nor any third party can manipulate results.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Escrow Model</h2>
        <p style={bodyStyle}>
          All entry fees are held in a publicly verifiable smart contract on Polygon. The contract
          address is visible on every game room. Funds are only released when the game server submits
          a signed result to the contract.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Game Fairness by Game</h2>
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {gameItems.map(g => (
            <div
              key={g.name}
              style={{
                background: '#0d0d1a',
                border: '1px solid #1a1a2e',
                borderRadius: '10px',
                padding: '14px 18px',
              }}
            >
              <p
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#f59e0b',
                  marginBottom: '6px',
                  letterSpacing: '0.04em',
                }}
              >
                {g.name}
              </p>
              <p style={bodyStyle}>{g.desc}</p>
            </div>
          ))}
        </div>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Dispute Resolution</h2>
        <p style={bodyStyle}>
          If a game result appears incorrect, contact support with your room code. We retain signed
          game logs for 90 days.
        </p>
      </div>
    </div>
  )
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const faqs = [
  {
    q: 'What network does Arena Games use?',
    a: 'Arena Games runs on the Polygon network. You need MATIC for gas fees (a very small amount) and USDT (Polygon) for entry fees.',
  },
  {
    q: 'How do I deposit?',
    a: 'Connect your wallet using the Connect Wallet button in the top right. Your wallet balance is your deposit. There is no separate deposit step. Just approve the USDT spend when joining a game.',
  },
  {
    q: 'How do I withdraw my winnings?',
    a: 'Winnings are sent directly to your connected wallet address by the smart contract when the game ends. No withdrawal step is needed.',
  },
  {
    q: 'What are the entry fees?',
    a: 'Entry fees range from $0.50 to $50 USDT depending on the room. You set the entry fee when creating a room, or join an existing room at its listed fee.',
  },
  {
    q: 'Is there a house edge?',
    a: 'Arena takes a small platform fee on winnings (visible before you confirm a game). There is no hidden house edge on game outcomes. The platform fee sustains development and operations.',
  },
  {
    q: 'Can I play on mobile?',
    a: 'Yes. Arena Games works on mobile browsers. We recommend Chrome or Safari on iOS and Android.',
  },
  {
    q: 'What is the bonus system?',
    a: 'After playing a certain number of matches at a given entry fee level, you earn bonus credits that can be used as entry fees for future games. Bonuses are non-withdrawable and expire after 48 hours.',
  },
  {
    q: 'What is a referral?',
    a: 'Share your referral link from your profile page. When a friend joins through your link and plays matches, you earn bonus match credits.',
  },
  {
    q: 'What happens if a player disconnects mid-game?',
    a: 'Disconnect rules vary by game. In most games, a disconnect within the first 10 seconds results in a refund to both parties. After that, the disconnecting player forfeits.',
  },
  {
    q: 'Are my funds safe?',
    a: 'Funds are held in an audited smart contract, not by Arena Games directly. We do not have custody of your USDT. The contract can be verified on Polygonscan.',
  },
  {
    q: "What is Liar's Dice?",
    a: "Liar's Dice is a classic bluffing game. Each player rolls a set of dice (hidden from opponents). Players take turns bidding on the total count of a face value across all dice. Any player can call \"liar\" on the previous bid, triggering a reveal. The loser of the challenge loses a die.",
  },
  {
    q: 'How does Highest Unique work?',
    a: 'All players secretly pick a number from 1 to a set maximum. After all picks are submitted, numbers are revealed. The player who picked the highest number that no one else also picked wins the pot.',
  },
]

export function FaqPage() {
  return (
    <div style={pageStyle}>
      <div style={innerStyle}>
        <h1 style={h1Style}>Frequently Asked Questions</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {faqs.map((item, i) => (
            <div
              key={i}
              style={{
                background: '#0d0d1a',
                border: '1px solid #1a1a2e',
                borderRadius: '10px',
                padding: '18px 20px',
              }}
            >
              <p
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#e2e8f0',
                  marginBottom: '10px',
                  letterSpacing: '0.02em',
                  lineHeight: 1.5,
                }}
              >
                {item.q}
              </p>
              <p style={bodyStyle}>{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Privacy ─────────────────────────────────────────────────────────────────

export function Privacy() {
  return (
    <div style={pageStyle}>
      <div style={innerStyle}>
        <h1 style={h1Style}>Privacy Policy</h1>
        <p style={lastUpdatedStyle}>Last updated: March 2026</p>

        <h2 style={h2Style}>What We Collect</h2>
        <p style={bodyStyle}>
          We collect wallet addresses, game activity data, and referral data. This information is
          necessary to operate the platform and pay referral bonuses.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>How We Use It</h2>
        <p style={bodyStyle}>
          Data is used to operate the platform, prevent fraud, and pay referral bonuses to eligible
          users. We do not sell your data to third parties.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>What We Do Not Collect</h2>
        <p style={bodyStyle}>
          We do not collect your name, email address, or phone number unless you voluntarily submit
          this information through a support request.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Cookies</h2>
        <p style={bodyStyle}>
          We use session cookies only. We do not use tracking cookies or third-party advertising
          cookies.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Third Parties</h2>
        <p style={bodyStyle}>
          The Polygon network is public by nature. All on-chain transactions, including deposits and
          withdrawals, are publicly visible on Polygonscan.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Your Rights</h2>
        <p style={bodyStyle}>
          You may request deletion of off-chain data by contacting our support team. On-chain
          transaction data is immutable and cannot be removed.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Contact</h2>
        <p style={bodyStyle}>
          For privacy-related questions, please contact us through our support page.
        </p>
      </div>
    </div>
  )
}

// ─── Terms ───────────────────────────────────────────────────────────────────

export function Terms() {
  return (
    <div style={pageStyle}>
      <div style={innerStyle}>
        <h1 style={h1Style}>Terms of Service</h1>
        <p style={lastUpdatedStyle}>Last updated: March 2026</p>

        <h2 style={h2Style}>Eligibility</h2>
        <p style={bodyStyle}>
          You must be 18 years of age or older to use Arena Games. You must not be located in a
          restricted jurisdiction. See the AML Policy for the list of restricted jurisdictions.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Platform Fee</h2>
        <p style={bodyStyle}>
          A platform fee is deducted from winnings. The exact fee is shown before you confirm a
          game. By confirming, you agree to the fee.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Restricted Jurisdictions</h2>
        <p style={bodyStyle}>
          Arena Games is not available to users in the United States, United Kingdom, France,
          Netherlands, or any other jurisdiction where online skill gaming or gambling is prohibited
          by law.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Game Rules</h2>
        <p style={bodyStyle}>
          Each game's rules are displayed before joining a room. By joining, you confirm that you
          have read and understood the rules for that game.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Bonus Terms</h2>
        <p style={bodyStyle}>
          Bonus credits are non-withdrawable. They expire 48 hours after being unlocked. Only one
          bonus tier can be active per entry fee level at a time. Bonuses reset monthly.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Liability</h2>
        <p style={bodyStyle}>
          Arena Games is not liable for losses due to network failures, wallet issues, or smart
          contract bugs beyond our control. Use the platform at your own risk.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Dispute</h2>
        <p style={bodyStyle}>
          Disputes must be submitted within 90 days of the game in question. Contact support with
          your room code. We retain signed game logs for 90 days.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Governing Law</h2>
        <p style={bodyStyle}>
          The platform operates under the applicable jurisdiction of its registration. By using
          Arena Games, you agree to resolve disputes through our support process before seeking
          external remedies.
        </p>
      </div>
    </div>
  )
}

// ─── AML Policy ──────────────────────────────────────────────────────────────

export function AmlPolicy() {
  return (
    <div style={pageStyle}>
      <div style={innerStyle}>
        <h1 style={h1Style}>AML Policy</h1>
        <p style={lastUpdatedStyle}>Last updated: March 2026</p>

        <h2 style={h2Style}>Purpose</h2>
        <p style={bodyStyle}>
          Arena Games is committed to preventing money laundering and terrorist financing. We take
          our compliance obligations seriously and cooperate with relevant authorities.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Restricted Jurisdictions</h2>
        <p style={bodyStyle}>
          Arena Games does not serve users located in the United States, United Kingdom, France,
          Netherlands, Iran, North Korea, or any jurisdiction where this service is prohibited by
          law. Accessing the platform from a restricted jurisdiction is a violation of these terms.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Our Approach</h2>
        <p style={bodyStyle}>
          We do not accept fiat deposits. All transactions are on-chain and publicly auditable on
          Polygon. Wallet addresses may be screened against known sanctions lists. We reserve the
          right to block wallets flagged by recognized sanctions databases.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Reporting</h2>
        <p style={bodyStyle}>
          Suspicious activity will be reported to relevant authorities in accordance with applicable
          law. We cooperate fully with law enforcement investigations.
        </p>

        <div style={dividerStyle} />

        <h2 style={h2Style}>Contact</h2>
        <p style={bodyStyle}>
          For compliance-related questions, please contact us through our support page. Include your
          wallet address and a description of your inquiry.
        </p>
      </div>
    </div>
  )
}
