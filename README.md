# Starfall Dominion — Browser Prototype v0.3

A **playable, single-player browser vertical slice** of the planned persistent galaxy space strategy game.

## Play locally
Open `index.html` in any modern desktop or mobile browser. No install, server, build process, or dependencies required.

## Controls
- Select a star system by clicking/tapping it.
- At your blue systems, construct mines, reactors, farms, shipyards, or ships (if a shipyard exists).
- Colonize adjacent unclaimed systems using the Colonize button.
- Send half the ships from a selected friendly system to a reachable destination. Fleets travel one hyperlane per turn.
- Click **End Turn** to generate resources, advance fleets, and trigger rival AI actions.
- **Save** stores progress in localStorage; **New Galaxy** resets it.

## Scope and limitations
This is **not** the final game or a networked multiplayer simulation. The galaxy, economic costs, combat and AI are simplified and turn-based for fast testing. The approved long-term design remains real-time, server-authoritative, cross-platform and persistent. Treaty systems, espionage, tactical combat, research and factions are not yet implemented. No real-money features.

## Hosting
For a public static demo, publish the root `index.html` using GitHub Pages (Settings → Pages) or any static hosting service. **Repository is currently private**, so GitHub Pages availability depends on your GitHub plan and repository settings. GitHub source hosting alone does not publish a live website.

## Next milestone
Move simulation rules into independently tested modules, add research and ship types, then prototype a server-authoritative persistent multiplayer backend.

## Prototype v0.3 additions
- Five research technologies, science generation and practical technology bonuses.
- Fleet dispatch percentages (25%, 50%, 100%).
- Multi-hop fleet travel unlocked by Hyperlane Navigation.
- Five in-game objectives guiding a first playtest.
- Automatic Node.js smoke tests on pushes via GitHub Actions (`node tests/smoke.cjs`).

## Interactive playtest checklist
1. Select Vega and colonize it.
2. Select Solace and build another mine.
3. End turns until you can research a technology.
4. Build ships at Solace and dispatch a fleet to a neighboring system.
5. Continue until the rival AI contests territory.
6. Reload the page and confirm progress persists.

Live site, if GitHub Pages has been enabled: https://spluxec.github.io/StarfallDominion/
