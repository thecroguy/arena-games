require('dotenv').config()
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')
// Pure crypto — no provider, no network detection, no retry loops
const { keccak_256 }              = require('@noble/hashes/sha3')
const { bytesToHex, hexToBytes, concatBytes } = require('@noble/hashes/utils')
const { secp256k1 }               = require('@noble/curves/secp256k1')

/** keccak256(bytes) → 0x-hex */
function keccak256(bytes)          { return '0x' + bytesToHex(keccak_256(bytes)) }
/** hex/Buffer → Uint8Array */
function getBytes(hex)             { return hexToBytes((hex || '').replace(/^0x/, '')) }
/** keccak256 of UTF-8 string → 0x-hex (ethers.id equivalent) */
function ethId(str)                { return keccak256(Buffer.from(str, 'utf8')) }

// ── Deterministic username fallback (mirrors frontend addrName) ─────────────
const _ADJS  = ['Brave','Swift','Dark','Iron','Bold','Sly','Wild','Frost','Storm','Blaze','Cyber','Neon','Pixel','Steel','Ghost','Nova','Lunar','Solar','Turbo','Hyper','Shadow','Crimson','Savage','Rogue','Sigma']
const _NOUNS = ['Fox','Wolf','Bear','Hawk','Lion','Tiger','Shark','Eagle','Viper','Dragon','Phoenix','Panda','Ninja','Rider','Coder','Sniper','Ranger','Hunter','Wizard','Knight','Pirate','Bandit','Nomad','Titan','Blade']
function addrName(address) {
  const hex = (address || '').replace(/^0x/i, '').toLowerCase().padEnd(10, '0')
  const a = parseInt(hex.slice(0, 4), 16) % _ADJS.length
  const n = parseInt(hex.slice(4, 8), 16) % _NOUNS.length
  const num = parseInt(hex.slice(8, 10), 16) % 100
  return `${_ADJS[a]}${_NOUNS[n]}${String(num).padStart(2, '0')}`
}
async function getPlayerUsername(address) {
  if (!supabase || !address) return addrName(address)
  try {
    const { data } = await supabase.from('player_profiles')
      .select('username').eq('address', address.toLowerCase()).maybeSingle()
    if (data) return data.username || addrName(address)
    // No profile yet — auto-create with deterministic name so leaderboard shows consistent name
    const name = addrName(address)
    supabase.from('player_profiles')
      .insert({ address: address.toLowerCase(), username: name, avatar_style: 'adventurer', purchased_styles: [] })
      .then(() => {}).catch(() => {})
    return name
  } catch { return addrName(address) }
}

/** solidityPackedKeccak256 — supports bytes32 / address / string types only */
function solidityPackedKeccak256(types, values) {
  const parts = types.map((t, i) => {
    if (t === 'bytes32') return getBytes(values[i])          // 32 bytes
    if (t === 'address') return getBytes(values[i])          // 20 bytes (packed, no padding)
    if (t === 'string')  return Buffer.from(values[i], 'utf8')
    throw new Error(`solidityPackedKeccak256: unsupported type ${t}`)
  })
  return keccak256(concatBytes(...parts))
}

/** Sign a pre-computed 32-byte message hash with EIP-191 prefix */
async function signMessage(privateKeyHex, msgHashHex) {
  const prefix    = Buffer.from('\x19Ethereum Signed Message:\n32')
  const ethHash   = keccak_256(concatBytes(prefix, getBytes(msgHashHex)))
  const privKey   = getBytes(privateKeyHex)
  const sig       = secp256k1.sign(ethHash, privKey, { lowS: true })
  const r = sig.r.toString(16).padStart(64, '0')
  const s = sig.s.toString(16).padStart(64, '0')
  const v = (sig.recovery + 27).toString(16).padStart(2, '0')
  return '0x' + r + s + v
}

/** Recover signer address from EIP-191 personal_sign (string message) */
function verifyMessage(message, sigHex) {
  const msgBytes  = Buffer.from(message, 'utf8')
  const prefix    = Buffer.from(`\x19Ethereum Signed Message:\n${msgBytes.length}`)
  const ethHash   = keccak_256(concatBytes(prefix, msgBytes))
  const sigBytes  = getBytes(sigHex)
  const r         = BigInt('0x' + bytesToHex(sigBytes.slice(0, 32)))
  const s         = BigInt('0x' + bytesToHex(sigBytes.slice(32, 64)))
  const v         = sigBytes[64]
  const recovery  = v >= 27 ? v - 27 : v
  const sig       = new secp256k1.Signature(r, s).addRecoveryBit(recovery)
  const pubKey    = sig.recoverPublicKey(ethHash)
  const addrBytes = keccak_256(pubKey.toRawBytes(false).slice(1)).slice(12)
  return '0x' + bytesToHex(addrBytes)
}

/** ABI-encode hasDeposited(bytes32,address) call data */
function encodeHasDepositedCall(roomIdHex, playerAddress) {
  const selector = keccak_256(Buffer.from('hasDeposited(bytes32,address)')).slice(0, 4)
  const addr32   = new Uint8Array(32)
  addr32.set(getBytes(playerAddress), 12)           // 20-byte address at offset 12
  return '0x' + bytesToHex(concatBytes(selector, getBytes(roomIdHex), addr32))
}

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
  'pattern-memory': { type: 'speed',  rounds: 10, roundMs: 12000, minP: 2, maxP: 10 },
  'reaction-grid':  { type: 'speed',  rounds: 15, roundMs: 5000,  minP: 2, maxP: 10 },
  'highest-unique': { type: 'sealed', rounds: 8,  roundMs: 20000, minP: 2, maxP: 20, min: 1, max: 100 },
  'lowest-unique':  { type: 'sealed', rounds: 8,  roundMs: 20000, minP: 2, maxP: 20, min: 1, max: 50  },
  'liars-dice':     { type: 'bluff',  rounds: 8,  roundMs: 60000, minP: 2, maxP: 6,  dicePerPlayer: 3 },
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

/** One-shot on-chain hasDeposited check — no persistent provider, no retry loop. */
async function hasDepositedOnChain(chainId, roomIdHex, playerAddress) {
  const cfg = CHAIN_CONFIG[chainId]
  if (!cfg || !cfg.escrow) return null // null = escrow not configured, can't verify
  const data = encodeHasDepositedCall(roomIdHex, playerAddress)
  const res = await fetch(cfg.rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: cfg.escrow, data }, 'latest'], id: 1 }),
    signal: AbortSignal.timeout(8000),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json.result !== '0x' && BigInt(json.result) !== 0n
}

