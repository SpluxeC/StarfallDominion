# Starfall Dominion — Expansion milestone release (v6.9.0)

This release bundles the originally proposed v6.7–v6.9 milestones on top of the existing v6.6 combat and later interface changes. It retains the current local-save key.

## Navigation fix
- The Commander Objective panel was removed from every command deck. Its advanced-command checkbox now lives in Settings.
- Pause/Resume is a persistent navigation button, placed between Empire and Research in a centered two-width grid slot, with status-dependent styling.
- Existing command decks and keyboard shortcuts remain.

## Original v6.7 milestone: Planetary economy
- Environment traits affect mineral, energy, food, and research output.
- Prosperity is stored per colony (0–100). Farms and reactors support gradual growth; trading infrastructure provides a further boost. Low prosperity reduces credit production.
- Existing colony specializations and scalable building costs remain.
- New economy tech grants deeper mining, fusion output, commerce, research and food bonuses.
- Empire production summaries and colony details show contextual information.

## Original v6.8 milestone: AI empires
- One rival AI faction is presently supported by the map/save model; it receives a randomized **persistent** strategic personality: Expansionist, Militarist, Industrialist or Sentinel.
- AI expands shipyards, develops ships and capital classes, builds defenses and chooses adjacent targets by relative strength and personality.
- New diplomacy options: improve relations, negotiate 240-second truce when relations are nonnegative, or provoke. Relations >=20 with a neutral policy deter attacks.
- Existing ceasefire and difficulty settings remain.
- Multiple **independent AI factions** are not yet supported; that requires a separate owner/state migration.

## Original v6.9 milestone: Technology and progression
- Nine new technologies in Economy, Science, and Military branches, added to the five existing starter technologies.
- Research dependencies enforced by the action handler and reflected in a tappable technology-card tree.
- Benefits include mining, fusion, research, trade, military damage/armor, shipyard caps, fleet cargo, travel speed and farming.
- Existing research unlocks and tech IDs remain compatible.

## Test coverage and release limitations
- JavaScript syntax checks on the existing page scripts and the three gameplay modules.
- Manual harness checks on economy multipliers, AI development, targeting, ceasefire expiry, randomized personalities, research dependencies, shipyard capacity, transport cargo and combat.
- **Live GitHub Pages deployment not independently confirmed** from the available environment. A GitHub commit does not guarantee Pages has published it; compare the public header with 'EXPANSION v6.9.0'.
- A full mobile-browser end-to-end regression pass is still recommended, especially on long-running saved games.
