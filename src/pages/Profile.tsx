import { useEffect, useState, useCallback } from 'react'
import { useAccount, useWriteContract, useChainId, useSwitchChain, useSignMessage, usePublicClient } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { parseUnits } from 'viem'
import { polygon } from 'wagmi/chains'
import { fetchPlayerHistory, fetchPlayerStats, fetchProfile, upsertProfile, unlockAvatarStyle, type GameHistory } from '../utils/supabase'
import {
  getAvatarUrl, getAvatarColor, AVATAR_STYLES, STYLE_CATALOG,
  isStyleOwned, getDefaultStyle,
  type AvatarStyle, type AvatarEntry,
} from '../utils/avatar'
import { getUsername, setUsername, shortAddr } from '../utils/profile'
import { getRoomId, ESCROW_ABI, getEscrowAddress } from '../utils/escrow'

const HOUSE_WALLET = import.meta.env.VITE_HOUSE_WALLET as `0x${string}` | undefined
const HOUSE_CONFIGURED = !!HOUSE_WALLET && HOUSE_WALLET !== '0x0000000000000000000000000000000000000000'
const USDT_POLYGON = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' as `0x${string}`
const USDT_ABI = [
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }] },
] as const
const EMERGENCY_REFUND_ABI = [
  { name: 'emergencyRefund', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'roomId', type: 'bytes32' }], outputs: [] },
] as const
const CLAIM_REFUND_ABI = [
  { name: 'claimRefund', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'roomId', type: 'bytes32' }, { name: 'sig', type: 'bytes' }], outputs: [] },
] as const
const CLAIM_ABI = [
  { name: 'claim', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'roomId', type: 'bytes32' }, { name: 'winner', type: 'address' }, { name: 'sig', type: 'bytes' }], outputs: [] },
] as const
const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

type StuckDeposit = {
  room_code: string
  room_id_hash: string
  chain_id: number
  escrow_address: string
  amount_usdt: number
  deposited_at: string
  refundable_at: string
  refund_sig: string | null  // if set, can call claimRefund() immediately
}

type PendingClaim = {
  room_code: string
  game_mode: string
  pot: number
  claim_sig: string
  escrow_address: string
  room_id_hash: string
  chain_id: number
  played_at: string
}

type PriceFilter = 'all' | 0 | 1 | 2 | 3

type ReferralStats = {
  referral_code: string | null
  referees: { referee_address: string; games_counted: number; earned_usdt: number }[]
  total_earned: number
  total_paid: number
  available: number
  pending_payout: { amount_usdt: number; status: string; requested_at: string } | null
}

