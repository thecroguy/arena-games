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
  'highest-unique': { type: 'sealed', rounds: 8,  roundMs: 20000, minP: 3, maxP: 20, min: 1, max: 100 },
  'lowest-unique':  { type: 'sealed', rounds: 8,  roundMs: 20000, minP: 3, maxP: 20, min: 1, max: 50  },
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

// (FAKE_CHAT_SVR removed — replaced by _genChat() word-bank generator below)


function _fakePick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function _fakeRand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

// Shuffle-deck: every item is used once before any repeats (guaranteed uniqueness per cycle)
function _makeShuffleDeck(arr) {
  let deck = []
  function refill() {
    deck = [...arr]
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]]
    }
  }
  refill()
  return { pick() { if (deck.length === 0) refill(); return deck.pop() } }
}

// Pick a unique username that isn't in the exclude list
function _pickUser(pool, ...exclude) {
  let u
  let tries = 0
  do { u = _fakePick(pool); tries++ } while (exclude.includes(u) && tries < 20)
  return u
}

let _fakeLastActivityUser = ''
function _fakePushActivity() {
  let u
  do { u = _fakePick(FAKE_PLAYERS_SVR) } while (u === _fakeLastActivityUser)
  _fakeLastActivityUser = u
  const g = _fakePick(FAKE_GAMES_SVR), e = _fakePick(FAKE_ENTRIES_SVR)
  const pot = FAKE_POTS_SVR[e]
  const tmpl = _deckActivity.pick()
  const msg =
    tmpl === 'won'     ? `${u} won $${pot} in ${g}` :
    tmpl === 'joined'  ? `${u} joined ${g} (${e} entry)` :
    tmpl === 'opened'  ? `${u} opened a ${e} room — ${g}` :
                         `${u} created a ${e} duel — ${g}`
  pushActivity(msg)
  // Emit leaderboard delta so the board updates live when someone wins
  if (tmpl === 'won') {
    io.emit('leaderboard:delta', { username: u, net: parseFloat(pot) })
  }
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
// ── Word banks — messages are assembled from these at runtime ─────────────
// Every send combines different slots → near-infinite unique sentences
const _WB = {
  opener:   ['bro', 'man', 'dude', 'ngl', 'honestly', 'fr', 'real talk', 'lowkey', 'not gonna lie'],
  cashVerb: ['cashed out', 'withdrew', 'claimed', 'got paid', 'pulled'],
  amounts:  ['$4', '$5', '$6', '$7', '$8', '$10', '$12', '$14', '$17', '$20', '$23', '$25', '$4.25', '$8.50', '$3.40', '$1.70'],
  timing:   ['yesterday', 'today', 'just now', 'an hour ago', 'this morning', '30 mins ago', 'earlier today', 'last night', 'like 10 mins ago', 'a few hours ago'],
  speed:    ['hit my wallet instantly', 'straight to wallet no issues', 'instant no waiting', 'went straight to my wallet', 'landed in seconds', 'super fast', 'no delays at all', 'claimed in like 10 secs'],
  games:    ['math arena', 'pattern memory', 'reaction grid', "liar's dice", 'highest unique'],
  durations:['a week', '2 weeks', '3 weeks', 'a month', 'a few days', '10 days'],
  totals:   ['$15', '$20', '$30', '$40', '$50', '$12', '$25', '$35', '$18', '$28'],
  chainRef: ['escrow is on-chain', 'smart contract handles it', 'check polygonscan', 'contract is open source', 'all funds on-chain', 'everything is verifiable'],
  trustEnd: ['nobody can touch your funds', 'fully transparent', 'verify it yourself', 'no middleman at all', 'immutable contract', 'you can audit it'],
  startTip: ['just connect metamask and pick a game', 'grab polygon USDT and go', 'start with a $0.50 match', 'takes 2 mins to set up', 'super easy to start'],
  gasNote:  ['gas on polygon is like cents', 'polygon fees are basically nothing', 'like $0.01 gas max', 'gas is negligible on polygon'],
  doubt:    ['i was skeptical at first too', 'thought it was bs honestly', 'was doubtful before i tried', 'almost didnt try it', 'was worried at first'],
  confirm:  ['its real', 'works perfectly', 'legit af', 'fully on-chain', 'cant lie its solid', '100% real'],
  payNote:  ['platform takes 15% cut', 'winner gets 85% of the pot', '15% fee then rest to wallet', 'small 15% fee, winner takes rest'],
  refNote:  ['if nobody joins it refunds automatically', 'stuck? profile page has refund button', 'escrow refunds if game doesnt start', 'full refund if no match found'],
  doubtQ:   ['real money', 'legit', 'paying out', 'for real', 'not a scam'],
  payVerb:  ['pay out', 'work', 'send money', 'actually pay', 'be legit'],
  withdrawRef: ['withdrawn from here', 'cashed out', 'got paid', 'claimed winnings'],
  fakeAlt:  ['points', 'fake credits', 'not real USDT', 'just fake'],
  realAlt:  ['cash out your winnings', 'withdraw', 'get real USDT', 'actually claim'],
  scamWord: ['scam', 'rug', 'fake site', 'honeypot'],
  lookWord: ['too good to be real', 'sus', 'sketchy', 'suspicious'],
  proofWord:['proof this is legit', 'withdrawal proof', 'receipts', 'evidence'],
  paySpeed: ['withdraws instant', 'pays out right away', 'sends direct to wallet'],
  startAmt: ['$0.50', '$1', 'a $0.50 match', '$1 match'],
  waitless: ['no waiting period', 'straight to wallet', 'instant'],
  solidWord:['sounds solid', 'makes sense', 'checks out', 'actually good'],
  tryWord:  ['try it', 'play a match', 'give it a shot', 'jump in'],
  noKyc:    ['kyc', 'waiting period', 'manual approval', 'identity check'],
  needWord: ['polygon USDT', 'metamask', 'USDT on polygon', 'a polygon wallet'],
  winReact: ['won', 'took', 'got the W on', 'cleaned up in', 'won back-to-back in'],
  lossReact:['lost', 'took an L in', 'got cooked in', 'lost that one in'],
  gameAdj:  ['close', 'quick', 'solid', 'intense', 'wild', 'brutal', 'clean', 'crazy'],
  whoQ:     ['anyone', 'who', 'anyone here'],
  smallAmt: ['$0.50', '$1', '$2', '$3', '$5'],
  streakW:  ['win streak', '3-game streak', 'hot streak', 'run rn'],
  grindLen: ['all day', 'for hours', 'since this morning', 'all night', 'the last 2 hours'],
  backReact:['ready to play', 'looking for a match', "who's next", 'who wants a game'],
}

// Generators — called each time so every message is uniquely assembled from the banks
function _genReply() {
  const w = _WB
  const pick = _fakePick
  const t = Math.floor(Math.random() * 14)
  switch (t) {
    case 0:  return `${pick(w.opener)} i just ${pick(w.cashVerb)} ${pick(w.amounts)} ${pick(w.timing)}, ${pick(w.speed)}`
    case 1:  return `${pick(w.doubt)} too, won ${pick(w.amounts)} in ${pick(w.games)} ${pick(w.timing)}, ${pick(w.confirm)}`
    case 2:  return `been playing ${pick(w.durations)}, ${pick(w.cashVerb)} ${pick(w.totals)} total, ${pick(w.confirm)}`
    case 3:  return `just ${pick(w.cashVerb)} ${pick(w.amounts)} from a ${pick(w.games)} match, ${pick(w.speed)}`
    case 4:  return `${pick(w.chainRef)} so ${pick(w.trustEnd)}`
    case 5:  return `winner gets paid the moment game ends, ${pick(w.speed)}`
    case 6:  return `${pick(w.startTip)}, no complicated setup`
    case 7:  return `start with ${pick(w.startAmt)} to test it, once you see the payout you'll trust it`
    case 8:  return `${pick(w.amounts)} in my wallet rn from ${pick(w.timing)}, fully working`
    case 9:  return `${pick(w.doubt)}, now i'm up ${pick(w.totals)} total — ${pick(w.chainRef)}`
    case 10: return `claim button shows after you win, ${pick(w.speed)}, no approval needed`
    case 11: return `${pick(w.gasNote)}, ${pick(w.payNote)}`
    case 12: return `${pick(w.refNote)}`
    default: return `entry goes to escrow on-chain, ${pick(w.trustEnd)}`
  }
}

function _genQuestion() {
  const w = _WB
  const pick = _fakePick
  const t = Math.floor(Math.random() * 9)
  switch (t) {
    case 0: return `wait is this actually ${pick(w.doubtQ)}?`
    case 1: return `does this platform actually ${pick(w.payVerb)}?`
    case 2: return `anyone actually ${pick(w.withdrawRef)}?`
    case 3: return `is the money real or just ${pick(w.fakeAlt)}?`
    case 4: return `can you actually ${pick(w.realAlt)}?`
    case 5: return `winnings go straight to your wallet? actually?`
    case 6: return `how do you know this isn't a ${pick(w.scamWord)}`
    case 7: return `this looks ${pick(w.lookWord)} ngl`
    default: return `anyone have ${pick(w.proofWord)}?`
  }
}

function _genFollowup() {
  const w = _WB
  const pick = _fakePick
  const t = Math.floor(Math.random() * 9)
  switch (t) {
    case 0: return `oh so it ${pick(w.paySpeed)} after the game?`
    case 1: return `damn okay gonna try ${pick(w.startAmt)} first`
    case 2: return `wait ${pick(w.waitless)}?? okay that's actually sick`
    case 3: return `okay that actually ${pick(w.solidWord)} ngl`
    case 4: return `alright gonna ${pick(w.tryWord)}, appreciate the info`
    case 5: return `so no ${pick(w.noKyc)}? just claims automatically?`
    case 6: return `bet gonna ${pick(w.tryWord)} rn`
    case 7: return `so i just need ${pick(w.needWord)}? that's it?`
    default: return `ok ok letsss go, trying ${pick(w.startAmt)} now`
  }
}

// General chat generator — every call assembles a unique sentence from word banks
function _genChat() {
  const w = _WB, pick = _fakePick
  const g = () => pick(w.games)
  const reactions = ['gg','wp','gg wp','nice','well played','gj','nice one','good game']
  const t = Math.floor(Math.random() * 38)
  switch (t) {
    case 0:  return `${pick(['anyone','who'])} want to ${pick(['play','duel','match up'])} for ${pick(w.smallAmt)}?`
    case 1:  return pick(reactions)
    case 2:  return `just ${pick(w.winReact)} a ${g()} match`
    case 3:  return `${pick(w.lossReact)} ${g()}, need a rematch`
    case 4:  return `${g()} is ${pick(['too easy','actually hard','my best game','brutal','kinda fun','hard to master','pure luck','a mind game'])}`
    case 5:  return `${pick(w.smallAmt)} duel open, ${pick(['anyone?','who wants it?','come get it','whos in?'])}`
    case 6:  return `on a ${pick(w.streakW)} ${pick(['lol','ngl','fr','not gonna lie'])}`
    case 7:  return `that was ${pick(['close','a good match','way too quick','intense','one-sided lol','actually fun'])}`
    case 8:  return `just joined, ${pick(['first time here','looks interesting','excited to try this','how does this work'])}`
    case 9:  return `${g()} is my ${pick(['best','worst','favorite','main','go-to'])} game`
    case 10: return `just ${pick(w.cashVerb)} ${pick(w.amounts)}, ${pick(w.speed)}`
    case 11: return `up ${pick(w.amounts)} today from ${g()} matches`
    case 12: return `${pick(w.smallAmt)} match anyone?`
    case 13: return `need ${pick(['1 more player','someone to duel','a game','an opponent','a warm-up match'])}`
    case 14: return `${pick(['this platform','arena games','this site'])} is ${pick(['underrated','actually solid','pretty good ngl','kinda addictive','slept on'])}`
    case 15: return `lost ${pick(w.amounts)} 😭 ${pick(['gg though','wp to them','rematch when?','they were good','learned something'])}`
    case 16: return `${pick(['polygon fees are','gas on here is','fees are'])} ${pick(['low','basically nothing','negligible','like pennies','cents max'])}, love it`
    case 17: return `${g()} round ${pick(['3','4','5','6','7','8'])} is ${pick(['insane','brutal','wild','no joke','not easy'])}`
    case 18: return `${pick(['anyone','who'])} playing ${g()} rn?`
    case 19: return `${pick(['tip:','pro tip:','fyi:'])} ${pick(['duels are faster than auto match','create a duel and share the link','polygon USDT is what you need to start','duel links are the move'])}`
    case 20: return `${pick(['just won 3 in a row','won back to back','on a run rn'])}, ${pick(['do not challenge me lol','feeling unstoppable','riding it while it lasts','someone stop me'])}`
    case 21: return `${g()} is ${pick(['pure speed','a mind game','all reaction time','pure logic','skill-based fr'])}`
    case 22: return `${pick(['rematch?','wanna run it back?','one more?','again?','round 2?'])}`
    case 23: return `been grinding ${pick(w.grindLen)}, ${pick(['worth it','tired now lol','up overall though','decent session'])}`
    case 24: return `who has the highest win rate here ${pick(['lol','fr','genuinely curious','asking for a friend'])}`
    case 25: return `quick match anyone? ${pick(['i have 5 mins','quick one','wont take long','be fast'])}`
    case 26: return `${pick(['lost','took an L in'])} ${g()} but ${pick(['learned the strat','gonna win next time','still fun','gg to them','respect though'])}`
    case 27: return `${pick(['auto match','matchmaking'])} is ${pick(['slow rn','kind of slow','quiet right now'])}, just ${pick(['use duels','create a duel','share a duel link'])}`
    case 28: return `duel open — ${g()}, ${pick(w.smallAmt)} pot`
    case 29: return `${pick(['won','lost'])} a ${pick(w.gameAdj)} one in ${g()}, ${pick(['great game','gg','good match','wp to them','was fun'])}`
    case 30: return `${pick(['ngl','honestly','not gonna lie'])} ${g()} is ${pick(['addicting','actually fun','better than i expected','my go-to now','worth trying'])}`
    case 31: return `${pick(['liar dice bluff','pattern memory round 8','reaction grid wave 5','math arena speed round'])} is ${pick(['no joke','actually insane','wild','so hard','unreal'])}`
    case 32: return `${pick(['first win today','finally won one','got one finally'])}, ${pick(["let's go","that's what im talking about",'feeling good','took long enough lol'])}`
    case 33: return `${pick(w.amounts)} pot, ${g()}, ${pick(['who wants it?','anyone?','open now','come play'])}`
    case 34: return `${pick(['back','just back','im back'])}, ${pick(w.backReact)}`
    case 35: return `${pick(['just beat someone in','won a','finished a'])} ${g()} ${pick(['match','duel','game'])}, easy ${pick(w.amounts)}`
    case 36: return `${pick(['deposited','started with'])} ${pick(w.smallAmt)}, now at ${pick(w.amounts)}, ${pick(['not bad','decent run','slow grind','slow and steady'])}`
    default: return `${pick(['nothing better than','best feeling is'])} ${pick(['winning and getting paid instantly','beating someone and claiming the pot','winning a tight match'])}`
  }
}

// Recent-message dedup: prevent same text appearing twice in quick succession from different users
const _recentChatSet = new Set()
function _genUniqueChat() {
  let msg, tries = 0
  do { msg = _genChat(); tries++ } while (_recentChatSet.has(msg) && tries < 8)
  _recentChatSet.add(msg)
  if (_recentChatSet.size > 15) _recentChatSet.delete(_recentChatSet.values().next().value)
  return msg
}

// Same dedup for reply threads so player1 and player2 don't say the same thing
const _recentReplySet = new Set()
function _genUniqueReply() {
  let msg, tries = 0
  do { msg = _genReply(); tries++ } while (_recentReplySet.has(msg) && tries < 8)
  _recentReplySet.add(msg)
  if (_recentReplySet.size > 10) _recentReplySet.delete(_recentReplySet.values().next().value)
  return msg
}

// Activity template rotation deck — cycles won→joined→opened→created, never same twice in a row
const _deckActivity = _makeShuffleDeck(['won','joined','opened','created'])

function _fakeSendLegitReply(lurkerName = null, extraDelay = 0) {
  setTimeout(() => {
    const player1 = _pickUser(FAKE_PLAYERS_SVR, lurkerName)
    const entry = { username: player1, message: _genUniqueReply(), ts: Date.now() }
    globalChat.push(entry)
    if (globalChat.length > 50) globalChat.shift()
    io.emit('chat:message', entry)
    // 40% chance a second different player chimes in with a completely different message
    if (Math.random() < 0.4) {
      setTimeout(() => {
        const player2 = _pickUser(FAKE_PLAYERS_SVR, lurkerName, player1)
        const entry2 = { username: player2, message: _genUniqueReply(), ts: Date.now() }
        globalChat.push(entry2)
        if (globalChat.length > 50) globalChat.shift()
        io.emit('chat:message', entry2)
      }, _fakeRand(5000, 15000))
    }
    // The lurker follows up after being convinced
    if (lurkerName && Math.random() < 0.6) {
      setTimeout(() => {
        const fu = { username: lurkerName, message: _genFollowup(), ts: Date.now() }
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
    // Lurker asks a unique doubt question — a player replies
    const q = _genQuestion()
    const lurker = _fakePick(FAKE_LURKERS_SVR)
    const qEntry = { username: lurker, message: q, ts: Date.now() }
    globalChat.push(qEntry)
    if (globalChat.length > 50) globalChat.shift()
    io.emit('chat:message', qEntry)
    _fakeSendLegitReply(lurker)  // a player answers; lurker may follow up
    setTimeout(_fakePushChat, _fakeRand(60000, 150000))
    return
  }
  const entry = { username: _fakePick(FAKE_PLAYERS_SVR), message: _genUniqueChat(), ts: Date.now() }
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
  for (let i = 5; i >= 0; i--) {
    globalChat.push({ username: _fakePick(FAKE_PLAYERS_SVR), message: _genUniqueChat(), ts: Date.now() - i * _fakeRand(40000, 180000) })
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
      io.to(code).emit('room:timeout', { message: 'Duel expired — entry fees refunded.' })
      if (room.players.some(p => p.deposited)) escrowRefund(room)
      cleanupRoom(code) // removes from rooms map + addressRooms + clears timers + deletes from DB
      console.log(`[duel-expiry] Room ${code} expired and cleaned up`)
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
// Re-run every 30 min — catches rooms whose refund_signed failed to write first time
setInterval(() => recoverStuckRooms(), 30 * 60 * 1000)

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
      const gridSize = round >= 8 ? 6 : round >= 5 ? 5 : 4
      const total    = gridSize * gridSize
      const patLen   = Math.min(4 + round, Math.floor(total * 0.55))
      const indices  = Array.from({ length: total }, (_, i) => i)
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]]
      }
      const pattern = indices.slice(0, patLen).sort((a, b) => a - b)
      return { type: 'pattern', gridSize, pattern, answer: pattern.join(',') }
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
    // answer is comma-joined sorted tile indices; compare both sides sorted
    const submitted = rawAnswer.split(',').map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b).join(',')
    return submitted === question.answer
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
    roomType:   room.roomType || 'public',
    duelExpiry: room.duelExpiry || null,
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
  const topScore = sorted[0].score
  const tied = sorted.filter(p => p.score === topScore)
  const winner = tied.length > 1 ? tied[Math.floor(Math.random() * tied.length)] : sorted[0]
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
  io.emit('leaderboard:delta', { username: winnerName, net: parseFloat(pot) })

  if (supabase) {
    const roomIdHash = getRoomId(room.code)
    const escrowAddr = getChainEscrowAddress(room.chainId) || null

    // ── Write claim_signed FIRST, independently — this is what the winner needs to claim funds.
    // Kept separate so game_history failures never prevent the winner from seeing their claim.
    if (claimSig && escrowAddr) {
      try {
        // Check for duplicate first (game:over can fire twice in edge cases)
        const { data: existing } = await supabase.from('escrow_events').select('id')
          .eq('event_type', 'claim_signed').eq('room_code', room.code).eq('player_address', winner.address.toLowerCase()).limit(1)
        if (!existing || existing.length === 0) {
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
          console.log(`[claim_signed] Stored claim sig for ${winner.address.slice(0, 8)} room ${room.code}`)
        }
      } catch (e) {
        console.error('[claim_signed] escrow_events write failed:', e.message)
      }
    }

    // ── Write game_history with retry (3 attempts) ──
    try {
      const cfg  = GAME_MODES[room.gameMode] || GAME_MODES['math-arena']
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
        claim_sig:      p.address === winner.address ? claimSig : null,
      }))
      let lastErr
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { error } = await supabase.from('game_history').insert(rows)
        if (!error) { lastErr = null; break }
        lastErr = error
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1000))
      }
      if (lastErr) console.error(`game_history insert failed after 3 attempts for room ${room.code}:`, lastErr.message)
    } catch (e) {
      console.error('game_history insert error:', e.message)
    }

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
  }

  setTimeout(() => cleanupRoom(room.code), 60_000)
}

