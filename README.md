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

## Mega Slide

Find it in the Build tab next to the fireman pole. Press on the floor where riders should land and drag up to make it
2 to 5 floors tall (a plain click builds 3). People hop in on the floor above the top and come out at the bottom. It
only goes down, about three times faster than stairs, so kids and visitors pick it over the stairs and elevators.
Each slide comes in rainbow, aqua (with a splash) or orange. Tap it to see "Rides today". It costs 60,000 plus
20,000 per floor. Code: `src/game/slide.ts` and `src/render/slide.ts`; `scripts/slidecheck.ts` checks someone rides
one.

## Giant visitors

At most one a day, picked at midnight. A dragon will not show up on a night that already has a night visitor or a UFO.

- **The Big Ape** — about one evening in six, 6pm to 7pm, once the tower is 20 floors tall. He climbs the outside, peeks in the windows, beats his chest on the roof while a little plane pulls a BE NICE banner, waves, and climbs back down. Tap him in Look mode.
- **The Dragon** — about one night in eight, just after midnight, if the tower has a Rocket Pad or a Cathedral. He flies past, lands, and breathes a small flame. The roof lanterns stay lit until dawn.
- **Skywriter** — about one clear afternoon in five. A plane writes the tower's name across the sky. The letters drift off over about 20 minutes.

## Roof toppers

The 🏗️ Build tab has a Roof group, after the elevators. Every topper, including the Rocket Pad, needs open sky. Building a floor over one is refused until you move it (`Move the Observatory first`, and the same for the others).

- **Observatory**: a silver dome. The slit opens at night and the telescope swings. On a clear night, once, `✨ Saw Saturn!`
- **Helipad**: an H in a circle. From 8am to 5pm a helicopter arrives every 3 hours, lands, and six visitors walk inside. You hear the rotor.
- **Wind Turbines**: up to three, side by side. They spin faster in a storm and trim the upkeep of the floor below a little. The room panel says `Making power`.
- **Water Tower**: a wooden tank. Pigeons sit on it until you tap, then they scatter.
- **Giant Donut**: a spinning donut sign. While it stands, every Donut Shop gets three times the customers.
- **Crown, Glass Dome, Radio Antenna**: one spire on the very top of the tower. Placing another swaps it. The antenna's red light blinks, and a beacon sweeps at night. The tower name sign stays off the toppers, and a placed spire takes the place of the cathedral's plain point.

## Sky Zoo

Fun → Wow. Two floors: penguins slide down an ice ramp into a pool, a giraffe pokes its head over the upstairs
railing, and monkeys swing on a tyre. A zookeeper walks between them with a bucket. After dark the penguins huddle
and the monkeys sleep in a pile.

Once a day at 10am, about a third of the time, a monkey escapes (never while Huggy is loose). It sits on a random
room, moves every hour, and leaves a banana peel that disappears the next morning. Tap it in Look mode — `Gotcha! 🍌`
— and the zookeeper carries it home for a small reward. If nobody catches it by 6pm, it swings back by itself.
The room it is sitting on says `🍌` when you poke it.

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
- `scripts/simcheck.ts`, `scripts/simbig.ts`, `scripts/slidecheck.ts`: headless smoke runs (`npm run sim` runs simcheck
  and slidecheck).

Saves are in `localStorage`, written automatically every game day.
