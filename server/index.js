require('dotenv').config()
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')

// ── Config ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001
const CLIENT_URL = process.env.CLIENT_URL || '*'
const TOTAL_ROUNDS = 10
const ROUND_TIME_MS = 12000

// ── Express + Socket.io ────────────────────────────────────────────────────
const app = express()
app.use(cors({ origin: CLIENT_URL }))
app.use(express.json())

const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] },
})

// ── Supabase (optional — only if env vars are set) ─────────────────────────
let supabase = null
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  console.log('Supabase connected')
}

// ── In-memory room store ───────────────────────────────────────────────────
// roomCode → Room
const rooms = new Map()

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase()
}

function makeQuestion() {
  const ops = ['+', '-', '×']
  const op = ops[Math.floor(Math.random() * ops.length)]
  let a = Math.floor(Math.random() * 50) + 1
  let b = Math.floor(Math.random() * 20) + 1
  if (op === '-' && b > a) [a, b] = [b, a]
  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b
  return { a, b, op, answer }
}

function roomPublic(room) {
  return {
    code: room.code,
    gameMode: room.gameMode,
    host: room.host,
    entryFee: room.entryFee,
    maxPlayers: room.maxPlayers,
    status: room.status,
    players: room.players.map(p => ({ address: p.address, score: p.score })),
  }
}

// ── Game flow ──────────────────────────────────────────────────────────────
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
  room.round++
  room.question = makeQuestion()
  room.status = 'playing'
  room.roundStartAt = Date.now()
  room.players.forEach(p => { p.answered = false; p.correct = null })

  // Send question WITHOUT the answer
  io.to(room.code).emit('game:question', {
    round: room.round,
    total: TOTAL_ROUNDS,
    a: room.question.a,
    b: room.question.b,
    op: room.question.op,
    timeMs: ROUND_TIME_MS,
  })

  room.roundTimer = setTimeout(() => endRound(room), ROUND_TIME_MS)
}

function endRound(room) {
  clearTimeout(room.roundTimer)
  io.to(room.code).emit('game:round_end', {
    answer: room.question.answer,
    scores: room.players.map(p => ({ address: p.address, score: p.score })),
  })

  if (room.round >= TOTAL_ROUNDS) {
    setTimeout(() => endGame(room), 1500)
  } else {
    setTimeout(() => startRound(room), 2000)
  }
}

async function endGame(room) {
  room.status = 'finished'
  const sorted = [...room.players].sort((a, b) => b.score - a.score)
  const winner = sorted[0]
  const pot = (room.entryFee * room.players.length * 0.85).toFixed(2)

  io.to(room.code).emit('game:over', {
    winner: winner.address,
    pot,
    scores: sorted.map((p, i) => ({ address: p.address, score: p.score, rank: i + 1 })),
  })

  // Persist to Supabase
  if (supabase) {
    try {
      const rows = room.players.map(p => ({
        room_code: room.code,
        game_mode: room.gameMode,
        player_address: p.address.toLowerCase(),
        score: p.score,
        total_rounds: TOTAL_ROUNDS,
        result: p.address === winner.address ? 'win' : 'loss',
        entry_fee: room.entryFee,
        earned: p.address === winner.address
          ? parseFloat(pot)
          : -room.entryFee,
        players_count: room.players.length,
      }))
      await supabase.from('game_history').insert(rows)
    } catch (e) {
      console.error('Supabase insert error:', e.message)
    }
  }

  // Clean up room after 60s
  setTimeout(() => rooms.delete(room.code), 60_000)
}

