# Local operations

## Startup

Use the existing `/workspace/autoai-india` checkout; cloud tasks are already isolated. Do not create a worktree or inspect previous AutoAI India checkouts. Confirm Node major version 24, run `npm ci` when dependencies need refreshing, then `npm run build` and `npm start`. The build validates the API, Next.js site, and Expo web/Android/iOS bundles. The API uses port 4000 by default. The server process must restart in future tasks; installed files are not live processes.

Readiness is demonstrated by `GET /api/health` (status ok), `GET /api/catalogue` (vehicles array), `npm run test:smoke`, and the test suite. Start the website separately with `npm run start:web`. An empty verified catalogue is normal. For the Expo shell use `npm run dev:mobile`; a physical device needs `EXPO_PUBLIC_API_URL` set to an address it can reach rather than loopback.

## Stop and restart

Send SIGTERM to the API process you started. SQLite closes through Fastify's shutdown hook. Do not kill unrelated port listeners. Runtime tests use their own temporary database and port 4197; free that port before testing rather than connecting tests to the development database.

## Persistence

The local `.data` directory is intentionally ignored. Keep it private and never add it to Git. For a development backup, stop the API before copying the database and any WAL/SHM companion files as a set into private storage. Restore only into a separate test directory first and verify account/data access. No automated encrypted backup/restore system has been deployed.

## Failure diagnosis

- Missing dependencies: run `npm ci` using the writable npm cache configured in `.npmrc`.
- Port occupied: inspect the owner; use API_PORT for your own process and do not stop someone else's service.
- Invalid origin: align APP_ORIGIN with the actual same-origin frontend. Production requires an explicit origin and HTTPS cookies.
- Unavailable payments/documents: expected until reviewed providers and adapters exist, not a reason to bypass validation.
- Empty advisor: inspect exclusions; missing review metadata, stale records or unmet customer needs are not grounds for fabricating a recommendation.
- Browser test: use installed `/usr/bin/chromium`, or supply CHROMIUM_EXECUTABLE_PATH. Downloading Playwright Chromium was blocked by network policy in onboarding; the existing browser passed the tests.
- Expo state: scripts direct Expo CLI state to `/tmp/autoai-expo` because the default home directory is not writable. Expo Doctor's online schema and React Native Directory checks require `exp.host`, which is blocked by the current egress policy; local dependency, Hermes and bundling checks pass.

## External activation

New MongoDB Atlas, Upstash, object storage, Vercel, Render, payment and AI resources require separate provider decisions and any paid-service approval. Never reuse previous AutoAI India resources. Do not put real identity documents or payments into this local foundation. No remote push, production deployment or protected-branch merge has occurred.
