// Static definitions: facility catalog, rating rules, tuning constants.

export const TOWER_WIDTH = 240 // tile units across
export const MAX_FLOOR = 100 // top floor index (101 floors above ground incl. lobby)
export const MIN_FLOOR = -10 // deepest basement
export const SKY_LOBBY_EVERY = 15

export const FLOOR_COST = 500 // per tile of bare floor

// Sim clock: one sim step = 0.1 game minutes. 60 steps/s at 1x speed.
export const MINUTES_PER_STEP = 0.1
export const STEPS_PER_SECOND = 60
export const DAY_MINUTES = 1440
export const DAYS_PER_QUARTER = 3 // weekday, weekday, weekend

export type FacilityKind =
  | 'lobby'
  | 'floor'
  | 'office'
  | 'condo'
  | 'hotelSingle'
  | 'hotelTwin'
  | 'hotelSuite'
  | 'housekeeping'
  | 'fastFood'
  | 'restaurant'
  | 'shop'
  | 'cinema'
  | 'partyHall'
  | 'security'
  | 'medical'
  | 'recycling'
  | 'parking'
  | 'metro'
  | 'cathedral'
  | 'stairs'
  | 'escalator'
  | 'firePole'
  | 'megaSlide'
  | 'iceCream'
  | 'arcade'
  | 'aquarium'
  | 'dinoMuseum'
  | 'hauntedHouse'
  | 'pool'
  | 'park'
  | 'rocketPad'
  | 'pizza'
  | 'tacos'
  | 'sushi'
  | 'donuts'
  | 'pancakes'
  | 'candy'
  | 'trampoline'
  | 'climbing'
  | 'miniGolf'
  | 'bowling'
  | 'rollerRink'
  | 'bookstore'
  | 'library'
  | 'fazbear'
  | 'toyFactory'
  | 'indigoPark'
  | 'observatory'
  | 'helipad'
  | 'turbine'
  | 'waterTower'
  | 'giantDonut'
  | 'crown'
  | 'dome'
  | 'antenna'
  | 'zoo'
  | 'rainforest'
  | 'market'
  | 'playground'
  | 'concertHall'
  | 'disco'

export type TransportKind = 'elevator' | 'serviceElevator' | 'expressElevator' | 'partyElevator'

export type ToolId = FacilityKind | TransportKind | 'bulldoze' | 'inspect'

export type Category = 'build' | 'homes' | 'hotel' | 'food' | 'shops' | 'fun' | 'services'

export interface FacilityDef {
  kind: FacilityKind
  name: string
  emoji: string
  category: Category
  width: number
  height: number // floors tall
  cost: number
  stars: number // star level needed to unlock
  pop: number // population counted when occupied
  blurb: string
  underground?: 'only' | 'no'
  drag?: boolean // drag horizontally to paint (lobby, floor)
  /** quarterly upkeep you pay */
  upkeep?: number
}

