import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Global override (dark body CSS) ──────────────────────────────────────────
const RESET_CSS = `
  .info-page, .info-page * { box-sizing: border-box; }
  .info-page { background: #f8fafc !important; color: #1e293b !important; }
  .info-page p, .info-page span, .info-page li, .info-page div { color: inherit; }
  .info-acc-q { color: #0f172a !important; font-size: 0.9rem; font-weight: 600; line-height: 1.45; font-family: system-ui,sans-serif; }
  .info-acc-body { color: #475569 !important; font-size: 0.86rem; line-height: 1.85; font-family: system-ui,sans-serif; }
  .info-body { color: #475569 !important; font-size: 0.88rem; line-height: 1.85; font-family: system-ui,sans-serif; }
  .info-card { background: #ffffff !important; }
  .info-tag { color: #b45309 !important; background: #fef3c7 !important; border: 1px solid #fde68a !important; }
  .info-h1 { color: #0f172a !important; font-family: system-ui,sans-serif !important; font-weight: 800 !important; font-size: clamp(1.5rem,3.5vw,2.1rem) !important; letter-spacing: -0.02em !important; line-height: 1.2 !important; }
  .info-h2 { color: #0f172a !important; font-family: system-ui,sans-serif !important; font-weight: 700 !important; font-size: 0.85rem !important; letter-spacing: 0.06em !important; text-transform: uppercase !important; }
  .info-sub { color: #64748b !important; font-size: 1rem !important; line-height: 1.65 !important; font-family: system-ui,sans-serif !important; }
  .info-label { color: #92400e !important; font-size: 0.6rem !important; font-weight: 800 !important; letter-spacing: 0.12em !important; text-transform: uppercase !important; font-family: system-ui,sans-serif !important; }
  .info-sec-label { color: #94a3b8 !important; font-size: 0.62rem !important; font-weight: 700 !important; letter-spacing: 0.1em !important; text-transform: uppercase !important; font-family: system-ui,sans-serif !important; }
  .info-chip { background: #f1f5f9 !important; color: #1e293b !important; border: 1px solid #e2e8f0 !important; font-size: 0.8rem !important; font-weight: 600 !important; }
  .info-game-name { color: #92400e !important; font-size: 0.75rem !important; font-weight: 700 !important; font-family: system-ui,sans-serif !important; letter-spacing: 0.02em !important; }
  .info-game-desc { color: #475569 !important; font-size: 0.84rem !important; line-height: 1.65 !important; font-family: system-ui,sans-serif !important; }
  .info-back { color: #64748b !important; font-size: 0.83rem !important; font-weight: 600 !important; font-family: system-ui,sans-serif !important; background: transparent !important; border: none !important; }
  .info-back:hover { color: #0f172a !important; }
  .info-hero { background: linear-gradient(135deg,#fffbeb,#fef9ec,#fff7ed) !important; border: 1px solid #fde68a !important; }
  .info-divider { border-top: 1px solid #e2e8f0 !important; }
  .info-acc-open { background: #ffffff !important; border-color: #fcd34d !important; box-shadow: 0 2px 16px rgba(245,158,11,0.12) !important; }
  .info-acc-closed { background: #ffffff !important; border-color: #e2e8f0 !important; box-shadow: 0 1px 4px rgba(0,0,0,0.05) !important; }
  .info-acc-body-wrap { background: #fafafa !important; border-top: 1px solid #fef3c7 !important; }
  .info-country-chip { background: #fff1f2 !important; border: 1px solid #fecdd3 !important; color: #9f1239 !important; font-size: 0.78rem !important; font-weight: 600 !important; }
`

function BackBtn() {
  const nav = useNavigate()
  return (
    <button className="info-back" onClick={() => nav(-1)}
      style={{ display:'inline-flex', alignItems:'center', gap:'6px', cursor:'pointer', marginBottom:'32px', padding:0 }}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M11 13.5L6.5 9 11 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Back
    </button>
  )
}

