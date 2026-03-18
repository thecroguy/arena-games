import { useNavigate } from 'react-router-dom'

const WALLETS = [
  { name: 'MetaMask',       icon: '🦊', desc: 'Most popular. Browser extension + mobile app.',     link: 'https://metamask.io',        recommend: true },
  { name: 'Coinbase Wallet',icon: '🔵', desc: 'Easy setup, beginner-friendly mobile app.',          link: 'https://wallet.coinbase.com', recommend: false },
  { name: 'Trust Wallet',   icon: '🛡️', desc: 'Great mobile wallet, supports all chains.',         link: 'https://trustwallet.com',     recommend: false },
  { name: 'WalletConnect',  icon: '🔗', desc: 'Connect any mobile wallet by scanning a QR code.',  link: 'https://walletconnect.com',   recommend: false },
]

const NETWORKS = [
  { icon: '🟣', name: 'Polygon',  gas: '~$0.001', speed: 'Instant', rec: true  },
  { icon: '🔵', name: 'Arbitrum', gas: '~$0.05',  speed: 'Fast',    rec: true  },
  { icon: '🅱',  name: 'Base',    gas: '~$0.01',  speed: 'Fast',    rec: true  },
  { icon: '🔴', name: 'Optimism', gas: '~$0.03',  speed: 'Fast',    rec: false },
  { icon: '🟡', name: 'BNB Chain',gas: '~$0.05',  speed: 'Fast',    rec: false },
  { icon: '🔷', name: 'Ethereum', gas: '~$2–10',  speed: 'Slow',    rec: false },
]