export const FACILITIES: Record<FacilityKind, FacilityDef> = {
  lobby: { kind: 'lobby', name: 'Lobby', emoji: '🚪', category: 'build', width: 1, height: 1, cost: 2000, stars: 1, pop: 0, drag: true,
    blurb: 'Everyone enters here. Ground floor first! Sky lobbies go on floors 15, 30, 45…' },
  floor: { kind: 'floor', name: 'Floor', emoji: '⬜', category: 'build', width: 1, height: 1, cost: FLOOR_COST, stars: 1, pop: 0, drag: true,
    blurb: 'Empty floor space. Facilities add their own floor automatically.' },
  office: { kind: 'office', name: 'Office', emoji: '💼', category: 'homes', width: 9, height: 1, cost: 40000, stars: 1, pop: 6,
    blurb: '6 workers. Pays rent every quarter. Workers need lunch nearby.' },
  condo: { kind: 'condo', name: 'Condo', emoji: '🏠', category: 'homes', width: 16, height: 1, cost: 80000, stars: 1, pop: 3,
    blurb: 'A family of 3 buys it when they move in. Keep it quiet!' },
  fastFood: { kind: 'fastFood', name: 'Fast Food', emoji: '🍔', category: 'food', width: 16, height: 1, cost: 100000, stars: 1, pop: 4,
    blurb: 'Lunch spot for workers and visitors. Earns money per customer.' },
  hotelSingle: { kind: 'hotelSingle', name: 'Single Room', emoji: '🛏️', category: 'hotel', width: 4, height: 1, cost: 20000, stars: 2, pop: 1,
    blurb: 'One guest per night. Needs housekeeping to clean it.' },
  hotelTwin: { kind: 'hotelTwin', name: 'Twin Room', emoji: '🛌', category: 'hotel', width: 6, height: 1, cost: 50000, stars: 2, pop: 2,
    blurb: 'Two guests per night. Needs housekeeping.' },
  hotelSuite: { kind: 'hotelSuite', name: 'Suite', emoji: '👑', category: 'hotel', width: 10, height: 1, cost: 100000, stars: 2, pop: 3,
    blurb: 'Fancy! VIPs stay here. Needs housekeeping.' },
  housekeeping: { kind: 'housekeeping', name: 'Housekeeping', emoji: '🧹', category: 'hotel', width: 15, height: 1, cost: 50000, stars: 2, pop: 6, upkeep: 5000,
    blurb: '6 housekeepers clean dirty hotel rooms each day.' },
  security: { kind: 'security', name: 'Security', emoji: '👮', category: 'services', width: 16, height: 1, cost: 100000, stars: 2, pop: 6, upkeep: 10000,
    blurb: 'Guards put out fires and search for bombs. Needed for 3★.' },
  restaurant: { kind: 'restaurant', name: 'Restaurant', emoji: '🍝', category: 'food', width: 24, height: 1, cost: 200000, stars: 3, pop: 8,
    blurb: 'Dinner for hotel guests, residents and visitors.' },
  shop: { kind: 'shop', name: 'Shop', emoji: '🛍️', category: 'shops', width: 12, height: 1, cost: 100000, stars: 3, pop: 3,
    blurb: 'Shoppers drop by during the day. Busier on weekends.' },
  cinema: { kind: 'cinema', name: 'Movie Theater', emoji: '🎬', category: 'shops', width: 31, height: 2, cost: 500000, stars: 3, pop: 10,
    blurb: 'Shows at 1pm, 5pm and 8pm. Draws big crowds.' },
  partyHall: { kind: 'partyHall', name: 'Party Hall', emoji: '🎉', category: 'shops', width: 27, height: 2, cost: 100000, stars: 3, pop: 8,
    blurb: 'Parties on weekends. Big payday if guests show up.' },
  medical: { kind: 'medical', name: 'Medical Center', emoji: '🏥', category: 'services', width: 26, height: 1, cost: 500000, stars: 3, pop: 10, upkeep: 20000,
    blurb: 'Keeps tenants healthy. Needed for 4★.' },
  recycling: { kind: 'recycling', name: 'Recycling', emoji: '♻️', category: 'services', width: 25, height: 2, cost: 500000, stars: 3, pop: 6, upkeep: 15000,
    blurb: 'Handles the trash. Needed for 4★.' },
  parking: { kind: 'parking', name: 'Parking', emoji: '🚗', category: 'services', width: 8, height: 1, cost: 3000, stars: 3, pop: 0, underground: 'only',
    blurb: 'Underground parking. Tenants want spots once you hit 3★.' },
  metro: { kind: 'metro', name: 'Metro Station', emoji: '🚇', category: 'services', width: 30, height: 3, cost: 1000000, stars: 4, pop: 30, underground: 'only',
    blurb: 'Brings crowds of visitors. Needed for 5★.' },
  cathedral: { kind: 'cathedral', name: 'Cathedral', emoji: '⛪', category: 'services', width: 40, height: 5, cost: 3000000, stars: 5, pop: 20,
    blurb: 'Build it on the very top (floors 96-100) to earn TOWER rating!' },
  stairs: { kind: 'stairs', name: 'Stairs', emoji: '🪜', category: 'build', width: 8, height: 1, cost: 5000, stars: 1, pop: 0,
    blurb: 'Connects this floor to the one above. People only climb a few floors.' },
  firePole: { kind: 'firePole', name: 'Fireman Pole', emoji: '🚒', category: 'build', width: 3, height: 1, cost: 3000, stars: 1, pop: 0,
    blurb: 'Slide DOWN to the floor below, way faster than stairs! It only goes down. Stack them for a big drop.' },
  megaSlide: { kind: 'megaSlide', name: 'Mega Slide', emoji: '🛝', category: 'build', width: 6, height: 3, cost: 60000, stars: 1, pop: 0, upkeep: 2000,
    blurb: 'A giant twisty slide! Drag up or down to make it 2 to 5 floors tall. People hop in at the top and WHOOSH out the bottom.' },
  escalator: { kind: 'escalator', name: 'Escalator', emoji: '↗️', category: 'build', width: 8, height: 1, cost: 20000, stars: 3, pop: 0,
    blurb: 'Faster than stairs. Shoppers love them.' },
  iceCream: { kind: 'iceCream', name: 'Ice Cream Shop', emoji: '🍦', category: 'food', width: 10, height: 1, cost: 60000, stars: 1, pop: 3,
    blurb: 'Sprinkles! Kids and families line up on sunny afternoons.' },
  park: { kind: 'park', name: 'Sky Park', emoji: '🌳', category: 'fun', width: 12, height: 1, cost: 30000, stars: 1, pop: 0, upkeep: 2000,
    blurb: 'Trees, flowers and butterflies. Makes rooms on the same floor happier.' },
  arcade: { kind: 'arcade', name: 'Arcade', emoji: '🕹️', category: 'fun', width: 16, height: 1, cost: 120000, stars: 1, pop: 6,
    blurb: 'Blinking games and a claw machine. A little noisy!' },
  pool: { kind: 'pool', name: 'Swimming Pool', emoji: '🏊', category: 'fun', width: 24, height: 1, cost: 250000, stars: 2, pop: 6,
    blurb: 'Cannonball! Splashy fun for residents and visitors.' },
  aquarium: { kind: 'aquarium', name: 'Aquarium', emoji: '🐠', category: 'fun', width: 24, height: 2, cost: 400000, stars: 2, pop: 12,
    blurb: 'A giant fish tank with a real shark. Visitors love it.' },
  hauntedHouse: { kind: 'hauntedHouse', name: 'Haunted House', emoji: '👻', category: 'fun', width: 20, height: 2, cost: 300000, stars: 2, pop: 8,
    blurb: 'Spooky ghosts and bats! Opens at 5pm. Busiest after dark.' },
  dinoMuseum: { kind: 'dinoMuseum', name: 'Dino Museum', emoji: '🦖', category: 'fun', width: 32, height: 3, cost: 700000, stars: 2, pop: 15,
    blurb: 'Giant dinosaur skeletons. The T-Rex roars at noon and 4pm!' },
  rocketPad: { kind: 'rocketPad', name: 'Rocket Pad', emoji: '🚀', category: 'fun', width: 14, height: 2, cost: 1500000, stars: 3, pop: 10, underground: 'no',
    blurb: 'Build it on a roof with open sky above. Blasts off every day at noon!' },
  donuts: { kind: 'donuts', name: 'Donut Shop', emoji: '🍩', category: 'food', width: 10, height: 1, cost: 50000, stars: 1, pop: 3,
    blurb: 'Opens bright and early. Workers grab a snack mid-morning.' },
  pancakes: { kind: 'pancakes', name: 'Pancake House', emoji: '🥞', category: 'food', width: 16, height: 1, cost: 90000, stars: 1, pop: 5,
    blurb: 'Breakfast! Families stop in before heading out for the day.' },
  tacos: { kind: 'tacos', name: 'Taco Stand', emoji: '🌮', category: 'food', width: 10, height: 1, cost: 50000, stars: 1, pop: 3,
    blurb: 'Quick, cheap and tasty. A favorite lunch spot.' },
  pizza: { kind: 'pizza', name: 'Pizza Place', emoji: '🍕', category: 'food', width: 14, height: 1, cost: 80000, stars: 1, pop: 5,
    blurb: 'Wood-fired oven and flying dough. Lunch and dinner.' },
  candy: { kind: 'candy', name: 'Candy Shop', emoji: '🍭', category: 'food', width: 10, height: 1, cost: 60000, stars: 1, pop: 3,
    blurb: 'Lollipops and jars of sweets. Busy on weekends.' },
  sushi: { kind: 'sushi', name: 'Sushi Bar', emoji: '🍣', category: 'food', width: 18, height: 1, cost: 150000, stars: 2, pop: 6,
    blurb: 'Plates ride around on a conveyor belt. Fancy lunch and dinner.' },
  trampoline: { kind: 'trampoline', name: 'Trampoline Park', emoji: '🤸', category: 'fun', width: 20, height: 2, cost: 200000, stars: 1, pop: 10,
    blurb: 'Two floors tall so everyone can bounce SUPER high. Plus a foam pit!' },
  climbing: { kind: 'climbing', name: 'Climbing & Zip Line', emoji: '🧗', category: 'fun', width: 12, height: 3, cost: 180000, stars: 1, pop: 6,
    blurb: 'Climb three floors, ring the bell, then ride the zip line all the way down!' },
  miniGolf: { kind: 'miniGolf', name: 'Mini Golf', emoji: '⛳', category: 'fun', width: 20, height: 1, cost: 120000, stars: 1, pop: 6,
    blurb: 'Putt through the spinning windmill for a hole-in-one.' },
  bowling: { kind: 'bowling', name: 'Bowling Alley', emoji: '🎳', category: 'fun', width: 28, height: 1, cost: 250000, stars: 2, pop: 10,
    blurb: 'STRIKE! Busy in the evenings. A little noisy.' },
  rollerRink: { kind: 'rollerRink', name: 'Roller Rink', emoji: '🛼', category: 'fun', width: 24, height: 1, cost: 200000, stars: 2, pop: 10,
    blurb: 'Disco lights and skaters zooming around in circles.' },
  bookstore: { kind: 'bookstore', name: 'Bookstore', emoji: '📚', category: 'shops', width: 14, height: 1, cost: 90000, stars: 1, pop: 4,
    blurb: 'Comics, mysteries and dragon books. There\'s a shop cat!' },
  toyFactory: { kind: 'toyFactory', name: 'Playtime Co. Toy Factory', emoji: '🧸', category: 'fun', width: 30, height: 2, cost: 600000, stars: 2, pop: 14,
    blurb: 'Toys on conveyor belts and Huggy Wuggy in his case. Some nights he escapes… find him and tap him!' },
  indigoPark: { kind: 'indigoPark', name: 'Indigo Park', emoji: '🦝', category: 'fun', width: 34, height: 2, cost: 500000, stars: 2, pop: 16,
    blurb: 'A little theme park with a train ride and Rambley on the big screen. Don\'t visit after dark…' },
  fazbear: { kind: 'fazbear', name: 'Freddy Fazbear\'s Pizza', emoji: '🐻', category: 'food', width: 32, height: 2, cost: 250000, stars: 1, pop: 12,
    blurb: 'Pizza and a singing animatronic band! But after midnight… the animatronics wander. 👀' },
  library: { kind: 'library', name: 'Library', emoji: '📖', category: 'shops', width: 24, height: 2, cost: 150000, stars: 1, pop: 8,
    blurb: 'Two floors of books and a story-time corner. Quiet, so neighbors don\'t mind.' },
  observatory: { kind: 'observatory', name: 'Observatory', emoji: '🔭', category: 'build', width: 8, height: 2, cost: 200000, stars: 2, pop: 0, underground: 'no',
    blurb: 'Silver dome for the roof. At night the telescope swings, and on a clear night you might see Saturn!' },
  helipad: { kind: 'helipad', name: 'Helipad', emoji: '🚁', category: 'build', width: 12, height: 1, cost: 500000, stars: 3, pop: 0, underground: 'no',
    blurb: 'Needs open sky. A helicopter visits every 3 hours from 8am to 5pm and six visitors hop out.' },
  turbine: { kind: 'turbine', name: 'Wind Turbine', emoji: '🌬️', category: 'build', width: 6, height: 2, cost: 45000, stars: 1, pop: 0, underground: 'no',
    blurb: 'Up to three, side by side. They spin faster in a storm and trim the upkeep of the floor below.' },
  waterTower: { kind: 'waterTower', name: 'Water Tower', emoji: '🛢️', category: 'build', width: 6, height: 2, cost: 20000, stars: 1, pop: 0, underground: 'no',
    blurb: 'A wooden tank with pigeons. Tap it and they scatter.' },
  giantDonut: { kind: 'giantDonut', name: 'Giant Donut', emoji: '🍩', category: 'build', width: 10, height: 2, cost: 75000, stars: 1, pop: 0, underground: 'no',
    blurb: 'A huge spinning donut on the roof. Donut Shops get three times the customers while it stands!' },
  crown: { kind: 'crown', name: 'Crown', emoji: '👑', category: 'build', width: 8, height: 2, cost: 25000, stars: 1, pop: 0, underground: 'no',
    blurb: 'A jewelled crown. It has to go on the very top, and only one spire can stand at a time.' },
  dome: { kind: 'dome', name: 'Glass Dome', emoji: '🪴', category: 'build', width: 8, height: 2, cost: 25000, stars: 1, pop: 0, underground: 'no',
    blurb: 'A glass dome with a garden. Placing it swaps whatever spire is already up there.' },
  antenna: { kind: 'antenna', name: 'Radio Antenna', emoji: '📡', category: 'build', width: 4, height: 3, cost: 25000, stars: 1, pop: 0, underground: 'no',
    blurb: 'A red light blinks, and a beacon sweeps the sky at night. Swaps the other spire.' },
  zoo: { kind: 'zoo', name: 'Sky Zoo', emoji: '🦒', category: 'fun', width: 28, height: 2, cost: 600000, stars: 2, pop: 10,
    blurb: 'Penguins slide, a giraffe says hello, and the monkeys swing. One of them escapes sometimes!' },
  rainforest: { kind: 'rainforest', name: 'Rainforest Frogs', emoji: '🐸', category: 'fun', width: 24, height: 2, cost: 350000, stars: 2, pop: 10,
    blurb: 'A misty jungle full of tiny bright frogs. They sing every night at 7pm, and they LOVE rainy days!' },
  market: { kind: 'market', name: 'Food Market', emoji: '🧺', category: 'food', width: 30, height: 1, cost: 150000, stars: 1, pop: 6,
    blurb: 'Four stands under striped awnings. Farmers market in the morning, night market after dark!' },
  playground: { kind: 'playground', name: 'Sky Playground', emoji: '🎠', category: 'fun', width: 20, height: 1, cost: 80000, stars: 1, pop: 4, underground: 'no',
    blurb: 'Swings, a spinning merry-go-round and a seesaw, up in the sky! Build it on a roof.' },
  concertHall: { kind: 'concertHall', name: 'Concert Hall', emoji: '🎤', category: 'shops', width: 36, height: 3, cost: 600000, stars: 2, pop: 14,
    blurb: 'A big stage with a different band every night. Sunday is a 2pm matinee. ENCORE!' },
  disco: { kind: 'disco', name: 'Disco', emoji: '🪩', category: 'fun', width: 28, height: 2, cost: 220000, stars: 2, pop: 10,
    blurb: 'A light-up dance floor. Kids\' disco till 7, then a night club. A little noisy!' },
}

