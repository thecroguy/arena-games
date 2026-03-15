require('dotenv').config()
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')
const { ethers } = require('ethers')

// ── Config ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001

const configuredOrigins = (process.env.CLIENT_URL || '')
  .split(',').map(o => o.trim()).filter(Boolean)

function isAllowedOrigin(origin) {
  if (!origin) return true                                                           // server-to-server
  if (configuredOrigins.includes(origin)) return true                               // CLIENT_URL env
  if (/^https:\/\/[a-z0-9-]+(\.vercel\.app)$/.test(origin)) return true            // preview deploys
  if (origin === 'https://joinarena.space' || origin === 'https://www.joinarena.space') return true
  return false
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) callback(null, true)
    else callback(new Error('Not allowed by CORS'))
  },
  methods: ['GET', 'POST'],
}

// ── Game mode config ───────────────────────────────────────────────────────
const GAME_MODES = {
  'math-arena':     { type: 'speed',  rounds: 10, roundMs: 12000, minP: 2, maxP: 10 },
  'word-blitz':     { type: 'speed',  rounds: 10, roundMs: 15000, minP: 2, maxP: 10 },
  'reaction-grid':  { type: 'speed',  rounds: 15, roundMs: 5000,  minP: 2, maxP: 10 },
  'highest-unique': { type: 'sealed', rounds: 8,  roundMs: 20000, minP: 2, maxP: 20, min: 1, max: 100 },
  'lowest-unique':  { type: 'sealed', rounds: 8,  roundMs: 20000, minP: 2, maxP: 20, min: 1, max: 50  },
  'number-rush':    { type: 'sealed', rounds: 8,  roundMs: 20000, minP: 2, maxP: 30, min: 1, max: 50  },
}

const VALID_FEES     = new Set([0.5, 1, 2, 5, 10, 25, 50])
const VALID_ADDRESS  = /^0x[0-9a-fA-F]{40}$/
const VALID_TX_HASH  = /^0x[0-9a-fA-F]{64}$/

// ── Express + Socket.io ───────────────────────────────────────────────────
const app = express()
app.use(cors(corsOptions))
app.use(express.json())

const server = http.createServer(app)
const io = new Server(server, { cors: corsOptions })

// ── Supabase ──────────────────────────────────────────────────────────────
let supabase = null
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  console.log('Supabase connected')
}

// ── Escrow signing (server never sends on-chain transactions) ─────────────
// Per-chain config: RPC + deployed escrow contract address
const CHAIN_CONFIG = {
  137:   { rpc: process.env.POLYGON_RPC  || 'https://polygon-rpc.com',              escrow: process.env.ESCROW_POLYGON  || '' },
  80002: { rpc: process.env.AMOY_RPC     || 'https://rpc-amoy.polygon.technology',  escrow: process.env.ESCROW_AMOY     || '' },
  56:    { rpc: 'https://bsc-dataseed.binance.org',                                  escrow: process.env.ESCROW_BSC      || '' },
  42161: { rpc: 'https://arb1.arbitrum.io/rpc',                                      escrow: process.env.ESCROW_ARBITRUM || '' },
  10:    { rpc: 'https://mainnet.optimism.io',                                        escrow: process.env.ESCROW_OPTIMISM || '' },
  8453:  { rpc: 'https://mainnet.base.org',                                           escrow: process.env.ESCROW_BASE     || '' },
}

const SERVER_SIGNING_KEY = process.env.SERVER_SIGNING_KEY
const HOUSE_WALLET = (process.env.HOUSE_WALLET || '').toLowerCase()

/** Returns the escrow address for a chain, or '' if not configured. */
function getChainEscrowAddress(chainId) {
  const cfg = CHAIN_CONFIG[chainId]
  return cfg && cfg.escrow ? cfg.escrow : ''
}

/** Returns a read-only contract for hasDeposited() verification, or null. */
function getReadEscrow(chainId) {
  const cfg = CHAIN_CONFIG[chainId]
  if (!cfg || !cfg.escrow) return null
  try {
    const provider = new ethers.JsonRpcProvider(cfg.rpc)
    return new ethers.Contract(cfg.escrow, ['function hasDeposited(bytes32,address) view returns (bool)'], provider)
  } catch (e) {
    console.error('Escrow read init error:', e.message)
    return null
  }
}

/** keccak256 of the room code string — matches Solidity keccak256(abi.encodePacked(code)) */
function getRoomId(code) {
  return ethers.keccak256(ethers.toUtf8Bytes(code))
}

if (SERVER_SIGNING_KEY) {
  console.log('Escrow signing wallet configured ✓')
} else {
  console.warn('SERVER_SIGNING_KEY not set — claim signatures disabled (manual payouts only)')
}

// ── In-memory room store ──────────────────────────────────────────────────
const rooms            = new Map()
const addressRooms     = new Map() // address → Set of room codes they created
const disconnectTimers = new Map() // `${code}:${address}` → reconnect timer

// ── Matchmaking queues ────────────────────────────────────────────────────
// Key: `${gameMode}:${entryFee}:${chainId}` → [{socketId, address}]
const matchmakingQueues = new Map()
const matchmakingTimers = new Map()

function doMatch(key, gameMode, entryFee, chainId) {
  const queue = matchmakingQueues.get(key) || []
  if (queue.length < 2) return
  const matched = queue.splice(0)
  matchmakingQueues.set(key, [])
  if (matchmakingTimers.has(key)) { clearTimeout(matchmakingTimers.get(key)); matchmakingTimers.delete(key) }

  const cfg  = GAME_MODES[gameMode]
  const code = generateCode()
  const room = {
    code, gameMode,
    entryFee,
    chainId,
    maxPlayers: Math.min(matched.length, cfg.maxP),
    host:    matched[0].address,
    players: matched.map(p => ({ id: p.socketId, address: p.address, score: 0, answered: false, correct: null, sealedPick: null, deposited: false })),
    status: 'waiting',
    round: 0, question: null, roundTimer: null, roundStartAt: null,
  }
  rooms.set(code, room)

  matched.forEach(p => {
    const s = io.sockets.sockets.get(p.socketId)
    if (s) { s.join(code); s.data.roomCode = code; s.data.address = p.address; s.data.matchmakingKey = null }
    io.to(p.socketId).emit('matchmaking:matched', { code, entryFee, gameMode, chainId })
  })
  console.log(`[Matchmaking] ${matched.length} players → room ${code} [${gameMode}] $${entryFee}`)
}

// ── Room persistence (survives server restarts) ────────────────────────────
async function saveRoomToDb(room) {
  if (!supabase) return
  await supabase.from('active_rooms').upsert({
    code:        room.code,
    game_mode:   room.gameMode,
    entry_fee:   room.entryFee,
    chain_id:    room.chainId || 137,
    max_players: room.maxPlayers,
    host:        room.host,
    players:     room.players.map(p => ({ address: p.address, deposited: !!p.deposited })),
    status:      'waiting',
  }, { onConflict: 'code' }).catch(e => console.error('saveRoom error:', e.message))
}

