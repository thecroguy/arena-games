import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'

// ── Data ──────────────────────────────────────────────────────────────────────

type Tier  = { matches: number; bonus: number; label: string }
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
      { matches: 5,  bonus: 2.00,  label: 'BRONZE' },  // reduced from 2.50
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

// ── Progress bar ──────────────────────────────────────────────────────────────

function Bar({ value, max, color, glow = false }: { value: number; max: number; color: string; glow?: boolean }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div style={{ height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`, borderRadius: '99px',
        background: `linear-gradient(90deg, ${color}66, ${color})`,
        boxShadow: glow ? `0 0 10px ${color}` : `0 0 5px ${color}55`,
        transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
      }} />
    </div>
  )
}

// ── Unlock toast ──────────────────────────────────────────────────────────────

function UnlockToast({ bonus, color, onUse }: { bonus: number; color: string; onUse: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 300, width: 'min(340px, 92vw)',
      borderRadius: '16px', padding: '20px 20px 16px',
      background: 'linear-gradient(145deg, #0f0f20, #0c0c18)',
      border: `1px solid ${color}55`,
      boxShadow: `0 0 40px ${color}33, 0 20px 60px rgba(0,0,0,0.7)`,
      animation: 'toast-in 0.3s cubic-bezier(0.22,1,0.36,1)',
      textAlign: 'center',
    }}>
      <div style={{ fontFamily: 'Orbitron,sans-serif', fontWeight: 900, fontSize: '1rem', color, letterSpacing: '0.04em', marginBottom: '6px' }}>
        BONUS UNLOCKED
      </div>
      <div style={{ fontSize: '1.6rem', fontFamily: 'Orbitron,sans-serif', fontWeight: 900, color: '#fbbf24', marginBottom: '4px' }}>
        +${bonus.toFixed(2)}
      </div>
      <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '16px' }}>
        Added to your bonus balance. Use within 48 hours.
      </div>
      <button onClick={onUse} style={{
        width: '100%', padding: '11px', borderRadius: '10px', border: 'none', cursor: 'pointer',
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        color: '#0a0a0f', fontFamily: 'Orbitron,sans-serif', fontWeight: 900,
        fontSize: '0.72rem', letterSpacing: '0.06em',
        boxShadow: `0 0 20px ${color}55`,
        animation: 'cta-glow 1.4s ease-in-out infinite',
      }}>
        Play and Use Bonus
      </button>
    </div>
  )
}

// ── Tier row ──────────────────────────────────────────────────────────────────

function TierRow({ tier, done, active, future, color, prevMatches, matchesDone }: {
  tier: Tier; done: boolean; active: boolean; future: boolean
  color: string; prevMatches: number; matchesDone: number
}) {
  const tc     = TIER_COL[tier.label]
  const total  = tier.matches - prevMatches
  const prog   = Math.max(0, Math.min(total, matchesDone - prevMatches))
  const needed = tier.matches - matchesDone
  const pct    = prog / total

  // within 30% of completing = "close" microcopy
  const close  = active && pct >= 0.7

  return (
    <div style={{
      borderRadius: '12px', padding: '12px 14px',
      background: active ? 'rgba(255,255,255,0.035)' : 'transparent',
      border: `1px solid ${active ? `rgba(${color.replace('#','')},0.3)` : done ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'}`,
      boxShadow: active ? `0 0 18px rgba(${color.replace('#','')},0.08)` : 'none',
      opacity: future ? 0.38 : 1,
      transition: 'opacity 0.2s',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Active top accent line */}
      {active && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: active ? '9px' : 0 }}>
        <span style={{
          fontSize: '0.45rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px',
          fontFamily: 'Orbitron,sans-serif', letterSpacing: '0.06em',
          background: `${tc}18`, color: tc, border: `1px solid ${tc}28`,
        }}>{tier.label}</span>

        <span style={{ fontSize: '0.64rem', color: future ? '#1e2030' : '#475569' }}>
          {tier.matches} matches
        </span>

        {done ? (
          <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: '#22c55e', fontWeight: 700 }}>Claimed</span>
        ) : (
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'Orbitron,sans-serif', fontWeight: 900,
            fontSize: '0.9rem',
            color: active ? color : future ? '#1e2030' : '#2d2d40',
          }}>
            ${tier.bonus.toFixed(2)}
          </span>
        )}
      </div>

      {active && (
        <>
          {/* Tier-only progress */}
          <Bar value={prog} max={total} color={color} glow={pct >= 0.85} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', marginBottom: close ? '8px' : 0 }}>
            <span style={{ fontSize: '0.58rem', color: '#374151', fontFamily: 'Orbitron,sans-serif' }}>
              {prog} / {total} matches
            </span>
            <span style={{ fontSize: '0.6rem', color, fontWeight: 700 }}>
              Just {needed} left to unlock ${tier.bonus.toFixed(2)}
            </span>
          </div>

          {/* Microcopy — only when within 30% */}
          {close && (
            <div style={{
              fontSize: '0.62rem', color: '#94a3b8', fontWeight: 600,
              padding: '5px 9px', borderRadius: '7px',
              background: `rgba(${color.replace('#','')},0.08)`,
              border: `1px solid rgba(${color.replace('#','')},0.18)`,
            }}>
              You are close to your next reward
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Main drawer ───────────────────────────────────────────────────────────────

export default function QuestDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address }  = useAccount()
  const navigate     = useNavigate()
  const [tab, setTab]           = useState<number>(1)
  const [showToast, setShowToast] = useState(false)

  const level        = LEVELS.find(l => l.entry === tab)!
  const matchesDone  = FAKE[tab] ?? 0
  const tierIdx      = level.tiers.findIndex(t => matchesDone < t.matches)
  const allDone      = tierIdx === -1
  const nextTier     = allDone ? null : level.tiers[tierIdx]
  const needed       = nextTier ? nextTier.matches - matchesDone : 0
  const prevMatches  = tierIdx > 0 ? level.tiers[tierIdx - 1].matches : 0
  const tierTotal    = nextTier ? nextTier.matches - prevMatches : 1
  const tierProg     = nextTier ? Math.max(0, matchesDone - prevMatches) : tierTotal
  const pct          = tierProg / tierTotal
  const ctaGlow      = pct >= 0.7  // glow CTA when close

  function handlePlay() {
    onClose()
    navigate('/')
  }

  if (!open) return null

  return (
    <>
      <style>{`
        @keyframes qdrawer-in  { from{transform:translateX(100%)} to{transform:translateX(0)} }
        @keyframes qoverlay-in { from{opacity:0} to{opacity:1} }
        @keyframes toast-in    { from{opacity:0;transform:translateX(-50%) translateY(-12px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes fire-q      { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.7) drop-shadow(0 0 6px #f97316)} }
        @keyframes cta-glow    { 0%,100%{box-shadow:0 0 14px rgba(249,115,22,0.4)} 50%{box-shadow:0 0 28px rgba(249,115,22,0.75)} }
        .q-tab  { cursor:pointer; border:none; transition:all .14s; font-family:Orbitron,sans-serif; }
        .q-tab:hover  { filter:brightness(1.1); }
        .q-cta  { cursor:pointer; border:none; transition:all .14s; }
        .q-cta:hover  { filter:brightness(1.12); transform:translateY(-1px); }
      `}</style>

      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)',
        animation: 'qoverlay-in 0.2s ease-out',
      }} />

      {/* Unlock toast */}
      {showToast && nextTier && (
        <UnlockToast
          bonus={nextTier.bonus}
          color={level.color}
          onUse={() => { setShowToast(false); handlePlay() }}
        />
      )}

      {/* Drawer panel — slides from RIGHT */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(370px, 100vw)', zIndex: 201,
        background: 'linear-gradient(180deg, #0d0d1a 0%, #09090f 100%)',
        borderLeft: '1px solid rgba(249,115,22,0.12)',
        display: 'flex', flexDirection: 'column',
        animation: 'qdrawer-in 0.25s cubic-bezier(0.22,1,0.36,1)',
        boxShadow: '-24px 0 70px rgba(0,0,0,0.75)',
        overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '15px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
          position: 'sticky', top: 0, background: '#0d0d1a', zIndex: 2,
        }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
            background: 'linear-gradient(145deg,#f97316,#ef4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(249,115,22,0.4)',
            animation: 'fire-q 2.2s ease-in-out infinite',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C9 6 7 8 8 12C5 11 4 8 5 5C2 8 1 12 3 16C5 19.5 8.5 22 12 22C15.5 22 19 19.5 21 16C23 12 20 7 17 5C17.5 8 16 10 14 11C15 8 14 5 12 2Z" fill="white" opacity="0.95"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Orbitron,sans-serif', fontWeight: 900, fontSize: '0.8rem', color: '#fb923c', letterSpacing: '0.07em' }}>QUESTS</div>
            <div style={{ fontSize: '0.58rem', color: '#374151', marginTop: '1px' }}>Play matches, earn bonuses</div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid #1a1a28',
            borderRadius: '7px', width: '28px', height: '28px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#4b5563', fontSize: '0.85rem', flexShrink: 0,
          }}>x</button>
        </div>

        {/* Entry tabs */}
        <div style={{ display: 'flex', gap: '6px', padding: '13px 14px 0' }}>
          {LEVELS.map(l => (
            <button key={l.entry} className="q-tab"
              onClick={() => setTab(l.entry)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: '9px',
                fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.05em',
                background: tab === l.entry ? `rgba(${l.colorRgb},0.13)` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${tab === l.entry ? `rgba(${l.colorRgb},0.38)` : 'rgba(255,255,255,0.06)'}`,
                color: tab === l.entry ? l.color : '#2d2d40',
                boxShadow: tab === l.entry ? `0 0 10px rgba(${l.colorRgb},0.1)` : 'none',
              }}>
              {l.label} ENTRY
            </button>
          ))}
        </div>

        {/* Current tier progress focus */}
        {address && nextTier && (
          <div style={{ padding: '12px 14px 0' }}>
            <div style={{
              padding: '12px 14px', borderRadius: '12px',
              background: `rgba(${level.colorRgb},0.06)`,
              border: `1px solid rgba(${level.colorRgb},0.2)`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.58rem', color: '#374151', fontFamily: 'Orbitron,sans-serif', letterSpacing: '0.08em' }}>
                  NEXT REWARD
                </span>
                <span style={{ fontFamily: 'Orbitron,sans-serif', fontWeight: 900, fontSize: '0.95rem', color: level.color }}>
                  ${nextTier.bonus.toFixed(2)}
                </span>
              </div>
              <Bar value={tierProg} max={tierTotal} color={level.color} glow={ctaGlow} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                <span style={{ fontSize: '0.58rem', fontFamily: 'Orbitron,sans-serif', color: '#374151' }}>
                  {tierProg} / {tierTotal} matches
                </span>
                <span style={{ fontSize: '0.6rem', color: level.color, fontWeight: 700 }}>
                  Just {needed} left
                </span>
              </div>
            </div>
          </div>
        )}

        {!address && (
          <div style={{ padding: '12px 14px 0' }}>
            <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.16)' }}>
              <span style={{ fontSize: '0.7rem', color: '#f97316' }}>Connect wallet to track progress</span>
            </div>
          </div>
        )}

        {allDone && (
          <div style={{ padding: '12px 14px 0' }}>
            <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.16)' }}>
              <span style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: 600 }}>All tiers complete at {level.label} entry.</span>
            </div>
          </div>
        )}

        {/* CTA */}
        {address && nextTier && (
          <div style={{ padding: '10px 14px 0' }}>
            {ctaGlow && (
              <div style={{ fontSize: '0.62rem', color: '#94a3b8', textAlign: 'center', marginBottom: '6px', fontWeight: 600 }}>
                You are close to your next reward
              </div>
            )}
            <button className="q-cta" onClick={handlePlay} style={{
              width: '100%', padding: '11px', borderRadius: '10px',
              background: 'linear-gradient(135deg,#f97316,#ef4444)', color: 'white',
              fontFamily: 'Orbitron,sans-serif', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.06em',
              boxShadow: ctaGlow ? '0 0 22px rgba(249,115,22,0.55)' : '0 0 10px rgba(249,115,22,0.25)',
              animation: ctaGlow ? 'cta-glow 1.4s ease-in-out infinite' : 'none',
            }}>
              Play and Unlock Reward
            </button>
          </div>
        )}

        {/* All tiers */}
        <div style={{ padding: '12px 10px 14px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ padding: '0 4px 6px', fontFamily: 'Orbitron,sans-serif', fontSize: '0.52rem', color: '#1e2030', letterSpacing: '0.1em' }}>ALL TIERS</div>
          {level.tiers.map((tier, idx) => {
            const prev = idx === 0 ? 0 : level.tiers[idx - 1].matches
            return (
              <TierRow
                key={tier.label}
                tier={tier}
                done={matchesDone >= tier.matches}
                active={tierIdx === idx}
                future={tierIdx !== -1 && idx > tierIdx}
                color={level.color}
                prevMatches={prev}
                matchesDone={matchesDone}
              />
            )
          })}
        </div>

        {/* Bonus rules */}
        <div style={{ margin: '0 10px', borderRadius: '11px', padding: '12px 13px', background: '#0b0b17', border: '1px solid #0d0d1e' }}>
          <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.5rem', fontWeight: 700, color: '#1a1a2e', letterSpacing: '0.1em', marginBottom: '8px' }}>BONUS RULES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {[
              ['Non-withdrawable', 'Entry fees only, not cash out.'],
              ['24-48h expiry',    'Use within 48h of unlock.'],
              ['No stacking',      'One active tier per entry level.'],
              ['Monthly reset',    'Count resets on the 1st.'],
            ].map(([t, d]) => (
              <div key={t} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#1e2030', marginTop: '6px', flexShrink: 0 }} />
                <span style={{ fontSize: '0.63rem', color: '#2d3748', lineHeight: 1.4 }}>
                  <strong style={{ color: '#374151' }}>{t}:</strong> {d}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Elite teaser */}
        <div style={{ margin: '10px 10px 22px', borderRadius: '11px', padding: '12px 13px', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
            background: 'linear-gradient(145deg,#7c3aed,#a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 10px rgba(124,58,237,0.28)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="white" opacity="0.9"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.62rem', fontWeight: 800, color: '#7c3aed', marginBottom: '3px' }}>ELITE TIER</div>
            <div style={{ fontSize: '0.63rem', color: '#2d3748', lineHeight: 1.4 }}>50 matches unlocks Elite status with exclusive perks and higher bonuses.</div>
          </div>
        </div>

      </div>
    </>
  )
}