export interface TransportDef {
  kind: TransportKind
  name: string
  emoji: string
  width: number
  cost: number // base cost incl. first car
  carCost: number
  perFloorCost: number
  maxSpan: number
  capacity: number
  stepsPerFloor: number
  stars: number
  upkeep: number
  blurb: string
}

export const TRANSPORTS: Record<TransportKind, TransportDef> = {
  elevator: { kind: 'elevator', name: 'Elevator', emoji: '🛗', width: 4, cost: 200000, carCost: 80000, perFloorCost: 2000, maxSpan: 30, capacity: 21, stepsPerFloor: 9, stars: 1, upkeep: 5000,
    blurb: 'Drag up/down to build. Reaches up to 30 floors. Add cars when it gets busy.' },
  serviceElevator: { kind: 'serviceElevator', name: 'Service Elevator', emoji: '🧺', width: 4, cost: 100000, carCost: 50000, perFloorCost: 1000, maxSpan: 30, capacity: 21, stepsPerFloor: 9, stars: 2, upkeep: 3000,
    blurb: 'Staff only — housekeepers and guards use it so guests don\'t wait.' },
  expressElevator: { kind: 'expressElevator', name: 'Express Elevator', emoji: '⚡', width: 6, cost: 400000, carCost: 150000, perFloorCost: 3000, maxSpan: 200, capacity: 42, stepsPerFloor: 3, stars: 3, upkeep: 15000,
    blurb: 'Zooms between lobbies (0, 15, 30…) and basements only.' },
  partyElevator: { kind: 'partyElevator', name: 'Party Elevator', emoji: '🪩', width: 4, cost: 260000, carCost: 100000, perFloorCost: 2000, maxSpan: 30, capacity: 21, stepsPerFloor: 9, stars: 1, upkeep: 7000,
    blurb: 'An elevator with a DJ inside. Everyone dances on the way up!' },
}