function Hero({ label, title, sub }: { label: string; title: string; sub: string }) {
  return (
    <div className="info-hero" style={{ borderRadius:'20px', padding:'40px 44px', marginBottom:'44px' }}>
      <div className="info-tag" style={{ display:'inline-block', borderRadius:'6px', padding:'4px 11px', marginBottom:'16px' }}>
        <span className="info-label">{label}</span>
      </div>
      <h1 className="info-h1" style={{ marginBottom:'14px' }}>{title}</h1>
      <p className="info-sub">{sub}</p>
    </div>
  )
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:'36px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'18px' }}>
        <div style={{ width:'4px', height:'22px', background:'linear-gradient(180deg,#f59e0b,#f97316)', borderRadius:'3px', flexShrink:0 }} />
        <h2 className="info-h2">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="info-body" style={{ margin:0 }}>{children}</p>
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="info-card" style={{ border:'1px solid #e2e8f0', borderRadius:'14px', padding:'20px 24px', boxShadow:'0 1px 6px rgba(0,0,0,0.06)', marginBottom:'10px' }}>
      {children}
    </div>
  )
}

function wrap(content: React.ReactNode) {
  return (
    <div className="info-page" style={{ minHeight:'100vh', padding:'40px 20px 80px' }}>
      <style>{RESET_CSS}</style>
      <div style={{ maxWidth:'780px', margin:'0 auto' }}>{content}</div>
    </div>
  )
}

// ── About ─────────────────────────────────────────────────────────────────────

export function About() {
  return wrap(<>
    <BackBtn />
    <Hero label="Company" title="About Arena Games"
      sub="A decentralized, skill-based gaming platform on Polygon where players compete head-to-head for real USDT with no custodian and no house edge." />

    <Sec title="What We Build">
      <P>Arena Games lets players wager USDT against each other across seven game formats. Entry fees are locked in an audited smart contract on Polygon the moment a room starts, and released automatically to the winner when the game ends. There is no custodian, no manual payout, and no intermediary.</P>
    </Sec>

    <Sec title="Our Games">
      {[
        { name:'Coin Flip',       desc:'Best-of-5 rounds. Pick Heads or Tails. Verifiably random result each round. Fastest game on the platform.' },
        { name:"Liar's Dice",     desc:"Classic bluffing game. Roll hidden dice, bid on totals across all cups, call Liar to challenge. Last player with dice wins." },
        { name:'Pattern Memory',  desc:'A tile grid flashes a sequence. Recreate it faster and more accurately than your opponents to win each round.' },
        { name:'Math Arena',      desc:'Mental arithmetic race. Same problem shown to all players simultaneously. First correct answer wins the point.' },
        { name:'Reaction Grid',   desc:'One cell lights up at a time. Click it before anyone else. Pure speed and reflexes.' },
        { name:'Highest Unique',  desc:'Secretly pick the highest number that nobody else also picks. Strategic number selection with a bluffing element.' },
        { name:'Lowest Unique',   desc:'Pick the lowest unique number. Contrarian thinking wins. Rewards players who predict what others will avoid.' },
      ].map(g => (
        <InfoCard key={g.name}>
          <div style={{ display:'flex', gap:'14px', alignItems:'flex-start' }}>
            <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#f59e0b', marginTop:'6px', flexShrink:0 }} />
            <div>
              <div className="info-game-name" style={{ marginBottom:'5px' }}>{g.name}</div>
              <div className="info-game-desc">{g.desc}</div>
            </div>
          </div>
        </InfoCard>
      ))}
    </Sec>

    <Sec title="How the Escrow Works">
      <P>When you create or join a game room, you approve a USDT transfer to our audited escrow contract on Polygon. The contract holds the funds for the duration of the game. When the server submits the cryptographically signed game result, the contract releases funds to the winner in the same transaction. Arena charges a small platform fee on winnings, always shown before you confirm.</P>
    </Sec>

    <Sec title="Our Mission">
      <P>We believe competitive games should be transparent, instant, and accessible. No sign-up forms, no bank accounts, no withdrawal queues. Connect a wallet and play. The smart contract enforces every rule. You keep your winnings.</P>
    </Sec>

    <Sec title="Contact Us">
      <P>For questions, disputes, or business inquiries, reach us at support@joinarena.space or through the Contact page in the footer.</P>
    </Sec>
  </>)
}

