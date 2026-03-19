import { useEffect } from 'react'
import { Routes, Route, useSearchParams, Navigate } from 'react-router-dom'
import { useAccount, useSignMessage } from 'wagmi'
import Home from './pages/Home'
import Game from './pages/Game'
import Profile from './pages/Profile'
import Leaderboard from './pages/Leaderboard'
import Guide from './pages/Guide'
import DuelJoin from './pages/DuelJoin'
import Navbar from './components/Navbar'
import { useProfileSync } from './hooks/useProfileSync'

const SERVER_URL = import.meta.env.VITE_SOCKET_URL || ''

function AppInner() {
  useProfileSync()
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [searchParams] = useSearchParams()

  // Pre-generate auth sig silently when wallet connects — cached in localStorage forever.
  // This means the sign popup happens ONCE ever, not before every game action.
  useEffect(() => {
    if (!address) return
    const cacheKey = `ag_authsig_${address.toLowerCase()}`
    if (localStorage.getItem(cacheKey)) return // already cached
    // Small delay so wallet connection UI settles first
    const t = setTimeout(() => {
      signMessageAsync({ message: `Arena Games: ${address.toLowerCase()}` })
        .then(sig => localStorage.setItem(cacheKey, sig))
        .catch(() => {}) // user dismissed — will be asked again next game action
    }, 1500)
    return () => clearTimeout(t)
  }, [address])

  // Capture ?ref=CODE on first load and store in sessionStorage
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref && /^[A-Z0-9]{6,12}$/.test(ref)) {
      sessionStorage.setItem('ag_pending_ref', ref)
    }
  }, [])

  // Register referral when wallet connects
  useEffect(() => {
    if (!address) return
    const code = sessionStorage.getItem('ag_pending_ref')
    if (!code) return
    sessionStorage.removeItem('ag_pending_ref')
    fetch(`${SERVER_URL}/api/referral/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referee_address: address, referral_code: code }),
    }).catch(() => {})
  }, [address])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lobby/:gameMode" element={<Navigate to="/" replace />} />
          <Route path="/game/:roomCode" element={<Game />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/r/:roomCode" element={<DuelJoin />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return <AppInner />
}

