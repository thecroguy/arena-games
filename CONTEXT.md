# Arena Games — Project Context (LOCAL ONLY — DO NOT COMMIT)

> Last updated: 2026-03-15 (session 4)

---

## What It Is
Skill-based multiplayer crypto gaming platform on Polygon. Players connect wallets, deposit USDT into a smart contract escrow, compete in 6 real-time game modes, and the winner claims the pot directly from the contract (~$0.01 MATIC gas).

---

## Stack
| Layer | Tech |
|-------|------|
| Frontend | React 19 + TypeScript + Vite |
| Routing | React Router v7 |
| Wallet | RainbowKit v2 + wagmi v2 + viem |
| Realtime | Socket.io client v4 |
| Database | Supabase (PostgreSQL) |
| Backend | Express.js + Socket.io server |
| Chains | Polygon (137) + Polygon Amoy testnet (80002) |
| Token | USDT (Polygon) / MockUSDT (Amoy testnet) |

---

## Deployment
| Service | URL |
|---------|-----|
| Frontend | Vercel — auto-deploy from master |
| Backend | Render.com — `arena-games-server.onrender.com` |
| Database | Supabase — project `xzhsaqnkteelriuqfjky` |
| Domain | `joinarena.space` (custom domain on Vercel) |

**GitHub:** `https://github.com/thecroguy/arena-games`

---

## Deployed Contracts

| Contract | Network | Address |
|----------|---------|---------|
| ArenaEscrow | Polygon Mainnet (137) | `0x2a5ee961bCC775B40556524072A09584844f147c` |
| ArenaEscrow | Polygon Amoy testnet (80002) | `0x9A7C8213B15859771Adc7a1DbA9891977Ae886Bb` |
| MockUSDT | Polygon Amoy testnet (80002) | `0x2a5ee961bCC775B40556524072A09584844f147c` |

**Deployer / Server / House wallet:** `0x65f27765Ec1a8448728015D26307377C55E2F828`

---

## Money Flow

```
Player → USDT.approve(escrow, amount) → escrow.deposit(roomId, entryFee)
                                                        |
                                          Server watches deposit events
                                          (reads hasDeposited via eth_call raw fetch)
                                                        |
                                          Game ends → Server signs claimSig
                                          keccak256(roomId, winnerAddress)
                                                        |
Winner ──────────────────── escrow.claim(roomId, winner, sig) from own wallet
                                                        |
                                              85% → winner wallet
                                              15% → house wallet
```

**Rake:** 15% (RAKE_BPS = 1500)
**Winner pot:** `entryFee × numPlayers × 0.85`
**House cut:** `entryFee × numPlayers × 0.15`

**Refund flow (abandoned room):**
```
Server signs keccak256(roomId, "REFUND")
→ emits game:refund_sig to all players
→ each player calls escrow.claimRefund(roomId, sig) from own wallet
→ 100% returned to each depositor
```

**Payout modes:**
- `escrow` — signature-based on-chain claim (when ESCROW_* env vars set)
- `manual` — fallback; server handles payout off-chain

---

## Signature Scheme (EIP-191)

- Server uses `@noble/hashes/sha3` + `@noble/curves/secp256k1` — NO ethers.js (removed to stop JsonRpcProvider spam)
- **Claim sig:** `keccak256(abi.encodePacked(roomId, winner))` — signed by `SERVER_SIGNING_KEY` wallet
- **Refund sig:** `keccak256(abi.encodePacked(roomId, "REFUND"))` — signed by `SERVER_SIGNING_KEY` wallet
- **Auth sig:** `signMessage("Arena Games: {address}")` — signed by player, proves address ownership
- **roomId:** `keccak256(abi.encodePacked(roomCode))` — bytes32
- Players pay their own gas (~$0.01 MATIC)

---

## Environment Variables