// ── Escrow refund helper — signs a refund authorization, players claim individually ──
// Server never sends a transaction. Each player calls claimRefund(roomId, sig) from
// their own wallet, paying ~$0.01 gas to receive 100% of their entry fee back.
async function escrowRefund(room) {
  const escrowAddr = getChainEscrowAddress(room.chainId)
  if (!SERVER_SIGNING_KEY || !escrowAddr) {
    console.error(`[CRITICAL] escrowRefund: cannot sign for room ${room.code} — SERVER_SIGNING_KEY=${!!SERVER_SIGNING_KEY} escrow=${!!escrowAddr}. recoverStuckRooms will retry on next restart.`)
    return
  }
  try {
    const roomId  = getRoomId(room.code)
    const msgHash   = solidityPackedKeccak256(['bytes32', 'string'], [roomId, 'REFUND'])
    const refundSig = await signMessage(SERVER_SIGNING_KEY, msgHash)
    io.to(room.code).emit('game:refund_sig', { refundSig })
    console.log(`Signed refund for abandoned room ${room.code}`)

    if (supabase) {
      const depositedPlayers = room.players.filter(p => p.deposited)
      if (depositedPlayers.length > 0) {
        const rows = depositedPlayers.map(p => ({
          event_type:     'refund_signed',
          room_code:      room.code,
          room_id_hash:   roomId,
          chain_id:       room.chainId || 137,
          escrow_address: escrowAddr,
          player_address: p.address.toLowerCase(),
          amount_usdt:    room.entryFee,
          sig:            refundSig,
          note:           `Refund authorized for abandoned room ${room.code}`,
        }))
        // Retry up to 3× so a transient Supabase blip doesn't strand users
        for (let attempt = 1; attempt <= 3; attempt++) {
          const { error } = await supabase.from('escrow_events').insert(rows)
          if (!error) break
          console.error(`[escrowRefund] Supabase insert attempt ${attempt} failed for ${room.code}:`, error.message)
          if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 2000))
        }
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

    // Require a txHash — proves player at least broadcast the tx
    const escrowAddr = getChainEscrowAddress(room.chainId)
    if (escrowAddr && (!txHash || !VALID_TX_HASH.test(txHash))) {
      return cb({ error: 'Transaction hash required' })
    }

    // Mark deposited optimistically so both players see it immediately
    player.deposited = true
    saveRoomToDb(room)
    io.to(code).emit('room:update', roomPublic(room))
    cb({ ok: true })

    // Verify on-chain in background — revert if fraud detected
    if (escrowAddr) {
      ;(async () => {
        try {
          let confirmed = await hasDepositedOnChain(room.chainId, getRoomId(code), address)
          if (!confirmed && txHash) {
            for (let attempt = 0; attempt < 3 && !confirmed; attempt++) {
              await new Promise(r => setTimeout(r, 10000))
              confirmed = await hasDepositedOnChain(room.chainId, getRoomId(code), address)
              if (confirmed) console.log(`Deposit for ${code} confirmed after ${(attempt + 1) * 10}s`)
            }
          }
          if (!confirmed) {
            // Revert — player lied about the txHash
            const r = rooms.get(code)
            if (r) {
              const p = r.players.find(p => p.address === address)
              if (p) { p.deposited = false; saveRoomToDb(r); io.to(code).emit('room:update', roomPublic(r)) }
            }
            console.warn(`[room:deposit] Revert — deposit not found on-chain for ${address.slice(0,8)} room ${code}`)
          }
        } catch (e) {
          console.error('Background escrow verification error:', e.message)
          // RPC down — leave optimistic mark, recoverStuckRooms will catch any issues
        }
      })()
    }
    console.log(`${address.slice(0, 8)} deposited for room ${code} (chain ${room.chainId})`)

    // No auto-start — host must click Start Game manually (prevents game starting before joiner is ready)

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
      const row = {
        event_type:     'deposit_confirmed',
        room_code:      code,
        room_id_hash:   getRoomId(code),
        chain_id:       room.chainId || 137,
        escrow_address: escrowAddr,
        player_address: address.toLowerCase(),
        amount_usdt:    room.entryFee,
        tx_hash:        txHash || null,
        note:           `On-chain deposit verified for room ${code}`,
      };
      (async () => {
        for (let attempt = 1; attempt <= 3; attempt++) {
          const { error } = await supabase.from('escrow_events').insert(row)
          if (!error) break
          console.error(`[deposit_confirmed] insert attempt ${attempt} failed for ${code}:`, error.message)
          if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 2000))
        }
      })()
    }
  })

  // Any player in the waiting room can cancel — instantly refunds all deposited players
  socket.on('room:cancel', async ({ code }) => {
    const room = rooms.get(code)
    if (!room || room.status !== 'waiting') return
    // Must be a member of the room
    if (!room.players.some(p => p.id === socket.id)) return
    console.log(`[room:cancel] ${socket.data.address?.slice(0,8)} cancelled room ${code}`)
    const anyDeposited = room.players.some(p => p.deposited)
    if (anyDeposited) await escrowRefund(room).catch(() => {})
    io.to(code).emit('game:abandoned', { reason: 'Game cancelled — entry fees are being refunded to your wallet.' })
    cleanupRoom(code)
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
    globalChat.push(entry)
    if (globalChat.length > 50) globalChat.shift()
    io.emit('chat:message', entry)
    // ── FAKE DATA: auto-reply if real user asks about legitimacy/payouts ──────
    const lower = trimmed.toLowerCase()
    if (_LEGIT_TRIGGERS.some(kw => lower.includes(kw))) _fakeSendLegitReply(name)
    // ── END FAKE DATA ──────────────────────────────────────────────────────────
  })

  socket.on('chat:history', (cb) => {
    if (typeof cb === 'function') cb(globalChat.slice(-50))
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
    io.to(code).emit('room:chat', { address: sender, text: clean, ts: Date.now() })
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
      const leavingPlayer = room.players.find(p => p.id === socket.id)
      const leavingDeposited = leavingPlayer?.deposited === true
      // Issue refund sig BEFORE removing — escrowRefund iterates room.players
      if (leavingDeposited) escrowRefund(room).catch(() => {})
      room.players = room.players.filter(p => p.id !== socket.id)
      console.log(`- ${address} left ${code} (${room.players.length} remaining, waiting)`)
      if (room.players.length === 0) {
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
app.get('/api/active-room/:address', async (req, res) => {
  const { address } = req.params
  if (!VALID_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' })
  const addr = address.toLowerCase()
  // Find all rooms this player is in (skip expired/finished/abandoned)
  const now = Date.now()
  const candidates = []
  for (const [code, room] of rooms) {
    if (room.status === 'finished' || room.status === 'abandoned') continue
    if (room.duelExpiry && room.duelExpiry < now && room.status === 'waiting') continue // duel expired
    if (room.players.some(p => p.address.toLowerCase() === addr)) {
      candidates.push({ code, gameMode: room.gameMode })
    }
  }
  if (candidates.length === 0) return res.json({ code: null })
  // Only filter out rooms where the refund was actually claimed on-chain (not just signed)
  if (supabase && candidates.length > 0) {
    try {
      const codes = candidates.map(c => c.code)
      const [{ data: deposits }, { data: refunds }] = await Promise.all([
        supabase.from('escrow_events').select('room_code').eq('player_address', addr)
          .eq('event_type', 'deposit_confirmed').in('room_code', codes),
        supabase.from('escrow_events').select('room_code').eq('player_address', addr)
          .eq('event_type', 'refund_claimed').in('room_code', codes),
      ])
      const depositedCodes = new Set((deposits || []).map(d => d.room_code))
      const claimedCodes   = new Set((refunds  || []).map(r => r.room_code))
      // Only show rooms where deposit is confirmed AND refund not yet claimed
      const active = candidates.find(c => depositedCodes.has(c.code) && !claimedCodes.has(c.code))
      return res.json(active || { code: null })
    } catch { /* fall through */ }
  }
  return res.json(candidates[0] || { code: null })
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
    const pendingDeposits = deposits.filter(d => {
      if (claimedRooms.has(d.room_code)) return false
      if (seenCodes.has(d.room_code)) return false
      seenCodes.add(d.room_code)
      return true
    })

    // Auto-generate refund sigs in background — don't block the HTTP response
    if (SERVER_SIGNING_KEY) {
      const unsigned = pendingDeposits.filter(d => !refundSigMap[d.room_code]);
      (async () => {
        for (const d of unsigned) {
          try {
            const roomId    = (d.room_id_hash && d.room_id_hash.length === 66) ? d.room_id_hash : getRoomId(d.room_code)
            const msgHash   = solidityPackedKeccak256(['bytes32', 'string'], [roomId, 'REFUND'])
            const refundSig = await signMessage(SERVER_SIGNING_KEY, msgHash)
            refundSigMap[d.room_code] = refundSig
            await supabase.from('escrow_events').insert({
              event_type:     'refund_signed',
              room_code:      d.room_code,
              room_id_hash:   roomId,
              chain_id:       d.chain_id,
              escrow_address: d.escrow_address,
              player_address: addr,
              sig:            refundSig,
              amount_usdt:    d.amount_usdt,
              note:           'Auto-signed on stuck-deposits request',
            }).catch(() => {})
            console.log(`[stuck-deposits] Auto-signed refund for ${d.room_code} (${addr.slice(0,8)})`)
          } catch (e) {
            console.error(`[stuck-deposits] Failed to sign refund for ${d.room_code}:`, e.message)
          }
        }
      })()
    }

    const stuck = pendingDeposits.map(d => ({
        room_code:      d.room_code,
        room_id_hash:   (d.room_id_hash && d.room_id_hash.length === 66) ? d.room_id_hash : getRoomId(d.room_code),
        chain_id:       d.chain_id,
        escrow_address: d.escrow_address,
        amount_usdt:    d.amount_usdt,
        deposited_at:   d.created_at,
        refund_sig:     refundSigMap[d.room_code] || null,
        refundable_at:  new Date(new Date(d.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
      }))

    res.json(stuck)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Already-claimed rooms — used by Profile to purge stale localStorage entries ─
app.get('/api/claimed-rooms/:address', async (req, res) => {
  const { address } = req.params
  if (!VALID_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' })
  if (!supabase) return res.json([])
  try {
    const addr = address.toLowerCase()
    const [{ data: fromHistory }, { data: fromEvents }] = await Promise.all([
      supabase.from('game_history').select('room_code').eq('player_address', addr).eq('result', 'win').not('claimed_at', 'is', null),
      supabase.from('escrow_events').select('room_code').eq('player_address', addr).in('event_type', ['claim_completed', 'refund_claimed']),
    ])
    const codes = [...new Set([
      ...(fromHistory || []).map(r => r.room_code),
      ...(fromEvents  || []).map(r => r.room_code),
    ])]
    res.json(codes)
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

    // Primary source: game_history (full row with pot, game_mode, etc.)
    const { data: historyData } = await supabase
      .from('game_history')
      .select('room_code, game_mode, pot, entry_fee, claim_sig, escrow_address, room_id_hash, chain_id, played_at')
      .eq('player_address', addr)
      .eq('result', 'win')
      .eq('payout_mode', 'escrow')
      .not('claim_sig', 'is', null)
      .is('claimed_at', null)
      .order('played_at', { ascending: false })
      .limit(50)

    // Fallback: escrow_events.claim_signed — catches wins where game_history insert failed
    // (Supabase free tier rate limits, network blips, etc.)
    const { data: eventData } = await supabase
      .from('escrow_events')
      .select('room_code, room_id_hash, chain_id, escrow_address, amount_usdt, sig, created_at')
      .eq('player_address', addr)
      .eq('event_type', 'claim_signed')
      .order('created_at', { ascending: false })
      .limit(50)

    // Rooms already covered by game_history (unclaimed wins already in primary list)
    const historyCodes = new Set((historyData || []).map(h => h.room_code))

    // Exclude rooms already claimed (game_history has claimed_at set) or refunded
    const [{ data: alreadyClaimed }, { data: settled }] = await Promise.all([
      supabase.from('game_history').select('room_code').eq('player_address', addr).eq('result', 'win').not('claimed_at', 'is', null),
      supabase.from('escrow_events').select('room_code').eq('player_address', addr).in('event_type', ['refund_claimed', 'refund_signed', 'claim_completed']),
    ])
    const claimedCodes  = new Set((alreadyClaimed || []).map(r => r.room_code))
    const settledCodes  = new Set((settled || []).map(s => s.room_code))

    // Dedup escrow_events by room_code (take most recent sig), then exclude covered/claimed rooms
    const seen = new Set()
    const extraClaims = (eventData || [])
      .filter(e => {
        if (historyCodes.has(e.room_code) || claimedCodes.has(e.room_code) || settledCodes.has(e.room_code)) return false
        if (seen.has(e.room_code)) return false  // keep only most recent (array already ordered desc)
        seen.add(e.room_code)
        return true
      })
      .map(e => ({
        room_code:      e.room_code,
        game_mode:      'unknown',
        pot:            e.amount_usdt,
        entry_fee:      null,
        claim_sig:      e.sig,
        escrow_address: e.escrow_address,
        room_id_hash:   e.room_id_hash,
        chain_id:       e.chain_id,
        played_at:      e.created_at,
      }))

    // Final dedup across both sources (history takes priority)
    const finalSeen = new Set()
    const result = [...(historyData || []), ...extraClaims].filter(r => {
      if (finalSeen.has(r.room_code)) return false
      finalSeen.add(r.room_code)
      return true
    })
    res.json(result)
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
    const addr  = address.toLowerCase()
    const code  = String(room_code).toUpperCase().slice(0, 8)
    // Update game_history row (may be a no-op if insert previously failed — that's OK)
    await supabase.from('game_history')
      .update({ claimed_at: new Date().toISOString() })
      .eq('player_address', addr).eq('room_code', code).eq('result', 'win')
    // Also write a claim_completed event so the escrow_events fallback query knows to skip this room
    // This handles the case where game_history insert failed but claim_signed event exists
    const { data: existing } = await supabase.from('escrow_events').select('id')
      .eq('event_type', 'claim_completed').eq('room_code', code).eq('player_address', addr).limit(1)
    if (!existing || existing.length === 0) {
      await supabase.from('escrow_events').insert({
        event_type: 'claim_completed', room_code: code, player_address: addr,
        note: `Winner claimed on-chain for room ${code}`,
      }).catch(() => {}) // best-effort
    }
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
    if (supabase) {
      await supabase.from('escrow_events').insert({
        event_type:     'refund_claimed',
        room_code:      roomCode,
        player_address: address.toLowerCase(),
        note:           'Player confirmed on-chain claimRefund',
      })
    }
    // Clean up room from memory — player has been refunded, no reason to stay in active room
    const room = rooms.get(roomCode)
    if (room && room.status === 'waiting') {
      room.players = room.players.filter(p => p.address.toLowerCase() !== address.toLowerCase())
      if (room.players.length === 0) {
        cleanupRoom(roomCode)
      } else {
        io.to(roomCode).emit('game:abandoned', { reason: 'A player claimed their refund — game cancelled.' })
        cleanupRoom(roomCode)
      }
    }
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
    chainId: room.chainId || 137,
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