const STEPS = [
  {
    step: '01',
    title: 'Install a Wallet',
    color: '#7c3aed',
    content: (
      <div>
        <p style={{ color: '#94a3b8', marginBottom: '16px', lineHeight: 1.6 }}>
          A crypto wallet is your account. It holds your USDT and lets you sign into Join Arena. No email or password needed.
        </p>
        <div style={{ display: 'grid', gap: '10px' }}>
          {WALLETS.map(w => (
            <a key={w.name} href={w.link} target="_blank" rel="noopener noreferrer"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', background: w.recommend ? 'rgba(124,58,237,0.08)' : '#0a0a0f', border: `1px solid ${w.recommend ? 'rgba(124,58,237,0.3)' : '#1e1e30'}`, borderRadius: '12px', padding: '12px 16px', transition: 'border-color 0.15s' }}>
              <span style={{ fontSize: '1.6rem' }}>{w.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.92rem' }}>{w.name}</span>
                  {w.recommend && <span style={{ fontSize: '0.6rem', background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '4px', padding: '1px 6px', fontWeight: 700 }}>RECOMMENDED</span>}
                </div>
                <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '2px' }}>{w.desc}</p>
              </div>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>↗</span>
            </a>
          ))}
        </div>
      </div>
    ),
  },
  {
    step: '02',
    title: 'Get USDT',
    color: '#22c55e',
    content: (
      <div>
        <p style={{ color: '#94a3b8', marginBottom: '16px', lineHeight: 1.6 }}>
          USDT (Tether) is a stablecoin worth $1 USD. You need it to pay entry fees. You can buy it on any exchange and send it to your wallet.
        </p>
        <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
          {[
            { name: 'Binance',  desc: 'Buy USDT with card or bank transfer' },
            { name: 'Coinbase', desc: 'Buy USDT, easy for beginners' },
            { name: 'Bybit',    desc: 'Low fees, wide network support' },
            { name: 'KuCoin',   desc: 'Supports many chains' },
          ].map(e => (
            <div key={e.name} style={{ background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.9rem' }}>{e.name}</span>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{e.desc}</span>
            </div>
          ))}
        </div>
        <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px', padding: '12px 14px', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.6 }}>
          💡 <strong style={{ color: '#22c55e' }}>Tip:</strong> When withdrawing from an exchange, choose <strong style={{ color: '#e2e8f0' }}>Polygon</strong> or <strong style={{ color: '#e2e8f0' }}>Arbitrum</strong> network — fees are under $0.05.
        </div>
      </div>
    ),
  },
  {
    step: '03',
    title: 'Connect Your Wallet',
    color: '#06b6d4',
    content: (
      <div>
        <p style={{ color: '#94a3b8', marginBottom: '16px', lineHeight: 1.6 }}>
          Click the <strong style={{ color: '#e2e8f0' }}>Connect Wallet</strong> button in the top-right corner of the site.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { n: '1', t: 'Click "Connect Wallet" in the navbar' },
            { n: '2', t: 'Choose your wallet (MetaMask, WalletConnect, etc.)' },
            { n: '3', t: 'Approve the connection in your wallet app' },
            { n: '4', t: 'Your address appears in the top-right — you\'re in!' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.75rem', color: '#06b6d4' }}>{s.n}</div>
              <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.6, paddingTop: '4px' }}>{s.t}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    step: '04',
    title: 'Pick Your Network',
    color: '#f59e0b',
    content: (
      <div>
        <p style={{ color: '#94a3b8', marginBottom: '16px', lineHeight: 1.6 }}>
          Join Arena supports USDT on 6 different networks. Choose the one where you have USDT. We recommend Polygon or Arbitrum for low fees.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
          {NETWORKS.map(n => (
            <div key={n.name} style={{ background: n.rec ? 'rgba(245,158,11,0.06)' : '#0a0a0f', border: `1px solid ${n.rec ? 'rgba(245,158,11,0.2)' : '#1e1e30'}`, borderRadius: '10px', padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontSize: '1rem' }}>{n.icon}</span>
                <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.85rem' }}>{n.name}</span>
                {n.rec && <span style={{ fontSize: '0.55rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '3px', padding: '1px 4px', fontWeight: 700 }}>BEST</span>}
              </div>
              <p style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 700 }}>{n.gas} gas</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    step: '05',
    title: 'Join or Create a Room',
    color: '#ec4899',
    content: (
      <div>
        <p style={{ color: '#94a3b8', marginBottom: '16px', lineHeight: 1.6 }}>
          Go to a game lobby, pick your entry fee, and create or join a room. Your wallet will ask you to confirm a USDT transfer — that's your entry fee going to the pot.
        </p>
        <div style={{ display: 'grid', gap: '8px' }}>
          {[
            { icon: '🏠', label: 'Create Room', desc: 'Set entry fee & max players. Share the room code with friends.' },
            { icon: '🚪', label: 'Join Room',   desc: 'Browse open rooms or paste a room code from a friend.' },
            { icon: '💳', label: 'Pay Entry',   desc: 'Confirm the USDT transfer in MetaMask. Game starts when enough players join.' },
          ].map(i => (
            <div key={i.label} style={{ display: 'flex', gap: '12px', background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: '10px', padding: '12px 14px' }}>
              <span style={{ fontSize: '1.3rem' }}>{i.icon}</span>
              <div>
                <p style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.88rem' }}>{i.label}</p>
                <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '2px', lineHeight: 1.5 }}>{i.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    step: '06',
    title: 'Play & Win',
    color: '#22c55e',
    content: (
      <div>
        <p style={{ color: '#94a3b8', marginBottom: '16px', lineHeight: 1.6 }}>
          Answer math questions faster than your opponents. Each correct answer = 1 point. After 10 rounds, highest score wins the pot.
        </p>
        <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
          {[
            { icon: '⏱️', label: '12 seconds',        desc: 'per question — speed matters' },
            { icon: '✅', label: 'First correct wins', desc: 'everyone can answer, fastest gets the point' },
            { icon: '🏆', label: '85% of pot',         desc: 'goes to the winner' },
            { icon: '💰', label: '15% platform fee',   desc: 'kept by Join Arena' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: '10px', padding: '10px 14px' }}>
              <span style={{ fontSize: '1.1rem' }}>{r.icon}</span>
              <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.88rem', minWidth: '140px' }}>{r.label}</span>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{r.desc}</span>
            </div>
          ))}
        </div>
        <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px', padding: '12px 14px' }}>
          <p style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.6 }}>
            💡 <strong style={{ color: '#22c55e' }}>Example:</strong> 4 players join a $5 room → pot = $20 → winner gets <strong style={{ color: '#22c55e' }}>$17 USDT</strong>
          </p>
        </div>
      </div>
    ),
  },
]

const FAQS = [
  { q: 'Is it safe to connect my wallet?', a: 'Yes. Join Arena only requests permission to read your address and send USDT. We never ask for your private key or seed phrase. Never share those with anyone.' },
  { q: 'What if I lose the game?', a: 'Your entry fee goes to the winner. Only enter amounts you\'re comfortable losing. Start with the $0.50 or $1 rooms to get a feel for it.' },
  { q: 'How do I get my winnings?', a: 'Winnings are sent directly to your wallet address after the game ends. No need to withdraw or claim anything.' },
  { q: 'What if the game disconnects?', a: 'If you disconnect mid-game, you forfeit that round but your score is kept. Reconnect using the room code. If the server crashes, contact us for a refund.' },
  { q: 'Do I need to be on a specific network?', a: 'No! Pick any of the 6 supported networks in the lobby. Your wallet will switch automatically when you pay.' },
  { q: 'Can I play for free first?', a: 'Yes — use Practice vs Bot mode from the home page. No wallet needed, no money involved, full game experience.' },
  { q: 'What is USDT?', a: 'USDT (Tether) is a stablecoin always worth $1 USD. It\'s the most popular crypto dollar and available on every major exchange.' },
]

export default function Guide() {
  const navigate = useNavigate()

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: 'clamp(24px,4vw,48px) clamp(16px,4vw,24px)' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '20px', padding: '6px 16px', marginBottom: '20px', fontSize: '0.78rem', color: '#a78bfa', fontWeight: 700, letterSpacing: '0.05em' }}>
          📖 GETTING STARTED
        </div>
        <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 900, background: 'linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '12px' }}>
          How to Play
        </h1>
        <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: '480px', margin: '0 auto', lineHeight: 1.6 }}>
          Everything you need to know to start playing and winning USDT in minutes.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '24px' }}>
          <button onClick={() => navigate('/game/practice', { state: { bot: true, entry: 0 } })}
            style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '10px', padding: '10px 22px', color: '#a78bfa', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
            🤖 Try Free Practice
          </button>
          <button onClick={() => navigate('/lobby/math-arena')}
            style={{ background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', border: 'none', borderRadius: '10px', padding: '10px 22px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
            Play for Real →
          </button>
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '56px' }}>
        {STEPS.map((s) => (
          <div key={s.step} style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 24px', borderBottom: '1px solid #1e1e30', background: `linear-gradient(135deg, ${s.color}0a, transparent)` }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: '1.4rem', color: s.color, opacity: 0.5, minWidth: '44px' }}>{s.step}</div>
              <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1rem', color: '#e2e8f0' }}>{s.title}</h2>
              <div style={{ marginLeft: 'auto', width: '8px', height: '8px', borderRadius: '50%', background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
            </div>
            <div style={{ padding: '20px 24px' }}>{s.content}</div>
          </div>
        ))}
      </div>

      {/* ── Game Guides ── */}
      <div style={{ marginBottom: '56px' }}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: '20px', padding: '6px 16px', marginBottom: '16px', fontSize: '0.78rem', color: '#06b6d4', fontWeight: 700, letterSpacing: '0.05em' }}>
            🎮 GAME GUIDES
          </div>
          <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 'clamp(1.2rem,3vw,1.8rem)', color: '#e2e8f0' }}>All 6 Games Explained</h2>
          <p style={{ color: '#64748b', marginTop: '8px', fontSize: '0.9rem' }}>Pure skill, zero luck. Every game has a winning strategy.</p>
        </div>

        {/* Math Arena */}
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #1e1e30', background: 'rgba(124,58,237,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, color: '#a78bfa', fontSize: '1rem' }}>✚</div>
            <div>
              <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: '#e2e8f0' }}>Math Arena</h3>
              <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>Speed math · 10 rounds · 12s each</p>
            </div>
            <button onClick={() => navigate('/lobby/math-arena')} style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', border: 'none', borderRadius: '8px', padding: '7px 16px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Play →</button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '16px' }}>
              A math question appears (+, −, ×). Every player sees the same question simultaneously. Type your answer and hit Enter as fast as possible — <strong style={{ color: '#e2e8f0' }}>first correct answer wins the round</strong>. 10 rounds total; highest score takes the pot.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginBottom: '12px' }}>
              {[
                { label: 'Round time', value: '12 seconds' },
                { label: 'Rounds', value: '10 per game' },
                { label: 'Win condition', value: 'Highest score' },
                { label: 'Tie break', value: 'Sudden death +1' },
              ].map(r => (
                <div key={r.label} style={{ background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{r.label}</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.8rem' }}>{r.value}</span>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem', color: '#94a3b8' }}>
              💡 <strong style={{ color: '#a78bfa' }}>Pro tip:</strong> Wrong answers have no penalty — submit your best guess even if unsure. Memorise ×9 and ×12 tables.
            </div>
          </div>
        </div>

        {/* Pattern Memory */}
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #1e1e30', background: 'rgba(168,85,247,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🧠</div>
            <div>
              <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: '#e2e8f0' }}>Pattern Memory</h3>
              <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>Flash tiles · 10 rounds · memorize &amp; tap</p>
            </div>
            <button onClick={() => navigate('/lobby/pattern-memory')} style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#a855f7,#7c3aed)', border: 'none', borderRadius: '8px', padding: '7px 16px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Play →</button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '16px' }}>
              A digit sequence flashes on screen (e.g. <strong style={{ color: '#a855f7', fontFamily: 'Orbitron, sans-serif' }}>4 7 2 9</strong>) for 3 seconds, then vanishes. Type it from memory before anyone else to score. Sequences grow longer as rounds progress.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginBottom: '12px' }}>
              {[
                { label: 'Display time', value: '3 seconds' },
                { label: 'Sequence length', value: '3–6 digits' },
                { label: 'Win condition', value: 'First correct' },
                { label: 'Rounds', value: '10' },
              ].map(r => (
                <div key={r.label} style={{ background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{r.label}</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.8rem' }}>{r.value}</span>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem', color: '#94a3b8' }}>
              💡 <strong style={{ color: '#a855f7' }}>Pro tip:</strong> Group digits into pairs as you read (e.g. 47 29). Your brain stores chunks better than individual numbers.
            </div>
          </div>
        </div>

        {/* Reaction Grid */}
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #1e1e30', background: 'rgba(34,197,94,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, color: '#22c55e', fontSize: '1rem' }}>⊞</div>
            <div>
              <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: '#e2e8f0' }}>Reaction Grid</h3>
              <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>Click the lit cell · 10 rounds · 8s each</p>
            </div>
            <button onClick={() => navigate('/lobby/reaction-grid')} style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#22c55e,#06b6d4)', border: 'none', borderRadius: '8px', padding: '7px 16px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Play →</button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '16px' }}>
              A 4×4 grid appears. One random cell lights up purple. Click it before anyone else. Pure reaction speed — no knowledge required. First click wins the round.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginBottom: '12px' }}>
              {[
                { label: 'Grid size', value: '4×4 (16 cells)' },
                { label: 'Round time', value: '8 seconds' },
                { label: 'Target', value: 'Random cell' },
                { label: 'Win condition', value: 'First to click' },
              ].map(r => (
                <div key={r.label} style={{ background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{r.label}</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.8rem' }}>{r.value}</span>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem', color: '#94a3b8' }}>
              💡 <strong style={{ color: '#22c55e' }}>Pro tip:</strong> Keep your mouse near the center of the grid. Desktop has ~50ms lower latency than mobile — play on a laptop if you can.
            </div>
          </div>
        </div>

        {/* Highest Unique */}
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #1e1e30', background: 'rgba(245,158,11,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, color: '#f59e0b', fontSize: '1.1rem' }}>↑</div>
            <div>
              <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: '#e2e8f0' }}>Highest Unique</h3>
              <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>Sealed bid · 5 rounds · 20s to submit</p>
            </div>
            <button onClick={() => navigate('/lobby/highest-unique')} style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', borderRadius: '8px', padding: '7px 16px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Play →</button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '16px' }}>
              Each round, everyone secretly picks a number between 1 and the player count. After time is up, picks are revealed. The player who picked the <strong style={{ color: '#f59e0b' }}>highest number that nobody else also picked</strong> wins the round. Read the crowd — avoid obvious picks.
            </p>
            <div style={{ background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
              <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.68rem', color: '#64748b', letterSpacing: '0.08em', marginBottom: '10px' }}>EXAMPLE (4 players)</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '8px' }}>
                {[['Alice','4'],['Bob','4'],['Carol','3'],['Dave','2']].map(([name,pick]) => (
                  <div key={name} style={{ textAlign: 'center', background: '#12121a', borderRadius: '6px', padding: '8px 4px' }}>
                    <p style={{ color: '#64748b', fontSize: '0.65rem' }}>{name}</p>
                    <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, color: pick === '4' ? '#ef4444' : pick === '3' ? '#22c55e' : '#94a3b8', fontSize: '1.1rem' }}>{pick}</p>
                  </div>
                ))}
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.78rem' }}>→ Alice & Bob both picked 4 (eliminated). Carol picked 3 uniquely — <strong style={{ color: '#22c55e' }}>Carol wins!</strong></p>
            </div>
            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem', color: '#94a3b8' }}>
              💡 <strong style={{ color: '#f59e0b' }}>Pro tip:</strong> In large rooms, avoid the maximum number — everyone wants it. Second-highest is often the sweet spot.
            </div>
          </div>
        </div>

        {/* Lowest Unique */}
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #1e1e30', background: 'rgba(239,68,68,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, color: '#ef4444', fontSize: '1.1rem' }}>↓</div>
            <div>
              <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: '#e2e8f0' }}>Lowest Unique</h3>
              <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>Sealed bid · 5 rounds · 20s to submit</p>
            </div>
            <button onClick={() => navigate('/lobby/lowest-unique')} style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#ef4444,#f59e0b)', border: 'none', borderRadius: '8px', padding: '7px 16px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Play →</button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '16px' }}>
              Same as Highest Unique but in reverse. Pick the <strong style={{ color: '#ef4444' }}>lowest number that nobody else picks</strong>. Everyone wants to go low, so picking 1 is tempting but extremely risky. Think like a contrarian.
            </p>
            <div style={{ background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
              <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.68rem', color: '#64748b', letterSpacing: '0.08em', marginBottom: '10px' }}>EXAMPLE (4 players)</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '8px' }}>
                {[['Alice','1'],['Bob','1'],['Carol','2'],['Dave','3']].map(([name,pick]) => (
                  <div key={name} style={{ textAlign: 'center', background: '#12121a', borderRadius: '6px', padding: '8px 4px' }}>
                    <p style={{ color: '#64748b', fontSize: '0.65rem' }}>{name}</p>
                    <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, color: pick === '1' ? '#ef4444' : pick === '2' ? '#22c55e' : '#94a3b8', fontSize: '1.1rem' }}>{pick}</p>
                  </div>
                ))}
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.78rem' }}>→ Alice & Bob both picked 1 (eliminated). Carol picked 2 uniquely — <strong style={{ color: '#22c55e' }}>Carol wins!</strong></p>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem', color: '#94a3b8' }}>
              💡 <strong style={{ color: '#ef4444' }}>Pro tip:</strong> Everyone's instinct is to pick 1. Pick 2 or 3 — the sweet spot where uniqueness is far more likely.
            </div>
          </div>
        </div>

        {/* Liar's Dice */}
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #1e1e30', background: 'rgba(249,115,22,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🎲</div>
            <div>
              <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: '#e2e8f0' }}>Liar's Dice</h3>
              <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>Bluff · 8 rounds · 60s each</p>
            </div>
            <button onClick={() => navigate('/lobby/liars-dice')} style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: '8px', padding: '7px 16px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Play →</button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '16px' }}>
              Each player gets <strong style={{ color: '#f97316' }}>3 private dice</strong>. On your turn, bid "there are at least X dice showing face Y across all players' dice." Each bid must be higher than the last. At any point, <strong style={{ color: '#f97316' }}>CALL LIAR!</strong> on the current bid — all dice are revealed. If the bid was too high, the bidder loses. If the count holds, the challenger loses.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginBottom: '12px' }}>
              {[
                { label: 'Dice per player', value: '3' },
                { label: 'Max players', value: '6' },
                { label: 'Win condition', value: 'Catch the bluff' },
                { label: 'Rounds', value: '8' },
              ].map(r => (
                <div key={r.label} style={{ background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{r.label}</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.8rem' }}>{r.value}</span>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem', color: '#94a3b8' }}>
              💡 <strong style={{ color: '#f97316' }}>Pro tip:</strong> Use your own dice as a baseline — if you have two 4s, there's likely more 4s at the table. Call LIAR! when the bid exceeds the total dice count or feels statistically impossible.
            </div>
          </div>
        </div>

        {/* Payout table */}
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e1e30' }}>
            <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: '#64748b', letterSpacing: '0.1em' }}>PAYOUT EXAMPLES</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e1e30' }}>
                  {['Players', 'Entry Fee', 'Total Pot', 'Winner Gets (85%)', 'Platform Fee'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  [2,  0.5],
                  [4,  1],
                  [5,  2],
                  [10, 5],
                  [5,  10],
                  [10, 25],
                ].map(([players, fee]) => {
                  const pot     = players * fee
                  const winner  = (pot * 0.85).toFixed(2)
                  const rake    = (pot * 0.15).toFixed(2)
                  return (
                    <tr key={`${players}-${fee}`} style={{ borderBottom: '1px solid #0d0d14' }}>
                      <td style={{ padding: '11px 16px', color: '#94a3b8', fontSize: '0.85rem' }}>{players}</td>
                      <td style={{ padding: '11px 16px', color: '#94a3b8', fontSize: '0.85rem' }}>${fee}</td>
                      <td style={{ padding: '11px 16px', fontWeight: 700, color: '#e2e8f0', fontSize: '0.85rem' }}>${pot}</td>
                      <td style={{ padding: '11px 16px', fontFamily: 'Orbitron, sans-serif', fontWeight: 700, color: '#22c55e', fontSize: '0.85rem' }}>${winner}</td>
                      <td style={{ padding: '11px 16px', color: '#64748b', fontSize: '0.82rem' }}>${rake}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1.1rem', marginBottom: '20px', color: '#e2e8f0', textAlign: 'center' }}>
          Frequently Asked Questions
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {FAQS.map(f => (
            <details key={f.q} style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '12px', padding: '0' }}>
              <summary style={{ padding: '14px 20px', cursor: 'pointer', fontWeight: 600, color: '#e2e8f0', fontSize: '0.92rem', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}>
                {f.q}
                <span style={{ color: '#64748b', fontSize: '1rem', flexShrink: 0, marginLeft: '12px' }}>＋</span>
              </summary>
              <div style={{ padding: '0 20px 16px', color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.7, borderTop: '1px solid #1e1e30', paddingTop: '12px' }}>
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.06))', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '20px', padding: '32px', textAlign: 'center' }}>
        <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1.1rem', marginBottom: '8px' }}>Ready to Play?</h3>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' }}>Start with free practice, then move to real USDT games when you're confident.</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/game/practice', { state: { bot: true, entry: 0 } })}
            style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '10px', padding: '11px 24px', color: '#a78bfa', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
            Practice Free
          </button>
          <button onClick={() => navigate('/lobby/math-arena')}
            style={{ background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', border: 'none', borderRadius: '10px', padding: '11px 24px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 0 20px rgba(124,58,237,0.3)' }}>
            Play for Real →
          </button>
        </div>
      </div>
    </div>
  )
}
