# Sky Tower

A SimTower-inspired skyscraper sim for the browser. Build lobbies, offices, condos, hotels, shops and
theaters; run elevators; keep tenants happy; climb from 1★ to the TOWER rating.

## Run it

```sh
npm install
npm run dev        # http://localhost:5320
```

Production build: `npm run build && npm run preview`. The build in `dist/` is a static site that can be hosted anywhere.

## Modes

- **Family**: 25% more income, lower star goals (150 / 500 / 1,500 / 3,000 / 5,000 people).
- **Classic**: SimTower-style goals (300 / 1,000 / 5,000 / 10,000 / 15,000).
- **Sandbox**: unlimited money, everything unlocked.

Optional starter tower and disasters (fires, bomb threats) are chosen on the title screen.

## Fun Zone

The 🎪 Fun Zone tab holds the whimsical stuff: Ice Cream Shop, Sky Park (makes rooms on its floor happier),
Arcade, Swimming Pool, Aquarium (with a shark), Haunted House (opens at 5pm), Dino Museum (the T-Rex roars at
noon and 4pm) and the Rocket Pad. The pad needs open sky above it and an elevator up to its floor. It launches
every day at noon and lands again around 2:30pm. Some nights a UFO visits the roof. Name your tower on the title
screen or in the ☰ menu; the name shows on a rooftop sign and on the blimp.

## Code map

- `src/game/`: pure TypeScript simulation, no DOM.
  - `defs.ts`: facility catalog, costs, star rules, tuning.
  - `world.ts`: placement, demolish, grid.
  - `routing.ts`: Dijkstra over elevators, stairs and escalators.
  - `elevators.ts`: per-car SCAN logic.
  - `sim.ts`: people, schedules, hotel, commerce, rating, events.
- `src/render/`: Canvas 2D renderer with procedural pixel-art sprites.
- `src/ui/`: React HUD and input controller.
- `scripts/simcheck.ts`, `scripts/simbig.ts`: headless smoke runs (`npx tsx scripts/simcheck.ts 3`).

Saves are in `localStorage`, written automatically every game day.