export const CATEGORIES: { id: Category; name: string; emoji: string; blurb: string }[] = [
  { id: 'build', name: 'Build', emoji: '🏗️', blurb: 'Floors, lobbies, stairs and elevators. Every tower starts here.' },
  { id: 'homes', name: 'Work & Live', emoji: '🏢', blurb: 'Offices pay rent. Condos sell to families. Both count as people.' },
  { id: 'hotel', name: 'Hotel', emoji: '🛎️', blurb: 'Guests sleep over and pay each night. Housekeeping keeps rooms clean.' },
  { id: 'food', name: 'Food', emoji: '🍕', blurb: 'Breakfast, lunch, dinner and treats. Workers need lunch nearby.' },
  { id: 'shops', name: 'Shops', emoji: '🛍️', blurb: 'Stores, books, movies and parties. Visitors come to spend.' },
  { id: 'fun', name: 'Fun', emoji: '🎪', blurb: 'Splash, bounce, roar and blast off. Visitors love it.' },
  { id: 'services', name: 'Services', emoji: '🏥', blurb: 'What a big tower needs to earn more stars.' },
]

export type Mode = 'family' | 'classic' | 'sandbox'

export interface StarRule {
  pop: number
  needs: { id: string; label: string }[]
}

/** Requirements to go FROM index star to index+1 (index 1..5). Index 5 → Tower (6). */
export function starRules(mode: Mode): Record<number, StarRule> {
  const p = mode === 'classic' ? [300, 1000, 5000, 10000, 15000] : [150, 500, 1500, 3000, 5000]
  return {
    1: { pop: p[0], needs: [] },
    2: { pop: p[1], needs: [{ id: 'security', label: 'Build a Security office' }] },
    3: {
      pop: p[2],
      needs: [
        { id: 'medical', label: 'Build a Medical Center' },
        { id: 'recycling', label: 'Build a Recycling center' },
        { id: 'hotelSuite', label: 'Have a hotel Suite' },
        { id: 'vip', label: 'Impress a visiting VIP' },
      ],
    },
    4: { pop: p[3], needs: [{ id: 'metro', label: 'Build a Metro Station' }] },
    5: { pop: p[4], needs: [{ id: 'cathedral', label: 'Build a Cathedral at the very top' }] },
  }
}