// ── Fairness ──────────────────────────────────────────────────────────────────

export function Fairness() {
  return wrap(<>
    <BackBtn />
    <Hero label="Trust" title="Fairness and Transparency"
      sub="Every game is designed so that neither Arena Games nor any third party can influence the outcome. Here is exactly how." />

    <Sec title="The Escrow Model">
      <P>All entry fees are transferred to a publicly verifiable smart contract on Polygon when a game begins. The contract address is shown on every game room. Funds cannot be moved until the server submits a signed result. Arena Games staff cannot release or redirect funds manually under any circumstances.</P>
    </Sec>

    <Sec title="Per-Game Fairness">
      {[
        { name:'Coin Flip', detail:'Results use a verifiable random seed committed before players pick and revealed after. Both players can verify the seed post-game by checking the signed server log.' },
        { name:"Liar's Dice", detail:'Each round uses a committed per-round seed for dice rolls. The seed is revealed at end of each challenge. No one can alter dice values after the commitment transaction.' },
        { name:'Pattern Memory', detail:'The tile sequence comes from one server-side seed broadcast identically to all players at the same millisecond. No player has any timing advantage at the source.' },
        { name:'Math Arena', detail:'Questions are generated from a fixed seed determined before the round starts. All players see the same problem at the same time. Server timestamps decide who answered first.' },
        { name:'Reaction Grid', detail:'Target positions come from a shared seed computed before the round. Server-side latency compensation is applied equally to all players.' },
        { name:'Highest and Lowest Unique', detail:"Picks are hashed and stored until all players submit or the timer closes. Numbers are revealed simultaneously. No player can see another's choice before submitting." },
      ].map(g => (
        <InfoCard key={g.name}>
          <div className="info-game-name" style={{ marginBottom:'8px' }}>{g.name}</div>
          <div className="info-game-desc">{g.detail}</div>
        </InfoCard>
      ))}
    </Sec>

    <Sec title="Smart Contract Verification">
      <P>Our escrow contract is deployed on Polygon Mainnet and fully readable on Polygonscan. The ABI and source code are available for independent review. Any developer can verify that funds flow only from players to contract and then to winner, with no owner withdrawal function present in the contract.</P>
    </Sec>

    <Sec title="Dispute Resolution">
      <P>If you believe a result was incorrect, contact support@joinarena.space within 90 days with your room code. We retrieve the signed game log, verify all player actions and timestamps, and respond within 48 hours. If a verified server error caused an incorrect result, a full refund is processed.</P>
    </Sec>
  </>)
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  { s:'Getting Started', q:'What do I need to play?', a:"A web3 wallet (MetaMask or WalletConnect-compatible), USDT on Polygon for entry fees, and a small amount of MATIC for gas (under $0.01 per game). No sign-up, no email, no KYC required." },
  { s:'Getting Started', q:'Which network does Arena Games use?', a:'Polygon Mainnet, Chain ID 137. If your wallet is on a different network, the app will prompt you to switch automatically.' },
  { s:'Getting Started', q:'How do I connect my wallet?', a:'Click Connect Wallet in the top right. Select your wallet provider. Approve the connection. If on the wrong network, click Switch Network when the app prompts you.' },
  { s:'Getting Started', q:'Can I play on mobile?', a:'Yes. Arena Games works on mobile browsers. Best experience in MetaMask Mobile or any WalletConnect-compatible browser on iOS or Android.' },
  { s:'Getting Started', q:'How do I get USDT on Polygon?', a:'Bridge from Ethereum using the official Polygon Bridge, or withdraw directly to your Polygon wallet from exchanges that support Polygon withdrawals (Binance, OKX, Bybit).' },
  { s:'Deposits and Withdrawals', q:'How do I deposit?', a:'There is no deposit page. Your wallet balance is your balance. When you join a game, you approve a USDT transfer to the escrow contract. Funds only move when you confirm in your wallet.' },
  { s:'Deposits and Withdrawals', q:'How do I withdraw my winnings?', a:'Winnings go directly to your wallet the moment the game ends. The smart contract sends them automatically. No request, no button, no wait.' },
  { s:'Deposits and Withdrawals', q:'Why did my transaction fail?', a:'Most common reasons: not enough MATIC for gas (keep at least 0.1 MATIC), USDT approval was rejected, or network congestion. Try again after 30 seconds.' },
  { s:'Deposits and Withdrawals', q:'How long do transactions take?', a:'Polygon transactions confirm in 2 to 5 seconds normally. During rare congestion it can take up to 30 seconds. If stuck over 5 minutes, speed up or cancel from your wallet.' },
  { s:'Games', q:'What games are available?', a:"Coin Flip, Liar's Dice, Pattern Memory, Math Arena, Reaction Grid, Highest Unique, and Lowest Unique. Each supports different player counts and entry fee levels." },
  { s:'Games', q:'How does Coin Flip work?', a:'Two players pick Heads or Tails. A verifiably random result decides each round. Best of 5 rounds. First to 3 wins takes the pot minus the platform fee.' },
  { s:'Games', q:"How does Liar's Dice work?", a:"Each player has 5 hidden dice. Players take turns bidding on total face counts across all cups. Any player can call Liar. Correct bid means the challenger loses a die. Wrong bid means the bidder does. Last player with dice wins." },
  { s:'Games', q:'How does Highest Unique work?', a:'All players secretly pick a number 1 to 20. All picks reveal simultaneously. Highest number that nobody else also picked wins. No unique numbers: round repeats.' },
  { s:'Games', q:'What is the platform fee?', a:'A percentage of the winning pot, always shown before you confirm entry. No hidden fees ever.' },
  { s:'Bonuses and Referrals', q:'What is the bonus system?', a:'Reach match milestones at a given entry fee level to unlock bonus credits. Example: 15 matches at $1 entry unlocks $1.20. Credits can be used as entry fees but cannot be withdrawn.' },
  { s:'Bonuses and Referrals', q:'When do bonuses expire?', a:'48 hours after being unlocked. Expiry time is shown in the Quest panel. Unused bonuses are forfeited.' },
  { s:'Bonuses and Referrals', q:'Can I stack bonuses?', a:'No. One active tier per entry fee level at a time. The next tier activates once the current one is used or expires.' },
  { s:'Bonuses and Referrals', q:'How does the referral program work?', a:'Copy your referral link from your Profile page. When friends join through your link and play matches, you earn bonus match credits. No cap on referrals.' },
  { s:'Safety and Security', q:'Are my funds safe?', a:'Funds are in an audited smart contract on Polygon, not held by Arena Games. We cannot move your funds. The contract is publicly readable on Polygonscan.' },
  { s:'Safety and Security', q:'What happens if I disconnect mid-game?', a:'Disconnect within the first 10 seconds: both players get a full refund. After 10 seconds: disconnect is treated as a forfeit.' },
  { s:'Safety and Security', q:'What if the game result seems wrong?', a:'Email support@joinarena.space with your room code within 90 days. We keep signed logs for all games and respond within 48 hours.' },
  { s:'Safety and Security', q:'Is Arena Games legal to use in my country?', a:'Arena Games is not available in the US, UK, France, Netherlands, or other jurisdictions where skill wagering is prohibited. Verify your local laws before playing.' },
]