/** keccak256 of the room code string — matches Solidity keccak256(abi.encodePacked(code)) */
function getRoomId(code) {
  return keccak256(Buffer.from(code, 'utf8'))
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

// ── Activity feed (last 50 events, broadcast to all) ─────────────────────
const activityFeed = []
function pushActivity(msg) {
  activityFeed.unshift({ msg, ts: Date.now() })
  if (activityFeed.length > 50) activityFeed.pop()
  io.emit('activity:update', activityFeed)
}

// ── Global chat (last 50 messages) ───────────────────────────────────────
const globalChat = []

// ════════════════════════════════════════════════════════════════════════════
// ── FAKE DATA — server-side generators (remove this entire block when real
//    users grow — search "FAKE DATA" to find all integration points) ────────
// ════════════════════════════════════════════════════════════════════════════
// Generate 1000 unique fake usernames using same Adj+Noun+number formula as real addrName()
const _FADJS  = ['Brave','Swift','Dark','Iron','Bold','Sly','Wild','Frost','Storm','Blaze',
                 'Cyber','Neon','Pixel','Steel','Ghost','Nova','Lunar','Solar','Turbo','Venom',
                 'Shadow','Crimson','Savage','Rogue','Sigma','Atomic','Toxic','Stealth','Apex','Echo']
const _FNOUNS = ['Fox','Wolf','Bear','Hawk','Lion','Tiger','Shark','Eagle','Viper','Dragon',
                 'Phoenix','Panda','Ninja','Rider','Coder','Sniper','Ranger','Hunter','Wizard','Knight',
                 'Pirate','Bandit','Nomad','Titan','Blade','Drifter','Stalker','Phantom','Ghost','Maverick']
// Generate names: adj×noun with varied num suffixes (01-99 spread) + some no-number names
const FAKE_USERS_SVR = (() => {
  const nums = [4,7,9,13,17,21,24,28,31,35,39,42,44,47,51,55,58,62,65,68,72,75,79,83,86,91,94,97]
  const out = []
  for (const num of nums) {
    for (let a = 0; a < _FADJS.length; a++) {
      for (let n = 0; n < _FNOUNS.length; n++) {
        out.push(`${_FADJS[a]}${_FNOUNS[n]}${String(num).padStart(2,'0')}`)
      }
    }
  }
  // ~25% of adj×noun combos also get a no-number variant (looks more natural)
  for (let a = 0; a < _FADJS.length; a++) {
    for (let n = 0; n < _FNOUNS.length; n++) {
      if ((a + n) % 4 === 0) out.push(`${_FADJS[a]}${_FNOUNS[n]}`)
    }
  }
  // Fisher-Yates shuffle
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
})()
// Players: appear in activity + give legit replies (never ask doubt questions)
// Lurkers: only ask questions in chat, never appear in activity
const FAKE_PLAYERS_SVR = FAKE_USERS_SVR.slice(0, 900)
const FAKE_LURKERS_SVR = FAKE_USERS_SVR.slice(900)

const FAKE_GAMES_SVR   = ['Math Arena','Pattern Memory','Reaction Grid','Highest Unique',"Liar's Dice"]
const FAKE_ENTRIES_SVR = ['$0.50','$1','$2','$5']
const FAKE_POTS_SVR    = { '$0.50':'0.85','$1':'1.70','$2':'3.40','$5':'8.50' }

// 5000-item chat pool: base messages shuffled repeatedly to fill
const _FCHAT_BASE = [
  'anyone want to play against me?','gg wp','just won a match, feeling good',
  'who wants to duel for $2?','math arena is too easy lol','pattern memory is actually hard',
  'reaction grid is brutal','lets go 🔥','highest unique is hard when smart ppl here',
  'lost twice :(','rematch anyone?','this platform is underrated','good game everyone',
  'duel open, anyone?','who tryna play right now','nice win','first time here',
  'quick match anyone?',"love liar's dice",'anyone on polygon?',
  'down for a game','solid platform ngl','cant believe i won that','on a streak rn',
  'nice round everyone','wp all','$1 match anyone?',
  'pattern memory is wild','just lost $2, need a rematch','reaction grid too fast for me',
  'highest unique is my best game','math arena is pure speed','anyone tried liar dice?',
  'gg no re','close match that was',
  "who's on a win streak?",'just joined the platform','is escrow instant?',
  'polygon fees are low, nice','$5 duel open if anyone brave','that liar dice bluff was perfect',
  'wp, good game','anyone playing highest unique?','pattern memory round 8 is insane',
  'need one more player','nice one','that was close','anyone up for $0.50?',
  // Money-focused
  'just cashed out $5, straight to my wallet no issues',
  'up $8 today from math arena matches',
  'won 3 in a row, pocketed like $12 total',
  'liar dice just made me $4, easiest game on here',
  'quick $2 duel win, love this platform',
  'deposited $5 yesterday, now at $18, not bad',
  'won $10 today playing pattern memory',
  'just claimed my winnings, instant payout',
  'been making like $5-10 a day on here',
  'won my first match, $0.85 in my wallet now lol',
  'nothing better than beating someone and taking their entry fee',
  'duel link open, $2 pot, anyone want it?',
  'just beat someone in math arena, easy $1.70',
  'up $6 since this morning, slow grind',
  'winning streak rn, do not challenge me lol',
  // Matchmaking honest pain (makes it feel real, not fake)
  'auto match takes forever when platform is quiet, just use duels',
  'tip: create a duel and share link, way faster than waiting for auto match',
  'auto matchmaking is slow rn, not enough players online yet',
  'just use the duel link bro, share it and your friend joins instantly',
  'platform is early so sometimes gotta wait for auto match, duel links are better',
]
const FAKE_CHAT_SVR = (() => {
  const out = []
  while (out.length < 5000) out.push(..._FCHAT_BASE)
  out.length = 5000
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
})()
let _fakeLastChat = ''  // prevent consecutive repeat

function _fakePick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function _fakeRand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function _fakePushActivity() {
  const u = _fakePick(FAKE_PLAYERS_SVR), g = _fakePick(FAKE_GAMES_SVR), e = _fakePick(FAKE_ENTRIES_SVR)
  const pot = FAKE_POTS_SVR[e]
  const msgs = [
    `${u} won $${pot} in ${g}`,
    `${u} joined ${g} (${e} entry)`,
    `${u} opened a ${e} room — ${g}`,
    `${u} created a ${e} duel — ${g}`,
  ]
  pushActivity(_fakePick(msgs))
  setTimeout(_fakePushActivity, _fakeRand(20000, 65000))
}

// Keywords that trigger a legitimacy response from a fake user
// Only trigger on authenticity/trust questions — not general chat
const _LEGIT_TRIGGERS = [
  'legit','leggit','legget','scam','fake','trust','safe','proof',
  'real money','is this real','for real','joking','joke',
  'doubt','skeptical','sketchy','sus','suspicious','verified',
  'withdraw','cashout','cash out','payout','pay out','get paid','get money',
  'actually work','does it work','really work','actually pay','do they pay',
  'lose money','stolen','rug','does this work','is it real','are you sure',
]
const _LEGIT_REPLIES  = [
  // Personal win proof
  'bro i just cashed out $14 yesterday, hit my wallet instantly',
  'i was skeptical at first too, now i am up $23 total',
  'dude i won $8 today, claimed it straight from escrow no issues',
  'been playing 3 weeks, pocketed like $50 total, its real',
  'just claimed $5 from a duel 10 mins ago, fully on-chain',
  'i thought it was bs too but the money came through same day',
  'withdrew $12 last week, no complaints',
  'won my 4th match today, all earnings sitting in my wallet rn',
  'i was doubtful too but its real, cashed out $20 total',
  'just won $8.50 from a math arena match lol easy',
  // Trust mechanism
  'escrow is on-chain so you can verify everything yourself',
  'smart contract handles it all, no middleman can touch funds',
  'check the contract on polygonscan, fully transparent',
  'all payouts are on-chain, nobody can freeze your winnings',
  'legit af, the escrow is verifiable on chain',
  'winner gets paid the moment game ends, automatic',
  // How to start
  'just connect metamask and pick a game, takes 2 mins',
  'you need USDT on polygon, bridge is like $0.10 gas',
  'start with $0.50 matches to get comfortable first',
  'i started with $1 matches, doubled up same day',
  'easy to start, just make sure you have polygon USDT',
  // Entry / fees
  'platform takes 15%, winner gets the rest straight to wallet',
  'entry goes into escrow on-chain, nobody touches it till game ends',
  '$0.50 entry pot is $0.85, easy money if you win',
  'gas on polygon is basically nothing, like cents',
  // Winning
  'claim button shows right after game, instant payout',
  'i claimed $4.25 in like 10 seconds after i won',
  'no manual approval needed, all automated on chain',
  // Refunds
  'if nobody joins your room it refunds automatically no worries',
  'stuck deposit? profile page has a refund button',
]

// Fake users spontaneously questioning legitimacy (organic Q&A between fake users)
const _LEGIT_QUESTIONS = [
  'wait is this actually real money?',
  'does this platform actually pay out?',
  'anyone actually withdrawn from here?',
  'is the money real or just points?',
  'can you actually cash out your winnings?',
  'wait so winnings go straight to your wallet?',
  'how do you know this isnt a scam lol',
  'this looks too good to be real ngl',
  'do they actually pay or is it fake?',
  'anyone have proof this is legit?',
]
// Follow-up from the same lurker AFTER getting a reply (sounds like they believed it)
const _LEGIT_FOLLOWUPS = [
  'oh nice so it withdraws instant after the game ends?',
  'damn okay gonna try $0.50 first',
  'wait so no waiting period?? straight to wallet??',
  'okay that actually sounds solid ngl',
  'alright i trust it, gonna play',
  'so it just claims automatically? no kyc or anything?',
  'ok ok lets goo',
  'bet gonna try a match rn',
  'so i just need polygon USDT? thats it?',
]

function _fakeSendLegitReply(lurkerName = null, extraDelay = 0) {
  // Player replies after a natural delay
  setTimeout(() => {
    const entry = { username: _fakePick(FAKE_PLAYERS_SVR), message: _fakePick(_LEGIT_REPLIES), ts: Date.now() }
    globalChat.push(entry)
    if (globalChat.length > 50) globalChat.shift()
    io.emit('chat:message', entry)
    // 40% chance a second player also chimes in
    if (Math.random() < 0.4) {
      setTimeout(() => {
        const entry2 = { username: _fakePick(FAKE_PLAYERS_SVR), message: _fakePick(_LEGIT_REPLIES), ts: Date.now() }
        globalChat.push(entry2)
        if (globalChat.length > 50) globalChat.shift()
        io.emit('chat:message', entry2)
      }, _fakeRand(5000, 15000))
    }
    // The original lurker follows up with a reaction (sounds like they got convinced)
    if (lurkerName && Math.random() < 0.6) {
      setTimeout(() => {
        const fu = { username: lurkerName, message: _fakePick(_LEGIT_FOLLOWUPS), ts: Date.now() }
        globalChat.push(fu)
        if (globalChat.length > 50) globalChat.shift()
        io.emit('chat:message', fu)
      }, _fakeRand(15000, 35000))
    }
  }, _fakeRand(8000, 25000) + extraDelay)
}

function _fakePushChat() {
  // 15% chance: fake user spontaneously asks a legitimacy question → triggers organic Q&A
  if (Math.random() < 0.15 && globalChat.length > 2) {
    // Lurker (not a player) asks a doubt question — a player then replies
    const q = _fakePick(_LEGIT_QUESTIONS)
    const lurker = _fakePick(FAKE_LURKERS_SVR)
    const qEntry = { username: lurker, message: q, ts: Date.now() }
    globalChat.push(qEntry)
    if (globalChat.length > 50) globalChat.shift()
    io.emit('chat:message', qEntry)
    _fakeSendLegitReply(lurker)  // a player answers; lurker may follow up
    setTimeout(_fakePushChat, _fakeRand(60000, 150000))
    return
  }
  let line = _fakePick(FAKE_CHAT_SVR)
  while (line === _fakeLastChat) line = _fakePick(FAKE_CHAT_SVR)  // no consecutive repeat
  _fakeLastChat = line
  const entry = { username: _fakePick(FAKE_PLAYERS_SVR), message: line, ts: Date.now() }
  globalChat.push(entry)
  if (globalChat.length > 50) globalChat.shift()
  io.emit('chat:message', entry)
  setTimeout(_fakePushChat, _fakeRand(45000, 120000))  // slower: 45–120s between fake messages
}

// Seed initial fake activity (5 items at staggered past timestamps)
;(function seedFakeActivity() {
  for (let i = 4; i >= 0; i--) {
    const u = _fakePick(FAKE_PLAYERS_SVR), g = _fakePick(FAKE_GAMES_SVR), e = _fakePick(FAKE_ENTRIES_SVR)
    const pot = FAKE_POTS_SVR[e]
    const msgs = [
      `${u} won $${pot} in ${g}`,
      `${u} joined ${g} (${e} entry)`,
      `${u} opened a ${e} room — ${g}`,
    ]
    activityFeed.push({ msg: _fakePick(msgs), ts: Date.now() - i * _fakeRand(30000, 120000) })
  }
  activityFeed.sort((a, b) => b.ts - a.ts)
})()

// Seed initial fake chat (6 messages at staggered past timestamps)
;(function seedFakeChat() {
  let lastMsg = ''
  for (let i = 5; i >= 0; i--) {
    let line = _fakePick(FAKE_CHAT_SVR)
    while (line === lastMsg) line = _fakePick(FAKE_CHAT_SVR)
    lastMsg = line
    globalChat.push({ username: _fakePick(FAKE_PLAYERS_SVR), message: line, ts: Date.now() - i * _fakeRand(40000, 180000) })
  }
})()

// ── Fake online count — server-side so ALL users see the same number ──────
// Starts at a realistic base (18-32), drifts ±1-3 every 25-55s
let _fakeOnlineOffset = _fakeRand(18, 32)
function _driftFakeOnline() {
  const delta = _fakeRand(-2, 3)  // slight upward bias
  _fakeOnlineOffset = Math.max(12, Math.min(50, _fakeOnlineOffset + delta))
  // Broadcast updated count to all connected clients
  io.emit('online:count', io.engine.clientsCount + _fakeOnlineOffset)
  setTimeout(_driftFakeOnline, _fakeRand(25000, 55000))
}
setTimeout(_driftFakeOnline, _fakeRand(25000, 55000))

// Start periodic fake generators (fire after short random delay so server start isn't obvious)
setTimeout(_fakePushActivity, _fakeRand(20000, 60000))
setTimeout(_fakePushChat,     _fakeRand(30000, 80000))
// ── END FAKE DATA ─────────────────────────────────────────────────────────────

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
  try {
    const { error } = await supabase.from('active_rooms').upsert({
      code:        room.code,
      game_mode:   room.gameMode,
      entry_fee:   room.entryFee,
      chain_id:    room.chainId || 137,
      max_players: room.maxPlayers,
      host:        room.host,
      players:     room.players.map(p => ({ address: p.address, deposited: !!p.deposited })),
      status:      'waiting',
    }, { onConflict: 'code' })
    if (error) console.error('saveRoom error:', error.message)
  } catch (e) { console.error('saveRoom error:', e.message) }
}