async function deleteRoomFromDb(code) {
  if (!supabase) return
  await supabase.from('active_rooms').delete().eq('code', code)
    .catch(e => console.error('deleteRoom error:', e.message))
}

async function loadRoomsFromDb() {
  if (!supabase) return
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // last 2 hours only
  const { data } = await supabase.from('active_rooms')
    .select('*').eq('status', 'waiting').gt('created_at', cutoff)
  if (!data || data.length === 0) return
  for (const row of data) {
    const room = {
      code: row.code, gameMode: row.game_mode, entryFee: Number(row.entry_fee),
      chainId: row.chain_id, maxPlayers: row.max_players, host: row.host,
      players: (row.players || []).map(p => ({
        id: null, address: p.address, score: 0,
        answered: false, correct: null, sealedPick: null,
        deposited: !!p.deposited, disconnected: true,
      })),
      status: 'waiting', round: 0, question: null, roundTimer: null, roundStartAt: null,
    }
    rooms.set(room.code, room)
    const hostSet = addressRooms.get(room.host) || new Set()
    hostSet.add(room.code)
    addressRooms.set(room.host, hostSet)
  }
  console.log(`Restored ${data.length} active room(s) from DB`)
}
loadRoomsFromDb()

// ── Startup recovery: auto-issue refund sigs for rooms stuck mid-game ─────
// Handles the case where server restarted while a game was in progress.
// Finds all rooms with confirmed deposits but no settlement, signs refund
// authorizations, and stores them in Supabase so players can claim instantly.
async function recoverStuckRooms() {
  if (!supabase || !SERVER_SIGNING_KEY) return
  try {
    const { data: deposits } = await supabase
      .from('escrow_events')
      .select('room_code, room_id_hash, chain_id, escrow_address, player_address, amount_usdt')
      .eq('event_type', 'deposit_confirmed')
      .order('created_at', { ascending: false })
      .limit(500)
    if (!deposits || deposits.length === 0) return

    const roomCodes = [...new Set(deposits.map(d => d.room_code))]
    const { data: settled } = await supabase
      .from('escrow_events')
      .select('room_code')
      .in('event_type', ['claim_signed', 'refund_signed'])
      .in('room_code', roomCodes)

    const settledRooms = new Set((settled || []).map(s => s.room_code))
    const stuckCodes = roomCodes.filter(c => !settledRooms.has(c))
    if (stuckCodes.length === 0) return

    const wallet = new ethers.Wallet(SERVER_SIGNING_KEY)
    for (const code of stuckCodes) {
      if (rooms.has(code)) continue // still in memory, handled normally
      try {
        const roomDeposits = deposits.filter(d => d.room_code === code)
        const first = roomDeposits[0]
        const roomId = first.room_id_hash || getRoomId(code)
        const chainId = first.chain_id || 137
        const escrowAddr = first.escrow_address || getChainEscrowAddress(chainId)
        if (!escrowAddr) continue

        const msgHash = ethers.solidityPackedKeccak256(['bytes32', 'string'], [roomId, 'REFUND'])
        const refundSig = await wallet.signMessage(ethers.getBytes(msgHash))

        await supabase.from('escrow_events').insert(
          roomDeposits.map(d => ({
            event_type:     'refund_signed',
            room_code:      code,
            room_id_hash:   roomId,
            chain_id:       chainId,
            escrow_address: escrowAddr,
            player_address: d.player_address,
            amount_usdt:    d.amount_usdt,
            sig:            refundSig,
            note:           `Auto-refund on server restart — room ${code} was in progress`,
          }))
        )
        console.log(`[recovery] Issued refund sig for stuck room ${code} (${roomDeposits.length} player(s))`)
      } catch (e) {
        console.error(`[recovery] Failed for room ${code}:`, e.message)
      }
    }
  } catch (e) {
    console.error('[recovery] recoverStuckRooms error:', e.message)
  }
}
recoverStuckRooms()

// ── Simple per-socket rate limiter ────────────────────────────────────────
const rateLimits = new Map()
function rateLimit(socketId, maxPerSec = 5) {
  const now = Date.now()
  const entry = rateLimits.get(socketId) || { count: 0, reset: now + 1000 }
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 1000 }
  entry.count++
  rateLimits.set(socketId, entry)
  return entry.count <= maxPerSec
}

// ── Word list for Word Blitz ───────────────────────────────────────────────
const WORDS = [
  'apple','house','brain','chair','cloud','dance','earth','flame',
  'grace','heart','image','judge','knife','light','magic','night',
  'ocean','peace','queen','river','smile','tiger','voice','water',
  'watch','youth','blood','candy','drink','entry','faith','giant',
  'hotel','jewel','karma','laser','money','nerve','orbit','pilot',
  'quote','radar','solar','storm','truth','vapor','beach','crown',
  'death','elite','fence','ghost','index','joint','level','motor',
  'ninja','onion','pride','quick','robot','sharp','toxic','ultra',
  'vivid','waste','yield','azure','blaze','cycle','error','flare',
  'green','hound','inner','jelly','kitty','lunar','maple','novel',
  'opera','piano','relay','spell','titan','upper','venom','arrow',
  'boost','comet','delta','exile','forge','grind','hover','joust',
  'kudos','lemon','merit','nylon','proxy','quill','risky','suite',
  'thorn','unite','verse','weave','pluck','sword','brave','frost',
  'globe','honey','ivory','joker','knack','mango','ozone','plant',
  'rocky','umbra','vocal','angel','blast','crane','depot','eagle',
  'flint','grape','haunt','input','raven','speed','trove','urban',
  'zonal','stomp','swirl','thump','pixel','niche','quirk','blunt',
]

function scramble(word) {
  const a = word.split('')
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  const result = a.join('')
  return result === word ? scramble(word) : result
}

// ── Question generators ───────────────────────────────────────────────────
function makeQuestion(gameMode) {
  switch (gameMode) {
    case 'math-arena': {
      const ops = ['+', '-', '×']
      const op  = ops[Math.floor(Math.random() * ops.length)]
      let a = Math.floor(Math.random() * 50) + 1
      let b = Math.floor(Math.random() * 20) + 1
      if (op === '-' && b > a) [a, b] = [b, a]
      const answer = op === '+' ? a + b : op === '-' ? a - b : a * b
      return { type: 'math', a, b, op, answer }
    }
    case 'word-blitz': {
      const word     = WORDS[Math.floor(Math.random() * WORDS.length)]
      const scrambled = scramble(word)
      return { type: 'word', scrambled: scrambled.toUpperCase(), answer: word }
    }
    case 'reaction-grid': {
      const target = Math.floor(Math.random() * 16)
      return { type: 'grid', target, answer: String(target) }
    }
    case 'highest-unique':
    case 'lowest-unique':
    case 'number-rush': {
      const cfg = GAME_MODES[gameMode]
      return { type: 'sealed', min: cfg.min, max: cfg.max, answer: null }
    }
    default:
      return makeQuestion('math-arena')
  }
}

