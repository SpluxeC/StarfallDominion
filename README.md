# Starfall Dominion — Persistent Multiplayer RTS Alpha

Starfall Dominion is a **continuous-time space RTS**, not a turn-based game. The repository now contains **two playable development tracks**:

| Track | Client | Server | Status |
|---|---|---|---|
| **Persistent multiplayer alpha** | [multiplayer/index.html](multiplayer/index.html) | [multiplayer/server.cjs](multiplayer/server.cjs) | New, server-authoritative four-player galaxy; needs hosting and end-to-end deployment verification |
| **Offline/local RTS prototype v4.2** | [index.html](index.html) | Browser-local only | Single-player development sandbox, unchanged apart from its multiplayer link |

**Expected game URLs after GitHub Pages is configured:**
- [Multiplayer client](https://spluxec.github.io/StarfallDominion/multiplayer/) — requires a separately hosted HTTPS galaxy server
- [Single-player RTS](https://spluxec.github.io/StarfallDominion/) — runs locally in the browser

GitHub Pages hosts HTML but **cannot** run the authoritative Node.js galaxy server. A public multiplayer rollout also requires a running Node host with persistent storage. The above URLs have not been independently verified as deployed.

## Start the multiplayer alpha locally

Install Node.js 22 or newer, clone the repository, then:

```bash
npm start
```

Open `http://localhost:8788/` (or the configured port). Register a commander, then join with another browser profile or device to control a second empire. Both connect to **one server-owned galaxy**, which continues simulating while the server is running.

Read [Multiplayer setup, hosting and limits](multiplayer/README.md) for Docker, environment variables, persistence, HTTPS and inviting friends. A [Render hosting blueprint](render.yaml) and [Docker Compose configuration](compose.yaml) are included. **Managed hosting with persistent storage may incur charges**; do not enable a paid host until you agree to its costs.

## Multiplayer alpha features

- One continuously advancing 20-system shared galaxy, with four independent human-controlled empires
- Server-authoritative resources, science, research, timed construction, fleets and combat
- Live visibility-filtered state streaming; private token-based player identity and reconnect
- Trade proposals, non-aggression pacts, temporary intelligence visibility, pirate faction pressure
- Exile recovery even after losing your colonies
- Atomic file-backed saves and bounded catch-up after server restart
- No End Turn mechanic; players can issue orders independently

**Production caveats:** This is still an early alpha. It needs a publicly hosted server and actual end-to-end browser validation. It does not yet have production account recovery, scalable database persistence, complete anti-cheat measures, moderation or a production deployment. See [multiplayer/README.md](multiplayer/README.md).

## Automated tests

```bash
npm test
```

Includes the original RTS smoke test, the older experimental snapshot-relay test, and authoritative multiplayer integration tests. GitHub Actions also runs the test suite on pushes.

## Earlier prototype and design history

### Original local RTS v4.2 documentation

**Starfall Dominion is designed as a persistent, shared-galaxy space RTS.** Players should be able to manage colonies, dispatch fleets, gather intelligence, and interact with each other without waiting for turns.

This section documents the earlier offline prototype. The newer multiplayer alpha described above introduces a server-owned continuously ticking galaxy, but still needs public hosting and verification.

## Play

Open [the expected GitHub Pages URL](https://spluxec.github.io/StarfallDominion/) once Pages is configured, or open `index.html` locally in a modern browser. No JavaScript build step or package installation is needed for the browser client.

If GitHub Pages returns a 404, the repository owner must open **Settings → Pages** and select **GitHub Actions** as the build/deployment source. The new `.github/workflows/pages.yml` workflow publishes both browser clients after every push to `main`. A source commit or workflow file does not prove the Pages site has deployed; check the workflow run for publishing errors.

## Real-time gameplay — no End Turn button

- The simulation automatically advances while the browser game is open.
- **Production:** Every 20 seconds of simulation produces the amounts shown in **Production / 20 seconds**. Income and research are accrued continuously, not awarded at discrete turn boundaries.
- **Construction:** Building or upgrading queues a job. Structures and ship squadrons finish after their countdown, even while you issue other orders. Each colony supports up to four queued jobs.
- **Fleet travel:** Ships move along hyperlanes, taking approximately **9 simulation seconds per hop**; animated markers show their position. Research unlocks longer routes across your network.
- **Opponents:** The rival AI grows its military and issues expansion or attack orders automatically. The Easy / Normal / Hard setting adjusts pressure.
- **Diplomacy:** Ceasefires last **80 simulation seconds** and prevent hostile arrivals during their term.
- **Testing controls:** **Pause / Resume** stops the local simulation. **Speed ×1 / ×2 / ×4** accelerates the whole simulation to shorten playtests.
- **Trading:** Galactic Exchange quotes adjust approximately every 160 simulation seconds.

This is currently a **local simulation that runs only while the browser page is active**. The clock is not maintained by a remote authoritative server; closing the browser does not simulate a persistent galaxy in the background. All strategic time values are provisional for balancing.

## Playtest controls

1. Select a star system by clicking, tapping, or keyboard activation.
2. Colonize neutral systems adjacent to your colonies.
3. At owned systems, queue mines, reactors, farms, shipyards, strategic extractors, ship squadrons, and colony upgrades.
4. Watch countdowns in the selected system's construction queue.
5. Build fleets and dispatch 25%, 50%, or 100% of available ships toward reachable systems.
6. Research navigation, industry, combat, defense, and logistics technologies.
7. Watch your resources, science, enemy activity, and moving fleet markers advance **without any manual turn action**.
8. Use Pause, Speed, Save, Export Save, and Import Save for testing.

Your initial civilization owns Solace and the AI controls Haven. The map currently includes nine linked systems. Player resources are credits, minerals, alloys, energy, food, titanium, crystals, and gas; science is tracked separately.

## Saves and migration

Saves are stored in the browser under `starfall-dominion-rts-v42`. Older `v4.1` and turn-based `v4.0` and earlier saves are loaded if a newer save is not present. Old turn-based timestamps, travel steps, and ceasefires are converted to real-time fields; queued jobs are stored in the new format. JSON import/export is also supported.

Save migration should be tested before further schema changes. The legacy `turn` property is retained for old-file and experimental room-server compatibility but **does not advance gameplay**.

## Experimental Shared Galaxy Lab (not actual multiplayer)

A prototype Node server in `server/rooms.cjs` supports **manual snapshot sharing**: create/join a room, upload a whole game state, download a whole game state, and reject concurrent writes with stale revision numbers.

To run it locally:

```bash
node server/rooms.cjs
```

The server defaults to port `8787`. Configure `PORT` and `ALLOWED_ORIGINS` through environment variables. For a GitHub Pages client, you must separately deploy it on an HTTPS host and provide that URL in the game's Shared Galaxy Lab.

**This room server is not an RTS multiplayer backend.** It lacks accounts, player-specific empires, durable storage, authoritative action validation, anti-cheat rules, and continuous server simulation. It is an untrusted proof of concept; do not expose it publicly as a production service or put private information in rooms.

The intended real multiplayer architecture will use a server-owned, continuously ticking galaxy with validated player commands, identity and access control, database persistence, reconnection, and synchronized state updates. Client clocks and localStorage must not decide the official outcome of a multiplayer game.

## Tests

Node.js 22 is used in GitHub Actions. No third-party packages are required.

```bash
node tests/smoke.cjs
node --test tests/rooms.test.cjs
```

The browser smoke test exercises ongoing production, pause, queued ship construction, real-time fleet arrivals, AI activity, research, trading, timed ceasefires, colony upgrades, legacy save migration, and interface behavior.

## Version direction

- **v1.x–v2.x:** Initial turn-based prototype and incremental economy/combat work.
- **v3.0:** Galactic Exchange and colony upgrades.
- **v4.0:** Experimental snapshot-sharing room service (not live multiplayer).
- **v4.1–v4.2:** Corrected direction to a continuously advancing **RTS**, with time-based simulation, fleets, AI, ceasefires, and construction queues.

Future work should be developed against the RTS simulation, **not** reintroduce End Turn mechanics. The multiplayer alpha now implements the first server-authoritative galaxy; hosting, production hardening and full end-to-end verification remain.
