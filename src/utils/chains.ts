export type SupportedChain = {
  id: number
  name: string
  shortName: string
  symbol: string        // native gas token
  usdt: `0x${string}`  // USDT contract on this chain
  decimals: number      // USDT decimals (6 on most, 18 on BSC)
  color: string
  icon: string
  explorer: string
}

export const SUPPORTED_CHAINS: SupportedChain[] = [
  {
    id: 137,
    name: 'Polygon',
    shortName: 'Polygon',
    symbol: 'MATIC',
    usdt: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    decimals: 6,
    color: '#8247e5',
    icon: '🟣',
    explorer: 'https://polygonscan.com/tx/',
  },
  {
    id: 1,
    name: 'Ethereum',
    shortName: 'Ethereum',
    symbol: 'ETH',
    usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    color: '#627eea',
    icon: '🔷',
    explorer: 'https://etherscan.io/tx/',
  },
  {
    id: 56,
    name: 'BNB Chain',
    shortName: 'BNB',
    symbol: 'BNB',
    usdt: '0x55d398326f99059fF775485246999027B3197955',
    decimals: 18,
    color: '#f3ba2f',
    icon: '🟡',
    explorer: 'https://bscscan.com/tx/',
  },
  {
    id: 42161,
    name: 'Arbitrum',
    shortName: 'Arbitrum',
    symbol: 'ETH',
    usdt: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    decimals: 6,
    color: '#28a0f0',
    icon: '🔵',
    explorer: 'https://arbiscan.io/tx/',
  },
  {
    id: 10,
    name: 'Optimism',
    shortName: 'Optimism',
    symbol: 'ETH',
    usdt: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    decimals: 6,
    color: '#ff0420',
    icon: '🔴',
    explorer: 'https://optimistic.etherscan.io/tx/',
  },
  {
    id: 8453,
    name: 'Base',
    shortName: 'Base',
    symbol: 'ETH',
    usdt: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    decimals: 6,
    color: '#0052ff',
    icon: '🅱',
    explorer: 'https://basescan.org/tx/',
  },
]

export const CHAIN_MAP = Object.fromEntries(SUPPORTED_CHAINS.map(c => [c.id, c]))

export function getChain(chainId: number): SupportedChain | undefined {
  return CHAIN_MAP[chainId]
}

export const USDT_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const