// ── Socket events ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('+ connect', socket.id)

  // List open rooms for a game mode
  socket.on('rooms:list', (gameMode, cb) => {
    const list = []
    for (const [, room] of rooms) {
      if (room.gameMode === gameMode && room.status === 'waiting') {
        list.push({
          code: room.code,
          host: room.host,
          players: room.players.length,
          max: room.maxPlayers,
          entry: room.entryFee,
          status: room.players.length >= room.maxPlayers ? 'full' : 'waiting',
        })
      }
    }
    cb(list)
  })

  // Create a new room
  socket.on('room:create', ({ gameMode, entryFee, maxPlayers, address }, cb) => {
    const code = generateCode()
    const room = {
      code,
      gameMode,
      entryFee,
      maxPlayers,
      host: address,
      players: [{ id: socket.id, address, score: 0, answered: false, correct: null }],
      status: 'waiting',
      round: 0,
      question: null,
      roundTimer: null,
      roundStartAt: null,
    }
    rooms.set(code, room)
    socket.join(code)
    socket.data.roomCode = code
    socket.data.address = address
    cb({ code })
    console.log(`Room ${code} created by ${address}`)
  })

  // Join an existing room by code
  socket.on('room:join', ({ code, address }, cb) => {
    const room = rooms.get(code.toUpperCase())
    if (!room) return cb({ error: 'Room not found' })
    if (room.status !== 'waiting') return cb({ error: 'Game already started' })
    if (room.players.length >= room.maxPlayers) return cb({ error: 'Room is full' })
    if (room.players.find(p => p.address === address)) return cb({ error: 'Already in room' })

    room.players.push({ id: socket.id, address, score: 0, answered: false, correct: null })
    socket.join(code)
    socket.data.roomCode = code
    socket.data.address = address

    io.to(code).emit('room:update', roomPublic(room))
    cb({ ok: true, room: roomPublic(room) })

    // Auto-start when room is full
    if (room.players.length >= room.maxPlayers) {
      setTimeout(() => startCountdown(room), 500)
    }
  })

  // Host manually starts the game
  socket.on('room:start', ({ code }) => {
    const room = rooms.get(code)
    if (!room) return
    if (room.host !== socket.data.address) return socket.emit('error', 'Not the host')
    if (room.players.length < 2) return socket.emit('error', 'Need at least 2 players')
    if (room.status !== 'waiting') return
    startCountdown(room)
  })

  // Player submits an answer
  socket.on('game:answer', ({ code, answer }) => {
    const room = rooms.get(code)
    if (!room || room.status !== 'playing') return

    const player = room.players.find(p => p.id === socket.id)
    if (!player || player.answered) return

    player.answered = true
    const correct = Number(answer) === room.question.answer
    player.correct = correct
    if (correct) player.score++

    io.to(code).emit('game:player_answered', {
      address: player.address,
      correct,
      scores: room.players.map(p => ({ address: p.address, score: p.score })),
    })

    // If everyone answered, end round early
    if (room.players.every(p => p.answered)) {
      clearTimeout(room.roundTimer)
      endRound(room)
    }
  })

  // Disconnect cleanup
  socket.on('disconnect', () => {
    const code = socket.data.roomCode
    if (!code) return
    const room = rooms.get(code)
    if (!room) return

    room.players = room.players.filter(p => p.id !== socket.id)
    console.log(`- ${socket.data.address} left ${code} (${room.players.length} left)`)

    if (room.players.length === 0) {
      clearTimeout(room.roundTimer)
      rooms.delete(code)
    } else {
      // Reassign host if host left
      if (room.host === socket.data.address && room.status === 'waiting') {
        room.host = room.players[0].address
      }
      io.to(code).emit('room:update', roomPublic(room))
      io.to(code).emit('game:player_left', { address: socket.data.address })
    }
  })
})

// ── REST endpoints ─────────────────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({ ok: true, rooms: rooms.size, uptime: process.uptime() })
})

app.get('/rooms/:gameMode', (req, res) => {
  const { gameMode } = req.params
  const list = []
  for (const [, room] of rooms) {
    if (room.gameMode === gameMode && room.status === 'waiting') {
      list.push({
        code: room.code,
        players: room.players.length,
        max: room.maxPlayers,
        entry: room.entryFee,
      })
    }
  }
  res.json(list)
})

// ── Start ──────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Arena Games server running on port ${PORT}`)
})