export default function Profile() {
  const { address, isConnected } = useAccount()
  const navigate = useNavigate()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const { signMessageAsync } = useSignMessage()
  const publicClient = usePublicClient()

  const [history, setHistory]   = useState<GameHistory[]>([])
  const [stats, setStats]       = useState<{ played: number; wins: number; winRate: number; totalEarned: number; totalSpent: number } | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // Profile state (synced to Supabase)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput]     = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>('bottts')
  const [ownedBases, setOwnedBases]   = useState<string[]>(['bottts'])

  // Avatar picker filter + layout
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all')
  const [expanded, setExpanded]       = useState(false)
  const [pendingStyle, setPendingStyle] = useState<AvatarEntry | null>(null)

  // Purchase flow
  const [buying, setBuying]             = useState<string | null>(null)  // base key being bought
  const [confirmEntry, setConfirmEntry] = useState<AvatarEntry | null>(null)
  const [buyStatus, setBuyStatus]       = useState<'idle' | 'switching' | 'paying' | 'saving'>('idle')

  // Stuck deposits + pending winnings
  const [stuckDeposits, setStuckDeposits]   = useState<StuckDeposit[]>([])
  const [pendingClaims, setPendingClaims]   = useState<PendingClaim[]>([])
  const [claimingRoom, setClaimingRoom]     = useState<string | null>(null)
  const [now, setNow]                       = useState(Date.now())

  // On-chain deposit check (scans room history stored in localStorage)
  type OnChainDeposit = { code: string; chainId: number; escrow: `0x${string}`; roomId: `0x${string}`; createdAt: number; settled: boolean }
  const [onChainDeposits, setOnChainDeposits] = useState<OnChainDeposit[]>([])
  const [scanningChain, setScanningChain]     = useState(false)
  const [manualRoomCode, setManualRoomCode]   = useState('')
  const [manualScanning, setManualScanning]   = useState(false)

  const [referralStats, setReferralStats]       = useState<ReferralStats | null>(null)
  const [generatingCode, setGeneratingCode]     = useState(false)
  const [requestingPayout, setRequestingPayout] = useState(false)
  const [referralCopied, setReferralCopied]     = useState(false)
  const [referralError, setReferralError]       = useState('')

  // Load profile from Supabase on connect
  useEffect(() => {
    if (!address) return
    const localName = getUsername(address)
    setDisplayName(localName)
    setNameInput(localName)
    // Set address-derived robot default while loading
    setAvatarStyle(getDefaultStyle(address))

    fetchProfile(address).then(p => {
      if (p) {
        if (p.username) { setDisplayName(p.username); setNameInput(p.username); setUsername(address, p.username) }
        if (p.avatar_style) setAvatarStyle(p.avatar_style as AvatarStyle)
        setOwnedBases(p.purchased_styles ?? ['bottts'])
      }
    })
    fetch(`${SERVER_URL}/api/referral/stats/${address}`)
      .then(r => r.json()).then(setReferralStats).catch(() => {})
  }, [address])

  useEffect(() => {
    if (!address) return
    setLoading(true)
    Promise.all([fetchPlayerHistory(address), fetchPlayerStats(address)])
      .then(([h, s]) => { setHistory(h); setStats(s) })
      .catch(() => setError('Stats unavailable — play some games first!'))
      .finally(() => setLoading(false))
  }, [address])

  const fetchStuck = useCallback(() => {
    if (!address) return
    fetch(`${SERVER_URL}/api/stuck-deposits/${address}`)
      .then(r => r.json())
      .then(async (data: StuckDeposit[]) => {
        if (!Array.isArray(data) || data.length === 0) { setStuckDeposits([]); return }
        // On-chain verify: remove deposits the player already claimed (hasDeposited returns false)
        const verified = await Promise.all(data.map(async d => {
          if (!publicClient || !d.escrow_address || !d.room_id_hash || d.room_id_hash.length !== 66) return d
          try {
            const stillHeld = await publicClient.readContract({
              address: d.escrow_address as `0x${string}`,
              abi: [{ name: 'hasDeposited', type: 'function', stateMutability: 'view', inputs: [{ name: 'roomId', type: 'bytes32' }, { name: 'player', type: 'address' }], outputs: [{ type: 'bool' }] }],
              functionName: 'hasDeposited',
              args: [d.room_id_hash as `0x${string}`, address as `0x${string}`],
            })
            if (!stillHeld) {
              // Already claimed on-chain — record it so server knows
              fetch(`${SERVER_URL}/api/mark-refund-claimed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomCode: d.room_code, address }) }).catch(() => {})
              return null
            }
          } catch { /* RPC fail — show it anyway */ }
          return d
        }))
        setStuckDeposits(verified.filter(Boolean) as StuckDeposit[])
      })
      .catch(() => {})
    fetch(`${SERVER_URL}/api/pending-claim/${address}`)
      .then(r => r.json()).then(data => { if (Array.isArray(data)) setPendingClaims(data) })
      .catch(() => {})
  }, [address, publicClient])

  useEffect(() => { fetchStuck() }, [fetchStuck])

  // Scan room history against the contract on-chain
  async function scanRoomCode(code: string, existingDeposits: OnChainDeposit[] = onChainDeposits): Promise<{ deposit: OnChainDeposit | null; reason: 'found' | 'settled' | 'not_found' }> {
    if (!address || !publicClient || !code) return { deposit: null, reason: 'not_found' }
    for (const chainId137 of [137, 80002]) {
      const escrow = getEscrowAddress(chainId137)
      if (!escrow) continue
      try {
        const roomId = getRoomId(code)
        const [deposited, info] = await Promise.all([
          publicClient.readContract({ address: escrow, abi: ESCROW_ABI, functionName: 'hasDeposited', args: [roomId, address] }),
          publicClient.readContract({ address: escrow, abi: ESCROW_ABI, functionName: 'roomInfo', args: [roomId] }),
        ])
        if (deposited) {
          const [, , settled] = info as [bigint, bigint, boolean, string[]]
          if (settled) return { deposit: null, reason: 'settled' }
          const deposit = { code, chainId: chainId137, escrow, roomId, createdAt: 0, settled }
          if (!existingDeposits.some(d => d.code === code)) {
            setOnChainDeposits(prev => [...prev.filter(d => d.code !== code), deposit])
          }
          return { deposit, reason: 'found' }
        }
      } catch { /* wrong chain — try next */ }
    }
    return { deposit: null, reason: 'not_found' }
  }

  // Server is source of truth — no localStorage dependency
  const scanOnChain = useCallback(async () => {
    if (!address || !publicClient) return
    try {
      setScanningChain(true)
      const r = await fetch(`${SERVER_URL}/api/room-history/${address}`)
      if (!r.ok) { setScanningChain(false); return }
      const serverRooms: { code: string; chainId: number }[] = await r.json()
      if (serverRooms.length === 0) { setScanningChain(false); return }
      const found: OnChainDeposit[] = []
      for (const { code, chainId: rChainId } of serverRooms) {
        const escrow = getEscrowAddress(rChainId)
        if (!escrow) continue
        try {
          const roomId = getRoomId(code)
          const [deposited, info] = await Promise.all([
            publicClient.readContract({ address: escrow, abi: ESCROW_ABI, functionName: 'hasDeposited', args: [roomId, address] }),
            publicClient.readContract({ address: escrow, abi: ESCROW_ABI, functionName: 'roomInfo', args: [roomId] }),
          ])
          if (deposited) {
            const [, , settled] = info as [bigint, bigint, boolean, string[]]
            if (!settled) found.push({ code, chainId: rChainId, escrow, roomId, createdAt: 0, settled })
          }
        } catch { /* skip */ }
      }
      setOnChainDeposits(found)
    } catch { /* ignore */ } finally {
      setScanningChain(false)
    }
  }, [address, publicClient])

  useEffect(() => { scanOnChain() }, [scanOnChain])

  // Tick every 30s so countdown updates
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  async function generateReferralCode() {
    if (!address) return
    setGeneratingCode(true); setReferralError('')
    try {
      const sig = await signMessageAsync({ message: `Arena referral code\n${address.toLowerCase()}` })
      const res = await fetch(`${SERVER_URL}/api/referral/generate-code`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, sig }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setReferralStats(prev => prev ? { ...prev, referral_code: data.code } : null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('rejected') && !msg.includes('denied')) setReferralError('Failed to generate code')
    } finally { setGeneratingCode(false) }
  }

  async function requestReferralPayout() {
    if (!address) return
    setRequestingPayout(true); setReferralError('')
    try {
      const sig = await signMessageAsync({ message: `Arena referral payout\n${address.toLowerCase()}` })
      const res = await fetch(`${SERVER_URL}/api/referral/request-payout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, sig }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      const updated = await fetch(`${SERVER_URL}/api/referral/stats/${address}`).then(r => r.json())
      setReferralStats(updated)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('rejected') && !msg.includes('denied')) setReferralError(msg)
    } finally { setRequestingPayout(false) }
  }

  async function saveName() {
    if (!address || !nameInput.trim()) return
    const clean = nameInput.trim().replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 20)
    try {
      const sig = await signMessageAsync({ message: `Arena profile update\n${address.toLowerCase()}` })
      await upsertProfile(address, { username: clean }, sig)
      setUsername(address, clean)
      setDisplayName(clean)
      setNameInput(clean)
      setEditingName(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('rejected') && !msg.includes('denied')) alert('Failed to save username — please try again')
    }
  }

  async function handleBuyStyle(entry: AvatarEntry) {
    if (!address || !isConnected) return
    const { baseKey, price } = entry

    if (price === 0 || isStyleOwned(entry.id, ownedBases)) {
      // Free or already owned — just switch
      setAvatarStyle(entry.id)
      setConfirmEntry(null)
      try {
        const sig = await signMessageAsync({ message: `Arena profile update\n${address.toLowerCase()}` })
        await upsertProfile(address, { avatar_style: entry.id }, sig)
      } catch { /* sig rejected — visual state already updated */ }
      return
    }

    if (!HOUSE_CONFIGURED) {
      setError('Avatar purchases are not available right now.')
      setConfirmEntry(null); return
    }

    setBuying(baseKey)
    setBuyStatus('switching')

    if (chainId !== polygon.id) {
      try { await switchChainAsync({ chainId: polygon.id }) }
      catch {
        setError('Switch to Polygon to pay for this avatar')
        setBuying(null); setBuyStatus('idle'); setConfirmEntry(null); return
      }
    }

    setBuyStatus('paying')
    let avatarTxHash: string | undefined
    try {
      avatarTxHash = await writeContractAsync({
        address: USDT_POLYGON,
        abi: USDT_ABI,
        functionName: 'transfer',
        args: [HOUSE_WALLET as `0x${string}`, parseUnits(String(price), 6)],
        chainId: polygon.id,
      })
    } catch {
      setError('Payment cancelled. No charge applied.')
      setBuying(null); setBuyStatus('idle'); setConfirmEntry(null); return
    }

    setBuyStatus('saving')
    try {
      const sig = await signMessageAsync({ message: `Arena avatar unlock: ${baseKey}\n${address.toLowerCase()}` })
      await unlockAvatarStyle(address, baseKey, ownedBases, sig, avatarTxHash)
      const newBases = Array.from(new Set([...ownedBases, baseKey]))
      setOwnedBases(newBases)
      setAvatarStyle(entry.id)
    } catch {
      setError('Paid but failed to save — refresh and it may appear.')
    } finally {
      setBuying(null); setBuyStatus('idle'); setConfirmEntry(null)
    }
  }

  async function saveAvatarSelection() {
    if (!pendingStyle || !address) return
    setAvatarStyle(pendingStyle.id)
    setPendingStyle(null)
    try {
      const sig = await signMessageAsync({ message: `Arena profile update\n${address.toLowerCase()}` })
      await upsertProfile(address, { avatar_style: pendingStyle.id }, sig)
    } catch { /* sig rejected — visual state already updated */ }
  }

  async function claimRefundForDeposit(deposit: StuckDeposit) {
    setClaimingRoom(deposit.room_code)
    try {
      if (chainId !== deposit.chain_id) await switchChainAsync({ chainId: deposit.chain_id })
      if (deposit.refund_sig) {
        // Server already signed a refund — use claimRefund() (instant, no 24h wait)
        await writeContractAsync({
          address: deposit.escrow_address as `0x${string}`,
          abi: CLAIM_REFUND_ABI,
          functionName: 'claimRefund',
          args: [deposit.room_id_hash as `0x${string}`, deposit.refund_sig as `0x${string}`],
          chainId: deposit.chain_id,
          gas: 300000n,
        })
      } else {
        // No sig yet — use emergencyRefund() (requires 24h)
        await writeContractAsync({
          address: deposit.escrow_address as `0x${string}`,
          abi: EMERGENCY_REFUND_ABI,
          functionName: 'emergencyRefund',
          args: [deposit.room_id_hash as `0x${string}`],
          chainId: deposit.chain_id,
          gas: 300000n,
        })
      }
      setStuckDeposits(prev => prev.filter(d => d.room_code !== deposit.room_code))
      setOnChainDeposits(prev => prev.filter(d => d.code !== deposit.room_code))
      // Tell server the refund was claimed so it doesn't reappear on refresh
      fetch(`${SERVER_URL}/api/mark-refund-claimed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: deposit.room_code, address }),
      }).catch(() => {})
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('TooEarlyForEmergency')) setError('Too early — refund available 24h after deposit. Come back later.')
      else if (!msg.includes('rejected')) setError('Refund failed. Try again.')
    } finally {
      setClaimingRoom(null)
    }
  }

  async function claimWinnings(pending: PendingClaim) {
    if (!address) return
    setClaimingRoom(pending.room_code)
    try {
      if (chainId !== pending.chain_id) await switchChainAsync({ chainId: pending.chain_id })
      await writeContractAsync({
        address: pending.escrow_address as `0x${string}`,
        abi: CLAIM_ABI,
        functionName: 'claim',
        args: [pending.room_id_hash as `0x${string}`, address, pending.claim_sig as `0x${string}`],
        chainId: pending.chain_id,
        gas: 300000n,
      })
      setPendingClaims(prev => prev.filter(p => p.room_code !== pending.room_code))
      // Mark as claimed in DB so it doesn't show up again
      fetch(`${SERVER_URL}/api/mark-claimed`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, room_code: pending.room_code }),
      }).catch(() => {})
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('AlreadySettled')) {
        // Already claimed on-chain — mark it and remove from list
        setPendingClaims(prev => prev.filter(p => p.room_code !== pending.room_code))
        fetch(`${SERVER_URL}/api/mark-claimed`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, room_code: pending.room_code }),
        }).catch(() => {})
      } else if (!msg.includes('rejected')) {
        setError('Claim failed. Try again.')
      }
    } finally {
      setClaimingRoom(null)
    }
  }

  if (!isConnected) {
    return (
      <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }}>🔒</div>
        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1.2rem' }}>Connect Your Wallet</h2>
        <p style={{ color: '#94a3b8', maxWidth: '300px', fontSize: '0.95rem' }}>Your wallet address is your account — no signup needed.</p>
        <ConnectButton />
      </div>
    )
  }

  const netProfit   = stats ? stats.totalEarned - stats.totalSpent : 0
  const avatarUrl   = address ? getAvatarUrl(address, avatarStyle) : ''
  const avatarColor = address ? getAvatarColor(address) : '#7c3aed'

  const filteredStyles = priceFilter === 'all'
    ? AVATAR_STYLES
    : AVATAR_STYLES.filter(s => s.price === priceFilter)

  const priceCounts = {
    all: AVATAR_STYLES.length,
    0: AVATAR_STYLES.filter(s => s.price === 0).length,
    1: AVATAR_STYLES.filter(s => s.price === 1).length,
    2: AVATAR_STYLES.filter(s => s.price === 2).length,
    3: AVATAR_STYLES.filter(s => s.price === 3).length,
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'clamp(20px,4vw,40px) clamp(16px,4vw,24px)' }}>

      {/* Profile header */}
      <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(6,182,212,0.06) 100%)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '20px', padding: 'clamp(20px,4vw,32px)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img src={avatarUrl} alt="avatar" width={80} height={80}
              style={{ borderRadius: '50%', border: `3px solid ${avatarColor}`, background: '#1e1e30', display: 'block' }} />
            <div style={{ position: 'absolute', bottom: 0, right: 0, background: '#22c55e', borderRadius: '50%', width: '16px', height: '16px', border: '2px solid #0a0a0f' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: '#64748b', fontSize: '0.68rem', letterSpacing: '0.1em', fontFamily: 'Orbitron, sans-serif', marginBottom: '4px' }}>PLAYER ACCOUNT</p>
            {editingName ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input value={nameInput} onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                  maxLength={20} autoFocus placeholder="Display name"
                  style={{ background: '#0a0a0f', border: '1px solid #7c3aed', borderRadius: '8px', padding: '6px 12px', color: '#e2e8f0', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', outline: 'none', width: '180px' }} />
                <button onClick={saveName} style={{ background: '#7c3aed', border: 'none', borderRadius: '6px', padding: '6px 14px', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Save</button>
                <button onClick={() => { setEditingName(false); setNameInput(displayName) }} style={{ background: 'transparent', border: '1px solid #1e1e30', borderRadius: '6px', padding: '6px 10px', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: 'clamp(0.85rem,2vw,1rem)', color: '#e2e8f0' }}>{displayName}</h1>
                <button onClick={() => setEditingName(true)} style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '6px', padding: '3px 10px', color: '#a78bfa', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}>Edit</button>
              </div>
            )}
            <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px', fontFamily: 'monospace' }}>{address ? shortAddr(address) : ''}</p>
            <p style={{ color: '#475569', fontSize: '0.7rem', marginTop: '2px' }}>🔑 Your wallet = your account. No password needed.</p>
          </div>
          <button onClick={() => navigate('/lobby/math-arena')}
            style={{ background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', border: 'none', borderRadius: '10px', padding: '10px 20px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
            Play Now →
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px 18px', marginBottom: '20px', color: '#ef4444', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between' }}>
          {error}
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Achievements + Level */}
      {stats && (() => {
        const level = Math.max(1, Math.floor(stats.wins / 5) + 1)
        const winsThisLevel = stats.wins % 5
        const winsToNext = 5 - winsThisLevel
        const badges: { icon: string; label: string; desc: string; unlocked: boolean }[] = [
          { icon: '🏆', label: 'First Win',    desc: 'Win your first game',           unlocked: stats.wins >= 1 },
          { icon: '🔥', label: '5 Wins',       desc: 'Win 5 games',                   unlocked: stats.wins >= 5 },
          { icon: '💎', label: '25 Wins',      desc: 'Win 25 games',                  unlocked: stats.wins >= 25 },
          { icon: '⚔️', label: '10 Games',     desc: 'Play 10 games',                 unlocked: stats.played >= 10 },
          { icon: '🎯', label: 'Sharp',        desc: 'Reach 70% win rate (5+ games)', unlocked: stats.winRate >= 70 && stats.played >= 5 },
          { icon: '💰', label: 'High Roller',  desc: 'Earn $10+ total',               unlocked: stats.totalEarned >= 10 },
          { icon: '🛡️', label: 'Veteran',      desc: 'Play 50 games',                 unlocked: stats.played >= 50 },
          { icon: '👑', label: 'Legend',       desc: 'Win 100 games',                 unlocked: stats.wins >= 100 },
        ]
        const unlockedCount = badges.filter(b => b.unlocked).length
        return (
          <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px' }}>
            {/* Level bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', borderRadius: '12px', padding: '8px 18px', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: '1.1rem', color: '#fff', flexShrink: 0 }}>
                LVL {level}
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Level {level} Progress</span>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{winsThisLevel}/5 wins · next level in {winsToNext} win{winsToNext !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ height: '6px', background: '#1e1e30', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(winsThisLevel / 5) * 100}%`, background: 'linear-gradient(90deg,#7c3aed,#06b6d4)', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                </div>
              </div>
            </div>

            {/* Achievements header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.68rem', color: '#64748b', letterSpacing: '0.1em' }}>ACHIEVEMENTS</span>
              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{unlockedCount} / {badges.length} unlocked</span>
            </div>

            {/* Badge grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
              {badges.map(b => (
                <div key={b.label} style={{ background: b.unlocked ? 'rgba(124,58,237,0.1)' : '#0a0a0f', border: `1px solid ${b.unlocked ? 'rgba(124,58,237,0.3)' : '#1e1e30'}`, borderRadius: '10px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', opacity: b.unlocked ? 1 : 0.4 }}>
                  <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{b.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.78rem', color: b.unlocked ? '#e2e8f0' : '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.label}</p>
                    <p style={{ color: '#475569', fontSize: '0.65rem', marginTop: '1px', lineHeight: 1.3 }}>{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Stats */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '12px', padding: '18px', height: '76px', opacity: 0.4 }} />
          ))}
        </div>
      ) : stats ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <StatCard label="Games Played" value={String(stats.played)} />
            <StatCard label="Wins"         value={String(stats.wins)}   color="#22c55e" />
            <StatCard label="Win Rate"     value={`${stats.winRate}%`}  color={stats.winRate >= 50 ? '#22c55e' : '#ef4444'} />
            <StatCard label="Net Profit"   value={`${netProfit >= 0 ? '+' : ''}$${netProfit.toFixed(2)}`} color={netProfit >= 0 ? '#22c55e' : '#ef4444'} />
            <StatCard label="Earned"       value={`$${stats.totalEarned.toFixed(2)}`} color="#22c55e" />
            <StatCard label="Spent"        value={`$${stats.totalSpent.toFixed(2)}`}  color="#ef4444" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: '14px', padding: '20px 22px' }}>
              <p style={{ color: '#64748b', fontSize: '0.7rem', letterSpacing: '0.08em', fontFamily: 'Orbitron, sans-serif', marginBottom: '6px' }}>TOTAL EARNED</p>
              <p style={{ fontSize: 'clamp(1.3rem,3vw,1.6rem)', fontWeight: 700, color: '#22c55e', fontFamily: 'Orbitron, sans-serif' }}>${stats.totalEarned.toFixed(2)}</p>
              <p style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '4px' }}>USDT across {stats.wins} wins</p>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: '14px', padding: '20px 22px' }}>
              <p style={{ color: '#64748b', fontSize: '0.7rem', letterSpacing: '0.08em', fontFamily: 'Orbitron, sans-serif', marginBottom: '6px' }}>TOTAL SPENT</p>
              <p style={{ fontSize: 'clamp(1.3rem,3vw,1.6rem)', fontWeight: 700, color: '#ef4444', fontFamily: 'Orbitron, sans-serif' }}>${stats.totalSpent.toFixed(2)}</p>
              <p style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '4px' }}>fees across {stats.played} games</p>
            </div>
          </div>
        </>
      ) : (
        <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '14px', padding: '32px', textAlign: 'center', color: '#64748b', marginBottom: '24px', fontSize: '0.95rem' }}>
          No games played yet —{' '}
          <button style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontWeight: 700, fontSize: 'inherit' }} onClick={() => navigate('/')}>
            play your first game →
          </button>
        </div>
      )}

      {/* Unclaimed winnings — won but browser closed before claiming */}
      {pendingClaims.length > 0 && (
        <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px' }}>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: '#22c55e', letterSpacing: '0.1em', marginBottom: '4px' }}>
            🏆 UNCLAIMED WINNINGS
          </p>
          <p style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '14px' }}>You won these games but haven't claimed yet. Claim now to receive your USDT.</p>
          {pendingClaims.map(p => {
            const isClaiming = claimingRoom === p.room_code
            return (
              <div key={p.room_code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '12px 0', borderBottom: '1px solid rgba(34,197,94,0.08)' }}>
                <div>
                  <p style={{ color: '#e2e8f0', fontWeight: 700, fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem' }}>
                    Room {p.room_code} &nbsp;<span style={{ color: '#22c55e' }}>${Number(p.pot).toFixed(2)} USDT</span>
                  </p>
                  <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '3px' }}>
                    {p.game_mode.replace('-', ' ')} · Won {new Date(p.played_at).toLocaleString()}
                  </p>
                </div>
                <button onClick={() => claimWinnings(p)} disabled={isClaiming}
                  style={{ background: isClaiming ? '#1e1e30' : 'linear-gradient(135deg,#22c55e,#06b6d4)', border: 'none', borderRadius: '8px', padding: '8px 18px', color: isClaiming ? '#475569' : '#0a0a0f', fontWeight: 700, fontSize: '0.82rem', cursor: isClaiming ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                  {isClaiming ? 'Claiming…' : 'Claim Winnings →'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Stuck deposits — paid but game never started */}
      {stuckDeposits.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px' }}>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: '#f59e0b', letterSpacing: '0.1em', marginBottom: '4px' }}>
            ⚠ PENDING DEPOSITS
          </p>
          <p style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '14px' }}>Your USDT is locked in the contract. Claim your refund below.</p>
          {stuckDeposits.map(d => {
            const canInstant = !!d.refund_sig
            const refundableAt = new Date(d.refundable_at).getTime()
            const emergencyReady = now >= refundableAt
            const canClaim = canInstant || emergencyReady
            const msLeft = refundableAt - now
            const hLeft = Math.floor(msLeft / 3_600_000)
            const mLeft = Math.floor((msLeft % 3_600_000) / 60_000)
            const isClaiming = claimingRoom === d.room_code
            return (
              <div key={d.room_code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '12px 0', borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
                <div>
                  <p style={{ color: '#e2e8f0', fontWeight: 700, fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem' }}>
                    Room {d.room_code} &nbsp;<span style={{ color: '#f59e0b' }}>${d.amount_usdt} USDT</span>
                  </p>
                  <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '3px' }}>
                    Deposited {new Date(d.deposited_at).toLocaleString()}
                  </p>
                  <p style={{ color: canInstant ? '#22c55e' : '#94a3b8', fontSize: '0.75rem', marginTop: '2px' }}>
                    {canInstant ? '✓ Refund ready — click to receive instantly' : emergencyReady ? '✓ Emergency refund ready' : `Emergency refund in ${hLeft}h ${mLeft}m`}
                  </p>
                </div>
                <button onClick={() => claimRefundForDeposit(d)} disabled={!canClaim || isClaiming}
                  style={{ background: canClaim && !isClaiming ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : '#1e1e30', border: 'none', borderRadius: '8px', padding: '8px 18px', color: canClaim && !isClaiming ? '#0a0a0f' : '#475569', fontWeight: 700, fontSize: '0.82rem', cursor: canClaim && !isClaiming ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                  {isClaiming ? 'Claiming…' : canClaim ? 'Get Refund →' : `Locked ${hLeft}h ${mLeft}m`}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* On-chain deposits found in room history but not in server records */}
      {onChainDeposits.filter(d => !stuckDeposits.some(s => s.room_code === d.code)).length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px' }}>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: '#ef4444', letterSpacing: '0.1em', marginBottom: '4px' }}>
            🔍 FOUND ON-CHAIN (not yet in server records)
          </p>
          <p style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '14px' }}>These deposits exist on the blockchain but the server has no record. Click to get your refund — you may need to sign once to verify your wallet.</p>
          {onChainDeposits.filter(d => !stuckDeposits.some(s => s.room_code === d.code)).map(d => {
            const isClaiming = claimingRoom === d.code
            return (
              <div key={d.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '12px 0', borderBottom: '1px solid rgba(239,68,68,0.1)' }}>
                <div>
                  <p style={{ color: '#e2e8f0', fontWeight: 700, fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem' }}>Room {d.code}</p>
                  <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '3px' }}>Chain ID {d.chainId} · Contract {d.escrow.slice(0, 10)}…</p>
                </div>
                <button onClick={async () => {
                  setClaimingRoom(d.code)
                  try {
                    if (chainId !== d.chainId) await switchChainAsync({ chainId: d.chainId })
                    // Try to get a server-signed refund first (instant, no 24h wait)
                    let refundSig: string | null = null
                    try {
                      const authSig = await signMessageAsync({ message: `Arena Games: ${address?.toLowerCase()}` })
                      const r = await fetch(`${SERVER_URL}/api/request-refund-sig`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ roomCode: d.code, address, chainId: d.chainId, escrowAddress: d.escrow, authSig }),
                      })
                      if (r.ok) { const data = await r.json(); refundSig = data.refundSig }
                    } catch { /* fall through to emergency */ }

                    if (refundSig) {
                      await writeContractAsync({ address: d.escrow, abi: CLAIM_REFUND_ABI, functionName: 'claimRefund', args: [d.roomId, refundSig as `0x${string}`], chainId: d.chainId, gas: 300000n })
                    } else {
                      await writeContractAsync({ address: d.escrow, abi: EMERGENCY_REFUND_ABI, functionName: 'emergencyRefund', args: [d.roomId], chainId: d.chainId, gas: 300000n })
                    }
                    fetch(`${SERVER_URL}/api/mark-refund-claimed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomCode: d.code, address }) }).catch(() => {})
                    setOnChainDeposits(prev => prev.filter(x => x.code !== d.code))
                  } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e)
                    if (msg.includes('TooEarlyForEmergency')) setError('Too early — wait 24h after deposit.')
                    else if (!msg.includes('rejected') && !msg.includes('denied')) setError('Claim failed. Try again.')
                  } finally { setClaimingRoom(null) }
                }} disabled={isClaiming}
                  style={{ background: isClaiming ? '#1e1e30' : 'linear-gradient(135deg,#ef4444,#f59e0b)', border: 'none', borderRadius: '8px', padding: '8px 18px', color: isClaiming ? '#475569' : '#0a0a0f', fontWeight: 700, fontSize: '0.82rem', cursor: isClaiming ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                  {isClaiming ? 'Claiming…' : 'Get Refund →'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {scanningChain && onChainDeposits.length === 0 && (
        <div style={{ color: '#475569', fontSize: '0.78rem', textAlign: 'center', marginBottom: '16px' }}>Scanning blockchain for deposits…</div>
      )}

      {/* Manual room code recovery */}
      <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '12px', padding: '14px 16px', marginBottom: '24px' }}>
        <p style={{ color: '#475569', fontSize: '0.75rem', marginBottom: '8px' }}>Missing a deposit? Enter the room code — or your recent rooms are scanned automatically above.</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={manualRoomCode} onChange={e => setManualRoomCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={6}
            style={{ flex: 1, background: '#0a0a0f', border: '1px solid #1e1e30', borderRadius: '8px', padding: '8px 12px', color: '#e2e8f0', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', letterSpacing: '0.12em', outline: 'none' }} />
          <button onClick={async () => {
            const code = manualRoomCode.trim().toUpperCase()
            if (!code || code.length < 4) return
            setManualScanning(true)
            const { reason } = await scanRoomCode(code)
            setManualScanning(false)
            if (reason === 'settled') setError(`Room ${code} is already settled — funds were distributed or previously claimed.`)
            else if (reason === 'not_found') setError(`No deposit found for room ${code} on this wallet.`)
            else { setManualRoomCode('') }
          }} disabled={manualScanning}
            style={{ background: manualScanning ? '#1e1e30' : 'linear-gradient(135deg,#7c3aed,#06b6d4)', border: 'none', borderRadius: '8px', padding: '8px 16px', color: manualScanning ? '#475569' : '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: manualScanning ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
            {manualScanning ? 'Scanning…' : 'Find Deposit'}
          </button>
        </div>
      </div>

      {/* Referral Program */}
      <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: '#64748b', letterSpacing: '0.1em', marginBottom: '4px' }}>REFERRAL PROGRAM</div>
            <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Earn 2% of every pot your referrals play — up to 20 games each</div>
          </div>
        </div>

        {referralStats?.referral_code ? (
          <div style={{ background: '#0d0d14', border: '1px solid #1e1e30', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ color: '#64748b', fontSize: '0.82rem', flexShrink: 0 }}>Your link:</span>
            <span style={{ color: '#a78bfa', fontSize: '0.85rem', fontWeight: 600, flex: 1, wordBreak: 'break-all' }}>
              {`${window.location.origin}?ref=${referralStats.referral_code}`}
            </span>
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}?ref=${referralStats.referral_code}`); setReferralCopied(true); setTimeout(() => setReferralCopied(false), 2000) }}
              style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #7c3aed', background: referralCopied ? 'rgba(34,197,94,0.15)' : 'rgba(124,58,237,0.15)', color: referralCopied ? '#22c55e' : '#a78bfa', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {referralCopied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        ) : (
          <button onClick={generateReferralCode} disabled={generatingCode}
            style={{ marginBottom: '20px', padding: '10px 20px', borderRadius: '10px', border: '1px solid #7c3aed', background: 'rgba(124,58,237,0.15)', color: '#a78bfa', fontWeight: 700, fontSize: '0.85rem', cursor: generatingCode ? 'not-allowed' : 'pointer', opacity: generatingCode ? 0.6 : 1 }}>
            {generatingCode ? 'Generating…' : 'Generate Referral Link'}
          </button>
        )}

        {/* Stats row */}
        {referralStats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'REFERRALS', value: referralStats.referees.length },
              { label: 'TOTAL EARNED', value: `$${referralStats.total_earned.toFixed(2)}` },
              { label: 'AVAILABLE', value: `$${referralStats.available.toFixed(2)}`, highlight: referralStats.available >= 50 },
            ].map(s => (
              <div key={s.label} style={{ background: '#0d0d14', border: '1px solid #1e1e30', borderRadius: '10px', padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.6rem', color: '#475569', letterSpacing: '0.1em', marginBottom: '6px' }}>{s.label}</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: s.highlight ? '#22c55e' : '#e2e8f0' }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Referee list */}
        {referralStats && referralStats.referees.length > 0 && (
          <div style={{ background: '#0d0d14', border: '1px solid #1e1e30', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e1e30', display: 'grid', gridTemplateColumns: '1fr 100px 80px', gap: '8px' }}>
              {['Player', 'Games', 'Earned'].map(h => (
                <span key={h} style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.6rem', color: '#475569', letterSpacing: '0.08em' }}>{h}</span>
              ))}
            </div>
            {referralStats.referees.map(r => (
              <div key={r.referee_address} style={{ padding: '10px 16px', borderBottom: '1px solid #0a0a12', display: 'grid', gridTemplateColumns: '1fr 100px 80px', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{r.referee_address.slice(0, 6)}…{r.referee_address.slice(-4)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ flex: 1, height: '4px', background: '#1e1e30', borderRadius: '2px' }}>
                    <div style={{ height: '100%', width: `${(r.games_counted / 20) * 100}%`, background: r.games_counted >= 20 ? '#475569' : '#7c3aed', borderRadius: '2px' }} />
                  </div>
                  <span style={{ color: r.games_counted >= 20 ? '#475569' : '#94a3b8', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{r.games_counted}/20</span>
                </div>
                <span style={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: 600 }}>${Number(r.earned_usdt).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Payout */}
        {referralStats && (
          referralStats.pending_payout ? (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '14px 18px', color: '#f59e0b', fontSize: '0.85rem' }}>
              Payout of <strong>${Number(referralStats.pending_payout.amount_usdt).toFixed(2)} USDT</strong> requested — pending manual transfer from the platform.
            </div>
          ) : referralStats.available >= 50 ? (
            <button onClick={requestReferralPayout} disabled={requestingPayout}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontWeight: 800, fontSize: '0.9rem', cursor: requestingPayout ? 'not-allowed' : 'pointer', opacity: requestingPayout ? 0.6 : 1 }}>
              {requestingPayout ? 'Requesting…' : `Request Payout — $${referralStats.available.toFixed(2)} USDT`}
            </button>
          ) : referralStats.total_earned > 0 ? (
            <div style={{ color: '#475569', fontSize: '0.82rem', textAlign: 'center' }}>
              ${(50 - referralStats.available).toFixed(2)} more to reach the $50 payout threshold
            </div>
          ) : null
        )}

        {referralError && <div style={{ marginTop: '12px', color: '#ef4444', fontSize: '0.82rem' }}>{referralError}</div>}
      </div>

      {/* Game history */}
      <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e1e30', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: '#64748b', letterSpacing: '0.1em' }}>GAME HISTORY</span>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{history.length} recent games</span>
        </div>
        {history.length === 0 && !loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No games yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e1e30' }}>
                  {['Room', 'Game', 'Score', 'Result', 'Date'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row, idx) => (
                  <tr key={row.id} style={{ borderBottom: idx < history.length - 1 ? '1px solid #0d0d14' : 'none' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.82rem', fontWeight: 700, color: '#a78bfa' }}>{row.room_code}</td>
                    <td style={{ padding: '12px 16px', color: '#e2e8f0', fontSize: '0.88rem', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{row.game_mode.replace('-', ' ')}</td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.85rem' }}>Won {row.score} / {row.total_rounds} rounds</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', background: row.result === 'win' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: row.result === 'win' ? '#22c55e' : '#ef4444', border: `1px solid ${row.result === 'win' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                        {row.result === 'win' ? `+$${row.earned.toFixed(2)}` : `-$${Math.abs(row.earned).toFixed(2)}`}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{new Date(row.played_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Avatar picker */}
      <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px' }}>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: '#64748b', letterSpacing: '0.1em' }}>
            AVATAR STYLE &nbsp;<span style={{ color: '#475569' }}>{AVATAR_STYLES.length} styles</span>
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <p style={{ color: '#475569', fontSize: '0.72rem' }}>Buying unlocks all 6 variants</p>
            <button onClick={() => setExpanded(e => !e)}
              style={{ background: expanded ? 'rgba(124,58,237,0.15)' : '#0a0a0f', border: `1px solid ${expanded ? '#7c3aed' : '#1e1e30'}`, borderRadius: '8px', padding: '4px 10px', color: expanded ? '#a78bfa' : '#64748b', fontWeight: 700, fontSize: '0.68rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {expanded ? '▲ Collapse' : '▼ Expand all'}
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {([['all', 'All'], [0, 'Free'], [1, '$1'], [2, '$2'], [3, '$3']] as [PriceFilter, string][]).map(([val, label]) => (
            <button key={String(val)} onClick={() => setPriceFilter(val)}
              style={{ background: priceFilter === val ? 'rgba(124,58,237,0.2)' : '#0a0a0f', border: `1px solid ${priceFilter === val ? '#7c3aed' : '#1e1e30'}`, borderRadius: '20px', padding: '4px 12px', color: priceFilter === val ? '#a78bfa' : '#64748b', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'Orbitron, sans-serif' }}>
              {label} <span style={{ opacity: 0.6, fontSize: '0.65rem' }}>{priceCounts[val === 'all' ? 'all' : val]}</span>
            </button>
          ))}
        </div>

        {/* Grid — horizontal scroll (collapsed) or full grid (expanded) */}
        <div style={expanded
          ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '8px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }
          : { display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }
        }>
          {filteredStyles.map(s => {
            const owned       = isStyleOwned(s.id, ownedBases)
            const isSaved     = avatarStyle === s.id
            const isPending   = pendingStyle?.id === s.id
            const isBuyingThis = buying === s.baseKey
            return (
              <button key={s.id}
                onClick={() => {
                  if (owned) setPendingStyle(isSaved && !pendingStyle ? null : s)
                  else setConfirmEntry(s)
                }}
                style={{
                  flexShrink: 0,
                  background: isPending ? 'rgba(6,182,212,0.15)' : isSaved ? 'rgba(124,58,237,0.18)' : '#0a0a0f',
                  border: `2px solid ${isPending ? '#06b6d4' : isSaved ? '#7c3aed' : '#1e1e30'}`,
                  borderRadius: '12px', padding: '10px 6px', cursor: 'pointer',
                  transition: 'all 0.15s', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: '5px', position: 'relative',
                  opacity: isBuyingThis ? 0.6 : 1,
                  width: expanded ? 'auto' : '82px',
                }}>
                {!owned && (
                  <span style={{ position: 'absolute', top: '4px', right: '4px', fontSize: '0.55rem', lineHeight: 1 }}>🔒</span>
                )}
                {isSaved && !isPending && (
                  <span style={{ position: 'absolute', top: '4px', left: '4px', width: '6px', height: '6px', borderRadius: '50%', background: '#7c3aed', display: 'block' }} />
                )}
                {isPending && (
                  <span style={{ position: 'absolute', top: '3px', left: '4px', fontSize: '0.55rem', color: '#06b6d4', lineHeight: 1, fontWeight: 700 }}>•</span>
                )}
                <img
                  src={address ? getAvatarUrl(address, s.id) : ''}
                  alt="" width={44} height={44}
                  onError={(e) => { e.currentTarget.src = `https://api.dicebear.com/8.x/identicon/svg?seed=${address}` }}
                  style={{ borderRadius: '50%', border: `2px solid ${isPending ? '#06b6d4' : isSaved ? '#7c3aed' : '#1e1e30'}`, background: '#1e1e30', display: 'block' }}
                />
                <span style={{ fontSize: '0.58rem', fontWeight: 700, color: isPending ? '#06b6d4' : isSaved ? '#a78bfa' : '#64748b', fontFamily: 'Orbitron, sans-serif', textAlign: 'center', lineHeight: 1.2 }}>
                  {s.baseName.toUpperCase()}
                </span>
                {s.bgLabel && s.bgLabel !== 'Classic' && (
                  <span style={{ fontSize: '0.52rem', color: '#475569', marginTop: '-3px' }}>{s.bgLabel}</span>
                )}
                {s.price === 0
                  ? <span style={{ fontSize: '0.52rem', color: '#22c55e', fontWeight: 700 }}>FREE</span>
                  : owned
                    ? <span style={{ fontSize: '0.52rem', color: '#a78bfa', fontWeight: 700 }}>✓ OWNED</span>
                    : <span style={{ fontSize: '0.52rem', color: '#f59e0b', fontWeight: 700 }}>${s.price} USDT</span>
                }
              </button>
            )
          })}
        </div>

        {/* Save bar — appears when a pending selection is made */}
        {pendingStyle && (
          <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.25)', borderRadius: '10px', padding: '10px 14px' }}>
            <img src={address ? getAvatarUrl(address, pendingStyle.id) : ''} alt="" width={32} height={32}
              style={{ borderRadius: '50%', border: '2px solid #06b6d4', background: '#1e1e30', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#06b6d4', fontWeight: 700, fontSize: '0.78rem' }}>{pendingStyle.baseName}{pendingStyle.bgLabel !== 'Classic' ? ` · ${pendingStyle.bgLabel}` : ''}</p>
              <p style={{ color: '#64748b', fontSize: '0.7rem' }}>Selected — save to apply</p>
            </div>
            <button onClick={saveAvatarSelection}
              style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)', border: 'none', borderRadius: '8px', padding: '8px 18px', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Save Avatar
            </button>
            <button onClick={() => setPendingStyle(null)}
              style={{ background: 'none', border: '1px solid #1e1e30', borderRadius: '8px', padding: '7px 10px', color: '#64748b', fontSize: '0.82rem', cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Purchase confirmation modal */}
      {confirmEntry && (
        <div onClick={() => !buying && setConfirmEntry(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '24px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#12121a', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '380px', textAlign: 'center' }}>
            {(() => {
              const baseMeta = STYLE_CATALOG.find(s => s.key === confirmEntry.baseKey)!
              const buyLabel = buyStatus === 'switching' ? 'Switching to Polygon…' : buyStatus === 'paying' ? `Sending $${baseMeta.price} USDT…` : buyStatus === 'saving' ? 'Saving…' : `Unlock for $${baseMeta.price} USDT`
              return (
                <>
                  <img src={address ? getAvatarUrl(address, confirmEntry.id) : ''} alt={confirmEntry.name}
                    width={80} height={80} style={{ borderRadius: '50%', border: `3px solid ${getAvatarColor(address ?? '')}`, background: '#1e1e30', margin: '0 auto 16px' }} />
                  <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>{confirmEntry.baseName}</h3>
                  {confirmEntry.bgLabel && confirmEntry.bgLabel !== 'Classic' && (
                    <p style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '8px' }}>{confirmEntry.bgLabel} variant</p>
                  )}
                  <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '20px', lineHeight: 1.6 }}>
                    One-time <strong style={{ color: '#f59e0b' }}>${baseMeta.price} USDT</strong> on Polygon.<br />
                    Unlocks <strong style={{ color: '#e2e8f0' }}>all 6 color variants</strong> of this style permanently.
                  </p>
                  <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>
                    🔑 Linked to <strong style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{address ? shortAddr(address) : ''}</strong> — works on any device
                  </div>
                  <button onClick={() => handleBuyStyle(confirmEntry)} disabled={!!buying}
                    style={{ width: '100%', background: buying ? '#1e1e30' : 'linear-gradient(135deg,#7c3aed,#06b6d4)', border: 'none', borderRadius: '10px', padding: '13px', color: buying ? '#64748b' : '#fff', fontWeight: 700, cursor: buying ? 'not-allowed' : 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', marginBottom: '10px' }}>
                    {buying ? buyLabel : `Unlock for $${baseMeta.price} USDT`}
                  </button>
                  {!buying && (
                    <button onClick={() => setConfirmEntry(null)}
                      style={{ width: '100%', background: 'transparent', border: '1px solid #1e1e30', borderRadius: '10px', padding: '11px', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>
                      Cancel
                    </button>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#12121a', border: '1px solid #1e1e30', borderRadius: '12px', padding: '16px 18px' }}>
      <p style={{ color: '#64748b', fontSize: '0.68rem', letterSpacing: '0.08em', marginBottom: '6px', fontFamily: 'Orbitron, sans-serif' }}>{label.toUpperCase()}</p>
      <p style={{ fontSize: 'clamp(1.1rem,3vw,1.4rem)', fontWeight: 700, fontFamily: 'Orbitron, sans-serif', color: color ?? '#e2e8f0' }}>{value}</p>
    </div>
  )
}
