# Arena Games — Project Context

## What It Is
Skill-based multiplayer crypto gaming platform on Polygon. Players connect wallets, deposit USDT entry fees, compete in real-time games across 6 game modes, winner takes the pot (85% after 15% rake).

## Stack
| Layer | Tech |
|-------|------|
| Frontend | React 19 + TypeScript + Vite |
| Routing | React Router v7 |
| Wallet | RainbowKit v2 + wagmi v2 + viem |
| Realtime | Socket.io client v4 |
| Database | Supabase (PostgreSQL) |
| Backend | Express.js + Socket.io server |
| Chains | Polygon + Polygon Amoy (testnet) |
| Token | USDT |

## Deployment
| Service | URL |
|---------|-----|
| Frontend | Vercel — auto-deploy from master |
| Backend | Render.com — `arena-games-server.onrender.com` (free tier) |
| Database | Supabase — project `xzhsaqnkteelriuqfjky` |
| Domain | `joinarena.space` (custom domain on Vercel) |

## GitHub
Repo: `https://github.com/thecroguy/arena-games` (user: thecroguy)

## Key Files
```
src/
  pages/
    Home.tsx          — landing + 6 game cards, Practice vs Bot CTA, SVG stats icons
    Lobby.tsx         — room browser + room creator; passes gameMode in navigate state
    Game.tsx          — multiplayer + bot practice for all 6 modes, emoji reactions, queue chat
    Profile.tsx       — avatar shop, wallet-gated stats, game history (Supabase)
    Leaderboard.tsx   — daily/weekly/alltime rankings (Supabase)
    Guide.tsx         — per-game guides for all 6 modes with worked examples
  components/
    Navbar.tsx        — sticky glass nav + SVG icons + RainbowKit ConnectButton
  utils/
    wagmi.ts          — wagmi config (Polygon + Amoy chains)
    socket.ts         — Socket.io singleton client
    supabase.ts       — Supabase client + fetchLeaderboard/fetchPlayerHistory
    avatar.ts         — DiceBear avatar catalog (25 bases × 6 colors = 150 styles)

server/
  index.js            — Express + Socket.io server, all 6 game modes, chat, reactions
  package.json

supabase/
  schema.sql          — game_history + player_profiles tables + leaderboard views + RLS

vercel.json           — SPA rewrite + installCommand
render.yaml           — Render.com backend config
.npmrc                — legacy-peer-deps=true (wagmi/rainbowkit compat)
```

## Environment Variables

### Frontend (Vercel)
```
VITE_SOCKET_URL              = https://arena-games-server.onrender.com
VITE_SUPABASE_URL            = https://xzhsaqnkteelriuqfjky.supabase.co
VITE_SUPABASE_ANON_KEY       = <anon public key from Supabase>
VITE_WALLETCONNECT_PROJECT_ID = 36c523bc6b1ee8cd0a3021eae67957c6
VITE_HOUSE_WALLET            = <house wallet address for USDT receives>
```

### Backend (Render.com)
```
NODE_ENV             = production
PORT                 = 3001
CLIENT_URL           = https://joinarena.space,https://www.joinarena.space
SUPABASE_URL         = https://xzhsaqnkteelriuqfjky.supabase.co
SUPABASE_SERVICE_KEY = <service_role key from Supabase>
```

## Game Modes
| Mode | Type | Rounds | Timer | Min→Max Players | Range |
|------|------|--------|-------|-----------------|-------|
| Math Arena | Speed | 10 | 12s | 2–10 | — |
| Word Blitz | Speed | 10 | 15s | 2–10 | — |
| Reaction Grid | Speed | 15 | 5s | 2–10 | — |
| Highest Unique | Sealed bid | 8 | 20s | 2–20 | 1–100 |
| Lowest Unique | Sealed bid | 8 | 20s | 2–20 | 1–50 |
| Number Rush | Sealed bid | 8 | 20s | 2–30 | 1–50 |

### Sealed Bid Logic (server-side, `evaluateSealed`)
- **Highest Unique**: unique picks only; highest unique wins the round
- **Lowest Unique**: unique picks only; lowest unique wins the round
- **Number Rush**: rarest pick wins; ties broken by lowest number

## Full Game Flow
1. Player connects wallet → Home → picks game mode
2. **Bot practice**: click "Practice vs Bot" → `/game/practice` with `{ bot: true, gameMode }`
3. **Multiplayer**: click "Play Now" → `/lobby?mode=<gameMode>` → create or join room
4. Lobby passes `gameMode` in navigate state: `{ host, entry, maxPlayers, gameMode }` / `{ gameMode }`
5. Server sends 3-2-1 countdown → questions → round timer
6. Server validates all answers; correct answer never sent to client before round end
7. After all rounds: server calculates winner, saves to Supabase, emits `game:over`
8. Winner + pot shown on screen; USDT payout is manual until smart contract deployed

## Bot Practice Mode (All 6 Games)
- Runs entirely client-side — no socket connection, no real money
- Bot delays: 2.5–7.5s random per round
- Bot accuracy by game: Reaction Grid 80%, Math Arena 70%, Word Blitz 60%
- Sealed games: bot picks randomly within valid range; winner evaluated with same rules as server
- State managed with refs (`botSealedPickRef`, `playerSealedPickRef`) to avoid stale closure bugs

## Social Features
### Emoji Reactions (in-game)
- Available during `playing` and `round_end` phases
- 8 reactions: 😭 💀 🔥 😂 🤯 👀 🫡 😤
- Floating animation (`floatUp` CSS keyframe), bottom-left corner
- Server validates against `VALID_EMOJIS` Set before broadcasting (`reaction:send` → `reaction:message`)
- Rate limit: 8/sec per socket