### Backend — Render.com
| Var | Purpose |
|-----|---------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `CLIENT_URL` | `https://joinarena.space,https://www.joinarena.space` |
| `SUPABASE_URL` | `https://xzhsaqnkteelriuqfjky.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Service role key (write access) |
| `SERVER_SIGNING_KEY` | Private key of escrow signing wallet |
| `HOUSE_WALLET` | House wallet address — required for avatar tx verification |
| `ESCROW_AMOY` | `0x9A7C8213B15859771Adc7a1DbA9891977Ae886Bb` |
| `ESCROW_POLYGON` | `0x2a5ee961bCC775B40556524072A09584844f147c` |
| `ADMIN_KEY` | Secret for `/admin/rooms` endpoint |

### Frontend — Vercel
| Var | Purpose |
|-----|---------|
| `VITE_SOCKET_URL` | `https://arena-games-server.onrender.com` |
| `VITE_SUPABASE_URL` | `https://xzhsaqnkteelriuqfjky.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon key (read-only Supabase) |
| `VITE_WALLETCONNECT_PROJECT_ID` | `36c523bc6b1ee8cd0a3021eae67957c6` |
| `VITE_HOUSE_WALLET` | House wallet address (receives 15% rake) |
| `VITE_ESCROW_AMOY` | `0x9A7C8213B15859771Adc7a1DbA9891977Ae886Bb` |
| `VITE_ESCROW_POLYGON` | `0x2a5ee961bCC775B40556524072A09584844f147c` |
| `VITE_USDT_AMOY` | `0x2a5ee961bCC775B40556524072A09584844f147c` (MockUSDT) |
| `VITE_USDT_POLYGON` | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` (real USDT) |
| `VITE_ANALYTICS_PASSWORD` | Password for `/analytics` admin page (default: `arena2026`) |

---

## Game Modes

| ID | Name | Type | Rounds | Timer | Players |
|----|------|------|--------|-------|---------|
| `math-arena` | Math Arena | Speed | 10 | 12s | 2–10 |
| `word-blitz` | Word Blitz | Speed | 10 | 15s | 2–10 |
| `reaction-grid` | Reaction Grid | Speed | 15 | 5s | 2–10 |
| `highest-unique` | Highest Unique | Sealed bid | 8 | 20s | 2–20 |
| `lowest-unique` | Lowest Unique | Sealed bid | 8 | 20s | 2–20 |
| `number-rush` | Number Rush | Sealed bid | 8 | 20s | 2–30 |

All modes have bot practice (client-side only, no socket, no money). Bot accuracy: Reaction 80%, Math 70%, Word 60%.

**Matchmaking queue:**
- Queue key: `${gameMode}:${entryFee}:${chainId}`
- 2+ players in queue triggers `doMatch()` — creates room, joins all to socket room, emits `matchmaking:matched`
- 30s timeout if only 1 player — emits `matchmaking:timeout`
- Players redirect to Lobby with `autoJoin` router state → auto-triggers deposit flow

**Sealed bid logic (`evaluateSealed`):**
- Highest Unique: unique picks only; highest unique wins
- Lowest Unique: unique picks only; lowest unique wins
- Number Rush: rarest pick wins; ties broken by lowest number

---

## Supabase Tables

| Table | Purpose |
|-------|---------|
| `game_history` | One row per player per game — result, pot, claim_sig, escrow_address, room_id_hash, claimed_at |
| `escrow_events` | Audit log — deposit_confirmed, claim_signed, refund_signed |
| `player_profiles` | Username, avatar style, purchased styles per wallet address |
| `active_rooms` | Waiting rooms persisted so they survive Render restarts |
| `leaderboard_alltime` / `leaderboard_weekly` / `leaderboard_daily` | Views over game_history |

`escrow_events` key columns: `event_type`, `room_code`, `room_id_hash`, `chain_id`, `escrow_address`, `player_address`, `amount_usdt`, `tx_hash`, `sig`, `note`

---

## Key Files

| File | Purpose |
|------|---------|
| `server/index.js` | Main server — game logic, signing, Supabase writes, all REST endpoints |
| `src/pages/Game.tsx` | Game UI — claim/refund buttons, bot mode, reconnect handling |
| `src/pages/Lobby.tsx` | Room browser, deposit flow, wallet auth sig challenge |
| `src/pages/Profile.tsx` | Profile, avatar, stats, stuck deposit viewer, self-serve refund/claim |
| `src/pages/Analytics.tsx` | Admin analytics dashboard — password gated, at `/analytics` (not in nav) |
| `src/components/Navbar.tsx` | Navbar — persistent active-room return banner |
| `src/pages/Home.tsx` | Landing page — 6 game cards, Practice vs Bot CTA |
| `src/utils/escrow.ts` | ABI, address helpers, getRoomId() |
| `src/utils/supabase.ts` | Supabase client, profile/avatar/history helpers |
| `src/utils/socket.ts` | Singleton socket with auto-reconnect (5 attempts, 1s delay) |
| `src/utils/profile.ts` | getUsername() — reads localStorage, falls back to deterministic addrName() |
| `contracts/contracts/ArenaEscrow.sol` | Escrow contract (claim, claimRefund, emergencyRefund) |
| `contracts/scripts/emergency-refund.js` | Manual emergency refund for stuck rooms (run after 24h) |
| `supabase/schema.sql` | Full DB schema — safe to re-run (uses IF NOT EXISTS) |