// Check answer for speed games (math, word, grid)
function checkAnswer(gameMode, question, rawAnswer) {
  if (!rawAnswer || typeof rawAnswer !== 'string') return false
  if (rawAnswer.length > 32) return false  // Reject unreasonably long answers
  if (question.type === 'math') {
    const n = parseInt(rawAnswer, 10)
    return !isNaN(n) && isFinite(n) && n === question.answer
  }
  if (question.type === 'word') {
    return rawAnswer.trim().toLowerCase() === question.answer
  }
  if (question.type === 'grid') {
    return rawAnswer === question.answer
  }
  return false
}

// Evaluate sealed bids at round end
function evaluateSealed(gameMode, picks) {
  if (!picks.length) return { winnerAddress: null, reason: 'No picks' }
  const freq = {}
  picks.forEach(({ pick }) => { freq[pick] = (freq[pick] || 0) + 1 })
  const unique = picks.filter(p => freq[p.pick] === 1)

  if (gameMode === 'highest-unique') {
    if (!unique.length) return { winnerAddress: null, reason: 'No unique bids — no points this round' }
    const winner = unique.reduce((a, b) => a.pick > b.pick ? a : b)
    return { winnerAddress: winner.address }
  }
  if (gameMode === 'lowest-unique') {
    if (!unique.length) return { winnerAddress: null, reason: 'No unique bids — no points this round' }
    const winner = unique.reduce((a, b) => a.pick < b.pick ? a : b)
    return { winnerAddress: winner.address }
  }
  if (gameMode === 'number-rush') {
    const minFreq = Math.min(...picks.map(p => freq[p.pick]))
    const rarest  = picks.filter(p => freq[p.pick] === minFreq)
    const winner  = rarest.reduce((a, b) => a.pick < b.pick ? a : b)
    return { winnerAddress: winner.address }
  }
  return { winnerAddress: null }
}

// ── Helper: public room shape ─────────────────────────────────────────────
function roomPublic(room) {
  return {
    code:       room.code,
    gameMode:   room.gameMode,
    host:       room.host,
    entryFee:   room.entryFee,
    maxPlayers: room.maxPlayers,
    status:     room.status,
    chainId:    room.chainId || 137,
    players:    room.players.map(p => ({ address: p.address, score: p.score, disconnected: !!p.disconnected, deposited: !!p.deposited })),
  }
}

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase()
}

function cleanupRoom(code) {
  const room = rooms.get(code)
  if (!room) return
  clearTimeout(room.roundTimer)
  // Cancel any pending reconnect timers for this room
  for (const p of room.players) {
    const key = `${code}:${p.address}`
    clearTimeout(disconnectTimers.get(key))
    disconnectTimers.delete(key)
  }
  // Decrement host's active room count
  const hostSet = addressRooms.get(room.host)
  if (hostSet) {
    hostSet.delete(code)
    if (hostSet.size === 0) addressRooms.delete(room.host)
  }
  rooms.delete(code)
  deleteRoomFromDb(code)
}

// ── Game flow ─────────────────────────────────────────────────────────────
function startCountdown(room) {
  // Cancel deposit timeout — game is starting
  if (room.depositTimeoutHandle) {
    clearTimeout(room.depositTimeoutHandle)
    room.depositTimeoutHandle = null
  }
  room.status = 'countdown'
  io.to(room.code).emit('room:update', roomPublic(room))
  let count = 3
  io.to(room.code).emit('game:countdown', count)
  const interval = setInterval(() => {
    count--
    if (count > 0) {
      io.to(room.code).emit('game:countdown', count)
    } else {
      clearInterval(interval)
      room.round = 0
      startRound(room)
    }
  }, 1000)
}

function startRound(room) {
  const cfg = GAME_MODES[room.gameMode] || GAME_MODES['math-arena']
  room.round++
  room.question   = makeQuestion(room.gameMode)
  room.status     = 'playing'
  room.roundStartAt = Date.now()
  room.players.forEach(p => { p.answered = false; p.correct = null; p.sealedPick = null })

  // Client payload: exclude server-only 'answer' field
  const { answer: _a, ...publicQuestion } = room.question
  io.to(room.code).emit('game:question', {
    round: room.round,
    total: cfg.rounds,
    timeMs: cfg.roundMs,
    ...publicQuestion,
  })

  room.roundTimer = setTimeout(() => endRound(room), cfg.roundMs)
}

function endRound(room) {
  clearTimeout(room.roundTimer)
  const cfg = GAME_MODES[room.gameMode] || GAME_MODES['math-arena']
  const isSealed = room.question.type === 'sealed'

  let sealedResult = null

  if (isSealed) {
    // Evaluate sealed bids
    const picks = room.players
      .filter(p => p.sealedPick !== null && p.sealedPick !== undefined)
      .map(p => ({ address: p.address, pick: p.sealedPick }))
    sealedResult = evaluateSealed(room.gameMode, picks)
    // Award point to winner
    if (sealedResult.winnerAddress) {
      const winner = room.players.find(p => p.address === sealedResult.winnerAddress)
      if (winner) winner.score++
    }
    sealedResult.picks = picks
  }

  io.to(room.code).emit('game:round_end', {
    answer:       isSealed ? null : String(room.question.answer),
    scores:       room.players.map(p => ({ address: p.address, score: p.score })),
    sealedResult: sealedResult,
  })

  if (room.round >= cfg.rounds) {
    setTimeout(() => endGame(room), 1500)
  } else {
    setTimeout(() => startRound(room), 2500)
  }
}