### Queue Chat (waiting phase only, multiplayer)
- Text input shown only during `phase === 'waiting' && !isBotMode`
- Server strips `<>`, max 120 chars, then broadcasts (`chat:send` → `chat:message`)
- Rate limit: 3/sec per socket
- Auto-scroll to latest message via `chatEndRef`

## Avatar System
- **Free**: Robot (`bottts`) — always unlocked, color derived from wallet address
- **$1 tier**: Bionic, Pixel, Retro, Shapes, Rings, Thumbs, Emoji, Icons, Mini, Identicon
- **$2 tier**: Explorer, Wanderer, Lorelei, Echo, Micah, Doodle, Sketch, Big Ears, Ears, Smile
- **$3 tier**: Cartoon, Toon, Peeps, Persona, Notion, Clean
- 25 base styles × 6 background colors = **150 total combinations**
- Background colors: Classic (none), Sky (#b6e3f4), Lavender (#c0aede), Blush (#ffd5dc), Mint (#c1f4c5), Peach (#ffdfbf)
- Pending selection UI: click avatar → "Save Avatar" bar appears → explicit save (no silent auto-save)
- Grid: horizontal scroll by default (collapsed), "Expand all" toggle for full grid
- `onError` fallback on all avatar `<img>` → falls back to identicon (prevents alt text display)
- DiceBear API: `https://api.dicebear.com/8.x/{style}/svg?seed={16-char-address}&backgroundColor={hex}`
- Avatar unlock: user sends USDT to house wallet → client calls `player_profiles` upsert (Supabase)

### Invalid DiceBear Styles (removed — showed alt text / broken images)
- `glass` — not a valid DiceBear v8.x style
- `dylan` — not a valid DiceBear v8.x style
- `initials` — shows letter-based text avatar ("FA"), looks wrong for a game platform

## Server Security Measures
- **Input validation**: all socket events validate address (`/^0x[0-9a-fA-F]{40}$/`), txHash (`/^0x[0-9a-fA-F]{64}$/`), fee (Set), game mode (Set), answer length (≤64 chars/32 chars)
- **Answer never leaked**: `answer` field stripped from question payload before sending to client
- **Rate limiting**: per-socket: general 5/s, answers 10/s, chat 3/s, reactions 8/s
- **CORS**: hardcoded allowlist includes `joinarena.space`, `www.joinarena.space`, `*.vercel.app` + `CLIENT_URL` env
- **Emoji validation**: server validates against a known Set — no arbitrary strings broadcast
- **Chat sanitization**: `<>` stripped, max 120 chars, empty strings rejected
- **Score authority**: all scores computed server-side; client cannot submit a score
- **Sealed bids**: picks stored server-side, never broadcast to other players until round end

## Known Security Gaps (Pre-Production)
| Severity | Issue | Impact |
|----------|-------|--------|
| Critical | `configuredOrigins.length === 0 → return true` fallback | If `CLIENT_URL` env is missing, any origin is accepted |
| Critical | RLS `using (true) with check (true)` on `player_profiles` | Any authenticated user can modify any other player's profile |
| Critical | No on-chain TX confirmation before avatar unlock | Client self-reports payment; no blockchain verification |
| Medium | No wallet signature verification | User can claim any wallet address on join |
| Medium | `VITE_HOUSE_WALLET` defaults to zero address if env not set | Payments go to 0x000...000 if misconfigured |
| Low | Render.com free tier cold start ~30s | First request after 15min idle fails |

### Fix Priorities Before Production
1. Set `CLIENT_URL` env on Render.com — never leave it empty
2. Fix RLS: `using (auth.uid() = user_id)` scoped to owner
3. Add backend webhook (Alchemy/QuickNode) to confirm TX before writing DB unlock
4. Add wallet signature challenge on room join for identity assurance

## Smart Contracts
- USDT Polygon: `0xc2132D05D31c914a87C6611C10748AEb04B58e8F`
- Game escrow contract: **NOT deployed** — payments are manual for now

## Monetization
1. **Game rake** — 15% of every pot (live)
2. **Avatar shop** — premium DiceBear styles ($1–$3 USDT, 150 combos)
3. **Paid tournaments** — special entry-fee events (roadmap)
4. **Battle pass** — monthly cosmetics (roadmap)
5. **Referral** — 5% of referred player's rake for 30 days (roadmap)

## Production Readiness Assessment
**Status: Beta / Soft Launch Ready — NOT fully production-hardened**

What works:
- All 6 game modes with server-side validation
- Bot practice for all 6 games
- Avatar shop with 150 style combinations
- Emoji reactions + queue chat
- Supabase game history + leaderboard
- Glass navbar, responsive mobile layout
- Per-game guides

What needs fixing before trusting real money:
- RLS policy scoped to user (not public write)
- TX confirmation before avatar unlock
- `CLIENT_URL` env must be set (fail-secure CORS)
- Smart contract escrow for trustless payouts

Safe for real users with small stakes (manual payouts reviewed by team). Not safe for automated high-value payouts without the above fixes.

## Working Setup Steps (Checklist)
- [x] `supabase/schema.sql` run in Supabase SQL editor
- [x] All env vars set on Vercel
- [x] `CLIENT_URL` = `https://joinarena.space,https://www.joinarena.space` on Render.com
- [x] Root Dir = `server` on Render.com
- [x] Custom domain `joinarena.space` configured on Vercel
- [ ] Fix RLS policies to be owner-scoped
- [ ] Add TX confirmation webhook before avatar unlock
- [ ] Deploy smart contract on Polygon Amoy for testnet escrow
- [ ] Set `VITE_HOUSE_WALLET` to real house wallet address
