import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'

const NAV_LINKS = [
  { to: '/', label: 'Games' },
  { to: '/leaderboard', label: 'Board' },
  { to: '/profile', label: 'Profile' },
]

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', height: '60px',
      background: 'rgba(13,13,20,0.95)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid #1e1e30',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <Link to="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
        <span style={{
          fontFamily: 'Orbitron, sans-serif', fontWeight: 900,
          fontSize: 'clamp(0.9rem, 3vw, 1.2rem)',
          background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          ARENA GAMES
        </span>
      </Link>

      <div style={{ display: 'flex', gap: 'clamp(10px, 3vw, 24px)', alignItems: 'center' }}>
        {NAV_LINKS.map(({ to, label }) => (
          <Link key={to} to={to} style={{
            textDecoration: 'none', fontWeight: 600,
            fontSize: 'clamp(0.75rem, 2vw, 0.9rem)',
            color: pathname === to ? '#a78bfa' : '#64748b',
            transition: 'color 0.2s',
          }}>
            {label}
          </Link>
        ))}
        <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
      </div>
    </nav>
  )
}