async function deleteRoomFromDb(code) {
  if (!supabase) return
  try {
    const { error } = await supabase.from('active_rooms').delete().eq('code', code)
    if (error) console.error('deleteRoom error:', error.message)
  } catch (e) { console.error('deleteRoom error:', e.message) }
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

// Auto-expire duel rooms every 60 seconds
setInterval(() => {
  const now = Date.now()
  for (const [code, room] of rooms) {
    if (room.roomType === 'duel' && room.duelExpiry && room.duelExpiry < now && room.status === 'waiting') {
      io.to(code).emit('room:timeout')
      // Issue refund sig before deleting so deposited host can claim from Profile
      if (room.players.some(p => p.deposited)) escrowRefund(room)
      rooms.delete(code)
      deleteRoomFromDb(code)
      console.log(`[duel-expiry] Room ${code} expired`)
    }
  }
}, 60000)

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

    for (const code of stuckCodes) {
      if (rooms.has(code)) continue // still in memory, handled normally
      try {
        const roomDeposits = deposits.filter(d => d.room_code === code)
        const first = roomDeposits[0]
        const roomId = (first.room_id_hash && first.room_id_hash.length === 66) ? first.room_id_hash : getRoomId(code)
        const chainId = first.chain_id || 137
        const escrowAddr = first.escrow_address || getChainEscrowAddress(chainId)
        if (!escrowAddr) continue

        const msgHash   = solidityPackedKeccak256(['bytes32', 'string'], [roomId, 'REFUND'])
        const refundSig = await signMessage(SERVER_SIGNING_KEY, msgHash)

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

// ── Question generators ───────────────────────────────────────────────────
function makeQuestion(gameMode, round = 1) {
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
    case 'pattern-memory': {
      const len    = Math.min(3 + Math.floor((round - 1) / 3), 6)
      const digits = Array.from({ length: len }, () => Math.floor(Math.random() * 9) + 1)
      return { type: 'pattern', sequence: digits.join(' '), answer: digits.join('') }
    }
    case 'reaction-grid': {
      const target = Math.floor(Math.random() * 16)
      return { type: 'grid', target, answer: String(target) }
    }
    case 'highest-unique':
    case 'lowest-unique':
    case 'liars-dice': {
      const cfg = GAME_MODES[gameMode]
      return { type: 'sealed', min: cfg.min, max: cfg.max, answer: null }
    }
    default:
      return makeQuestion('math-arena')
  }
}

// Check answer for speed games (math, pattern, grid)
function checkAnswer(gameMode, question, rawAnswer) {
  if (!rawAnswer || typeof rawAnswer !== 'string') return false
  if (rawAnswer.length > 32) return false  // Reject unreasonably long answers
  if (question.type === 'math') {
    const n = parseInt(rawAnswer, 10)
    return !isNaN(n) && isFinite(n) && n === question.answer
  }
  if (question.type === 'pattern') {
    return rawAnswer.trim().replace(/\s+/g, '') === question.answer
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
    players:    room.players.map(p => ({ address: p.address, username: p.username || addrName(p.address), score: p.score, disconnected: !!p.disconnected, deposited: !!p.deposited })),
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
  room.status = 'playing'
  room.roundEnding = false
  room.roundStartAt = Date.now()
  room.players.forEach(p => { p.answered = false; p.correct = null; p.sealedPick = null })

  // ── Bluff (Liar's Dice) — turn-based round ───────────────────────────────
  if (cfg.type === 'bluff') {
    room.bluff = {
      dice: {},
      currentBid: null,
      turnOrder: room.players.map(p => p.address),
      currentTurnIdx: 0,
    }
    room.players.forEach(p => {
      room.bluff.dice[p.address] = Array.from({ length: cfg.dicePerPlayer }, () => Math.floor(Math.random() * 6) + 1)
    })
    const totalDice = room.players.length * cfg.dicePerPlayer
    room.question = { type: 'bluff', totalDice, answer: null }

    io.to(room.code).emit('game:question', {
      round: room.round, total: cfg.rounds, timeMs: cfg.roundMs,
      type: 'bluff', totalDice,
      turnOrder: room.bluff.turnOrder, currentTurnIdx: 0, currentBid: null,
    })
    // Send private dice to each player
    room.players.forEach(p => {
      const s = io.sockets.sockets.get(p.id)
      if (s) s.emit('game:bluff_dice', { dice: room.bluff.dice[p.address] })
    })
    // Timeout — force challenge from current-turn player
    room.roundTimer = setTimeout(() => {
      if (room.bluff?.currentBid) resolveBluffChallenge(room, room.bluff.turnOrder[room.bluff.currentTurnIdx])
      else endBluffRound(room, null, null, null, null)
    }, cfg.roundMs)
    return
  }

  // ── All other game types ─────────────────────────────────────────────────
  room.question   = makeQuestion(room.gameMode, room.round)
  const { answer: _a, ...publicQuestion } = room.question
  io.to(room.code).emit('game:question', {
    round: room.round,
    total: cfg.rounds,
    timeMs: cfg.roundMs,
    ...publicQuestion,
  })
  room.roundTimer = setTimeout(() => endRound(room), cfg.roundMs)
}

function resolveBluffChallenge(room, challengerAddress) {
  clearTimeout(room.roundTimer)
  const b = room.bluff
  const bid = b.currentBid
  const allDiceArr = Object.values(b.dice).flat()
  const actualCount = allDiceArr.filter(d => d === bid.face).length
  const bidSucceeds = actualCount >= bid.count
  const winner = bidSucceeds ? bid.bidder : challengerAddress
  const loser  = bidSucceeds ? challengerAddress : bid.bidder
  const winnerPlayer = room.players.find(p => p.address === winner)
  if (winnerPlayer) winnerPlayer.score++
  endBluffRound(room, winner, loser, bid, actualCount)
}

function endBluffRound(room, winner, loser, bid, actualCount) {
  const cfg = GAME_MODES[room.gameMode]
  io.to(room.code).emit('game:round_end', {
    answer: null,
    scores: room.players.map(p => ({ address: p.address, username: p.username || addrName(p.address), score: p.score })),
    bluffResult: { allDice: room.bluff?.dice || {}, bid, actualCount, winner, loser },
  })
  if (room.round >= cfg.rounds) setTimeout(() => endGame(room), 2000)
  else setTimeout(() => startRound(room), 3500)
}

function endRound(room) {
  if (room.roundEnding) return
  room.roundEnding = true
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
    scores:       room.players.map(p => ({ address: p.address, username: p.username || addrName(p.address), score: p.score })),
    sealedResult: sealedResult,
  })

  if (room.round >= cfg.rounds) {
    setTimeout(() => endGame(room), 1500)
  } else {
    setTimeout(() => startRound(room), 2500)
  }
}

async function endGame(room) {
  if (room.status === 'finished') return
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
      const msgHash = solidityPackedKeccak256(['bytes32', 'address'], [roomId, winner.address])
      claimSig      = await signMessage(SERVER_SIGNING_KEY, msgHash)
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
  const winnerName = winner.username || addrName(winner.address)
  const gNameEnd = { 'math-arena': 'Math Arena', 'pattern-memory': 'Pattern Memory', 'reaction-grid': 'Reaction Grid', 'highest-unique': 'Highest Unique', 'lowest-unique': 'Lowest Unique', 'liars-dice': "Liar's Dice" }[room.gameMode] || room.gameMode
  pushActivity(`${winnerName} won $${pot} in ${gNameEnd}`)

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

      // ── Referral credits — 2% of pot per referee per game (up to 20 games) ──
      try {
        const totalPot = room.entryFee * room.players.length
        for (const p of room.players) {
          const addr = p.address.toLowerCase()
          const { data: ref } = await supabase.from('referrals')
            .select('id, games_counted').eq('referee_address', addr).maybeSingle()
          if (ref && ref.games_counted < 20) {
            const fee = parseFloat((totalPot * 0.02).toFixed(4))
            const { data: cur } = await supabase.from('referrals').select('earned_usdt').eq('id', ref.id).single()
            const newEarned = parseFloat(((cur?.earned_usdt || 0) + fee).toFixed(4))
            await supabase.from('referrals')
              .update({ games_counted: ref.games_counted + 1, earned_usdt: newEarned, updated_at: new Date().toISOString() })
              .eq('id', ref.id).lt('games_counted', 20)
          }
        }
      } catch (e) { console.error('Referral credit error:', e.message) }

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
    const msgHash   = solidityPackedKeccak256(['bytes32', 'string'], [roomId, 'REFUND'])
    const refundSig = await signMessage(SERVER_SIGNING_KEY, msgHash)
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
  // Broadcast online count to all clients (real + server-side fake offset)
  io.emit('online:count', io.engine.clientsCount + _fakeOnlineOffset)

  socket.on('rooms:list', (gameMode, cb) => {
    if (typeof cb !== 'function') return
    if (!GAME_MODES[gameMode]) return cb([])
    const list = []
    const now = Date.now()
    for (const [, room] of rooms) {
      if (room.gameMode === gameMode && room.status === 'waiting') {
        // Skip expired duel rooms
        if (room.roomType === 'duel' && room.duelExpiry && room.duelExpiry < now) continue
        list.push({
          code:      room.code,
          host:      room.host,
          hostName:  room.hostName || '',
          players:   room.players.length,
          max:       room.maxPlayers,
          entry:     room.entryFee,
          status:    room.players.length >= room.maxPlayers ? 'full' : 'waiting',
          roomType:  room.roomType || 'public',
          duelExpiry: room.duelExpiry || null,
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

  socket.on('room:create', async ({ gameMode, entryFee, maxPlayers, address, chainId, txHash, authSig, roomType }, cb) => {
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
      const recovered = verifyMessage(`Arena Games: ${address.toLowerCase()}`, authSig)
      if (recovered.toLowerCase() !== address.toLowerCase()) return cb({ error: 'Signature does not match wallet address' })
    } catch { return cb({ error: 'Invalid auth signature' }) }

    // Room creation cap — max 3 active rooms per address
    const hostRooms = addressRooms.get(address) || new Set()
    if (hostRooms.size >= 3) return cb({ error: 'You already have 3 active rooms. Please close one first.' })

    const cfg = GAME_MODES[gameMode]
    const clampedMax = Math.min(Math.max(maxPlayers || cfg.maxP, cfg.minP), cfg.maxP)
    const resolvedChainId = Number(chainId) || 137
    const resolvedRoomType = ['public', 'duel', 'private'].includes(roomType) ? roomType : 'public'

    const code = generateCode()
    const hostUsername = await getPlayerUsername(address)
    const room = {
      code, gameMode, entryFee,
      chainId: resolvedChainId,
      maxPlayers: clampedMax,
      host: address,
      hostName: hostUsername,
      roomType: resolvedRoomType,
      duelExpiry: resolvedRoomType === 'duel' ? Date.now() + 15 * 60 * 1000 : null,
      players: [{ id: socket.id, address, username: hostUsername, score: 0, answered: false, correct: null, sealedPick: null, deposited: false }],
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
    const gameName = { 'math-arena': 'Math Arena', 'pattern-memory': 'Pattern Memory', 'reaction-grid': 'Reaction Grid', 'highest-unique': 'Highest Unique', 'lowest-unique': 'Lowest Unique', 'liars-dice': "Liar's Dice" }[gameMode] || gameMode
    if (resolvedRoomType === 'duel') pushActivity(`${hostUsername} created a $${entryFee} duel — ${gameName}`)
    else pushActivity(`${hostUsername} opened a $${entryFee} room — ${gameName}`)
  })

  socket.on('room:join', async ({ code, address, txHash, authSig }, cb) => {
    if (typeof cb !== 'function') return
    if (!rateLimit(socket.id)) return cb({ error: 'Too many requests' })

    if (!VALID_ADDRESS.test(address))   return cb({ error: 'Invalid wallet address' })
    if (txHash && !VALID_TX_HASH.test(txHash)) return cb({ error: 'Invalid transaction hash' })

    let room = rooms.get((code || '').toUpperCase())
    // On-demand DB recovery — handles race condition on server cold start
    if (!room && supabase) {
      const { data } = await supabase.from('active_rooms')
        .select('*').eq('code', (code || '').toUpperCase()).eq('status', 'waiting').single()
      if (data) {
        room = {
          code: data.code, gameMode: data.game_mode, entryFee: Number(data.entry_fee),
          chainId: data.chain_id, maxPlayers: data.max_players, host: data.host,
          players: (data.players || []).map(p => ({
            id: null, address: p.address, score: 0,
            answered: false, correct: null, sealedPick: null,
            deposited: !!p.deposited, disconnected: true,
          })),
          status: 'waiting', round: 0, question: null, roundTimer: null, roundStartAt: null,
        }
        rooms.set(room.code, room)
        console.log(`[room:join] On-demand recovery of room ${room.code} from DB`)
      }
    }
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
        const recovered = verifyMessage(`Arena Games: ${address.toLowerCase()}`, authSig)
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
      // Re-send private dice for bluff games
      if (room.bluff?.dice?.[address]) {
        socket.emit('game:bluff_dice', {
          dice: room.bluff.dice[address],
          currentBid: room.bluff.currentBid,
          currentTurnIdx: room.bluff.currentTurnIdx,
          turnOrder: room.bluff.turnOrder,
        })
      }
      io.to(room.code).emit('game:player_reconnected', { address })
      console.log(`+ ${address} reconnected to ${room.code}`)
      return cb({ ok: true, reconnected: true, room: roomPublic(room) })
    }

    if (room.status !== 'waiting')        return cb({ error: 'Game already started' })
    if (room.players.length >= room.maxPlayers) return cb({ error: 'Room is full' })
    if (room.players.find(p => p.address === address)) return cb({ error: 'Already in room' })

    const joinerUsername = await getPlayerUsername(address)
    room.players.push({ id: socket.id, address, username: joinerUsername, score: 0, answered: false, correct: null, sealedPick: null, deposited: false })
    socket.join(code)
    socket.data.roomCode = code
    socket.data.address  = address

    const gName = { 'math-arena': 'Math Arena', 'pattern-memory': 'Pattern Memory', 'reaction-grid': 'Reaction Grid', 'highest-unique': 'Highest Unique', 'lowest-unique': 'Lowest Unique', 'liars-dice': "Liar's Dice" }[room.gameMode] || room.gameMode
    pushActivity(`${joinerUsername} joined ${gName} ($${room.entryFee} entry)`)

    io.to(code).emit('room:update', roomPublic(room))
    cb({ ok: true, room: roomPublic(room) })
  })

  // Player confirms their escrow deposit — server verifies on-chain then marks them ready
  socket.on('room:deposit', async ({ code, txHash, address: payloadAddress }, cb) => {
    if (typeof cb !== 'function') cb = () => {}
    let room = rooms.get((code || '').toUpperCase())
    // On-demand DB recovery — same as room:join, handles server restart between create and deposit
    if ((!room || room.status !== 'waiting') && supabase) {
      const { data } = await supabase.from('active_rooms')
        .select('*').eq('code', (code || '').toUpperCase()).eq('status', 'waiting').single()
      if (data) {
        room = {
          code: data.code, gameMode: data.game_mode, entryFee: Number(data.entry_fee),
          chainId: data.chain_id, maxPlayers: data.max_players, host: data.host,
          players: (data.players || []).map(p => ({
            id: null, address: p.address, score: 0,
            answered: false, correct: null, sealedPick: null,
            deposited: !!p.deposited, disconnected: true,
          })),
          status: 'waiting', round: 0, question: null, roundTimer: null, roundStartAt: null,
        }
        rooms.set(room.code, room)
        // Re-join the socket to this room's channel
        socket.join(room.code)
        console.log(`[room:deposit] On-demand recovery of room ${room.code} from DB`)
      }
    }
    if (!room || room.status !== 'waiting') return cb({ error: 'Room not found or already started' })

    // After server restart socket.data.address is lost — accept it from the payload as fallback
    const address = socket.data.address || (VALID_ADDRESS.test(payloadAddress) ? payloadAddress : null)
    if (address && !socket.data.address) socket.data.address = address  // restore for future events
    let player = room.players.find(p => p.address === address)
    // Player might not be in recovered room list yet — add them
    if (!player && address) {
      const depositUsername = await getPlayerUsername(address)
      player = { id: socket.id, address, username: depositUsername, score: 0, answered: false, correct: null, sealedPick: null, deposited: false }
      room.players.push(player)
      io.to(room.code).emit('room:update', roomPublic(room))
    }
    if (!player) return cb({ error: 'Not in room' })
    if (player.deposited) return cb({ ok: true }) // already confirmed

    const escrowAddr = getChainEscrowAddress(room.chainId)
    if (escrowAddr) {
      // Verify on-chain that this player actually deposited
      // The tx may still be pending when this fires — retry up to 3×10s before giving up
      try {
        let confirmed = await hasDepositedOnChain(room.chainId, getRoomId(code), address)
        if (!confirmed && txHash && VALID_TX_HASH.test(txHash)) {
          for (let attempt = 0; attempt < 3 && !confirmed; attempt++) {
            await new Promise(r => setTimeout(r, 10000))
            confirmed = await hasDepositedOnChain(room.chainId, getRoomId(code), address)
            if (confirmed) console.log(`Deposit for ${code} confirmed after ${(attempt + 1) * 10}s`)
          }
        }
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

    // Auto-start when room is at capacity AND every player has deposited
    if (room.players.length >= room.maxPlayers && room.players.every(p => p.deposited)) {
      console.log(`All players deposited in full room ${code} — auto-starting`)
      setTimeout(() => startCountdown(room), 2000) // 2s grace so UI can update first
    }

    // Start 10-min timeout on first deposit — if room never fills, auto-refund
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
      }, 10 * 60 * 1000) // 10 minutes
    }

    // Log deposit confirmation — evidence player paid; dispute-proof if they deny depositing
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
      }).then(({ error }) => error && console.error('escrow_events insert error:', error.message))
    }
  })

  socket.on('room:start', ({ code }) => {
    const room = rooms.get(code)
    if (!room) return
    if (room.host !== socket.data.address) return socket.emit('error', 'Not the host')
    if (room.players.length < 2)           return socket.emit('error', 'Need at least 2 players')
    if (room.status !== 'waiting')         return

    // Check all players have deposited (only enforced when escrow is configured)
    if (getChainEscrowAddress(room.chainId)) {
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

  // Bluff: player submits a bid
  socket.on('game:bid', ({ code, count, face }) => {
    if (!rateLimit(socket.id)) return
    const room = rooms.get(code)
    if (!room || room.status !== 'playing' || !room.bluff) return
    const b = room.bluff
    const playerAddress = socket.data.address
    if (b.turnOrder[b.currentTurnIdx] !== playerAddress) return
    const c = Number(count), f = Number(face)
    if (!Number.isInteger(c) || !Number.isInteger(f) || f < 1 || f > 6 || c < 1) return
    const totalDice = room.players.length * GAME_MODES[room.gameMode].dicePerPlayer
    if (c > totalDice) return
    const cur = b.currentBid
    if (cur) {
      const isHigher = c > cur.count || (c === cur.count && f > cur.face)
      if (!isHigher) { socket.emit('game:bluff_error', 'Bid must be higher than current bid'); return }
    }
    b.currentBid = { count: c, face: f, bidder: playerAddress }
    b.currentTurnIdx = (b.currentTurnIdx + 1) % b.turnOrder.length
    io.to(code).emit('game:bluff_update', { currentBid: b.currentBid, currentTurnIdx: b.currentTurnIdx })
  })

  // Bluff: player calls LIAR
  socket.on('game:challenge', ({ code }) => {
    if (!rateLimit(socket.id)) return
    const room = rooms.get(code)
    if (!room || room.status !== 'playing' || !room.bluff) return
    const b = room.bluff
    const playerAddress = socket.data.address
    if (b.turnOrder[b.currentTurnIdx] !== playerAddress) return
    if (!b.currentBid) { socket.emit('game:bluff_error', 'No bid to challenge yet'); return }
    resolveBluffChallenge(room, playerAddress)
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
      const recovered = verifyMessage(`Arena Games: ${address.toLowerCase()}`, authSig)
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

  // Global chat
  socket.on('global:chat:send', ({ username, message }) => {
    if (!message || typeof message !== 'string') return
    const trimmed = message.trim().slice(0, 200)
    if (!trimmed) return
    const name = (username || 'Anonymous').slice(0, 30)
    const entry = { username: name, message: trimmed, ts: Date.now() }
    globalChat.unshift(entry)
    if (globalChat.length > 50) globalChat.pop()
    io.emit('chat:message', entry)
    // ── FAKE DATA: auto-reply if real user asks about legitimacy/payouts ──────
    const lower = trimmed.toLowerCase()
    if (_LEGIT_TRIGGERS.some(kw => lower.includes(kw))) _fakeSendLegitReply(name)
    // ── END FAKE DATA ──────────────────────────────────────────────────────────
  })

  socket.on('chat:history', (cb) => {
    if (typeof cb === 'function') cb(globalChat.slice(0, 50).reverse())
  })

  socket.on('activity:get', (cb) => {
    if (typeof cb === 'function') cb(activityFeed)
  })

  // Chat (lobby/queue only)
  socket.on('chat:send', ({ code, text, address: payloadAddress }) => {
    if (!rateLimit(socket.id, 3)) return
    const room = rooms.get(code)
    if (!room) return
    const clean = String(text || '').replace(/[<>]/g, '').slice(0, 120).trim()
    if (!clean) return
    const sender = socket.data.address || (VALID_ADDRESS.test(payloadAddress) ? payloadAddress : null)
    if (!sender) return
    io.to(code).emit('chat:message', { address: sender, text: clean, ts: Date.now() })
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
    setTimeout(() => io.emit('online:count', io.engine.clientsCount + _fakeOnlineOffset), 100)
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
    const recovered = verifyMessage(msg, sig)
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
    const recovered = verifyMessage(msg, sig)
    if (recovered.toLowerCase() !== address.toLowerCase()) return res.status(401).json({ error: 'Invalid signature' })

    // Verify the USDT payment on-chain if txHash provided
    if (txHash) {
      if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return res.status(400).json({ error: 'Invalid transaction hash' })
      if (!HOUSE_WALLET) return res.status(503).json({ error: 'Server not configured for avatar purchases' })
      try {
        const rpcRes = await fetch(CHAIN_CONFIG[137].rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getTransactionReceipt', params: [txHash], id: 1 }),
          signal: AbortSignal.timeout(10000),
        })
        const rpcJson = await rpcRes.json()
        if (rpcJson.error) throw new Error(rpcJson.error.message)
        const receipt = rpcJson.result
        if (!receipt || receipt.status !== '0x1') return res.status(400).json({ error: 'Transaction not confirmed or failed' })
        const USDT_POLYGON = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f'
        if (receipt.to?.toLowerCase() !== USDT_POLYGON) return res.status(400).json({ error: 'Not a USDT transaction' })
        const transferTopic = ethId('Transfer(address,address,uint256)')
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
    const unsettled = roomCodes.filter(c => !settledRooms.has(c))
    if (unsettled.length === 0) return res.json({ hasActive: false })
    // Only block if the room still exists (in memory or active_rooms table)
    // Stuck/dead rooms should not prevent new room creation
    const inMemory = unsettled.filter(c => rooms.has(c))
    if (inMemory.length > 0) return res.json({ hasActive: true, roomCode: inMemory[0] })
    const { data: activeRooms } = await supabase
      .from('active_rooms')
      .select('code')
      .in('code', unsettled)
    const activeInDb = (activeRooms || []).map(r => r.code)
    const activeRoom = activeInDb[0] || null
    res.json({ hasActive: !!activeRoom, roomCode: activeRoom })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Active room lookup ─────────────────────────────────────────────────────
// Returns the room code the address is currently a player in (not finished),
// or { code: null } if none. Used by Navbar and Lobby instead of localStorage.
app.get('/api/active-room/:address', (req, res) => {
  const { address } = req.params
  if (!VALID_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' })
  const addr = address.toLowerCase()
  for (const [code, room] of rooms) {
    if (room.status === 'finished' || room.status === 'abandoned') continue
    if (room.players.some(p => p.address.toLowerCase() === addr)) {
      return res.json({ code, gameMode: room.gameMode })
    }
  }
  return res.json({ code: null })
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

    // Rooms that are fully done — claim_signed (won) or refund_claimed (refunded on-chain)
    const roomCodes = [...new Set(deposits.map(d => d.room_code))]
    const { data: claimed } = await supabase
      .from('escrow_events')
      .select('room_code')
      .in('event_type', ['claim_signed', 'refund_claimed'])
      .in('room_code', roomCodes)

    // Fetch refund sigs — rooms with refund_signed still need player to call claimRefund
    const { data: refundSigs } = await supabase
      .from('escrow_events')
      .select('room_code, sig')
      .eq('event_type', 'refund_signed')
      .in('room_code', roomCodes)

    const claimedRooms = new Set((claimed || []).map(s => s.room_code))
    const refundSigMap = {}
    for (const r of (refundSigs || [])) refundSigMap[r.room_code] = r.sig

    // Deduplicate by room_code (take most recent deposit per room)
    const seenCodes = new Set()
    const stuck = deposits
      .filter(d => {
        if (claimedRooms.has(d.room_code)) return false
        if (seenCodes.has(d.room_code)) return false
        seenCodes.add(d.room_code)
        return true
      })
      .map(d => ({
        room_code:      d.room_code,
        room_id_hash:   (d.room_id_hash && d.room_id_hash.length === 66) ? d.room_id_hash : getRoomId(d.room_code),
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
      .in('event_type', ['deposit_confirmed', 'refund_signed'])
      .eq('player_address', addr)
      .order('created_at', { ascending: false })
      .limit(200)
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

// ── Mark refund claimed — removes from stuck deposits on refresh ──────────
// ── Request refund sig for a deposit the server has no record of ─────────────
// Player proves wallet ownership via authSig, server signs a refund so they
// can call claimRefund() immediately without waiting 24h for emergencyRefund.
app.post('/api/request-refund-sig', express.json(), async (req, res) => {
  try {
    const { roomCode, address, chainId, escrowAddress, authSig } = req.body || {}
    if (!roomCode || !address || !authSig) return res.status(400).json({ error: 'Missing fields' })
    if (!VALID_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' })
    if (!SERVER_SIGNING_KEY) return res.status(503).json({ error: 'Signing not configured' })

    // Verify wallet ownership
    try {
      const recovered = verifyMessage(`Arena Games: ${address.toLowerCase()}`, authSig)
      if (recovered.toLowerCase() !== address.toLowerCase()) return res.status(401).json({ error: 'Signature mismatch' })
    } catch { return res.status(401).json({ error: 'Invalid signature' }) }

    const resolvedChainId = chainId || 137
    const escrowAddr = escrowAddress || getChainEscrowAddress(resolvedChainId)
    if (!escrowAddr) return res.status(400).json({ error: 'Unknown chain' })

    const roomId = getRoomId(roomCode)
    const msgHash = solidityPackedKeccak256(['bytes32', 'string'], [roomId, 'REFUND'])
    const refundSig = await signMessage(SERVER_SIGNING_KEY, msgHash)

    // Store in Supabase so Profile's stuck-deposits endpoint finds it next time
    if (supabase) {
      await supabase.from('escrow_events').insert({
        event_type:     'refund_signed',
        room_code:      roomCode,
        room_id_hash:   roomId,
        chain_id:       resolvedChainId,
        escrow_address: escrowAddr,
        player_address: address.toLowerCase(),
        sig:            refundSig,
        note:           'Player-requested refund sig — deposit found on-chain, not in server records',
      })
    }

    console.log(`[refund-request] Issued refund sig for ${address.slice(0,8)} room ${roomCode}`)
    res.json({ refundSig })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/mark-refund-claimed', express.json(), async (req, res) => {
  try {
    const { roomCode, address } = req.body || {}
    if (!roomCode || !address) return res.status(400).json({ error: 'Missing fields' })
    if (!VALID_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' })
    if (!supabase) return res.json({ ok: true })
    await supabase.from('escrow_events').insert({
      event_type:     'refund_claimed',
      room_code:      roomCode,
      player_address: address.toLowerCase(),
      note:           'Player confirmed on-chain claimRefund',
    })
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

// ── Referral endpoints ────────────────────────────────────────────────────

// Generate or return existing referral code
app.post('/api/referral/generate-code', express.json(), async (req, res) => {
  try {
    const { address, sig } = req.body || {}
    if (!address || !sig) return res.status(400).json({ error: 'Missing fields' })
    if (!VALID_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' })
    const recovered = verifyMessage(`Arena referral code\n${address.toLowerCase()}`, sig)
    if (recovered.toLowerCase() !== address.toLowerCase()) return res.status(401).json({ error: 'Invalid signature' })
    if (!supabase) return res.status(503).json({ error: 'DB not configured' })
    // Return existing code if already generated
    const { data: existing } = await supabase.from('player_profiles')
      .select('referral_code').eq('address', address.toLowerCase()).maybeSingle()
    if (existing?.referral_code) return res.json({ code: existing.referral_code })
    // Generate new unique 8-char code
    const makeCode = (salt) => {
      const h = bytesToHex(keccak_256(Buffer.from(address + salt)))
      return h.slice(2, 10).toUpperCase()
    }
    let code = makeCode(Date.now())
    const { data: clash } = await supabase.from('player_profiles').select('address').eq('referral_code', code).maybeSingle()
    if (clash) code = makeCode(Date.now() + 1)
    await supabase.from('player_profiles')
      .upsert({ address: address.toLowerCase(), referral_code: code }, { onConflict: 'address' })
    res.json({ code })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Register a referee under a referrer (called on wallet connect with ?ref=CODE)
app.post('/api/referral/register', express.json(), async (req, res) => {
  try {
    const { referee_address, referral_code } = req.body || {}
    if (!referee_address || !referral_code) return res.status(400).json({ error: 'Missing fields' })
    if (!VALID_ADDR.test(referee_address)) return res.status(400).json({ error: 'Invalid address' })
    if (!/^[A-Z0-9]{6,12}$/.test(referral_code)) return res.status(400).json({ error: 'Invalid code' })
    if (!supabase) return res.status(503).json({ error: 'DB not configured' })
    const { data: referrer } = await supabase.from('player_profiles')
      .select('address').eq('referral_code', referral_code).maybeSingle()
    if (!referrer) return res.status(404).json({ error: 'Referral code not found' })
    if (referrer.address === referee_address.toLowerCase()) return res.status(400).json({ error: 'Cannot refer yourself' })
    // Check already registered
    const { data: existing } = await supabase.from('referrals')
      .select('id').eq('referee_address', referee_address.toLowerCase()).maybeSingle()
    if (existing) return res.json({ ok: true, already: true })
    await supabase.from('referrals').insert({
      referrer_address: referrer.address,
      referee_address: referee_address.toLowerCase(),
    })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Get referral stats for a referrer
app.get('/api/referral/stats/:address', async (req, res) => {
  try {
    const address = (req.params.address || '').toLowerCase()
    if (!VALID_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' })
    if (!supabase) return res.json({ referral_code: null, referees: [], total_earned: 0, pending_payout: null })
    const [{ data: profile }, { data: refs }, { data: payout }] = await Promise.all([
      supabase.from('player_profiles').select('referral_code').eq('address', address).maybeSingle(),
      supabase.from('referrals').select('referee_address, games_counted, earned_usdt').eq('referrer_address', address),
      supabase.from('referral_payouts').select('amount_usdt, status, requested_at').eq('referrer_address', address).eq('status', 'pending').maybeSingle(),
    ])
    const total_earned = (refs || []).reduce((s, r) => s + parseFloat(r.earned_usdt || 0), 0)
    const { data: paid } = await supabase.from('referral_payouts')
      .select('amount_usdt').eq('referrer_address', address).eq('status', 'paid')
    const total_paid = (paid || []).reduce((s, r) => s + parseFloat(r.amount_usdt || 0), 0)
    res.json({
      referral_code: profile?.referral_code || null,
      referees: refs || [],
      total_earned: parseFloat(total_earned.toFixed(4)),
      total_paid: parseFloat(total_paid.toFixed(4)),
      available: parseFloat((total_earned - total_paid - (payout ? parseFloat(payout.amount_usdt) : 0)).toFixed(4)),
      pending_payout: payout || null,
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Request payout (requires sig, min $50 available)
app.post('/api/referral/request-payout', express.json(), async (req, res) => {
  try {
    const { address, sig } = req.body || {}
    if (!address || !sig) return res.status(400).json({ error: 'Missing fields' })
    if (!VALID_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' })
    const recovered = verifyMessage(`Arena referral payout\n${address.toLowerCase()}`, sig)
    if (recovered.toLowerCase() !== address.toLowerCase()) return res.status(401).json({ error: 'Invalid signature' })
    if (!supabase) return res.status(503).json({ error: 'DB not configured' })
    const { data: refs } = await supabase.from('referrals').select('earned_usdt').eq('referrer_address', address.toLowerCase())
    const total_earned = (refs || []).reduce((s, r) => s + parseFloat(r.earned_usdt || 0), 0)
    const { data: payouts } = await supabase.from('referral_payouts').select('amount_usdt, status').eq('referrer_address', address.toLowerCase())
    const total_requested = (payouts || []).reduce((s, r) => s + parseFloat(r.amount_usdt || 0), 0)
    const available = parseFloat((total_earned - total_requested).toFixed(4))
    if (available < 50) return res.status(400).json({ error: `Minimum $50 required. Available: $${available.toFixed(2)}` })
    const pending = (payouts || []).find(p => p.status === 'pending')
    if (pending) return res.status(400).json({ error: 'Payout already pending' })
    await supabase.from('referral_payouts').insert({ referrer_address: address.toLowerCase(), amount_usdt: available })
    res.json({ ok: true, amount: available })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Admin: mark payout as paid
app.post('/api/referral/mark-paid', express.json(), async (req, res) => {
  try {
    const adminSecret = process.env.ADMIN_KEY
    if (!adminSecret || req.headers['x-admin-key'] !== adminSecret) return res.status(401).json({ error: 'Unauthorized' })
    const { payout_id, tx_hash } = req.body || {}
    if (!payout_id || !tx_hash) return res.status(400).json({ error: 'Missing fields' })
    if (!supabase) return res.status(503).json({ error: 'DB not configured' })
    await supabase.from('referral_payouts')
      .update({ status: 'paid', paid_at: new Date().toISOString(), tx_hash })
      .eq('id', payout_id)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/room/:code', (req, res) => {
  const room = rooms.get((req.params.code || '').toUpperCase())
  if (!room || room.status !== 'waiting') return res.json({ found: false })
  res.json({
    found: true,
    code: room.code,
    gameMode: room.gameMode,
    entryFee: room.entryFee,
    players: room.players.length,
    max: room.maxPlayers,
    hostName: room.hostName || '',
    roomType: room.roomType || 'public',
    duelExpiry: room.duelExpiry || null,
  })
})

// ── Start ─────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Join Arena server running on port ${PORT}`)
})
