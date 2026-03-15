const { ethers, network } = require('hardhat')

// USDT addresses per chain
const USDT = {
  137:   '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // Polygon mainnet
  80002: '0xf7de44b4786f581d27b9acf9c5aca9b91c47e27', // Amoy testnet mock USDT (check current address)
}

async function main() {
  const [deployer] = await ethers.getSigners()
  const chainId = network.config.chainId

  console.log('Deploying ArenaEscrow on chain', chainId)
  console.log('Deployer:', deployer.address)
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'MATIC')

  const usdtAddress   = USDT[chainId]
  const serverAddress = process.env.SERVER_WALLET_ADDRESS  // read-only signing wallet
  const houseAddress  = process.env.HOUSE_WALLET_ADDRESS   // receives 15% rake

  if (!usdtAddress)   throw new Error(`No USDT address for chainId ${chainId}`)
  if (!serverAddress) throw new Error('SERVER_WALLET_ADDRESS env var required')
  if (!houseAddress)  throw new Error('HOUSE_WALLET_ADDRESS env var required')

  console.log('\nConstructor args:')
  console.log('  USDT:   ', usdtAddress)
  console.log('  Server: ', serverAddress)
  console.log('  House:  ', houseAddress)

  const Escrow = await ethers.getContractFactory('ArenaEscrow')
  const escrow = await Escrow.deploy(usdtAddress, serverAddress, houseAddress)
  await escrow.waitForDeployment()

  const address = await escrow.getAddress()
  console.log('\n✅ ArenaEscrow deployed to:', address)
  console.log('\nAdd to .env:')
  console.log(`ESCROW_${chainId === 137 ? 'POLYGON' : 'AMOY'}=${address}`)
  console.log('\nVerify on explorer:')
  console.log(`npx hardhat verify --network ${chainId === 137 ? 'polygon' : 'amoy'} ${address} ${usdtAddress} ${serverAddress} ${houseAddress}`)
}

main().catch(err => { console.error(err); process.exit(1) })
