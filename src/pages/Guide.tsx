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
          A crypto wallet is your account. It holds your USDT and lets you sign into Arena Games. No email or password needed.
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
          Arena Games supports USDT on 6 different networks. Choose the one where you have USDT. We recommend Polygon or Arbitrum for low fees.
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
            { icon: '💰', label: '15% platform fee',   desc: 'kept by Arena Games' },
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
  { q: 'Is it safe to connect my wallet?', a: 'Yes. Arena Games only requests permission to read your address and send USDT. We never ask for your private key or seed phrase. Never share those with anyone.' },
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
        {STEPS.map((s, i) => (
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

      {/* ── Game Guide ── */}
      <div style={{ marginBottom: '56px' }}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: '20px', padding: '6px 16px', marginBottom: '16px', fontSize: '0.78rem', color: '#06b6d4', fontWeight: 700, letterSpacing: '0.05em' }}>
            🧮 GAME GUIDE
          </div>
          <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 'clamp(1.2rem,3vw,1.8rem)', color: '#e2e8f0' }}>Math Arena — How It Works</h2>
          <p style={{ color: '#64748b', marginTop: '8px', fontSize: '0.9rem' }}>Simple rules, pure skill, real money.</p>
        </div>

        {/* Round flow visual */}
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.72rem', color: '#64748b', letterSpacing: '0.1em', marginBottom: '20px' }}>A ROUND LOOKS LIKE THIS</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0', overflowX: 'auto', paddingBottom: '8px' }}>
            {[
              { icon: '3️⃣', label: 'Countdown',   sub: '3 · 2 · 1',          color: '#7c3aed' },
              { icon: '🧮', label: 'Question',    sub: '27 × 4 = ?',          color: '#06b6d4' },
              { icon: '⚡', label: 'Answer Fast',  sub: 'Type + press Enter',  color: '#f59e0b' },
              { icon: '✅', label: 'Score',        sub: '+1 if correct',        color: '#22c55e' },
              { icon: '🔁', label: 'Next Round',  sub: '10 rounds total',     color: '#a78bfa' },
              { icon: '🏆', label: 'Winner',      sub: 'Highest score wins',  color: '#f59e0b' },
            ].map((s, i, arr) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ textAlign: 'center', padding: '0 12px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: `${s.color}18`, border: `2px solid ${s.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', margin: '0 auto 8px' }}>{s.icon}</div>
                  <p style={{ fontWeight: 700, color: s.color, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{s.label}</p>
                  <p style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '2px', whiteSpace: 'nowrap' }}>{s.sub}</p>
                </div>
                {i < arr.length - 1 && <div style={{ width: '24px', height: '2px', background: '#1e1e30', flexShrink: 0 }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Question types */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {[
            { op: '+', label: 'Addition',       example: '34 + 17 = 51',  tip: 'Easiest — always go fast',        color: '#22c55e' },
            { op: '−', label: 'Subtraction',    example: '52 − 28 = 24',  tip: 'Watch for borrow carries',        color: '#06b6d4' },
            { op: '×', label: 'Multiplication', example: '7 × 8 = 56',    tip: 'Know your times tables to 12',    color: '#f59e0b' },
          ].map(q => (
            <div key={q.op} style={{ background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${q.color}18`, border: `1px solid ${q.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: '1.1rem', color: q.color }}>{q.op}</div>
                <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.9rem' }}>{q.label}</span>
              </div>
              <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '6px' }}>{q.example}</p>
              <p style={{ color: '#64748b', fontSize: '0.75rem' }}>💡 {q.tip}</p>
            </div>
          ))}
        </div>

        {/* Timer + scoring rules */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', padding: '20px' }}>
            <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: '#64748b', letterSpacing: '0.1em', marginBottom: '16px' }}>TIMER RULES</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { bar: '100%', color: '#22c55e', text: '12s — Full time, solve fast' },
                { bar: '50%',  color: '#f59e0b', text: '6s left — Yellow warning' },
                { bar: '25%',  color: '#ef4444', text: '3s left — Red, hurry up!' },
                { bar: '0%',   color: '#475569', text: '0s — Round ends, no points' },
              ].map(t => (
                <div key={t.text} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '48px', height: '5px', background: '#1e1e30', borderRadius: '3px', flexShrink: 0, overflow: 'hidden' }}>
                    <div style={{ width: t.bar, height: '100%', background: t.color, borderRadius: '3px' }} />
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{t.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', padding: '20px' }}>
            <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: '#64748b', letterSpacing: '0.1em', marginBottom: '16px' }}>SCORING RULES</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { icon: '✅', color: '#22c55e', text: 'Correct answer = +1 point' },
                { icon: '❌', color: '#ef4444', text: 'Wrong answer = 0 points (no penalty)' },
                { icon: '⏱️', color: '#64748b', text: 'No answer = 0 points' },
                { icon: '⚡', color: '#f59e0b', text: 'Speed doesn\'t add points, only first correct' },
                { icon: '🔟', color: '#a78bfa', text: '10 rounds total per game' },
              ].map(r => (
                <div key={r.text} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{r.icon}</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.5 }}>{r.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tiebreaker */}
        <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(124,58,237,0.06))', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '14px', padding: '20px 24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ fontSize: '1.3rem' }}>⚔️</span>
            <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: '#f59e0b' }}>Tiebreaker — Sudden Death</h3>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '12px' }}>
            If two or more players finish with the <strong style={{ color: '#e2e8f0' }}>same score</strong> after 10 rounds, they enter a <strong style={{ color: '#f59e0b' }}>sudden death tiebreaker</strong>. One extra question — whoever answers correctly first wins the entire pot. No more chances, first right answer takes all.
          </p>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {[
              { label: 'Same score?',       value: 'Tiebreaker triggered' },
              { label: 'Extra rounds',      value: '1 sudden death question' },
              { label: 'Winner condition',  value: 'First correct answer' },
            ].map(t => (
              <div key={t.label} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '8px 14px' }}>
                <p style={{ color: '#64748b', fontSize: '0.68rem', marginBottom: '2px' }}>{t.label}</p>
                <p style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.82rem' }}>{t.value}</p>
              </div>
            ))}
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

        {/* Strategy tips */}
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', padding: '20px 24px' }}>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: '#64748b', letterSpacing: '0.1em', marginBottom: '16px' }}>PRO TIPS</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            {[
              { icon: '⌨️', tip: 'Use a keyboard, not mobile — you\'ll answer 2× faster' },
              { icon: '🧠', tip: 'Memorise ×9 and ×12 tables — they appear often' },
              { icon: '🎯', tip: 'Submit even if unsure — wrong answers have no penalty' },
              { icon: '👀', tip: 'Watch the scoreboard live to know how close the game is' },
              { icon: '🤖', tip: 'Practice vs Bot first — bot has 70% accuracy, beat it first' },
              { icon: '💡', tip: 'Small rooms (2 players) have worst odds but highest pot ratio' },
            ].map(t => (
              <div key={t.tip} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: '#0a0a0f', borderRadius: '10px', padding: '10px 12px' }}>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{t.icon}</span>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.5 }}>{t.tip}</p>
              </div>
            ))}
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
