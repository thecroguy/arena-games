require('@nomicfoundation/hardhat-toolbox')
require('dotenv').config()

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001'

module.exports = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  paths: {
    sources: './contracts',
  },
  networks: {
    // Polygon Amoy testnet — deploy here first to verify everything works
    amoy: {
      url: process.env.AMOY_RPC || 'https://rpc-amoy.polygon.technology',
      accounts: [DEPLOYER_KEY],
      chainId: 80002,
    },
    // Polygon mainnet — deploy here for production
    polygon: {
      url: process.env.POLYGON_RPC || 'https://polygon-rpc.com',
      accounts: [DEPLOYER_KEY],
      chainId: 137,
    },
    // Add other chains here as needed (BSC, Arbitrum, Base, Optimism)
  },
  etherscan: {
    apiKey: {
      polygon:         process.env.POLYGONSCAN_API_KEY || '',
      polygonAmoy:     process.env.POLYGONSCAN_API_KEY || '',
    },
    customChains: [
      {
        network: 'polygonAmoy',
        chainId: 80002,
        urls: {
          apiURL:     'https://api-amoy.polygonscan.com/api',
          browserURL: 'https://amoy.polygonscan.com',
        },
      },
    ],
  },
}
