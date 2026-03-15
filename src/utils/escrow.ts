import { keccak256, toBytes } from 'viem'

// ── Contract addresses (fill after deployment) ─────────────────────────────
// Chain ID → deployed ArenaEscrow address
export const ESCROW_ADDRESS: Partial<Record<number, `0x${string}`>> = {
  137:   (import.meta.env.VITE_ESCROW_POLYGON  || '') as `0x${string}`,  // Polygon mainnet
  80002: (import.meta.env.VITE_ESCROW_AMOY     || '') as `0x${string}`,  // Polygon Amoy testnet
  // Add other chains after deploying there:
  // 56:    (import.meta.env.VITE_ESCROW_BSC      || '') as `0x${string}`,
  // 42161: (import.meta.env.VITE_ESCROW_ARBITRUM || '') as `0x${string}`,
  // 10:    (import.meta.env.VITE_ESCROW_OPTIMISM  || '') as `0x${string}`,
  // 8453:  (import.meta.env.VITE_ESCROW_BASE      || '') as `0x${string}`,
}

/** Returns the escrow address for a chain, or null if not deployed there yet. */
export function getEscrowAddress(chainId: number): `0x${string}` | null {
  const addr = ESCROW_ADDRESS[chainId]
  return addr && addr !== '0x' ? addr : null
}

/** Compute the on-chain roomId from a room code string (matches Solidity keccak256(abi.encodePacked(code))). */
export function getRoomId(roomCode: string): `0x${string}` {
  return keccak256(toBytes(roomCode))
}

// ── Contract ABI (only the functions we call from the frontend) ────────────
export const ESCROW_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roomId',    type: 'bytes32' },
      { name: 'entryFee', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roomId', type: 'bytes32' },
      { name: 'winner', type: 'address' },
      { name: 'sig',    type: 'bytes'   },
    ],
    outputs: [],
  },
  {
    name: 'claimRefund',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roomId', type: 'bytes32' },
      { name: 'sig',    type: 'bytes'   },
    ],
    outputs: [],
  },
  {
    name: 'emergencyRefund',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'roomId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'hasDeposited',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'roomId', type: 'bytes32' },
      { name: 'player', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'roomInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'roomId', type: 'bytes32' }],
    outputs: [
      { name: 'entryFee',    type: 'uint256' },
      { name: 'playerCount', type: 'uint256' },
      { name: 'settled',     type: 'bool'    },
      { name: 'players',     type: 'address[]' },
    ],
  },
] as const

// ── USDT ABI (with approve — needed for escrow flow) ──────────────────────
export const USDT_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount',  type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const