async function endGame(room) {
  room.status = 'finished'
  const sorted = [...room.players].sort((a, b) => b.score - a.score)
  const winner = sorted[0]
  const pot    = (room.entryFee * room.players.length * 0.85).toFixed(2)

  // ── Sign claim authorization (server never sends a transaction) ──────────
  // Winner calls claim(roomId, winner, sig) from their own wallet, paying ~$0.01 gas.
  let claimSig   = null
  let payoutMode = 'manual' // 'escrow' | 'manual'
  if (SERVER_SIGNING_KEY && getChainEscrowAddress(room.chainId)) {
    try {
      const roomId  = getRoomId(room.code)
      const msgHash = ethers.solidityPackedKeccak256(['bytes32', 'address'], [roomId, winner.address])
      const wallet  = new ethers.Wallet(SERVER_SIGNING_KEY)
      claimSig      = await wallet.signMessage(ethers.getBytes(msgHash))
      payoutMode    = 'escrow'
      console.log(`Signed claim for room ${room.code} → winner ${winner.address.slice(0, 8)} ($${pot})`)
    } catch (e) {
      console.error(`Claim signing failed for room ${room.code}:`, e.message)
    }
  }

  io.to(room.code).emit('game:over', {
    winner: winner.address,
    pot,
    payoutMode,  // 'escrow' = winner can claim via button; 'manual' = team pays within 24h
    claimSig,    // winner passes this to claim() on the contract
    scores: sorted.map((p, i) => ({ address: p.address, score: p.score, rank: i + 1 })),
  })

  if (supabase) {
    try {
      const cfg          = GAME_MODES[room.gameMode] || GAME_MODES['math-arena']
      const roomIdHash   = getRoomId(room.code)
      const escrowAddr   = getChainEscrowAddress(room.chainId) || null
      const rows = room.players.map(p => ({
        room_code:      room.code,
        game_mode:      room.gameMode,
        player_address: p.address.toLowerCase(),
        score:          p.score,
        total_rounds:   cfg.rounds,
        result:         p.address === winner.address ? 'win' : 'loss',
        entry_fee:      room.entryFee,
        earned:         p.address === winner.address ? parseFloat(pot) : -room.entryFee,
        players_count:  room.players.length,
        chain_id:       room.chainId || 137,
        payout_mode:    payoutMode,
        escrow_address: escrowAddr,
        room_id_hash:   roomIdHash,
        // Store the claim signature on the winner's row — cryptographic proof of who server declared winner
        claim_sig:      p.address === winner.address ? claimSig : null,
      }))
      await supabase.from('game_history').insert(rows)

      // Log claim authorization to escrow_events for full dispute audit trail
      if (claimSig && escrowAddr) {
        await supabase.from('escrow_events').insert({
          event_type:     'claim_signed',
          room_code:      room.code,
          room_id_hash:   roomIdHash,
          chain_id:       room.chainId || 137,
          escrow_address: escrowAddr,
          player_address: winner.address.toLowerCase(),
          amount_usdt:    parseFloat(pot),
          sig:            claimSig,
          note:           `Server authorized ${winner.address.slice(0, 8)} to claim $${pot} USDT`,
        })
      }
    } catch (e) {
      console.error('Supabase insert error:', e.message)
    }
  }

  setTimeout(() => cleanupRoom(room.code), 60_000)
}

// ── Escrow refund helper — signs a refund authorization, players claim individually ──
// Server never sends a transaction. Each player calls claimRefund(roomId, sig) from
// their own wallet, paying ~$0.01 gas to receive 100% of their entry fee back.
async function escrowRefund(room) {
  const escrowAddr = getChainEscrowAddress(room.chainId)
  if (!SERVER_SIGNING_KEY || !escrowAddr) return
  try {
    const roomId  = getRoomId(room.code)
    // Must match: keccak256(abi.encodePacked(roomId, "REFUND")) in the contract
    const msgHash = ethers.solidityPackedKeccak256(['bytes32', 'string'], [roomId, 'REFUND'])
    const wallet  = new ethers.Wallet(SERVER_SIGNING_KEY)
    const refundSig = await wallet.signMessage(ethers.getBytes(msgHash))
    io.to(room.code).emit('game:refund_sig', { refundSig })
    console.log(`Signed refund for abandoned room ${room.code}`)

    // Log refund authorization for every deposited player — dispute evidence
    if (supabase) {
      const depositedPlayers = room.players.filter(p => p.deposited)
      if (depositedPlayers.length > 0) {
        await supabase.from('escrow_events').insert(
          depositedPlayers.map(p => ({
            event_type:     'refund_signed',
            room_code:      room.code,
            room_id_hash:   roomId,
            chain_id:       room.chainId || 137,
            escrow_address: escrowAddr,
            player_address: p.address.toLowerCase(),
            amount_usdt:    room.entryFee,
            sig:            refundSig, // same sig — each player uses it individually
            note:           `Refund authorized for abandoned room ${room.code}`,
          }))
        )
      }
    }
  } catch (e) {
    console.error(`Refund signing failed for room ${room.code}:`, e.message)
  }
}

