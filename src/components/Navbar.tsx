import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

function IconGames({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="6" height="6" rx="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" />
    </svg>
  )
}
function IconTrophy({ size = 16 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 -960 960 960" width={size} fill="#F19E39">
      <path d="M536.5-543.5Q560-567 560-600t-23.5-56.5Q513-680 480-680t-56.5 23.5Q400-633 400-600t23.5 56.5Q447-520 480-520t56.5-23.5ZM280-120v-80h160v-124q-49-11-87.5-41.5T296-442q-75-9-125.5-65.5T120-640v-40q0-33 23.5-56.5T200-760h80v-80h400v80h80q33 0 56.5 23.5T840-680v40q0 76-50.5 132.5T664-442q-18 46-56.5 76.5T520-324v124h160v80H280Zm0-408v-152h-80v40q0 38 22 68.5t58 43.5Zm285 93q35-35 35-85v-240H360v240q0 50 35 85t85 35q50 0 85-35Zm115-93q36-13 58-43.5t22-68.5v-40h-80v152Zm-200-52Z"/>
    </svg>
  )
}
function IconBook({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3c-1.5-1-3.5-1-5-1v11c1.5 0 3.5 0 5 1 1.5-1 3.5-1 5-1V2c-1.5 0-3.5 0-5 1Z" />
      <line x1="8" y1="3" x2="8" y2="14" />
    </svg>
  )
}
function IconPerson({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="5" r="3" />
      <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    </svg>
  )
}

