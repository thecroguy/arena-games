import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'

// ── Data ──────────────────────────────────────────────────────────────────────

type Tier = { matches: number; bonus: number; label: string }
type Level = { entry: number; label: string; color: string; colorRgb: string; tiers: Tier[] }

const LEVELS: Level[] = [
  {
    entry: 1, label: '$1', color: '#f59e0b', colorRgb: '245,158,11',
    tiers: [
      { matches: 5,  bonus: 0.50, label: 'BRONZE' },
      { matches: 15, bonus: 1.20, label: 'SILVER' },
      { matches: 30, bonus: 2.00, label: 'GOLD'   },
      { matches: 50, bonus: 3.00, label: 'ELITE'  },
    ],
  },
  {
    entry: 5, label: '$5', color: '#a855f7', colorRgb: '168,85,247',
    tiers: [
      { matches: 5,  bonus: 2.50,  label: 'BRONZE' },
      { matches: 15, bonus: 6.00,  label: 'SILVER' },
      { matches: 30, bonus: 10.00, label: 'GOLD'   },
      { matches: 50, bonus: 15.00, label: 'ELITE'  },
    ],
  },
]

const TIER_COL: Record<string, string> = {
  BRONZE: '#f59e0b', SILVER: '#94a3b8', GOLD: '#fbbf24', ELITE: '#a78bfa',
}

// Fake progress — replace with real API
const FAKE: Record<number, number> = { 1: 7, 5: 2 }

// ── Sub-components ────────────────────────────────────────────────────────────

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div style={{ height: '5px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`, borderRadius: '99px',
        background: `linear-gradient(90deg, ${color}88, ${color})`,
        boxShadow: `0 0 6px ${color}66`,
        transition: 'width 0.5s cubic-bezier(.4,0,.2,1)',
      }} />
    </div>
  )
}

