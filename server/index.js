require('dotenv').config()
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')

// ── Config ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001

const configuredOrigins = (process.env.CLIENT_URL || '')
  .split(',').map(o => o.trim()).filter(Boolean)

function isAllowedOrigin(origin) {
  if (!origin) return true
  if (configuredOrigins.length === 0) return true
  if (configuredOrigins.includes(origin)) return true
  if (/^https:\/\/[a-z0-9-]+(\.vercel\.app)$/.test(origin)) return true
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

// ── In-memory room store ──────────────────────────────────────────────────
const rooms           = new Map()
const addressRooms    = new Map() // address → Set of room codes they created
const disconnectTimers = new Map() // `${code}:${address}` → reconnect timer

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
    players:    room.players.map(p => ({ address: p.address, score: p.score, disconnected: !!p.disconnected })),
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
}

// ── Game flow ─────────────────────────────────────────────────────────────
function startCountdown(room) {
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

  io.to(room.code).emit('game:over', {
    winner: winner.address,
    pot,
    scores: sorted.map((p, i) => ({ address: p.address, score: p.score, rank: i + 1 })),
  })

  if (supabase) {
    try {
      const cfg   = GAME_MODES[room.gameMode] || GAME_MODES['math-arena']
      const rows  = room.players.map(p => ({
        room_code:      room.code,
        game_mode:      room.gameMode,
        player_address: p.address.toLowerCase(),
        score:          p.score,
        total_rounds:   cfg.rounds,
        result:         p.address === winner.address ? 'win' : 'loss',
        entry_fee:      room.entryFee,
        earned:         p.address === winner.address ? parseFloat(pot) : -room.entryFee,
        players_count:  room.players.length,
      }))
      await supabase.from('game_history').insert(rows)
    } catch (e) {
      console.error('Supabase insert error:', e.message)
    }
  }

  setTimeout(() => cleanupRoom(room.code), 60_000)
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

  socket.on('room:create', ({ gameMode, entryFee, maxPlayers, address, txHash }, cb) => {
    if (typeof cb !== 'function') return
    if (!rateLimit(socket.id)) return cb({ error: 'Too many requests' })

    // Validate inputs
    if (!GAME_MODES[gameMode])         return cb({ error: 'Invalid game mode' })
    if (!VALID_FEES.has(entryFee))     return cb({ error: 'Invalid entry fee' })
    if (!VALID_ADDRESS.test(address))  return cb({ error: 'Invalid wallet address' })
    if (txHash && !VALID_TX_HASH.test(txHash)) return cb({ error: 'Invalid transaction hash' })

    // Room creation cap — max 3 active rooms per address
    const hostRooms = addressRooms.get(address) || new Set()
    if (hostRooms.size >= 3) return cb({ error: 'You already have 3 active rooms. Please close one first.' })

    const cfg = GAME_MODES[gameMode]
    const clampedMax = Math.min(Math.max(maxPlayers || cfg.maxP, cfg.minP), cfg.maxP)

    const code = generateCode()
    const room = {
      code, gameMode, entryFee,
      maxPlayers: clampedMax,
      host: address,
      players: [{ id: socket.id, address, score: 0, answered: false, correct: null, sealedPick: null }],
      status: 'waiting',
      round: 0, question: null, roundTimer: null, roundStartAt: null,
    }
    rooms.set(code, room)
    hostRooms.add(code)
    addressRooms.set(address, hostRooms)
    socket.join(code)
    socket.data.roomCode = code
    socket.data.address  = address
    cb({ code })
    console.log(`Room ${code} [${gameMode}] created by ${address.slice(0, 8)}`)
  })

  socket.on('room:join', ({ code, address, txHash }, cb) => {
    if (typeof cb !== 'function') return
    if (!rateLimit(socket.id)) return cb({ error: 'Too many requests' })

    if (!VALID_ADDRESS.test(address))   return cb({ error: 'Invalid wallet address' })
    if (txHash && !VALID_TX_HASH.test(txHash)) return cb({ error: 'Invalid transaction hash' })

    const room = rooms.get((code || '').toUpperCase())
    if (!room) return cb({ error: 'Room not found' })

    // Reconnect check — player disconnected during active game
    const reconnecting = room.players.find(p => p.address === address && p.disconnected)
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

    room.players.push({ id: socket.id, address, score: 0, answered: false, correct: null, sealedPick: null })
    socket.join(code)
    socket.data.roomCode = code
    socket.data.address  = address

    io.to(code).emit('room:update', roomPublic(room))
    cb({ ok: true, room: roomPublic(room) })

    if (room.players.length >= room.maxPlayers) {
      setTimeout(() => startCountdown(room), 500)
    }
  })

  socket.on('room:start', ({ code }) => {
    const room = rooms.get(code)
    if (!room) return
    if (room.host !== socket.data.address)   return socket.emit('error', 'Not the host')
    if (room.players.length < 2)             return socket.emit('error', 'Need at least 2 players')
    if (room.status !== 'waiting')           return
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
    const code    = socket.data.roomCode
    const address = socket.data.address
    if (!code || !address) return
    const room = rooms.get(code)
    if (!room) return

    const wasActive = room.status === 'playing' || room.status === 'countdown'

    if (!wasActive) {
      // Waiting phase — remove immediately
      room.players = room.players.filter(p => p.id !== socket.id)
      console.log(`- ${address} left ${code} (${room.players.length} remaining, waiting)`)
      if (room.players.length === 0) { cleanupRoom(code); return }
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
      if (activePlayers.length === 0) { cleanupRoom(code); return }
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

// ── Start ─────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Join Arena server running on port ${PORT}`)
})
