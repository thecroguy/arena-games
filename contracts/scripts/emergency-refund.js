// Emergency refund for stuck rooms (call after 24h from deposit time)
// Usage: npm run emergency-refund
// Edit STUCK_ROOMS below with the room codes that have stuck funds
require('dotenv').config()
const { ethers } = require('hardhat')

// ── Add room codes with stuck funds here ──────────────────────────────────
const STUCK_ROOMS = ['JPE9', 'YJC6']
// ─────────────────────────────────────────────────────────────────────────

const ABI = [
  'function emergencyRefund(bytes32 roomId) external',
  'function roomInfo(bytes32 roomId) external view returns (uint256 entryFee, uint256 playerCount, bool settled, address[] players)',
]

async function main() {
  const [signer] = await ethers.getSigners()
  const network  = await ethers.provider.getNetwork()
  const chainId  = Number(network.chainId)

  const escrowAddr = chainId === 137
    ? process.env.ESCROW_POLYGON
    : process.env.ESCROW_AMOY

  if (!escrowAddr) throw new Error('No escrow address in .env for chain ' + chainId)

  console.log('=== Emergency Refund ===')
  console.log('Chain:', chainId === 137 ? 'Polygon Mainnet' : 'Polygon Amoy')
  console.log('Escrow:', escrowAddr)
  console.log('Signer:', signer.address)
  console.log('')

  const escrow = new ethers.Contract(escrowAddr, ABI, signer)

  for (const code of STUCK_ROOMS) {
    const roomId = ethers.keccak256(ethers.toUtf8Bytes(code))
    console.log(`Room ${code}`)
    console.log(`  roomId: ${roomId}`)

    try {
      const [entryFee, playerCount, settled, players] = await escrow.roomInfo(roomId)
      console.log(`  Entry fee:    ${ethers.formatUnits(entryFee, 6)} USDT`)
      console.log(`  Players:      ${playerCount}`)
      console.log(`  Settled:      ${settled}`)
      console.log(`  Addresses:    ${players.join(', ')}`)

      if (settled) { console.log('  ⏭ Already settled — skipping\n'); continue }
      if (playerCount === 0n) { console.log('  ⏭ No deposits — skipping\n'); continue }

      console.log('  Calling emergencyRefund...')
      const tx = await escrow.emergencyRefund(roomId)
      await tx.wait()
      console.log(`  ✅ Refunded! TX: ${tx.hash}\n`)
    } catch (e) {
      if (e.message.includes('TooEarlyForEmergency')) {
        console.log('  ⏳ Too early — must wait 24h from deposit time\n')
      } else {
        console.error('  ❌ Error:', e.message, '\n')
      }
    }
  }
}

main().catch(err => { console.error(err); process.exit(1) })