// ── Socket events ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('+ connect', socket.id)

  socket.on('rooms:list', (gameMode, cb) => {
    if (typeof cb !== 'function') return
    if (!GAME_MODES[gameMode]) return cb([])
    const list = []
    for (const [, room] of rooms) {
      if (room.gameMode === gameMode && room.status === 'waiting') {
        list.push({
          code:   room.code,
          host:   room.host,
          players: room.players.length,
          max:    room.maxPlayers,
          entry:  room.entryFee,
          status: room.players.length >= room.maxPlayers ? 'full' : 'waiting',
        })
      }
    }
    cb(list)
  })

  socket.on('room:get', (code, cb) => {
    if (typeof cb !== 'function') return
    const room = rooms.get(code)
    cb(room ? { code: room.code, status: room.status } : null)
  })

  socket.on('room:create', ({ gameMode, entryFee, maxPlayers, address, chainId, txHash, authSig }, cb) => {
    if (typeof cb !== 'function') return
    if (!rateLimit(socket.id)) return cb({ error: 'Too many requests' })

    // Validate inputs
    if (!GAME_MODES[gameMode])         return cb({ error: 'Invalid game mode' })
    if (!VALID_FEES.has(entryFee))     return cb({ error: 'Invalid entry fee' })
    if (!VALID_ADDRESS.test(address))  return cb({ error: 'Invalid wallet address' })
    if (txHash && !VALID_TX_HASH.test(txHash)) return cb({ error: 'Invalid transaction hash' })

    // Verify wallet ownership
    if (!authSig) return cb({ error: 'Authentication required — please sign the wallet challenge' })
    try {
      const recovered = ethers.verifyMessage(`Arena Games: ${address.toLowerCase()}`, authSig)
      if (recovered.toLowerCase() !== address.toLowerCase()) return cb({ error: 'Signature does not match wallet address' })
    } catch { return cb({ error: 'Invalid auth signature' }) }

    // Room creation cap — max 3 active rooms per address
    const hostRooms = addressRooms.get(address) || new Set()
    if (hostRooms.size >= 3) return cb({ error: 'You already have 3 active rooms. Please close one first.' })

    const cfg = GAME_MODES[gameMode]
    const clampedMax = Math.min(Math.max(maxPlayers || cfg.maxP, cfg.minP), cfg.maxP)
    const resolvedChainId = Number(chainId) || 137

    const code = generateCode()
    const room = {
      code, gameMode, entryFee,
      chainId: resolvedChainId,
      maxPlayers: clampedMax,
      host: address,
      players: [{ id: socket.id, address, score: 0, answered: false, correct: null, sealedPick: null, deposited: false }],
      status: 'waiting',
      round: 0, question: null, roundTimer: null, roundStartAt: null,
    }
    rooms.set(code, room)
    hostRooms.add(code)
    addressRooms.set(address, hostRooms)
    socket.join(code)
    socket.data.roomCode = code
    socket.data.address  = address
    saveRoomToDb(room)
    cb({ code, chainId: resolvedChainId })
    console.log(`Room ${code} [${gameMode}] created by ${address.slice(0, 8)} on chain ${resolvedChainId}`)
  })

  socket.on('room:join', ({ code, address, txHash, authSig }, cb) => {
    if (typeof cb !== 'function') return
    if (!rateLimit(socket.id)) return cb({ error: 'Too many requests' })

    if (!VALID_ADDRESS.test(address))   return cb({ error: 'Invalid wallet address' })
    if (txHash && !VALID_TX_HASH.test(txHash)) return cb({ error: 'Invalid transaction hash' })

    const room = rooms.get((code || '').toUpperCase())
    if (!room) return cb({ error: 'Room not found' })

    // Pre-matched player (already in room via matchmaking — skip auth, just sync socket)
    const preMatched = room.players.find(p => p.address === address && !p.disconnected)
    if (preMatched) {
      preMatched.id = socket.id
      socket.join(room.code); socket.data.roomCode = room.code; socket.data.address = address
      return cb({ ok: true, room: roomPublic(room) })
    }

    // Verify wallet ownership (skip for reconnects — they already proved it)
    const reconnecting = room.players.find(p => p.address === address && p.disconnected)
    if (!reconnecting) {
      if (!authSig) return cb({ error: 'Authentication required' })
      try {
        const recovered = ethers.verifyMessage(`Arena Games: ${address.toLowerCase()}`, authSig)
        if (recovered.toLowerCase() !== address.toLowerCase()) return cb({ error: 'Signature does not match wallet address' })
      } catch { return cb({ error: 'Invalid auth signature' }) }
    }

    if (reconnecting) {
      const key = `${room.code}:${address}`
      clearTimeout(disconnectTimers.get(key))
      disconnectTimers.delete(key)
      reconnecting.id = socket.id
      reconnecting.disconnected = false
      socket.join(room.code)
      socket.data.roomCode = room.code
      socket.data.address  = address
      const cfg = GAME_MODES[room.gameMode] || GAME_MODES['math-arena']
      const publicQ = room.question ? (({ answer: _a, ...rest }) => rest)(room.question) : null
      socket.emit('game:reconnected', {
        round:    room.round,
        total:    cfg.rounds,
        scores:   room.players.map(p => ({ address: p.address, score: p.score })),
        question: publicQ,
        timeMs:   room.question ? Math.max(0, cfg.roundMs - (Date.now() - room.roundStartAt)) : 0,
        status:   room.status,
        gameMode: room.gameMode,
      })
      io.to(room.code).emit('game:player_reconnected', { address })
      console.log(`+ ${address} reconnected to ${room.code}`)
      return cb({ ok: true, reconnected: true, room: roomPublic(room) })
    }

    if (room.status !== 'waiting')        return cb({ error: 'Game already started' })
    if (room.players.length >= room.maxPlayers) return cb({ error: 'Room is full' })
    if (room.players.find(p => p.address === address)) return cb({ error: 'Already in room' })

    room.players.push({ id: socket.id, address, score: 0, answered: false, correct: null, sealedPick: null, deposited: false })
    socket.join(code)
    socket.data.roomCode = code
    socket.data.address  = address

    io.to(code).emit('room:update', roomPublic(room))
    cb({ ok: true, room: roomPublic(room) })

    if (room.players.length >= room.maxPlayers) {
      setTimeout(() => startCountdown(room), 500)
    }
  })

  // Player confirms their escrow deposit — server verifies on-chain then marks them ready
  socket.on('room:deposit', async ({ code, txHash }, cb) => {
    if (typeof cb !== 'function') cb = () => {}
    const room = rooms.get((code || '').toUpperCase())
    if (!room || room.status !== 'waiting') return cb({ error: 'Room not found or already started' })

    const address = socket.data.address
    const player  = room.players.find(p => p.address === address)
    if (!player) return cb({ error: 'Not in room' })
    if (player.deposited) return cb({ ok: true }) // already confirmed

    const escrow = getReadEscrow(room.chainId)
    if (escrow) {
      // Verify on-chain that this player actually deposited
      try {
        const roomId    = getRoomId(code)
        const confirmed = await escrow.hasDeposited(roomId, address)
        if (!confirmed) return cb({ error: 'Deposit not found on-chain. Please wait a moment and try again.' })
      } catch (e) {
        console.error('Escrow verification error:', e.message)
        // If RPC fails, fall back to trusting the txHash
        if (!txHash || !VALID_TX_HASH.test(txHash)) return cb({ error: 'Could not verify deposit. Please try again.' })
      }
    } else {
      // Escrow not configured for this chain — trust txHash (legacy fallback)
      if (txHash && !VALID_TX_HASH.test(txHash)) return cb({ error: 'Invalid transaction hash' })
    }

    player.deposited = true
    saveRoomToDb(room)
    io.to(code).emit('room:update', roomPublic(room))
    cb({ ok: true })
    console.log(`${address.slice(0, 8)} deposited for room ${code} (chain ${room.chainId})`)

    // Start 5-min timeout on first deposit — if room never fills, auto-refund
    if (!room.depositTimeoutHandle) {
      room.depositTimeoutHandle = setTimeout(async () => {
        const r = rooms.get(code)
        if (!r || r.status !== 'waiting') return
        const hasDeposits = r.players.some(p => p.deposited)
        if (!hasDeposits) return
        console.log(`Room ${code} timed out — auto-refunding depositors`)
        io.to(code).emit('room:timeout', { message: 'Room timed out — no game started. Refunding your deposit.' })
        await escrowRefund(r)
        cleanupRoom(code)
      }, 5 * 60 * 1000) // 5 minutes
    }

    // Log deposit confirmation — evidence player paid; dispute-proof if they deny depositing
    const escrowAddr = getChainEscrowAddress(room.chainId)
    if (supabase && escrowAddr) {
      supabase.from('escrow_events').insert({
        event_type:     'deposit_confirmed',
        room_code:      code,
        room_id_hash:   getRoomId(code),
        chain_id:       room.chainId || 137,
        escrow_address: escrowAddr,
        player_address: address.toLowerCase(),
        amount_usdt:    room.entryFee,
        tx_hash:        txHash || null,
        note:           `On-chain deposit verified for room ${code}`,
      }).catch(e => console.error('escrow_events insert error:', e.message))
    }
  })

  socket.on('room:start', ({ code }) => {
    const room = rooms.get(code)
    if (!room) return
    if (room.host !== socket.data.address) return socket.emit('error', 'Not the host')
    if (room.players.length < 2)           return socket.emit('error', 'Need at least 2 players')
    if (room.status !== 'waiting')         return

    // Check all players have deposited (only enforced when escrow is configured)
    const escrow = getReadEscrow(room.chainId)
    if (escrow) {
      const notReady = room.players.filter(p => !p.deposited)
      if (notReady.length > 0) {
        const names = notReady.map(p => p.address.slice(0, 6) + '…').join(', ')
        return socket.emit('error', `Waiting for deposits from: ${names}`)
      }
    }

    startCountdown(room)
  })

  // Player submits an answer
  socket.on('game:answer', ({ code, answer }) => {
    if (!rateLimit(socket.id, 10)) return
    const room = rooms.get(code)
    if (!room || room.status !== 'playing') return

    const player = room.players.find(p => p.id === socket.id)
    if (!player || player.answered) return

    // Sanitize answer
    const raw = String(answer || '').slice(0, 64).trim()

    if (room.question.type === 'sealed') {
      // Sealed bid: just store the pick, don't reveal
      const cfg = GAME_MODES[room.gameMode]
      const pick = parseInt(raw, 10)
      if (isNaN(pick) || pick < cfg.min || pick > cfg.max) return

      player.answered   = true
      player.sealedPick = pick

      // Notify all players that someone submitted (no pick value revealed)
      const submitted = room.players.filter(p => p.answered).length
      io.to(code).emit('game:sealed_submitted', {
        address: player.address,
        submitted,
        total: room.players.length,
      })

      // If all submitted, end round early
      if (room.players.every(p => p.answered || p.disconnected)) {
        clearTimeout(room.roundTimer)
        endRound(room)
      }
    } else {
      // Speed game: check immediately
      player.answered = true
      const correct   = checkAnswer(room.gameMode, room.question, raw)
      player.correct  = correct
      if (correct) player.score++

      io.to(code).emit('game:player_answered', {
        address: player.address,
        correct,
        scores: room.players.map(p => ({ address: p.address, score: p.score })),
      })

      if (room.players.every(p => p.answered || p.disconnected)) {
        clearTimeout(room.roundTimer)
        endRound(room)
      }
    }
  })

  // ── Matchmaking ────────────────────────────────────────────────────────
  socket.on('matchmaking:join', ({ gameMode, entryFee, chainId, address, authSig }, cb) => {
    if (typeof cb !== 'function') return
    if (!rateLimit(socket.id)) return cb({ error: 'Too many requests' })
    if (!GAME_MODES[gameMode])        return cb({ error: 'Invalid game mode' })
    if (!VALID_FEES.has(entryFee))    return cb({ error: 'Invalid entry fee' })
    if (!VALID_ADDRESS.test(address)) return cb({ error: 'Invalid address' })
    if (!authSig) return cb({ error: 'Authentication required' })
    try {
      const recovered = ethers.verifyMessage(`Arena Games: ${address.toLowerCase()}`, authSig)
      if (recovered.toLowerCase() !== address.toLowerCase()) return cb({ error: 'Signature mismatch' })
    } catch { return cb({ error: 'Invalid auth signature' }) }

    const cId = Number(chainId) || 137
    const key = `${gameMode}:${entryFee}:${cId}`
    if (!matchmakingQueues.has(key)) matchmakingQueues.set(key, [])
    const queue = matchmakingQueues.get(key)

    // Replace if already in queue (reconnected browser tab)
    const idx = queue.findIndex(p => p.address === address)
    if (idx >= 0) queue.splice(idx, 1)
    queue.push({ socketId: socket.id, address })
    socket.data.matchmakingKey = key

    // Notify all waiting of new queue size
    queue.forEach(p => io.to(p.socketId).emit('matchmaking:queue_update', { size: queue.length }))
    cb({ ok: true, queueSize: queue.length })

    if (queue.length >= 2) { doMatch(key, gameMode, entryFee, cId); return }

    // Start 30s timeout on first joiner
    if (queue.length === 1) {
      if (matchmakingTimers.has(key)) clearTimeout(matchmakingTimers.get(key))
      matchmakingTimers.set(key, setTimeout(() => {
        matchmakingTimers.delete(key)
        const q = matchmakingQueues.get(key) || []
        if (q.length >= 2) { doMatch(key, gameMode, entryFee, cId); return }
        q.forEach(p => io.to(p.socketId).emit('matchmaking:timeout', { reason: 'No opponents found. Try creating a room.' }))
        matchmakingQueues.set(key, [])
      }, 30_000))
    }
  })

  socket.on('matchmaking:leave', (_, cb) => {
    const key = socket.data.matchmakingKey
    if (key) {
      const queue = (matchmakingQueues.get(key) || []).filter(p => p.socketId !== socket.id)
      matchmakingQueues.set(key, queue)
      socket.data.matchmakingKey = null
      queue.forEach(p => io.to(p.socketId).emit('matchmaking:queue_update', { size: queue.length }))
    }
    if (typeof cb === 'function') cb({ ok: true })
  })

  // Chat (lobby/queue only)
  socket.on('chat:send', ({ code, text }) => {
    if (!rateLimit(socket.id, 3)) return
    const room = rooms.get(code)
    if (!room) return
    const clean = String(text || '').replace(/[<>]/g, '').slice(0, 120).trim()
    if (!clean) return
    io.to(code).emit('chat:message', { address: socket.data.address, text: clean, ts: Date.now() })
  })

  // Emoji reactions (in-game)
  const VALID_EMOJIS = new Set(['😭','💀','🔥','😂','🤯','👀','🫡','😤'])
  socket.on('reaction:send', ({ code, emoji }) => {
    if (!rateLimit(socket.id, 8)) return
    const room = rooms.get(code)
    if (!room) return
    if (!VALID_EMOJIS.has(emoji)) return
    io.to(code).emit('reaction:message', { address: socket.data.address, emoji })
  })

  // Disconnect handling
  socket.on('disconnect', () => {
    // Clean up matchmaking queue
    const mqKey = socket.data.matchmakingKey
    if (mqKey) {
      const queue = (matchmakingQueues.get(mqKey) || []).filter(p => p.socketId !== socket.id)
      matchmakingQueues.set(mqKey, queue)
      queue.forEach(p => io.to(p.socketId).emit('matchmaking:queue_update', { size: queue.length }))
    }

    const code    = socket.data.roomCode
    const address = socket.data.address
    if (!code || !address) return
    const room = rooms.get(code)
    if (!room) return

    const wasActive = room.status === 'playing' || room.status === 'countdown'

    if (!wasActive) {
      // Waiting phase — remove immediately
      const hadDeposits = room.players.some(p => p.deposited)
      room.players = room.players.filter(p => p.id !== socket.id)
      console.log(`- ${address} left ${code} (${room.players.length} remaining, waiting)`)
      if (room.players.length === 0) {
        if (hadDeposits) escrowRefund(room).catch(() => {}) // refund any locked funds
        cleanupRoom(code)
        return
      }
      if (room.host === address) room.host = room.players[0].address
      io.to(code).emit('room:update', roomPublic(room))
      io.to(code).emit('game:player_left', { address })
      return
    }

    // Active game — 30-second reconnect window instead of instant abandon
    const player = room.players.find(p => p.id === socket.id)
    if (!player) return
    player.disconnected = true
    player.id = null
    console.log(`- ${address} disconnected from active game ${code} — 30s to reconnect`)
    io.to(code).emit('game:player_disconnected', { address, reconnectSecs: 30 })

    const key = `${code}:${address}`
    const timer = setTimeout(() => {
      disconnectTimers.delete(key)
      const r = rooms.get(code)
      if (!r) return
      r.players = r.players.filter(p => p.address !== address)
      console.log(`- ${address} forfeited from ${code} (reconnect timeout)`)
      const activePlayers = r.players.filter(p => !p.disconnected)
      if (activePlayers.length === 0) {
        escrowRefund(r).catch(() => {}) // refund locked entry fees
        io.to(code).emit('game:abandoned', { reason: 'All players disconnected — entry fees refunded to your wallet.' })
        cleanupRoom(code)
        return
      }
      // If all remaining connected players already answered, end round now
      if (r.status === 'playing' && r.players.every(p => p.answered || p.disconnected)) {
        clearTimeout(r.roundTimer)
        endRound(r)
      }
      io.to(code).emit('game:player_left', { address, reason: 'timeout' })
    }, 30_000)
    disconnectTimers.set(key, timer)
  })
})