export function FaqPage() {
  const [open, setOpen] = useState<number | null>(null)
  const sections = [...new Set(FAQ_ITEMS.map(f => f.s))]

  return wrap(<>
    <BackBtn />
    <Hero label="FAQ" title="Frequently Asked Questions"
      sub="Everything you need to know about Arena Games, your funds, bonuses, and how games work." />

    {sections.map(sec => (
      <Sec key={sec} title={sec}>
        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
          {FAQ_ITEMS.filter(f => f.s === sec).map(item => {
            const idx = FAQ_ITEMS.indexOf(item)
            const isOpen = open === idx
            return (
              <div key={idx} className={isOpen ? 'info-acc-open' : 'info-acc-closed'}
                style={{ borderRadius:'12px', overflow:'hidden', border:'1px solid', transition:'all .15s' }}>
                <button onClick={() => setOpen(isOpen ? null : idx)}
                  style={{ width:'100%', background:'transparent', border:'none', cursor:'pointer', padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', textAlign:'left' }}>
                  <span className="info-acc-q">{item.q}</span>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
                    style={{ flexShrink:0, transition:'transform .22s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <path d="M5 7.5l5 5 5-5" stroke={isOpen ? '#f59e0b' : '#94a3b8'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {isOpen && (
                  <div className="info-acc-body-wrap" style={{ padding:'0 20px 18px' }}>
                    <p className="info-acc-body" style={{ margin:'14px 0 0' }}>{item.a}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Sec>
    ))}
  </>)
}

// ── Privacy ───────────────────────────────────────────────────────────────────

export function Privacy() {
  return wrap(<>
    <BackBtn />
    <Hero label="Legal" title="Privacy Policy" sub="Last updated March 2026. This policy explains what data we collect, how we use it, and your rights." />
    <Sec title="What We Collect"><P>We collect wallet addresses (required to play), game activity records (match results, entry fees, timestamps), referral relationships, and support correspondence if you contact us. We do not collect your name, email address, phone number, or physical address unless you voluntarily provide them in a support request.</P></Sec>
    <Sec title="How We Use Your Data"><P>Data is used to: operate matchmaking and payout systems, prevent fraud and detect cheating, calculate and distribute referral bonus credits, respond to disputes and support requests, and improve the platform. We do not sell your data to any third party. We do not use your data for advertising.</P></Sec>
    <Sec title="On-Chain Data"><P>All transactions on Polygon are publicly visible on Polygonscan. This includes wallet-to-contract transfers and contract-to-wallet payouts. This data is outside our control by the nature of the blockchain. We cannot delete or obscure on-chain records.</P></Sec>
    <Sec title="Cookies and Local Storage"><P>We use localStorage to cache your wallet authentication signature so you do not need to sign on every game. We use sessionStorage to track referral links. We do not use tracking cookies, advertising cookies, or any third-party analytics.</P></Sec>
    <Sec title="Data Retention"><P>Signed game logs are retained for 90 days for dispute resolution. Off-chain profile data (username, referral history) is kept while your wallet is active on the platform. You may request deletion of off-chain data by contacting support. On-chain records cannot be deleted.</P></Sec>
    <Sec title="Your Rights"><P>You may request a copy or deletion of your off-chain data by emailing support@joinarena.space with your wallet address. We process requests within 30 days.</P></Sec>
    <Sec title="Contact"><P>Privacy questions: support@joinarena.space. Include your wallet address and a description of your request.</P></Sec>
  </>)
}

// ── Terms ─────────────────────────────────────────────────────────────────────

export function Terms() {
  return wrap(<>
    <BackBtn />
    <Hero label="Legal" title="Terms of Service" sub="Last updated March 2026. By connecting your wallet and using Arena Games, you agree to these terms in full." />
    <Sec title="Eligibility"><P>You must be at least 18 years of age. You must not be in a restricted jurisdiction. By connecting your wallet, you confirm both. It is your sole responsibility to verify that using Arena Games is lawful where you are located.</P></Sec>
    <Sec title="Restricted Jurisdictions"><P>Arena Games is not available to residents of the United States, United Kingdom, France, Netherlands, Germany, Spain, Singapore, Iran, North Korea, or any other jurisdiction where online skill wagering is prohibited by law. We reserve the right to block access from these regions at any time.</P></Sec>
    <Sec title="How the Platform Works"><P>Arena Games is a peer-to-peer competitive gaming platform. Entry fees go to an escrow smart contract and are paid to the winner automatically. Arena provides the game server, matchmaking, and contract infrastructure. The platform does not take the other side of any wager.</P></Sec>
    <Sec title="Platform Fee"><P>A fee is deducted from the winning pot to sustain development. The exact percentage is displayed on the game card before you confirm entry. By confirming, you agree to the stated fee. Fees are not refundable in the event of a loss.</P></Sec>
    <Sec title="Bonus Credits"><P>Bonus credits are non-withdrawable and expire 48 hours after being unlocked. Only one active tier per entry fee level is allowed at a time. Bonuses reset on the first of each calendar month. Bonus credits have no cash value.</P></Sec>
    <Sec title="Disconnections and Refunds"><P>Disconnect within the first 10 seconds of a game: both players receive a full refund from the escrow contract. After 10 seconds: a disconnect is treated as a forfeit. Refunds for verified Arena server errors will be processed within 48 hours.</P></Sec>
    <Sec title="Prohibited Conduct"><P>You may not use bots, scripts, or automation to play games. You may not collude with other players to manipulate results. Wallets found cheating will be permanently blocked from the escrow contract.</P></Sec>
    <Sec title="Liability"><P>Arena Games is not liable for losses from wallet issues, network failures, or smart contract bugs outside our reasonable control. Competitive games involve the risk of losing your entry fee. This risk is accepted voluntarily when you play.</P></Sec>
    <Sec title="Disputes"><P>Submit disputes to support@joinarena.space within 90 days of the game with your room code and wallet address. We respond within 48 hours. Game logs are retained for 90 days only.</P></Sec>
    <Sec title="Changes to Terms"><P>We may update these terms at any time. Changes are posted here with an updated date. Continued use of the platform after changes constitutes acceptance.</P></Sec>
  </>)
}

// ── AML Policy ────────────────────────────────────────────────────────────────

export function AmlPolicy() {
  return wrap(<>
    <BackBtn />
    <Hero label="Compliance" title="AML Policy" sub="Last updated March 2026. Arena Games is committed to preventing money laundering and illegal financial activity on the platform." />
    <Sec title="Purpose"><P>This policy outlines how Arena Games prevents its platform from being used for money laundering, terrorist financing, or other illegal financial activity. We take these obligations seriously and cooperate fully with relevant regulatory authorities.</P></Sec>
    <Sec title="Restricted Jurisdictions">
      <P>Arena Games does not serve users in the following jurisdictions:</P>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginTop:'14px' }}>
        {['United States','United Kingdom','France','Netherlands','Germany','Spain','Singapore','Iran','North Korea','Syria','Cuba','Sudan','Myanmar'].map(j => (
          <span key={j} className="info-country-chip" style={{ borderRadius:'8px', padding:'5px 12px' }}>{j}</span>
        ))}
      </div>
      <p className="info-body" style={{ marginTop:'14px' }}>Accessing the platform from any of these jurisdictions violates these terms and may violate local law. We reserve the right to block access and freeze escrow funds associated with flagged wallets pending compliance review.</p>
    </Sec>
    <Sec title="No Fiat Deposits"><P>Arena Games does not accept fiat currency. All transactions are on the Polygon blockchain using USDT. Every transaction is publicly auditable on Polygonscan. The on-chain nature of all activity provides a permanent, tamper-proof record of every entry fee and payout.</P></Sec>
    <Sec title="Wallet Screening"><P>Wallet addresses may be screened against OFAC SDN, EU Consolidated Sanctions, and other recognized databases. Flagged wallets will be blocked from games. Funds associated with flagged wallets may be held pending compliance review.</P></Sec>
    <Sec title="Suspicious Activity"><P>We monitor for patterns consistent with layering and structuring, including rapid cycling of funds, unusual win/loss patterns inconsistent with the game format, and wallets that appear in known illicit transaction databases. Suspicious activity will be reported to relevant authorities.</P></Sec>
    <Sec title="Record Keeping"><P>On-chain transaction records are immutable and permanently accessible on Polygon. Off-chain game logs are retained for a minimum of 90 days. We cooperate fully with law enforcement by providing available records upon lawful request.</P></Sec>
    <Sec title="Contact"><P>Compliance inquiries: support@joinarena.space. Include your wallet address and a description of your inquiry. Compliance requests are handled separately from standard support.</P></Sec>
  </>)
}
