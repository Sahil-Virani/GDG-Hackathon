# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Outfit Battle: a multiplayer fashion game (React + Vite client, Express server, shared Zod schemas) with Vonage video, on-device MediaPipe pose framing, and a Gemini judge/stylist. README.md is detailed and authoritative on product behavior, env vars, and the API route table.

## Commands

Requires Node 22.12+. Single `package.json` at the root; no workspaces.

```bash
npm install            # postinstall runs setup:assets (copies MediaPipe WASM, downloads pose model to client/public/mediapipe, gitignored)
npm run dev            # tsx watch server (port 3002) + Vite (5173, proxies /api -> PORT)
npm run typecheck      # tsc --noEmit over client, server, shared, tests
npm test               # node:test logic suite: tests/*.test.ts via tsx
npm run test:e2e       # Playwright (Chromium); auto-starts or reuses `npm run dev`
npm run build          # typecheck + vite build -> dist/client
npm start              # serves dist/client + API (uses POSIX `NODE_ENV=production` syntax; run from Git Bash on Windows)
npm run format         # prettier (singleQuote, trailingComma all, printWidth 100)
```

Single tests:

```bash
node --import tsx --test --test-name-pattern "double capture" tests/game.test.ts
npx playwright test -g "pose guidance is advisory"
```

E2E needs `npx playwright install chromium` once. It runs serially (1 worker) and writes screenshots to `test-results/`. The tests replace `getUserMedia` with a canvas stream and rely on demo-mode copy such as "Your next look starts here." Keep that in mind when changing UI text or fallback advice.

## Configuration modes

`server/src/config.ts` validates env with Zod at import time:

- `DEMO_MODE=true` (default) gives deterministic fake judging/coaching and no Gemini calls.
- Vonage video turns on whenever both `VONAGE_APPLICATION_ID` and `VONAGE_PRIVATE_KEY_PATH` are set, **independent of demo mode**.
- `DEMO_MODE=false` throws at startup unless Gemini _and_ Vonage are configured. Never add a silent fallback to mocked AI.

## Architecture

**The server is the only authority; there is no socket server or database.** `server/src/state/game.ts` (`GameStore`) holds every room in in-memory Maps and owns all transitions. Every mutation calls `touch()`, which bumps `room.revision` and emits a small `GameEvent`. In `app.ts` the emitter is `broadcast` from `services/video.ts`, which sends it as a Vonage signal. Clients treat signals only as _refresh hints_. `useRoom` fetches `GET /state` on each signal and also polls every 1.5s, discarding older revisions. So a new game feature means server state + projection + route. Never trust client-sent state and never put game data in signals.

**Phases:** `LOBBY → THEME_REVEAL → POSE → LEADERBOARD → ADVICE → (next round | FINAL_RESULTS)`. Time-based transitions (theme reveal end, leaderboard → advice, capture deadline, 35s presence lease expiry, 6h room cleanup) all happen in `GameStore.tick()`, which `server/src/index.ts` calls every second. Per-player status (posing/judging/locked) is separate from the room phase. `checkComplete` / `checkAdvance` only consider _connected_ players, so disconnects can unblock a round.

**Score secrecy is a core invariant.** `GameStore.view()` (public) and `privateView()` (owner) are the only projections sent to clients. No scores or breakdowns appear until `round.leaderboard` exists, and advice and closet images are owner-only. Tests assert this by searching the serialized JSON for `"score"`. Keep it true when adding fields.

**Capture/judging flow (`GameStore.capture`):** attempts are capped at 3. The `judging` flag blocks concurrent double submissions. After the `await judge(...)`, the code re-checks round, phase, and finalized, because a deadline or disconnect may have finalized the round meanwhile. Preserve this race guard. An unsuitable photo returns the player to posing until the third attempt, which gets a neutral 5. Provider errors also finalize with a neutral 5 (`fallback: true`). `normalizeJudgment` recomputes the total from the rubric (theme 0–4, color 0–3, fit 0–3) and trims feedback to 15 words. `rankRound` breaks ties by total → theme → styling → color, and identical rubrics share a rank. Only the final round decides the winner.

**`shared/schema.ts`** is imported by both sides. It holds Zod request schemas, the AI output schemas (`judgeSchema`, `adviceSchema`), which are also converted with `z.toJSONSchema` into Gemini's `responseJsonSchema`, the event/reaction signal schemas, and the `RoomView`/`PrivateView` types. Change a schema here and both the Gemini contract and the client types change with it.

**AI (`server/src/services/ai.ts`):** `@google/genai` is server-only. `structured()` does JSON-mode generation followed by Zod parsing. If the scoring model returns HTTP 429/500/503/504, it retries once on `GEMINI_FALLBACK_MODEL`. `judgeWithRetry` (`services/judging.ts`) retries once more, then falls back to neutral. Failures are logged through `logAiError`, which never logs images or keys. Demo branches live inside `judge`/`coach`/`tryOn`. The system prompt restricts judging to clothing only and treats user text as data; keep that restriction in any prompt changes.

**Client:** routes are `/` (Landing) and `/battle/:code` (lazy `Battle`). Credentials (participant ID + bearer token) live in a Zustand store persisted to `sessionStorage` (per tab), and `lib/api.ts` attaches them to requests. `useVideo` gets the camera stream, reports connection status, and lazily imports `@opentok/client` only when the server returns video credentials. The same `MediaStream` feeds preview, Vonage publishing, pose detection, and still capture. `usePose` runs MediaPipe locally at about 10 Hz and fails open. Pose guidance is advisory only and must never block Ready/capture (an e2e test covers this). Pure framing geometry lives in `client/src/lib/pose.ts` and is unit-tested.

## Conventions

- ESM throughout. Server files import relative modules with `.js` extensions (`'./config.js'`); client files and tests import without extensions.
- Errors meant for users are thrown as `GameError(message, status)`. The Express error handler maps `GameError`, `ZodError`, and body-size errors to JSON `{ error }` and hides everything else behind a generic 503.
- Validate request bodies with schemas from `shared/schema.ts` (or inline `z.object`) inside the route, then call `auth(req)` to resolve room + player from the bearer token.
