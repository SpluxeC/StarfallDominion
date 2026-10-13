# Multiplayer Alpha Implementation Status (October 2026)

The repository now contains the first working **server-authoritative multiplayer alpha** in `multiplayer/`. This is separate from the earlier in-browser single-player RTS and older shared-snapshot relay.

| Principle | Alpha implementation | Remaining work |
|---|---|---|
| No turn button | Server ticks continuously; all player orders are asynchronous | Balance time scales for long-term world |
| Player-specific empires | Four unique, token-authenticated commanders | Account recovery, player slots, alliance support |
| Server authoritative rules | Server validates and resolves colonization, fleets, combat, research, construction, trades and treaties | Broader anti-abuse hardening and combat replay |
| Galaxy persistence | Atomic JSON save and bounded startup catch-up | Transactional DB, backups, replication, migrations |
| Live state updates | Visibility-filtered SSE snapshots and reconnect | Incremental deltas and latency testing |
| Fog / intelligence | Owned and nearby systems visible, hidden distant data and military events | Scouting ships and espionage |
| Pirate rivals | Automatic pirate ship growth and raids | Multiple sophisticated NPC empires |
| Recovery | Exile outposts and cooldown-based flotilla recovery | Political exile mechanics and faction persistence |
| Deployable hosting | Node.js 22 server, Docker, Render blueprint, GitHub Pages client workflow | User-connected paid/public host and deployed HTTPS origin |

**Important:** The public GitHub Pages client cannot advance a persistent universe by itself. The Node server must run on separate always-on hosting with durable disk. Gameplay simulation and basic core rules have passed local code checks; GitHub Actions tests have also passed on the QA pull request. End-to-end public hosting has not been confirmed.

---

# Starfall Dominion: RTS Non-Negotiables

**Status:** Target architecture and gameplay design direction. The current v4.2 browser client is an early local proof of concept; these requirements are not yet fully implemented.

1. **No global turns.** All player actions take place on a shared continuous timeline. Never reintroduce End Turn or make other participants wait for a player.
2. **One persistent galaxy.** The multiplayer world must continue while an individual player is offline. Empire growth, fleet travel, diplomacy deadlines, and combat are time-based; there are no scheduled complete-world resets or a permanent winner.
3. **The server owns time and state.** The future authoritative server validates orders, schedules completion timestamps, resolves combat, and persists state in a database. Client-rendered time and `localStorage` are not authoritative.
4. **Asynchronous orders.** Players can queue construction, research, travel, diplomacy, and logistics while other operations proceed independently. Disconnection must not require pausing the universe.
5. **Fleet simulation.** Fleet transit has real durations on mapped hyperlanes. Intelligence, interception, reinforcement, and combat outcomes must be deterministic on the server, with separate visual replay on clients.
6. **Sovereignty and continuity.** Systems, colonies, treaties, resource ownership, and player identity are separate records. Loss of an empire should lead to exile/recovery gameplay rather than deleting the player identity.
7. **Actual multiplayer means independent actors.** The room snapshot relay currently in this repo is a manual export/import test, **not** live or authoritative multiplayer. The real multiplayer milestone requires authentication, per-player factions, permissions, command validation, event/state synchronization, persistence, anti-cheat measures, reconnection, and production hosting.
8. **Performance and persistence.** Design a server scheduler that processes due events without relying on an always-open web browser, and provide bounded catch-up and reconnect snapshots to clients. Time must remain monotonic across deployment restarts.
9. **Fairness.** The long-term galaxy must not grant competitive power for payments. Diplomacy, espionage, treaties, and reputation operate in real time subject to game rules.

## Current local RTS prototype (v4.2)

- Automatically advancing client simulation.
- Continuous resource and research production.
- Timed ship and building queues.
- Time-based fleet movement with animated markers.
- Autonomous rival AI.
- Duration-based ceasefires.
- Pause / 1× / 2× / 4× **local test controls**, which will not control a real server clock.
- Legacy turn-based saves migrated into elapsed-seconds data; old `turn` is an obsolete compatibility field.

## Next technical milestones

1. Extract the simulation into a pure rules engine runnable in Node.js and the browser, with deterministic timers and tests.
2. Build an **authoritative Node server** owning a durable galaxy state and scheduling commands/events without a browser.
3. Add authenticated player identities and independent empires; lock down commands and scope visibility.
4. Stream state deltas to PC/mobile browser clients (WebSocket or equivalent) with reconnection and catch-up.
5. Build fleet combat, fleets, resources, research, treaties, and diplomacy as server-validated events, then add load, latency, and abuse tests.

**Release terminology:** v4.2 is a playable **local real-time proof of concept**, not a persistent production RTS and not the complete shared galaxy.