export type RentLevel = 0 | 1 | 2 | 3 // low, average, high, very high
export const RENT_LABELS = ['Low', 'Average', 'High', 'Very High']
export const RENT_MULT = [0.6, 1, 1.4, 1.9]
export const RENT_HAPPY = [15, 0, -12, -28]

// Income tuning
export const OFFICE_RENT = 10000 // per quarter, at average
export const CONDO_PRICE = 150000 // one-time sale
export const HOTEL_NIGHT: Partial<Record<FacilityKind, number>> = { hotelSingle: 3000, hotelTwin: 4500, hotelSuite: 9000 }
export const SPEND: Partial<Record<FacilityKind, number>> = {
  fastFood: 400, restaurant: 1200, shop: 800, cinema: 1000, partyHall: 0, metro: 0,
  bookstore: 300, library: 60, fazbear: 500, toyFactory: 600, indigoPark: 700,
  trampoline: 400, climbing: 300, miniGolf: 250, bowling: 450, rollerRink: 350,
  pizza: 350, tacos: 250, sushi: 700, donuts: 150, pancakes: 300, candy: 150, market: 350,
  iceCream: 200, arcade: 350, pool: 250, aquarium: 550, hauntedHouse: 450, dinoMuseum: 650, rocketPad: 1000, zoo: 500, rainforest: 500, playground: 100,
  concertHall: 1200,
  disco: 300,
}
export const SHOP_CAPACITY: Partial<Record<FacilityKind, number>> = {
  fastFood: 14, restaurant: 18, shop: 8, cinema: 60, partyHall: 40,
  bookstore: 10, library: 30, fazbear: 30, toyFactory: 30, indigoPark: 40,
  trampoline: 24, climbing: 10, miniGolf: 14, bowling: 20, rollerRink: 20,
  pizza: 12, tacos: 8, sushi: 12, donuts: 8, pancakes: 14, candy: 8, market: 24,
  iceCream: 10, arcade: 16, pool: 20, aquarium: 40, hauntedHouse: 24, dinoMuseum: 50, rocketPad: 40, zoo: 36, rainforest: 30, playground: 20,
  concertHall: 90,
  disco: 40,
}

