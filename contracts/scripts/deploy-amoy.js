// Deploy MockUSDT + ArenaEscrow to Polygon Amoy testnet.
// Run: npm run deploy:amoy-full
require('dotenv').config()
const { ethers } = require('hardhat')

async function main() {
  const [deployer] = await ethers.getSigners()
  const balance    = await ethers.provider.getBalance(deployer.address)

  console.log('=== Amoy Testnet Deployment ===')
  console.log('Deployer:', deployer.address)
  console.log('Balance: ', ethers.formatEther(balance), 'MATIC')

  if (balance === 0n) {
    console.error('\nDeployer has no MATIC. Get some at: https://faucet.polygon.technology')
    process.exit(1)
  }

  const serverAddress = process.env.SERVER_WALLET_ADDRESS
  const houseAddress  = process.env.HOUSE_WALLET_ADDRESS
  if (!serverAddress) throw new Error('SERVER_WALLET_ADDRESS missing in .env')
  if (!houseAddress)  throw new Error('HOUSE_WALLET_ADDRESS missing in .env')

  // 1 — Deploy MockUSDT
  console.log('\n[1/3] Deploying MockUSDT...')
  const MockUSDT = await ethers.getContractFactory('MockUSDT')
  const usdt     = await MockUSDT.deploy()
  await usdt.waitForDeployment()
  const usdtAddr = await usdt.getAddress()
  console.log('      MockUSDT:', usdtAddr)

  // 2 — Mint 10,000 USDT to deployer for testing
  console.log('[2/3] Minting 10,000 test USDT to deployer...')
  const amount = ethers.parseUnits('10000', 6)
  await (await usdt.mint(deployer.address, amount)).wait()
  console.log('      Done — deployer has 10,000 USDT')

  // 3 — Deploy ArenaEscrow
  console.log('[3/3] Deploying ArenaEscrow...')
  const Escrow  = await ethers.getContractFactory('ArenaEscrow')
  const escrow  = await Escrow.deploy(usdtAddr, serverAddress, houseAddress)
  await escrow.waitForDeployment()
  const escrowAddr = await escrow.getAddress()
  console.log('      ArenaEscrow:', escrowAddr)

  console.log('\n✅ Deployment complete!\n')
  console.log('── Add to server/.env ──────────────────────────────────')
  console.log(`ESCROW_AMOY=${escrowAddr}`)
  console.log('')
  console.log('── Add to frontend .env (Vercel) ───────────────────────')
  console.log(`VITE_ESCROW_AMOY=${escrowAddr}`)
  console.log('')
  console.log('── Amoy USDT address (for players to approve) ──────────')
  console.log(`VITE_USDT_AMOY=${usdtAddr}`)
  console.log('\nTo mint test USDT to a player wallet:')
  console.log(`  npm run mint -- --network amoy --usdt ${usdtAddr} --to <player_address> --amount 100`)
  console.log('\nView on explorer:')
  console.log(`  https://amoy.polygonscan.com/address/${escrowAddr}`)
}

main().catch(err => { console.error(err); process.exit(1) })
