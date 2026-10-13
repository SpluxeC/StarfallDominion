# Starfall Dominion v6.3.1-alpha — stabilization notes

## Stabilized in this pass
- Timed fleet engagements: defender reinforcements now join the active battle.
- Fortress durability is not counted as newly created defender ships.
- Ceasefires pause in-progress battles.
- Invasions check troops, garrisons, and fortresses after the space phase.
- Empire victory waits for in-flight hostile fleets and active engagements.
- Legacy saves initialize `engagements` and `battleReports`, with validation of restored engagements.
- Regression scenarios added to `tests/smoke.cjs` for timed battles, reinforcements, ceasefires, invasions, and save migration.

## Verification
The repository has a GitHub Actions workflow at `.github/workflows/test.yml` that runs `node tests/smoke.cjs`, `node --test tests/rooms.test.cjs`, and `node --test tests/multiplayer.test.cjs` on push. Test execution and browser rendering have **not** been confirmed in this pass; check the Actions tab before labeling the build stable.

## Known limitations
- Multiplayer still uses a separate authoritative engine; the new single-player invasion and battle systems are not yet fully ported.
- Fleet classes and advanced tactical retreat from an already engaged battle are not implemented.
- Three.js planet view requires WebGL and CDN access; the 2D fallback remains available.
- Real-device performance and long-session balance testing are still needed.

## Suggested acceptance checklist
1. Start a fresh game, build troops, and invade a defended AI colony.
2. Reinforce an ongoing defensive battle and confirm ship counts.
3. Verify ceasefires suspend combat and resume correctly.
4. Save/reload during an engagement and verify battle progress is restored.
5. Confirm the Colony tab shows one build/upgrade button per district and a green progress bar directly below it.
6. Run the GitHub Actions workflow and test on desktop and mobile browsers.
