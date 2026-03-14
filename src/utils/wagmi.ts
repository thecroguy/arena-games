import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { polygon, polygonAmoy, mainnet, bsc, arbitrum, optimism, base } from 'wagmi/chains'

export const wagmiConfig = getDefaultConfig({
  appName: 'Arena Games',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_WALLETCONNECT_PROJECT_ID',
  chains: [polygon, mainnet, bsc, arbitrum, optimism, base, polygonAmoy],
  ssr: false,
})