const NAV_LINKS = [
  { to: '/',            label: 'Games',   icon: <IconGames size={16} /> },
  { to: '/leaderboard', label: 'Board',   icon: <IconTrophy size={16} /> },
  { to: '/guide',       label: 'Guide',   icon: <IconBook size={16} /> },
  { to: '/profile',     label: 'Profile', icon: <IconPerson size={16} /> },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { address } = useAccount()
  const [open, setOpen] = useState(false)
  const [activeRoom, setActiveRoom] = useState('')

  // Fetch active room from server on mount and poll every 10s
  useEffect(() => {
    if (!address) { setActiveRoom(''); return }
    let cancelled = false
    function fetchRoom() {
      fetch(`${SERVER_URL}/api/active-room/${address}`)
        .then(r => r.json())
        .then(data => { if (!cancelled) setActiveRoom(data.code || '') })
        .catch(() => {})
    }
    fetchRoom()
    const t = setInterval(fetchRoom, 10000)
    return () => { cancelled = true; clearInterval(t) }
  }, [address])

  const onGamePage = pathname.startsWith('/game/')

  return (
    <>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(12px, 4vw, 28px)', height: '60px',
        background: 'rgba(10,10,15,0.6)', backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        borderBottom: '1px solid rgba(124,58,237,0.12)',
        position: 'sticky', top: 0, zIndex: 100,
        minWidth: 0, overflow: 'hidden',
      }}>
        <Link to="/" style={{ textDecoration: 'none', flexShrink: 0, display:'flex', alignItems:'center', gap:'9px' }}>
          <style>{`
            @keyframes helm-cycle {
              0%   { filter: hue-rotate(0deg)   saturate(2.0) brightness(1.2)  drop-shadow(0 0 8px rgba(251,191,36,0.8)) }
              20%  { filter: hue-rotate(-25deg) saturate(2.4) brightness(1.3)  drop-shadow(0 0 14px rgba(239,68,68,0.9)) }
              45%  { filter: hue-rotate(210deg) saturate(2.2) brightness(1.25) drop-shadow(0 0 10px rgba(124,58,237,0.9)) }
              70%  { filter: hue-rotate(155deg) saturate(2.0) brightness(1.2)  drop-shadow(0 0 12px rgba(6,182,212,0.85)) }
              100% { filter: hue-rotate(0deg)   saturate(2.0) brightness(1.2)  drop-shadow(0 0 8px rgba(251,191,36,0.8)) }
            }
            @keyframes helm-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
            .arena-helm { animation: helm-cycle 5s ease-in-out infinite, helm-bob 3s ease-in-out infinite; }
            @media (hover: hover) { .arena-logo-wrap:hover .arena-helm { animation-duration: 1.4s, 0.8s; } }
          `}</style>
          {/* Spartan Helmet SVG — Corinthian style */}
          <div className="arena-logo-wrap" style={{ display:'flex', alignItems:'center' }}>
            <svg className="arena-helm" width="30" height="38" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="hg1" x1="0" y1="0" x2="0.6" y2="1">
                  <stop offset="0%" stopColor="#fde68a"/>
                  <stop offset="35%" stopColor="#f59e0b"/>
                  <stop offset="100%" stopColor="#92400e"/>
                </linearGradient>
                <linearGradient id="hg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fef9c3"/>
                  <stop offset="100%" stopColor="#f59e0b"/>
                </linearGradient>
                <linearGradient id="hgrim" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#92400e"/>
                  <stop offset="50%" stopColor="#f59e0b"/>
                  <stop offset="100%" stopColor="#92400e"/>
                </linearGradient>
              </defs>

              {/* Plume crest — tall, proud */}
              <rect x="17" y="0" width="6" height="4" rx="3" fill="url(#hg2)" opacity="0.98"/>
              <path d="M20 3 C13 4 9 9 10 17" stroke="url(#hg2)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <path d="M20 3 C17 8 17 13 18 18" stroke="url(#hg2)" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.75"/>
              <path d="M20 3 C23 6 24 10 23 16" stroke="url(#hg2)" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.45"/>

              {/* Main dome — wide Corinthian curve */}
              <path d="M4 24 C4 11 9 3 20 3 C31 3 36 11 36 24 L36 29 C36 33 32 36 20 36 C8 36 4 33 4 29 Z" fill="url(#hg1)" opacity="0.97"/>

              {/* Cheek plates — sweep down and inward */}
              <path d="M4 27 L4 37 C4 40 7 43 10 43 L30 43 C33 43 36 40 36 37 L36 27" fill="url(#hg1)" opacity="0.68"/>

              {/* Neck guard / chin bar — the solid Spartan bottom */}
              <rect x="4" y="41" width="32" height="5" rx="2" fill="url(#hgrim)" opacity="0.85"/>

              {/* Face opening — iconic Corinthian T-shape cutout */}
              {/* Brow bar (top of T) */}
              <rect x="8" y="18" width="24" height="4" rx="2" fill="#08080f"/>
              {/* Nasal / nose guard going down */}
              <rect x="18" y="18" width="4" height="18" rx="2" fill="#08080f"/>
              {/* Lower cheek openings */}
              <rect x="8"  y="22" width="8" height="14" rx="2" fill="#08080f"/>
              <rect x="24" y="22" width="8" height="14" rx="2" fill="#08080f"/>

              {/* Eye glow inside brow openings */}
              <rect x="9"  y="19" width="7.5" height="2.5" rx="1.2" fill="url(#hg2)" opacity="0.9"/>
              <rect x="23.5" y="19" width="7.5" height="2.5" rx="1.2" fill="url(#hg2)" opacity="0.9"/>

              {/* Edge trim lines for depth */}
              <path d="M4 24 C4 11 9 3 20 3 C31 3 36 11 36 24" stroke="rgba(254,243,199,0.18)" strokeWidth="1" fill="none"/>

              {/* Highlight glint on dome */}
              <path d="M10 8 C12 6 15 4 18 4" stroke="rgba(255,255,255,0.38)" strokeWidth="1.8" strokeLinecap="round"/>

              {/* Rivet details */}
              <circle cx="6"  cy="30" r="1.2" fill="rgba(255,255,255,0.22)"/>
              <circle cx="34" cy="30" r="1.2" fill="rgba(255,255,255,0.22)"/>
              <circle cx="6"  cy="38" r="1"   fill="rgba(255,255,255,0.18)"/>
              <circle cx="34" cy="38" r="1"   fill="rgba(255,255,255,0.18)"/>
            </svg>
          </div>
          <span style={{
            fontFamily: 'Orbitron, sans-serif', fontWeight: 900,
            fontSize: 'clamp(0.8rem, 3vw, 1.05rem)',
            background: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 40%, #ef4444 75%, #7c3aed 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            letterSpacing: '0.06em', whiteSpace: 'nowrap',
          }}>
            JOIN ARENA
          </span>
        </Link>

        {/* Desktop nav */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} className="desktop-nav">
          {NAV_LINKS.map(({ to, label }) => {
            const active = pathname === to
            return (
              <Link key={to} to={to} style={{
                textDecoration: 'none', fontWeight: 600,
                fontSize: '0.88rem', padding: '6px 14px', borderRadius: '8px',
                color: active ? '#a78bfa' : '#64748b',
                background: active ? 'rgba(124,58,237,0.12)' : 'transparent',
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}>
                {label}
              </Link>
            )
          })}
          <div style={{ marginLeft: '4px' }}>
            <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
          </div>
        </div>

        {/* Mobile: hamburger only (wallet is in dropdown) */}
        <button
          className="mobile-nav"
          onClick={() => setOpen(o => !o)}
          style={{
            background: open ? 'rgba(124,58,237,0.2)' : 'transparent',
            border: `1px solid ${open ? '#7c3aed' : '#1e1e30'}`,
            borderRadius: '8px', padding: '8px 10px', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0,
          }}
          aria-label="Menu"
        >
          <span style={{ display: 'block', width: '18px', height: '2px', background: open ? '#a78bfa' : '#64748b', borderRadius: '2px', transition: 'all 0.2s', transform: open ? 'rotate(45deg) translate(4px, 4px)' : 'none' }} />
          <span style={{ display: 'block', width: '18px', height: '2px', background: open ? '#a78bfa' : '#64748b', borderRadius: '2px', transition: 'all 0.2s', opacity: open ? 0 : 1 }} />
          <span style={{ display: 'block', width: '18px', height: '2px', background: open ? '#a78bfa' : '#64748b', borderRadius: '2px', transition: 'all 0.2s', transform: open ? 'rotate(-45deg) translate(4px, -4px)' : 'none' }} />
        </button>
      </nav>

      {/* Active room banner — shown on every page except the game page itself */}
      {activeRoom && !onGamePage && (
        <div style={{
          background: 'rgba(34,197,94,0.08)', borderBottom: '1px solid rgba(34,197,94,0.2)',
          padding: '8px clamp(12px,4vw,28px)', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '12px', zIndex: 98,
        }}>
          <span style={{ color: '#22c55e', fontSize: '0.82rem', fontWeight: 600 }}>
            🎮 Active room: <strong style={{ fontFamily: 'Orbitron, sans-serif' }}>{activeRoom}</strong>
          </span>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button onClick={() => { navigate(`/game/${activeRoom}`); setOpen(false) }}
              style={{ background: '#22c55e', border: 'none', borderRadius: '6px', padding: '5px 12px', color: '#0a0a0f', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
              Return →
            </button>
            <button onClick={() => { setActiveRoom('') }}
              style={{ background: 'none', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', padding: '5px 8px', color: '#64748b', fontSize: '0.78rem', cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Mobile drawer — slides in from the right */}
      <style>{`
        @keyframes drawer-in  { from { transform: translateX(100%) } to { transform: translateX(0) } }
        @keyframes overlay-in { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            className="mobile-nav"
            style={{
              position: 'fixed', inset: 0, zIndex: 98,
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
              animation: 'overlay-in 0.2s ease-out',
            }}
          />
          {/* Drawer panel */}
          <div
            className="mobile-nav"
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width: '280px', zIndex: 99,
              background: 'linear-gradient(180deg, #0c0c17 0%, #08080f 100%)',
              borderLeft: '1px solid rgba(124,58,237,0.2)',
              display: 'flex', flexDirection: 'column',
              animation: 'drawer-in 0.22s cubic-bezier(0.22,1,0.36,1)',
              boxShadow: '-20px 0 60px rgba(0,0,0,0.6)',
            }}
          >
            {/* Drawer header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid rgba(124,58,237,0.1)' }}>
              <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.65rem', fontWeight: 700, color: '#374151', letterSpacing: '0.12em' }}>MENU</span>
              <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1e1e30', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '1rem' }}>
                ✕
              </button>
            </div>

            {/* Wallet */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(124,58,237,0.08)' }}>
              <ConnectButton chainStatus="full" accountStatus="full" showBalance={false} />
            </div>

            {/* Nav links */}
            <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {NAV_LINKS.map(({ to, label, icon }) => {
                const active = pathname === to
                return (
                  <Link key={to} to={to} onClick={() => setOpen(false)} style={{
                    textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '13px 16px', borderRadius: '12px',
                    background: active ? 'rgba(124,58,237,0.14)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(124,58,237,0.28)' : 'transparent'}`,
                    color: active ? '#a78bfa' : '#64748b',
                    fontWeight: 600, fontSize: '0.92rem', transition: 'all 0.14s',
                  }}>
                    <span style={{ width: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: active ? 1 : 0.6 }}>{icon}</span>
                    {label}
                    {active && <span style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: '#7c3aed', boxShadow: '0 0 8px #7c3aed', display: 'block' }} />}
                  </Link>
                )
              })}

            </div>

            {/* Footer */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(124,58,237,0.08)' }}>
              <div style={{ fontSize: '0.58rem', color: '#1e2030', fontFamily: 'Orbitron,sans-serif', letterSpacing: '0.1em', textAlign: 'center' }}>JOIN ARENA · POLYGON · BSC · ETH</div>
            </div>
          </div>
        </>
      )}

      <style>{`
        .desktop-nav { display: flex !important; }
        .mobile-nav  { display: none  !important; }
        @media (max-width: 640px) {
          .desktop-nav { display: none  !important; }
          .mobile-nav  { display: flex  !important; }
        }
        /* Mobile dropdown override (it's a div, not button) */
        @media (max-width: 640px) {
          div.mobile-nav { display: block !important; }
        }
      `}</style>

    </>
  )
}
