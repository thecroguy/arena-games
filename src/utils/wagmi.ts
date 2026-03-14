import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { polygon, polygonAmoy } from 'wagmi/chains'

export const wagmiConfig = getDefaultConfig({
  appName: 'Arena Games',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_WALLETCONNECT_PROJECT_ID',
  chains: [polygonAmoy, polygon],
  ssr: false,
})

export const USDT_ADDRESS_POLYGON = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
export const USDT_ADDRESS_AMOY    = '0x0000000000000000000000000000000000000000' // replace after deploying test USDT
export const CONTRACT_ADDRESS     = '0x0000000000000000000000000000000000000000' // replace after deploy
