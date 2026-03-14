# Arena Games — Project Context

## What It Is
Skill-based multiplayer crypto gaming platform on Polygon. Players connect wallets, deposit USDT entry fees, compete in real-time games, winner takes the pot (85% after 15% rake).

## Stack
| Layer | Tech |
|-------|------|
| Frontend | React 19 + TypeScript + Vite + Tailwind v4 |
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
| Frontend | Vercel — `arena-games.vercel.app` (auto-deploy from master) |
| Backend | Render.com — `arena-games-server.onrender.com` (free tier) |
| Database | Supabase — project `xzhsaqnkteelriuqfjky` |

## GitHub
Repo: `https://github.com/thecroguy/arena-games` (user: thecroguy)

## Key Files
```
src/
  pages/
    Home.tsx          — landing page, game grid, "Practice vs Bot" CTA
    Lobby.tsx         — room browser + room creator (Socket.io)
    Game.tsx          — multiplayer game + bot practice mode
    Profile.tsx       — wallet-gated stats + game history (Supabase)
    Leaderboard.tsx   — daily/weekly/alltime rankings (Supabase)
  components/
    Navbar.tsx        — sticky nav + RainbowKit ConnectButton
  utils/
    wagmi.ts          — wagmi config (Polygon + Amoy chains)
    socket.ts         — Socket.io singleton client
    supabase.ts       — Supabase client + fetchLeaderboard/fetchPlayerHistory
    avatar.ts         — DiceBear avatar URLs + accent colors

server/
  index.js            — Express + Socket.io server, in-memory game state
  package.json

supabase/
  schema.sql          — game_history table + leaderboard views + RLS

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
```

### Backend (Render.com)
```
NODE_ENV           = production
PORT               = 3001
CLIENT_URL         = https://arena-games.vercel.app
SUPABASE_URL       = https://xzhsaqnkteelriuqfjky.supabase.co
SUPABASE_SERVICE_KEY = <service_role key from Supabase>
```

## Game Flow
1. Player connects wallet → goes to Lobby → creates/joins room
2. Host clicks Start (min 2 players)
3. Server sends 3-2-1 countdown → math questions → 12s timer per round
4. Server validates answers (never sends correct answer to client)
5. After 10 rounds: server calculates winner, saves to Supabase, emits game:over
6. Winner shown on screen (USDT payout manual until smart contract deployed)

## Bot Practice Mode
- Navigate to `/game/practice` with state `{ bot: true }`
- Runs entirely client-side, no socket
- Bot answers after 2.5–7.5s with 70% accuracy
- No real money involved

## Avatars
- DiceBear API: `https://api.dicebear.com/8.x/adventurer/svg?seed={address}`
- Deterministic per wallet address
- Future: purchasable premium styles (avataaars, bottts, micah etc.) via USDT

## Smart Contracts
- USDT Polygon: `0xc2132D05D31c914a87C6611C10748AEb04B58e8F`
- Game contract: `0x000...000` — NOT deployed yet (payments are manual for now)

## Monetization Plan (Roadmap)
1. **Game rake** — 15% of every pot (live)
2. **Avatar shop** — premium DiceBear styles ($1–$5 USDT)
3. **Accessories** — hats, badges, frames on avatars ($0.50–$3)
4. **Paid tournaments** — special entry-fee events
5. **Battle pass** — monthly cosmetics subscription
6. **Referral** — 5% of referred player's rake for 30 days

## Known Limitations
- Smart contract not deployed → no trustless escrow yet (payments manual)
- Render.com free tier spins down after 15min inactivity (cold start ~30s)
- Supabase anon key in frontend is safe (RLS enforces read-only for public)

## Pending Setup Steps
- [ ] Run `supabase/schema.sql` in Supabase SQL editor
- [ ] Add all env vars to Vercel (especially VITE_SUPABASE_ANON_KEY)
- [ ] Fix Render.com: Root Dir = `server`, correct env var names
- [ ] Deploy smart contract on Polygon Amoy for testnet escrow
