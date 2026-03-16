import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Lobby from './pages/Lobby'
import Game from './pages/Game'
import Profile from './pages/Profile'
import Leaderboard from './pages/Leaderboard'
import Guide from './pages/Guide'
import Navbar from './components/Navbar'
import { useProfileSync } from './hooks/useProfileSync'

function AppInner() {
  useProfileSync()
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lobby/:gameMode" element={<Lobby />} />
          <Route path="/game/:roomCode" element={<Game />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/guide" element={<Guide />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return <AppInner />
}
