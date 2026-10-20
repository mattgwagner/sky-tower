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

## What you can build

The palette on the left has seven tabs. Each tab shows a one-line blurb and groups its things under small headings.

- 🏗️ **Build**: lobbies and floors, then elevators, stairs, escalators, express and service elevators.
- 🏢 **Work & Live**: offices (rent every quarter) and condos (sold to a family).
- 🛎️ **Hotel**: single, twin and suite rooms, plus housekeeping.
- 🍕 **Food**: breakfast and treats (Donut Shop, Pancake House, Ice Cream Shop, Candy Shop) and lunch and dinner (Fast
  Food, Taco Stand, Pizza Place, Restaurant, Sushi Bar). Workers grab lunch and mid-morning snacks, families eat
  breakfast and dinner, and hotel guests eat breakfast before checkout.
- 🛍️ **Shops**: Shop, Bookstore, Library (quiet, so it doesn't bother neighbors), Cinema and Party Hall.
- 🎪 **Fun**: chill out (Sky Park, Arcade, Swimming Pool, Aquarium), get moving (Trampoline Park, Climbing Wall,
  Mini Golf, Bowling Alley, Roller Rink) and wow (Haunted House, Dino Museum, Rocket Pad).
- 🏥 **Services**: Security, Medical Center, Recycling, Parking, Metro Station and the Cathedral at the very top.

## Poke things

In 👆 Look mode, tap any room and it reacts: the T-Rex roars, the ghosts say boo, the shark splashes, the cathedral
bell rings, the parking garage honks. Every room has a few lines and a sound, and it wobbles when poked.

## Postcards

The 📸 button (also in the ☰ menu) renders the whole tower onto a postcard with the tower's name, stars and
population. Save picture downloads a PNG, or opens the share sheet on an iPad or phone.

## Sky

Some days it rains from 10am to 6pm; a third of those are storms with lightning and thunder, and every rainy day ends
with a rainbow. On winter days it snows. At night, shooting stars streak across the sky now and then.

## Spooky stuff

Fan homages with original pixel art, scary-silly rather than gory:

- **Playtime Co. Toy Factory** (Fun → Spooky): conveyor toys, GrabPack hands, Huggy Wuggy in a display case. Most
  nights he escapes and hides in a ceiling vent somewhere in the tower; tap him in Look mode to catch him for a reward.
  He moves every two hours and sneaks back at 6am if nobody finds him.
- **Indigo Park**: a little indoor park with a railway and Rambley on the big screen. After dark the screen goes to
  static and Rambley glitches.
- **Night visitors** (at most one a night, about two nights in three): with 2+ hotel rooms, the lights on a hotel
  floor flicker and Rush tears down the hall while everyone hides; otherwise Seek's eyes open on a floor's walls before
  it runs across. Hotel rooms carry gold four-digit door plates, and the Library has a blind Figure after 9pm.

## Holidays

The tower keeps a calendar. A badge in the top bar shows today's holiday, and the news feed announces it that morning.

- **Spooky Week** (all of quarter 3): jack-o-lanterns in the lobbies, cobwebs on the shops, bats at dusk and a
  purple-orange sunset. From 6 to 9pm trick-or-treaters (a ghost, a dino, an astronaut) ride the elevators and knock
  on condo doors, about one per 40 people and never more than 12; they're all home by 10pm. The Candy Shop and the
  Haunted House get twice the customers.
- **Snow Day** (the first snowy day of winter): a snowman grows in every Sky Park, kids have a snowball fight outside
  the lobby, icicles hang from the roof line, and everyone wears a hat and scarf.
- **Heart Day** (quarter 1, day 2): hearts float out of condos and booked hotel rooms, the Restaurant lights a candle,
  and the blimp's banner gets hearts.
- **Tower Birthday** (every 12 days after the tower was founded): bunting and a birthday banner on the roof, confetti
  all day, a free party in the Party Hall (it opens even on a weekday), cake at noon and fireworks at 8pm. A tower
  saved before this change counts its birthday from the day it is next played.
- **New Year**: a countdown in the top bar for the last ten minutes of the year, then fireworks and a
  `HAPPY NEW YEAR!` splash.

`scripts/holidaycheck.ts` walks a test tower through a year and prints trick-or-treater, party and shop counts.

## Metro trains

A Metro Station gets a train every 30 game minutes from 5am to midnight: it pulls out of the tunnel, opens its doors
for 8 minutes, and leaves. About four in ten people leave the tower by train when there is a station; they wait on
the platform and board when the doors open, and each train drops off a crowd of visitors.

## Saved towers

Each tower saves under its own name. The title screen lists them (most recent first) with play and delete buttons.
A save from before this change is moved into the list automatically the first time the title screen loads.

## Fun Zone extras

The Sky Park makes rooms on its floor happier. The Haunted House opens at 5pm. The T-Rex roars at noon and 4pm. The
Rocket Pad needs open sky above it and an elevator up to its floor; it launches every day at noon and lands again
around 2:30pm. Some nights a UFO visits the roof. Name your tower on the title screen or in the ☰ menu; the name
shows on a rooftop sign, on the blimp and on postcards.

## Code map

- `src/game/`: pure TypeScript simulation, no DOM.
  - `defs.ts`: facility catalog, costs, star rules, tuning.
  - `world.ts`: placement, demolish, grid.
  - `routing.ts`: Dijkstra over elevators, stairs and escalators.
  - `elevators.ts`: per-car SCAN logic.
  - `sim.ts`: people, schedules, hotel, commerce, rating, events.
- `src/render/`: Canvas 2D renderer with procedural pixel-art sprites. `sky-fx.ts` has the weather predicate, rainbow,
  shooting stars and lightning; `poke-fx.ts` the poke wobble.
- `src/game/poke.ts`: what each room says and plays when tapped.
- `src/ui/postcard.ts`: renders the tower to a framed PNG and saves or shares it.
- `src/ui/`: React HUD and input controller.
- `scripts/simcheck.ts`, `scripts/simbig.ts`: headless smoke runs (`npx tsx scripts/simcheck.ts 3`).

Saves are in `localStorage`, written automatically every game day.
