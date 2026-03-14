import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'

const NAV_LINKS = [
  { to: '/', label: 'Games' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/profile', label: 'Profile' },
]

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      height: '64px',
      background: '#0d0d14',
      borderBottom: '1px solid #1e1e30',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <Link to="/" style={{ textDecoration: 'none' }}>
        <span style={{
          fontFamily: 'Orbitron, sans-serif',
          fontWeight: 900,
          fontSize: '1.25rem',
          background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          ARENA GAMES
        </span>
      </Link>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        {NAV_LINKS.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            style={{
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              letterSpacing: '0.05em',
              color: pathname === to ? '#7c3aed' : '#94a3b8',
              transition: 'color 0.2s',
            }}
          >
            {label}
          </Link>
        ))}
        <ConnectButton
          chainStatus="icon"
          accountStatus="address"
          showBalance={false}
        />
      </div>
    </nav>
  )
}
