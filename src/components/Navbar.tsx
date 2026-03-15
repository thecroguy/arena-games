import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'

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
  const [open, setOpen] = useState(false)

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
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <span style={{
            fontFamily: 'Orbitron, sans-serif', fontWeight: 900,
            fontSize: 'clamp(0.85rem, 3vw, 1.1rem)',
            background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            letterSpacing: '0.05em', whiteSpace: 'nowrap',
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
          <div style={{ marginLeft: '8px' }}>
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

      {/* Mobile dropdown */}
      {open && (
        <div
          style={{
            position: 'fixed', top: '60px', left: 0, right: 0, zIndex: 99,
            background: 'rgba(10,10,15,0.98)', backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(124,58,237,0.15)',
            padding: '16px',
          }}
          className="mobile-nav"
        >
          {/* Wallet connect at top of dropdown */}
          <div style={{ marginBottom: '12px', padding: '0 4px' }}>
            <ConnectButton chainStatus="full" accountStatus="full" showBalance={false} />
          </div>
          <div style={{ height: '1px', background: '#1e1e30', marginBottom: '10px' }} />
          {NAV_LINKS.map(({ to, label, icon }) => {
            const active = pathname === to
            return (
              <Link key={to} to={to} onClick={() => setOpen(false)} style={{
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 14px', borderRadius: '10px', marginBottom: '4px',
                background: active ? 'rgba(124,58,237,0.12)' : 'transparent',
                border: `1px solid ${active ? 'rgba(124,58,237,0.3)' : 'transparent'}`,
                color: active ? '#a78bfa' : '#94a3b8',
                fontWeight: 600, fontSize: '0.95rem',
              }}>
                <span style={{ width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
                {label}
                {active && <span style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: '#7c3aed', display: 'block' }} />}
              </Link>
            )
          })}
        </div>
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
