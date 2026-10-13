# Starfall Dominion — Authoritative Multiplayer RTS (Alpha)

This folder implements a **live server-owned shared galaxy**. It is deliberately separate from the original standalone RTS prototype. Each player controls an independent empire, while a persistent Node process advances the galaxy whether or not anyone is connected.

## Run locally (Node 22+)

From the repository root:

```bash
npm start
```

Open **http://localhost:8788/** in your browser, then use a second browser profile or device to create another empire on the same server.

For a private invite-only server, set `STARFALL_INVITE_CODE`. This setting is mandatory if `NODE_ENV=production`.

The HTTP server uses **port 8788** by default. It serves the multiplayer browser client at `/`, exposes a JSON API under `/api`, and streams live snapshots over authenticated `/api/events` using HTTP server-sent events over a bearer-authenticated streaming fetch.

## Persistent hosting

```bash
cp .env.example .env
# Replace the example invite code with your own long random value
docker compose up -d --build
```

The Compose service binds only to local port 8788. Run an HTTPS reverse proxy on the same host (Caddy, nginx, or equivalent) and point a DNS name at the proxy. The Galaxy server must be publicly reachable by HTTPS if players connect from the GitHub Pages client.

**Persistent storage:** `galaxy-data` is a Docker named volume containing the galaxy and token hashes. Back up the volume regularly. The server writes atomic JSON snapshots after player commands, on a short timer, and when stopped cleanly. File-backed storage is suitable for a four-player **alpha**; it is not a scale-out multi-instance database.

**Server uptime:** The universe ticks while the Node process runs, including when all players are offline. On restart, the server simulates at most **one hour** of downtime; longer outages do not fully catch up. Continuous operation requires hosting and process supervision.

## Join the same galaxy with friends

1. Host the Node server on a machine or platform that remains online with durable storage.
2. Give your friends the same HTTPS server address and the invitation code.
3. Open `https://spluxec.github.io/StarfallDominion/multiplayer/` (after GitHub Pages is enabled), or visit your Node server's root URL.
4. Each friend creates a different commander. The four starting systems are Solace, Kestrel, Pavo, and Kepler.
5. Player identity is stored as a long bearer token in the browser's localStorage. Keep it private; a copy of the token controls that player's empire.
6. Commands, travel, construction, combat, research, trade, treaties, and recovery are checked by the server, not trusted to the browser.

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Public server health/time/player count |
| `/api/join` | POST | Invite-protected commander registration |
| `/api/state` | GET | Authenticated visibility-filtered snapshot |
| `/api/events` | GET | Authenticated real-time snapshot stream |
| `/api/command` | POST | Authenticated, rate-limited, server-validated order |

Authorization header: `Bearer <player-token>`. The raw token is only returned during registration and is not stored in the server file; a SHA-256 hash is stored for matching.

## What's playable

- Up to four human commanders with independent identities, colonies, resources, and research.
- 20 hyperlane-connected systems with reconnaissance visibility.
- Continuous production, timed construction and shipbuilding, fleet movement, combat and conquest.
- Automatic pirate expansion, live map updates, and simple research bonuses.
- Resource trade proposals, non-aggression pacts, reputation penalties for treaty breaking.
- Exile recovery outposts if an empire loses all its territory.
- Atomic file-backed persistence with bounded restart catch-up.

## Alpha limitations

**This is a functional architecture prototype, not a production-grade permanent MMO.** There is no password login, token recovery, admin/moderation system, database replication, horizontal scaling, complete anti-abuse protection, or authoritative combat replay. Token theft grants access. The 20-system galaxy is intentionally small, there is no account deletion or free-slot reclamation, and existing empires cannot be transferred between hosts. Server snapshots are full visibility-filtered states rather than compressed deltas.

The original local single-player RTS remains at the repository root. It is separate and cannot join this multiplayer universe.

## Tests

```bash
npm test
```

CI runs local RTS tests, old snapshot-relay tests, and multiplayer HTTP + gameplay integration tests on Node.js 22.

## Publishing the browser client

A GitHub Actions workflow at `.github/workflows/pages.yml` publishes the static game pages. Once the repository owner selects **Settings → Pages → Source: GitHub Actions**, the expected client address is `https://spluxec.github.io/StarfallDominion/multiplayer/`. The server does not run on GitHub Pages. A public URL alone is not proof of successful deployment.

To use the optional Render blueprint, open `render.yaml` in the repository and connect the Render service. The plan uses a paid persistent disk and therefore requires reviewing and agreeing to its hosting charges before deployment. After the server has a real HTTPS origin, enter it in the browser client's server field. The generated invitation code is in the server's environment settings; keep it private.