---

## Server API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/active-deposit/:address` | Returns `{hasActive, roomCode}` — prevents joining two games at once |
| `GET /api/stuck-deposits/:address` | Unsettled deposits with refund_sig (if signed) and 24h countdown |
| `GET /api/pending-claim/:address` | Won games with claim_sig not yet claimed on-chain |
| `GET /api/room-history/:address` | All rooms player deposited in (from escrow_events) — used by Profile scan |
| `POST /api/report-deposit` | Client fallback — records deposit even if server was down at deposit time |
| `POST /api/mark-claimed` | Marks game_history row as claimed after winner calls claim() on-chain |
| `POST /api/profile` | Wallet-sig verified profile update |
| `POST /api/avatar-unlock` | Wallet-sig verified avatar unlock + on-chain tx receipt verification |
| `GET /health` | Keep-alive + room count |
| `GET /admin/rooms` | Admin room snapshot (requires `ADMIN_KEY` header) |

---

## Username System

Usernames are stored in `localStorage` per device under key `ag_un_{address}`. Since other players' usernames aren't known cross-device, every address has a **deterministic fallback name** generated from the wallet address hash (e.g. `CyberWolf42`, `SwiftShark07`). Same address → same name on any device. Set in `src/utils/profile.ts → addrName()`.

Player profiles (including custom usernames) are also stored in Supabase `player_profiles` table but the frontend currently reads localStorage first — full cross-device sync via Supabase profile fetch is a future improvement.

---

## Security Status

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | No wallet ownership challenge on join | High | Fixed — `signMessage("Arena Games: {address}")` cached per session, server verifies |
| 2 | Claim sigs have no nonce/expiry | Medium | Open — mitigated by contract `settled` flag |
| 3 | Avatar purchase tx not verified on-chain | Medium | Fixed — server checks Transfer log to HOUSE_WALLET via Polygon RPC |
| 4 | Render free tier instability | Medium | Mitigated — room persistence + recoverStuckRooms on startup |
| 5 | Game state partly in memory | Medium | Partial — waiting rooms persist; mid-game crash triggers refund |
| 6 | Deposit event miss risk | Medium | Mitigated — client `/api/report-deposit` fallback |
| 7 | No reconnect handling | Medium | Fixed — `rejoin()` on socket reconnect; server holds 30s window |
| 8 | No automatic matchmaking | Low | Fixed — matchmaking queue with 30s timeout, doMatch() creates room |
| 9 | No spectator mode | Low | Open |
| 10 | Admin endpoint not rate limited | Low | Open |
| 11 | DiceBear avatar API dependency | Low | Open — avatars are cosmetic only |
| 12 | Bot logic visible in frontend | Info | Acceptable — no money at risk |

Previously fixed critical issues (all resolved):
- CORS fail-open when `CLIENT_URL` env missing
- `HOUSE_WALLET` defaults to `0x0` (fund loss risk)
- Supabase anon key could write any player profile
- Signing key wallet address logged to stdout

---

## Payout Timing

| Scenario | Speed |
|----------|-------|
| Game completes normally — winner claims | Instant — winner clicks Claim, pays ~$0.01 gas |
| Game abandoned (players leave) | Instant — server signs refund, each player clicks button |
| Room timed out (10 min, no game start) | Instant — server auto-issues refund sigs |
| Server restarted mid-game | Instant after restart — recoverStuckRooms() signs refunds on startup |
| Server offline >24h | 24h — emergencyRefund() on Profile page, no server needed |

---

