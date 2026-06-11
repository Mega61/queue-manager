# Andante Labs · Queue Manager

A robust **Solace PubSub+** publish/subscribe console built on **Next.js**. Publish to
**queues and topics**, subscribe to **queues and topics** (topic taps live *or* guaranteed),
and manage incoming traffic with a live feed, **JSON download** (single & bulk) and
**JSON upload** (single & batch replay). Built to run unattended in one Docker container on a VM.

<sub>Branded under **Andante Labs** — <https://andantelabs.com></sub>

---

## What it does

| Capability | How |
|---|---|
| Publish → **queue** | guaranteed (persistent, broker-acked) or direct |
| Publish → **topic** | persistent or direct |
| Subscribe → **queue** | guaranteed flow, optional auto-ACK (consume) |
| Subscribe → **topic** | **direct** live tap (`session.subscribe`) *or* **guaranteed** (queue-backed + `addSubscription`) |
| Incoming messages | live SSE feed, bounded buffer, filter, expand, copy |
| Download | a single message (`.json`) or the whole buffer (`.ndjson` / `.json`) |
| Upload to send | a JSON file into the body, or a **JSON array / NDJSON** for batch replay |

Many subscriptions run concurrently on one session; every message is tagged with its source.

## Architecture

```
src/
  app/
    page.tsx                 operator console (client)
    layout.tsx, globals.css  Andante brand tokens + self-hosted fonts
    api/                     route handlers (runtime = nodejs, force-dynamic)
      connection/            POST connect · DELETE disconnect · GET status
      subscriptions/ [id]/   GET list · POST add (queue|topic+mode) · DELETE remove
      publish/               POST single or batch publish
      messages/ export/ [id]/  GET list (after-cursor) · DELETE clear · bulk & single download
      events/                GET SSE stream (status | message | error)
      health/ ready/ metrics/
  server/                    server-only Solace domain logic (TypeScript)
    manager.ts               globalThis singleton: session + subscriptions + publisher + buffer + bus
    solace.ts solace init + resilient session props
    publisher.ts subscriptions.ts buffer.ts bus.ts config.ts logger.ts types.ts
  components/                React UI (shadcn-style, Andante-themed) + ui/ primitives
  hooks/use-sse.ts  lib/ (api, format, utils)
public/assets/             logo + self-hosted Hanken Grotesk / Spline Sans Mono
Dockerfile  docker-compose.yml  .env.example
```

### Key architectural constraint
`solclientjs` needs **one long-lived Node process** holding the session — it is **not**
serverless/edge compatible. So: all Solace routes run on the Node runtime (`runtime = 'nodejs'`,
`dynamic = 'force-dynamic'`), `solclientjs` is kept out of the bundler via `serverExternalPackages`,
the manager is a `globalThis` singleton, and deployment is **standalone `next start`** in one
container. Do not horizontally fork the server process.

## Quick start (local)

```bash
npm install
npm run dev            # http://localhost:3000
npm test               # vitest (no broker required)
npm run build && npm start   # production build
```

Open the console, enter the broker connection (**credentials are UI-only**), connect, then add
subscriptions and/or publish.

## Configuration

Only **non-secret** operational settings come from the environment (see `.env.example`):
`PORT`, `HOSTNAME`, `LOG_LEVEL`, `LOG_JSON`, `MESSAGE_BUFFER_SIZE`, and the `SOLACE_*` resilience
timers. **Broker credentials are entered in the UI per session** — never written to `.env`, never
stored server-side, and the password is never persisted (the browser remembers the other fields
locally for convenience).

## Deploy on a VM (Docker)

```bash
cp .env.example .env          # optional, non-secret settings
docker compose up -d --build
docker compose logs -f
docker compose ps             # container + health status
```

The image is a Next.js **standalone** build running as the non-root `node` user, with a
`HEALTHCHECK` against `/api/health` and `tini`/`init` so `SIGTERM` shuts it down cleanly. Put it
behind a reverse proxy (nginx/Caddy) for TLS; disable proxy buffering on `/api/events` (SSE).

## Verification

- `npm test` — buffer eviction/cursor, Solace topic-wildcard matching, route validation, and a
  check that **no password appears** in any status/metrics payload.
- `npm run build` — typechecks and produces the standalone bundle.
- Real-broker smoke (manual, via UI): connect → add a queue sub and a topic sub (direct + guaranteed)
  → publish to each → confirm tagged messages in the feed → download one → bulk export → upload a
  JSON array and batch-publish → disconnect.
