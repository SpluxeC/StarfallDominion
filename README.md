# Starfall Dominion — Real-Time RTS Prototype v4.2

**Starfall Dominion is designed as a persistent, shared-galaxy space RTS.** Players should be able to manage colonies, dispatch fleets, gather intelligence, and interact with each other without waiting for turns.

This repository currently contains an **experimental single-player browser RTS**, a **separate, unhosted shared-snapshot room server**, and automated gameplay tests. It is not yet the fully persistent multiplayer game.

## Play

Open [the expected GitHub Pages URL](https://spluxec.github.io/StarfallDominion/) once Pages is configured, or open `index.html` locally in a modern browser. No JavaScript build step or package installation is needed for the browser client.

If GitHub Pages returns a 404, the repository owner must enable **Settings → Pages → Deploy from a branch → main → /(root)**. A source commit alone cannot confirm that the site is publicly deployed.

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

Future work should be developed against the RTS simulation, **not** reintroduce End Turn mechanics. The main remaining milestone is a genuinely server-authoritative persistent galaxy that friends can occupy together.