## Known Bugs Fixed (Session 4 — 2026-03-15)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Server crashed on every room creation | `saveRoomToDb` called `.catch()` on Supabase query builder (not a full Promise in v2) — unhandled rejection crashed Node v22 | Replaced with `try/catch + await` in saveRoomToDb, deleteRoomFromDb, escrow_events insert |
| "Room not found" immediately after create | Server crash wiped room from memory before room was saved to DB | Fixed by above crash fix |
| Deposit stuck as "Pending" indefinitely | `hasDepositedOnChain` called before tx confirmed (tx pending in mempool) | Added retry loop: 3× 10s retries before giving up |
| Game started while player still in MetaMask | Auto-start fired on room:join when room hit maxPlayers, regardless of deposit status | Removed auto-start from room:join; now auto-starts only when room full AND all players deposited |
| Winner/leaderboard showed wallet addresses | `getUsername()` fell back to `shortAddr()` (cross-device localStorage miss) | Added deterministic `addrName()` fallback — consistent name from address hash |
| Lobby "Host:" showed raw address | Direct `shortAddr()` call | Replaced with `getUsername()` |

---

## Stuck USDT — 2026-03-15 Testing Incident

Root cause: Render free tier restarted mid-deposit, rooms lost from memory, USDT locked in contract.

- Account 1 (`0x65f2...F828`) — 0.5 USDT locked for room JPE9
- Account 2 (`0x5d36...c024`) — 0.5 USDT locked for room YJC6
- Both rooms manually inserted into Supabase `escrow_events` as `deposit_confirmed`
- Recovery: After 1:42pm on 2026-03-16 (24h after deposit) → Profile page → Emergency Refund buttons
- Backup: `cd contracts && npm run emergency-refund` (requires private key in `contracts/.env`, clear after use)

---

## Live Test Results (2026-03-15)

End-to-end test on Polygon mainnet PASSED:
- Both players deposited $0.50 USDT each → $1.00 pot
- Highest Unique game played 8 rounds
- Account 1 won 6/8, Account 2 won 1/8
- Winner claimed: $0.85 USDT to winner + $0.15 USDT to house wallet (same address in test)
- All escrow contract interactions confirmed on-chain ✅

---

## Fix Priorities (Open)

1. [ ] Recover JPE9 + YJC6 stuck USDT — after 1:42pm Mar 16 2026, Profile → Emergency Refund
2. [ ] Add nonce/expiry to claim signatures (security issue #2)
3. [ ] Cross-device username sync via Supabase `player_profiles` table
4. [ ] Analytics dashboard at `/analytics` — page built (`src/pages/Analytics.tsx`), route not yet wired in App.tsx

---

## Checklist

- [x] `supabase/schema.sql` run in Supabase SQL editor
- [x] `claimed_at` column added to game_history
- [x] `active_rooms` table created
- [x] JPE9 + YJC6 inserted into escrow_events manually
- [x] RLS patch run (`revoke insert/update from anon`)
- [x] All env vars set on Render and Vercel
- [x] Custom domain `joinarena.space` on Vercel
- [x] `CONTEXT.md` in `.gitignore`
- [x] ArenaEscrow deployed on Polygon mainnet
- [x] Room persistence to Supabase (active_rooms)
- [x] UptimeRobot keep-alive + server self-ping
- [x] Emergency refund script (contracts/scripts/emergency-refund.js)
- [x] 10-min deposit timeout with auto-refund
- [x] Block double-joining if user has active locked deposit
- [x] Persistent return-to-room banner in Navbar
- [x] Profile page — stuck deposits, pending claims, on-chain scan
- [x] SERVER_URL falls back to VITE_SOCKET_URL
- [x] gas: 300000n on all emergencyRefund/claimRefund/claim calls
- [x] recoverStuckRooms() on server startup
- [x] Wallet sig challenge on room create/join
- [x] Socket reconnect handling
- [x] Avatar purchase tx verified on-chain
- [x] Auto matchmaking queue (30s timeout, doMatch creates room, autoJoin flow in Lobby)
- [x] ethers.js removed — replaced with @noble/hashes + @noble/curves (no JsonRpcProvider spam)
- [x] saveRoomToDb crash fix (Supabase .catch bug on Node v22)
- [x] Deposit retry loop (3×10s) for pending tx confirmation
- [x] Auto-start only when room full AND all deposited
- [x] Deterministic username fallback (addrName from address hash)
- [x] End-to-end mainnet test PASSED (create → deposit → play → claim)
- [ ] Recover JPE9 + YJC6 after 1:42pm Mar 16 2026
- [ ] Analytics route wired in App.tsx
