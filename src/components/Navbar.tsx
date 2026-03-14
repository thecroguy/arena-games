import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'

const NAV_LINKS = [
  { to: '/',            label: 'Games',    icon: '🎮' },
  { to: '/leaderboard', label: 'Board',    icon: '🏆' },
  { to: '/profile',     label: 'Profile',  icon: '👤' },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(16px, 4vw, 28px)', height: '60px',
        background: 'rgba(10,10,15,0.97)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(124,58,237,0.15)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <span style={{
            fontFamily: 'Orbitron, sans-serif', fontWeight: 900,
            fontSize: 'clamp(0.9rem, 3vw, 1.15rem)',
            background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            letterSpacing: '0.05em',
          }}>
            ARENA GAMES
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
                transition: 'all 0.15s',
              }}>
                {label}
              </Link>
            )
          })}
          <div style={{ marginLeft: '8px' }}>
            <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
          </div>
        </div>

        {/* Mobile: wallet + hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="mobile-nav">
          <ConnectButton chainStatus="none" accountStatus="avatar" showBalance={false} />
          <button
            onClick={() => setOpen(o => !o)}
            style={{ background: open ? 'rgba(124,58,237,0.2)' : 'transparent', border: `1px solid ${open ? '#7c3aed' : '#1e1e30'}`, borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}
            aria-label="Menu"
          >
            <span style={{ display: 'block', width: '18px', height: '2px', background: open ? '#a78bfa' : '#64748b', borderRadius: '2px', transition: 'all 0.2s', transform: open ? 'rotate(45deg) translate(4px, 4px)' : 'none' }} />
            <span style={{ display: 'block', width: '18px', height: '2px', background: open ? '#a78bfa' : '#64748b', borderRadius: '2px', transition: 'all 0.2s', opacity: open ? 0 : 1 }} />
            <span style={{ display: 'block', width: '18px', height: '2px', background: open ? '#a78bfa' : '#64748b', borderRadius: '2px', transition: 'all 0.2s', transform: open ? 'rotate(-45deg) translate(4px, -4px)' : 'none' }} />
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {open && (
        <div style={{
          position: 'fixed', top: '60px', left: 0, right: 0, zIndex: 99,
          background: 'rgba(10,10,15,0.98)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(124,58,237,0.15)',
          padding: '12px 16px 20px',
        }} className="mobile-nav">
          {NAV_LINKS.map(({ to, label, icon }) => {
            const active = pathname === to
            return (
              <Link key={to} to={to} onClick={() => setOpen(false)} style={{
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px',
                padding: '13px 16px', borderRadius: '10px', marginBottom: '4px',
                background: active ? 'rgba(124,58,237,0.12)' : 'transparent',
                border: `1px solid ${active ? 'rgba(124,58,237,0.3)' : 'transparent'}`,
                color: active ? '#a78bfa' : '#94a3b8',
                fontWeight: 600, fontSize: '0.95rem',
              }}>
                <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                {label}
                {active && <span style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: '#7c3aed' }} />}
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
      `}</style>
    </>
  )
}
