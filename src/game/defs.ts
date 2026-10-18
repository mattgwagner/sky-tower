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

export type TransportKind = 'elevator' | 'serviceElevator' | 'expressElevator'

export type ToolId = FacilityKind | TransportKind | 'bulldoze' | 'inspect'

export type Category = 'basics' | 'homes' | 'hotel' | 'shops' | 'services' | 'move'

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
  lobby: { kind: 'lobby', name: 'Lobby', emoji: '🚪', category: 'basics', width: 1, height: 1, cost: 2000, stars: 1, pop: 0, drag: true,
    blurb: 'Everyone enters here. Ground floor first! Sky lobbies go on floors 15, 30, 45…' },
  floor: { kind: 'floor', name: 'Floor', emoji: '⬜', category: 'basics', width: 1, height: 1, cost: FLOOR_COST, stars: 1, pop: 0, drag: true,
    blurb: 'Empty floor space. Facilities add their own floor automatically.' },
  office: { kind: 'office', name: 'Office', emoji: '💼', category: 'homes', width: 9, height: 1, cost: 40000, stars: 1, pop: 6,
    blurb: '6 workers. Pays rent every quarter. Workers need lunch nearby.' },
  condo: { kind: 'condo', name: 'Condo', emoji: '🏠', category: 'homes', width: 16, height: 1, cost: 80000, stars: 1, pop: 3,
    blurb: 'A family of 3 buys it when they move in. Keep it quiet!' },
  fastFood: { kind: 'fastFood', name: 'Fast Food', emoji: '🍔', category: 'shops', width: 16, height: 1, cost: 100000, stars: 1, pop: 4,
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
  restaurant: { kind: 'restaurant', name: 'Restaurant', emoji: '🍝', category: 'shops', width: 24, height: 1, cost: 200000, stars: 3, pop: 8,
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
  stairs: { kind: 'stairs', name: 'Stairs', emoji: '🪜', category: 'move', width: 8, height: 1, cost: 5000, stars: 1, pop: 0,
    blurb: 'Connects this floor to the one above. People only climb a few floors.' },
  escalator: { kind: 'escalator', name: 'Escalator', emoji: '↗️', category: 'move', width: 8, height: 1, cost: 20000, stars: 3, pop: 0,
    blurb: 'Faster than stairs. Shoppers love them.' },
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
  expressElevator: { kind: 'expressElevator', name: 'Express Elevator', emoji: '🚀', width: 6, cost: 400000, carCost: 150000, perFloorCost: 3000, maxSpan: 200, capacity: 42, stepsPerFloor: 3, stars: 3, upkeep: 15000,
    blurb: 'Zooms between lobbies (0, 15, 30…) and basements only.' },
}

export const CATEGORIES: { id: Category; name: string; emoji: string }[] = [
  { id: 'basics', name: 'Basics', emoji: '🏗️' },
  { id: 'move', name: 'Get Around', emoji: '🛗' },
  { id: 'homes', name: 'Work & Live', emoji: '🏢' },
  { id: 'hotel', name: 'Hotel', emoji: '🛎️' },
  { id: 'shops', name: 'Food & Fun', emoji: '🍔' },
  { id: 'services', name: 'Services', emoji: '🏥' },
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
export const SPEND: Partial<Record<FacilityKind, number>> = { fastFood: 400, restaurant: 1200, shop: 800, cinema: 1000, partyHall: 0, metro: 0 }
export const SHOP_CAPACITY: Partial<Record<FacilityKind, number>> = { fastFood: 14, restaurant: 18, shop: 8, cinema: 60, partyHall: 40 }

export function isHotel(k: FacilityKind) {
  return k === 'hotelSingle' || k === 'hotelTwin' || k === 'hotelSuite'
}
export function isCommercial(k: FacilityKind) {
  return k === 'fastFood' || k === 'restaurant' || k === 'shop' || k === 'cinema' || k === 'partyHall'
}
export function isResidential(k: FacilityKind) {
  return k === 'condo' || isHotel(k)
}
export function isConnector(k: FacilityKind) {
  return k === 'stairs' || k === 'escalator'
}
export function isLobbyFloor(f: number) {
  return f === 0 || (f > 0 && f % SKY_LOBBY_EVERY === 0)
}