// ── REST endpoints ────────────────────────────────────────────────────────

// Admin: snapshot of active games for crash recovery audit
const ADMIN_KEY = process.env.ADMIN_KEY
app.get('/admin/rooms', (req, res) => {
  if (ADMIN_KEY && req.headers['x-admin-key'] !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const snapshot = []
  for (const [, room] of rooms) {
    snapshot.push({
      code:       room.code,
      gameMode:   room.gameMode,
      entryFee:   room.entryFee,
      status:     room.status,
      round:      room.round,
      players:    room.players.map(p => ({ address: p.address, score: p.score, disconnected: !!p.disconnected })),
      pot:        (room.entryFee * room.players.length * 0.85).toFixed(2),
    })
  }
  res.json({ rooms: snapshot, timestamp: new Date().toISOString() })
})

app.get('/health', (_, res) => {
  res.json({ ok: true, rooms: rooms.size, uptime: Math.round(process.uptime()) })
})

app.get('/rooms/:gameMode', (req, res) => {
  const { gameMode } = req.params
  if (!GAME_MODES[gameMode]) return res.status(400).json({ error: 'Invalid game mode' })
  const list = []
  for (const [, room] of rooms) {
    if (room.gameMode === gameMode && room.status === 'waiting') {
      list.push({ code: room.code, players: room.players.length, max: room.maxPlayers, entry: room.entryFee })
    }
  }
  res.json(list)
})

// ── Profile API (wallet-sig verified, service key writes) ─────────────────
const VALID_ADDR = /^0x[0-9a-fA-F]{40}$/

app.post('/api/profile', express.json(), async (req, res) => {
  try {
    const { address, sig, updates } = req.body || {}
    if (!address || !sig || !updates) return res.status(400).json({ error: 'Missing fields' })
    if (!VALID_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' })

    const msg = `Arena profile update\n${address.toLowerCase()}`
    const recovered = ethers.verifyMessage(msg, sig)
    if (recovered.toLowerCase() !== address.toLowerCase()) return res.status(401).json({ error: 'Invalid signature' })

    const safe = {}
    if (typeof updates.username === 'string')     safe.username     = updates.username.replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 20)
    if (typeof updates.avatar_style === 'string') safe.avatar_style = updates.avatar_style.slice(0, 50)

    if (!supabase) return res.status(503).json({ error: 'DB not configured' })
    const { error } = await supabase.from('player_profiles')
      .upsert({ address: address.toLowerCase(), ...safe, updated_at: new Date().toISOString() }, { onConflict: 'address' })
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/avatar-unlock', express.json(), async (req, res) => {
  try {
    const { address, sig, style, currentStyles, txHash } = req.body || {}
    if (!address || !sig || !style) return res.status(400).json({ error: 'Missing fields' })
    if (!VALID_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' })

    const msg = `Arena avatar unlock: ${style}\n${address.toLowerCase()}`
    const recovered = ethers.verifyMessage(msg, sig)
    if (recovered.toLowerCase() !== address.toLowerCase()) return res.status(401).json({ error: 'Invalid signature' })

    // Verify the USDT payment on-chain if txHash provided
    if (txHash) {
      if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return res.status(400).json({ error: 'Invalid transaction hash' })
      if (!HOUSE_WALLET) return res.status(503).json({ error: 'Server not configured for avatar purchases' })
      try {
        const provider = new ethers.JsonRpcProvider(CHAIN_CONFIG[137].rpc)
        const receipt = await provider.getTransactionReceipt(txHash)
        if (!receipt || receipt.status !== 1) return res.status(400).json({ error: 'Transaction not confirmed or failed' })
        const USDT_POLYGON = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f'
        if (receipt.to?.toLowerCase() !== USDT_POLYGON) return res.status(400).json({ error: 'Not a USDT transaction' })
        const transferTopic = ethers.id('Transfer(address,address,uint256)')
        const log = receipt.logs.find(l =>
          l.address.toLowerCase() === USDT_POLYGON &&
          l.topics[0] === transferTopic &&
          l.topics[2] && ('0x' + l.topics[2].slice(26)).toLowerCase() === HOUSE_WALLET
        )
        if (!log) return res.status(400).json({ error: 'No USDT transfer to house wallet found in transaction' })
      } catch (e) {
        if (e.message?.includes('Invalid address')) return res.status(400).json({ error: 'Invalid transaction hash' })
        console.error('[avatar-unlock] RPC verify error:', e.message)
        // RPC failure — fall through and allow (don't block users for infra issues)
      }
    }

    const merged = Array.from(new Set([...(Array.isArray(currentStyles) ? currentStyles : ['bottts']), style]))
    if (!supabase) return res.status(503).json({ error: 'DB not configured' })
    const { error } = await supabase.from('player_profiles')
      .upsert({ address: address.toLowerCase(), purchased_styles: merged, avatar_style: style, updated_at: new Date().toISOString() }, { onConflict: 'address' })
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Active deposit check — prevent joining two games at once ──────────────
app.get('/api/active-deposit/:address', async (req, res) => {
  const { address } = req.params
  if (!VALID_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' })
  if (!supabase) return res.json({ hasActive: false })
  try {
    const addr = address.toLowerCase()
    const { data: deposits } = await supabase
      .from('escrow_events')
      .select('room_code')
      .eq('event_type', 'deposit_confirmed')
      .eq('player_address', addr)
      .order('created_at', { ascending: false })
      .limit(20)
    if (!deposits || deposits.length === 0) return res.json({ hasActive: false })
    const roomCodes = [...new Set(deposits.map(d => d.room_code))]
    const { data: settled } = await supabase
      .from('escrow_events')
      .select('room_code')
      .in('event_type', ['claim_signed', 'refund_signed'])
      .in('room_code', roomCodes)
    const settledRooms = new Set((settled || []).map(s => s.room_code))
    const activeRoom = roomCodes.find(c => !settledRooms.has(c))
    res.json({ hasActive: !!activeRoom, roomCode: activeRoom || null })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Stuck deposits: deposits with no payout or refund yet ─────────────────
// Used by Profile page to show pending funds + "Claim Refund" button after 24h
app.get('/api/stuck-deposits/:address', async (req, res) => {
  const { address } = req.params
  if (!VALID_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' })
  if (!supabase) return res.json([])
  try {
    const addr = address.toLowerCase()
    // All deposit_confirmed events for this player
    const { data: deposits } = await supabase
      .from('escrow_events')
      .select('room_code, room_id_hash, chain_id, escrow_address, amount_usdt, created_at')
      .eq('event_type', 'deposit_confirmed')
      .eq('player_address', addr)
      .order('created_at', { ascending: false })

    if (!deposits || deposits.length === 0) return res.json([])

    // Rooms that already have a payout or refund
    const roomCodes = [...new Set(deposits.map(d => d.room_code))]
    const { data: settled } = await supabase
      .from('escrow_events')
      .select('room_code')
      .in('event_type', ['claim_signed', 'refund_signed'])
      .in('room_code', roomCodes)

    // Also fetch refund sigs for these rooms (issued by server on restart or abandonment)
    const { data: refundSigs } = await supabase
      .from('escrow_events')
      .select('room_code, sig')
      .eq('event_type', 'refund_signed')
      .in('room_code', roomCodes)

    const settledRooms = new Set((settled || []).map(s => s.room_code))
    const refundSigMap = {}
    for (const r of (refundSigs || [])) {
      if (!settledRooms.has(r.room_code)) refundSigMap[r.room_code] = r.sig
    }

    // Deduplicate by room_code (take most recent deposit per room)
    const seenCodes = new Set()
    const stuck = deposits
      .filter(d => {
        if (settledRooms.has(d.room_code)) return false
        if (seenCodes.has(d.room_code)) return false
        seenCodes.add(d.room_code)
        return true
      })
      .map(d => ({
        room_code:      d.room_code,
        room_id_hash:   d.room_id_hash,
        chain_id:       d.chain_id,
        escrow_address: d.escrow_address,
        amount_usdt:    d.amount_usdt,
        deposited_at:   d.created_at,
        refund_sig:     refundSigMap[d.room_code] || null, // instant claimRefund if available
        refundable_at:  new Date(new Date(d.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
      }))

    res.json(stuck)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Pending claims: wins where player has claim sig but may not have claimed ─
// Winner closes browser before clicking Claim → comes back to Profile → sees it here
app.get('/api/pending-claim/:address', async (req, res) => {
  const { address } = req.params
  if (!VALID_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' })
  if (!supabase) return res.json([])
  try {
    const addr = address.toLowerCase()
    const { data } = await supabase
      .from('game_history')
      .select('room_code, game_mode, pot, entry_fee, claim_sig, escrow_address, room_id_hash, chain_id, played_at')
      .eq('player_address', addr)
      .eq('result', 'win')
      .eq('payout_mode', 'escrow')
      .not('claim_sig', 'is', null)
      .is('claimed_at', null)   // only unclaimed wins
      .order('played_at', { ascending: false })
      .limit(50)
    res.json(data || [])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Report deposit (client fallback — called after on-chain tx even if server was down) ─
// Ensures every deposit is recorded in escrow_events even if server restarted mid-flow.
app.post('/api/report-deposit', express.json(), async (req, res) => {
  try {
    const { address, room_code, tx_hash, chain_id, amount_usdt } = req.body || {}
    if (!address || !room_code) return res.status(400).json({ error: 'Missing fields' })
    if (!VALID_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' })
    if (!supabase) return res.json({ ok: true })

    const addr = address.toLowerCase()
    const code = String(room_code).toUpperCase().slice(0, 8)
    const chainId = Number(chain_id) || 137
    const escrowAddr = getChainEscrowAddress(chainId)
    if (!escrowAddr) return res.json({ ok: true })

    // Don't insert duplicate
    const { data: existing } = await supabase
      .from('escrow_events')
      .select('id')
      .eq('event_type', 'deposit_confirmed')
      .eq('room_code', code)
      .eq('player_address', addr)
      .limit(1)
    if (existing && existing.length > 0) return res.json({ ok: true, already: true })

    const roomId = getRoomId(code)
    await supabase.from('escrow_events').insert({
      event_type:     'deposit_confirmed',
      room_code:      code,
      room_id_hash:   roomId,
      chain_id:       chainId,
      escrow_address: escrowAddr,
      player_address: addr,
      amount_usdt:    Number(amount_usdt) || 0,
      tx_hash:        tx_hash || null,
      note:           `Client-reported deposit for room ${code} (server was down at deposit time)`,
    })
    console.log(`[report-deposit] Recorded missed deposit: ${addr.slice(0, 8)} → room ${code}`)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Room history: all rooms a player deposited in (from escrow_events) ────────
// Used by Profile to build the on-chain scan list without relying on localStorage.
app.get('/api/room-history/:address', async (req, res) => {
  const { address } = req.params
  if (!VALID_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' })
  if (!supabase) return res.json([])
  try {
    const addr = address.toLowerCase()
    const { data } = await supabase
      .from('escrow_events')
      .select('room_code, chain_id')
      .eq('event_type', 'deposit_confirmed')
      .eq('player_address', addr)
      .order('created_at', { ascending: false })
      .limit(100)
    // Deduplicate by room_code
    const seen = new Set()
    const rooms = (data || []).filter(r => {
      if (seen.has(r.room_code)) return false
      seen.add(r.room_code)
      return true
    })
    res.json(rooms)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Mark win as claimed (called by frontend after successful on-chain claim) ─
app.post('/api/mark-claimed', express.json(), async (req, res) => {
  try {
    const { address, room_code } = req.body || {}
    if (!address || !room_code) return res.status(400).json({ error: 'Missing fields' })
    if (!VALID_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' })
    if (!supabase) return res.json({ ok: true })
    await supabase.from('game_history')
      .update({ claimed_at: new Date().toISOString() })
      .eq('player_address', address.toLowerCase())
      .eq('room_code', room_code)
      .eq('result', 'win')
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Self keep-alive (prevents Render free tier from sleeping) ─────────────
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`
setInterval(() => {
  fetch(`${SELF_URL}/health`).catch(() => {})
}, 10 * 60 * 1000) // ping every 10 minutes

// ── Start ─────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Join Arena server running on port ${PORT}`)
})