function TierRow({ tier, done, active, color, prevMatches, matchesDone }: {
  tier: Tier; done: boolean; active: boolean; color: string; prevMatches: number; matchesDone: number
}) {
  const tc = TIER_COL[tier.label]
  const tierTotal = tier.matches - prevMatches
  const progressInTier = Math.max(0, Math.min(tierTotal, matchesDone - prevMatches))
  const needed = tier.matches - matchesDone

  return (
    <div style={{
      borderRadius: '12px', padding: '11px 13px',
      background: active ? 'rgba(255,255,255,0.04)' : 'transparent',
      border: `1px solid ${active ? `rgba(${color.replace('#','')},0.25)` : done ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.04)'}`,
      opacity: done ? 0.55 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: active ? '8px' : 0 }}>
        {/* Tier label */}
        <span style={{
          fontSize: '0.46rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px',
          fontFamily: 'Orbitron,sans-serif', letterSpacing: '0.06em',
          background: `${tc}18`, color: tc, border: `1px solid ${tc}30`,
        }}>{tier.label}</span>

        <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{tier.matches} matches</span>

        {done ? (
          <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#22c55e', fontWeight: 700 }}>Claimed</span>
        ) : (
          <span style={{ marginLeft: 'auto', fontFamily: 'Orbitron,sans-serif', fontWeight: 900, fontSize: '0.88rem', color: active ? color : '#374151' }}>
            ${tier.bonus.toFixed(2)}
          </span>
        )}
      </div>

      {active && (
        <>
          <Bar value={progressInTier} max={tierTotal} color={color} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
            <span style={{ fontSize: '0.58rem', color: '#475569' }}>{progressInTier}/{tierTotal}</span>
            <span style={{ fontSize: '0.58rem', color, fontWeight: 700 }}>{needed} more for ${tier.bonus.toFixed(2)}</span>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

export default function QuestDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address } = useAccount()
  const [tab, setTab] = useState<number>(1)

  const level = LEVELS.find(l => l.entry === tab)!
  const matchesDone = FAKE[tab] ?? 0
  const currentTierIdx = level.tiers.findIndex(t => matchesDone < t.matches)
  const nextTier = currentTierIdx === -1 ? null : level.tiers[currentTierIdx]
  const needed = nextTier ? nextTier.matches - matchesDone : 0

  if (!open) return null

  return (
    <>
      <style>{`
        @keyframes qdrawer-in { from{transform:translateX(100%)} to{transform:translateX(0)} }
        @keyframes qoverlay-in { from{opacity:0} to{opacity:1} }
        @keyframes fire-q { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.6) drop-shadow(0 0 6px #f97316)} }
        .q-tab { cursor:pointer; border:none; transition:all .14s; }
        .q-tab:hover { filter:brightness(1.1); }
        .q-play-btn { cursor:pointer; border:none; transition:all .14s; }
        .q-play-btn:hover { filter:brightness(1.12); transform:translateY(-1px); }
      `}</style>

      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        animation: 'qoverlay-in 0.2s ease-out',
      }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(380px, 100vw)',
        zIndex: 201, background: 'linear-gradient(180deg, #0d0d1a 0%, #08080f 100%)',
        borderLeft: '1px solid rgba(249,115,22,0.15)',
        display: 'flex', flexDirection: 'column',
        animation: 'qdrawer-in 0.24s cubic-bezier(0.22,1,0.36,1)',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.7)',
        overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)',
          position: 'sticky', top: 0, background: '#0d0d1a', zIndex: 1,
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
            background: 'linear-gradient(145deg,#f97316,#ef4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 14px rgba(249,115,22,0.4)',
            animation: 'fire-q 2s ease-in-out infinite',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C9 6 7 8 8 12C5 11 4 8 5 5C2 8 1 12 3 16C5 19.5 8.5 22 12 22C15.5 22 19 19.5 21 16C23 12 20 7 17 5C17.5 8 16 10 14 11C15 8 14 5 12 2Z" fill="white" opacity="0.95"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Orbitron,sans-serif', fontWeight: 900, fontSize: '0.82rem', color: '#fb923c', letterSpacing: '0.06em' }}>QUESTS</div>
            <div style={{ fontSize: '0.6rem', color: '#475569', marginTop: '1px' }}>Play matches. Earn bonuses.</div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid #1e1e30',
            borderRadius: '8px', width: '30px', height: '30px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#64748b', fontSize: '0.9rem', flexShrink: 0,
          }}>✕</button>
        </div>

        {/* Entry tabs */}
        <div style={{ display: 'flex', gap: '6px', padding: '14px 16px 0' }}>
          {LEVELS.map(l => (
            <button key={l.entry} className="q-tab"
              onClick={() => setTab(l.entry)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: '9px',
                fontFamily: 'Orbitron,sans-serif', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.05em',
                background: tab === l.entry ? `rgba(${l.colorRgb},0.14)` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${tab === l.entry ? `rgba(${l.colorRgb},0.4)` : 'rgba(255,255,255,0.07)'}`,
                color: tab === l.entry ? l.color : '#374151',
                boxShadow: tab === l.entry ? `0 0 12px rgba(${l.colorRgb},0.12)` : 'none',
              }}>
              {l.label} ENTRY
            </button>
          ))}
        </div>

        {/* Motivational nudge */}
        <div style={{ padding: '10px 16px 0' }}>
          {!address ? (
            <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.18)' }}>
              <span style={{ fontSize: '0.72rem', color: '#fb923c' }}>Connect wallet to track progress</span>
            </div>
          ) : nextTier ? (
            <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.4 }}>
                <strong style={{ color: '#f97316' }}>{needed} more</strong> match{needed !== 1 ? 'es' : ''} to unlock <strong style={{ color: '#fbbf24' }}>${nextTier.bonus.toFixed(2)}</strong>
              </span>
              <Link to="/" onClick={onClose} style={{ textDecoration: 'none', flexShrink: 0 }}>
                <button className="q-play-btn" style={{
                  background: 'linear-gradient(135deg,#f97316,#ef4444)', color: 'white',
                  borderRadius: '7px', padding: '6px 12px', fontFamily: 'Orbitron,sans-serif',
                  fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.06em',
                  boxShadow: '0 0 10px rgba(249,115,22,0.3)',
                }}>PLAY NOW</button>
              </Link>
            </div>
          ) : (
            <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.18)' }}>
              <span style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: 600 }}>All tiers complete at {level.label} entry.</span>
            </div>
          )}
        </div>

        {/* Overall progress */}
        <div style={{ padding: '12px 16px 4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.58rem', color: '#374151', fontFamily: 'Orbitron,sans-serif', letterSpacing: '0.08em' }}>OVERALL PROGRESS</span>
            <span style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.72rem', fontWeight: 900, color: level.color }}>{matchesDone} / 50</span>
          </div>
          <Bar value={matchesDone} max={50} color={level.color} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            {level.tiers.map(t => (
              <span key={t.matches} style={{ fontSize: '0.48rem', color: '#1e2030', fontFamily: 'Orbitron,sans-serif' }}>{t.matches}</span>
            ))}
          </div>
        </div>

        {/* Tier rows */}
        <div style={{ padding: '4px 12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {level.tiers.map((tier, idx) => {
            const prevMatches = idx === 0 ? 0 : level.tiers[idx - 1].matches
            return (
              <TierRow
                key={tier.label}
                tier={tier}
                done={matchesDone >= tier.matches}
                active={currentTierIdx === idx}
                color={level.color}
                prevMatches={prevMatches}
                matchesDone={matchesDone}
              />
            )
          })}
        </div>

        {/* Rules */}
        <div style={{ margin: '0 12px', borderRadius: '12px', padding: '12px 14px', background: '#0c0c18', border: '1px solid #0d0d1e' }}>
          <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.54rem', fontWeight: 700, color: '#1e2030', letterSpacing: '0.1em', marginBottom: '8px' }}>BONUS RULES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {[
              ['Non-withdrawable', 'Used for entry fees only.'],
              ['24-48h expiry', 'Use within 48h of unlock.'],
              ['No stacking', 'One active tier per entry level.'],
              ['Monthly reset', 'Match count resets each month.'],
            ].map(([title, desc]) => (
              <div key={title} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#1e2030', marginTop: '5px', flexShrink: 0 }} />
                <span style={{ fontSize: '0.65rem', color: '#374151', lineHeight: 1.4 }}>
                  <strong style={{ color: '#4b5563' }}>{title}:</strong> {desc}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Elite teaser */}
        <div style={{ margin: '10px 12px 20px', borderRadius: '12px', padding: '12px 14px', background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.18)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
            background: 'linear-gradient(145deg,#7c3aed,#a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(124,58,237,0.3)',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="white" opacity="0.9"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.64rem', fontWeight: 800, color: '#a78bfa', marginBottom: '3px' }}>ELITE TIER</div>
            <div style={{ fontSize: '0.65rem', color: '#374151', lineHeight: 1.4 }}>50 matches unlocks Elite status — exclusive perks and higher bonuses coming soon.</div>
          </div>
        </div>

      </div>
    </>
  )
}