/** Places to eat, by meal. */
export const LUNCH: FacilityKind[] = ['fastFood', 'restaurant', 'pizza', 'tacos', 'sushi', 'market']
export const DINNER: FacilityKind[] = ['restaurant', 'fastFood', 'pizza', 'sushi', 'tacos', 'fazbear', 'market']
export const BREAKFAST: FacilityKind[] = ['pancakes', 'donuts', 'market']
export const FOOD: FacilityKind[] = [...LUNCH, ...BREAKFAST, 'candy', 'fazbear']

/** Fun Zone places people visit like shops. */
export const ATTRACTIONS: FacilityKind[] = [
  'iceCream', 'arcade', 'pool', 'aquarium', 'hauntedHouse', 'dinoMuseum', 'rocketPad',
  'trampoline', 'climbing', 'miniGolf', 'bowling', 'rollerRink', 'bookstore', 'library', 'toyFactory', 'indigoPark', 'zoo', 'rainforest', 'playground',
  'concertHall',
  'disco',
]

export function isHotel(k: FacilityKind) {
  return k === 'hotelSingle' || k === 'hotelTwin' || k === 'hotelSuite'
}
export function isCommercial(k: FacilityKind) {
  return k === 'fastFood' || k === 'restaurant' || k === 'shop' || k === 'cinema' || k === 'partyHall' || ATTRACTIONS.includes(k) || FOOD.includes(k)
}
export function isResidential(k: FacilityKind) {
  return k === 'condo' || isHotel(k)
}
export function isConnector(k: FacilityKind) {
  return k === 'stairs' || k === 'escalator' || k === 'firePole' || k === 'megaSlide'
}
export function isLobbyFloor(f: number) {
  return f === 0 || (f > 0 && f % SKY_LOBBY_EVERY === 0)
}
