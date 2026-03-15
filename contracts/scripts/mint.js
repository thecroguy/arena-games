// Mint test USDT to any wallet on Amoy testnet.
// Run: npx hardhat run scripts/mint.js --network amoy
// Edit MINT_TO and USDT_ADDRESS below before running.
require('dotenv').config()
const { ethers } = require('hardhat')

const USDT_ADDRESS = process.env.MOCK_USDT_AMOY || ''  // set in contracts/.env
const MINT_TO      = process.env.MINT_TO || ''          // wallet to receive USDT
const MINT_AMOUNT  = process.env.MINT_AMOUNT || '1000'  // amount in USDT (not wei)

async function main() {
  if (!USDT_ADDRESS) throw new Error('Set MOCK_USDT_AMOY in contracts/.env')
  if (!MINT_TO)      throw new Error('Set MINT_TO in contracts/.env')

  const [deployer] = await ethers.getSigners()
  const usdt = await ethers.getContractAt('MockUSDT', USDT_ADDRESS)

  const amount = ethers.parseUnits(MINT_AMOUNT, 6)
  await (await usdt.mint(MINT_TO, amount)).wait()

  console.log(`✅ Minted ${MINT_AMOUNT} USDT → ${MINT_TO}`)
}

main().catch(err => { console.error(err); process.exit(1) })
