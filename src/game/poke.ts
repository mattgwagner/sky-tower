// Tap-to-poke: every room does something silly when you tap it in Look mode.
import type { Sfx } from '../audio'
import type { FacilityKind } from './defs'
import type { Facility, Game } from './state'
import { minuteOfDay } from './state'
import { trainPhase } from './sim'
import { fx } from './world'

interface Poke { says: string[]; color?: string; sfx?: Sfx }

const POKES: Partial<Record<FacilityKind, Poke>> = {
  dinoMuseum: { says: ['ROAAAR! 🦖', 'RAWR!!', 'STOMP STOMP STOMP', 'I\'m a T-Rex, not a chicken!'], color: '#ff922b', sfx: 'roar' },
  hauntedHouse: { says: ['BOO! 👻', 'OoOoOoOo…', 'Who turned off the lights?', '🦇 Eek eek!'], color: '#e5dbff', sfx: 'spooky' },
  aquarium: { says: ['SPLASH! 🦈', 'CHOMP! 🦈', 'Blub blub 🐟', 'The shark says hi 👋'], color: '#74c0fc', sfx: 'splash' },
  pool: { says: ['CANNONBALL! 💦', 'Marco… POLO!', 'No running! 🏊', 'SPLASH!'], color: '#74c0fc', sfx: 'splash' },
  rocketPad: { says: ['Fueling up… ⛽', 'Systems GO! 🚀', 'Astronauts, suit up!', 'T-minus soon! ⏱️'], color: '#ffd43b', sfx: 'ding' },
  arcade: { says: ['HIGH SCORE! 🕹️', 'BLEEP BLOOP', 'Insert coin 🪙', 'LEVEL UP!'], color: '#f783ac', sfx: 'arcade' },
  iceCream: { says: ['Brain freeze! 🍦', 'Extra sprinkles! ✨', 'Two scoops!', 'Lick lick lick'], color: '#ffc9c9', sfx: 'ding' },
  park: { says: ['🐦 Tweet tweet!', '🦋', '🌸 Smell the flowers', '🐿️ A squirrel!'], color: '#8ce99a', sfx: 'twinkle' },
  trampoline: { says: ['BOING! 🤸', 'BOING BOING!', 'Backflip!! 🔄', 'Into the foam pit!'], color: '#ffd43b', sfx: 'boing' },
  climbing: { says: ['DING! 🔔 Made it!', 'ZIIIIIP! 🪂', 'WHEEEEE!', 'Don\'t look down…', 'Almost there! 🧗'], color: '#ffd43b', sfx: 'ding' },
  bowling: { says: ['STRIKE! 🎳', 'Gutter ball… 😅', 'SPARE!', 'Bumpers up!'], color: '#ffd43b', sfx: 'strike' },
  rollerRink: { says: ['Wheee! 🛼', 'Disco time! 🪩', 'Skate backwards!'], color: '#da77f2', sfx: 'arcade' },
  miniGolf: { says: ['HOLE IN ONE! ⛳', 'Through the windmill!', 'Fore! 🏌️'], color: '#8ce99a', sfx: 'pop' },
  pizza: { says: ['Mamma mia! 🍕', 'Extra cheese!', '🍕 Dough in the air!'], color: '#ffa94d', sfx: 'pop' },
  tacos: { says: ['Taco time! 🌮', 'Extra guac! 🥑', '🌮🌮🌮'], color: '#ffa94d', sfx: 'pop' },
  sushi: { says: ['🍣 All aboard the sushi train!', 'Wasabi! 🔥', 'Chopsticks, go!'], color: '#ffa94d', sfx: 'train' },
  donuts: { says: ['Mmm, donuts 🍩', 'Sprinkles!', 'Donut worry!'], color: '#ffa94d', sfx: 'pop' },
  pancakes: { says: ['FLIP! 🥞', 'Syrup waterfall!', 'Stack it higher!'], color: '#ffa94d', sfx: 'pop' },
  candy: { says: ['Sugar rush! 🍭', 'Gummy bears! 🐻', 'Don\'t tell the dentist!'], color: '#f783ac', sfx: 'twinkle' },
  fastFood: { says: ['Order up! 🍔', 'Fries with that?', 'Milkshake! 🥤'], color: '#ffa94d', sfx: 'pop' },
  restaurant: { says: ['Bon appétit! 🍝', 'Table for two?', 'Compliments to the chef! 👨‍🍳'], color: '#ffa94d', sfx: 'ding' },
  shop: { says: ['Cha-ching! 🛍️', 'Big sale today!', 'Can I have it? Please?'], color: '#ffd43b', sfx: 'cash' },
  bookstore: { says: ['Meow 🐈', 'Purrrr…', 'The cat is on the books again'], color: '#ffd43b', sfx: 'meow' },
  library: { says: ['Shhh! 🤫', 'Story time! 📖', '…turn the page…'], color: '#a5d8ff', sfx: 'twinkle' },
  cinema: { says: ['🍿 It\'s starting!', 'Shhh! 🤫', 'Best movie EVER'], color: '#f783ac', sfx: 'party' },
  partyHall: { says: ['PARTY! 🎉', '🎂 Make a wish!', '🎈🎈🎈'], color: '#ff7ad9', sfx: 'party' },
  cathedral: { says: ['DONG! 🔔', 'DING DONG!', '🕊️'], color: '#ffd43b', sfx: 'bell' },
  toyFactory: { says: ['Huggy wants a HUG! 🤗', 'GrabPack: GRAB! ✋', 'It\'s Playtime! 🧸', 'Toys toys toys!'], color: '#74c0fc', sfx: 'boing' },
  indigoPark: { says: ['Welcome to Indigo Park! 🦝', 'All aboard the park railway! 🚂', 'Stay on the path, friend!', 'Let\'s go on an adventure!'], color: '#b197fc', sfx: 'train' },
  fazbear: { says: ['Hurr hurr hurr! 🐻'], color: '#ffd43b', sfx: 'party' },
  metro: { says: ['Choo choo! 🚇', 'All aboard!', 'Mind the gap!'], color: '#a5d8ff', sfx: 'train' },
  parking: { says: ['Beep beep! 🚗', 'HONK!', 'Vroom vroom!'], color: '#ffd43b', sfx: 'honk' },
  lobby: { says: ['Welcome! 👋', 'Hello there!', 'Nice tower!', '👋'], color: '#ffd43b', sfx: 'ding' },
  office: { says: ['Tap tap tap ⌨️', 'Meeting time!', '☕ Coffee break!', 'Is it Friday yet?'], color: '#a5d8ff', sfx: 'click' },
  condo: { says: ['Knock knock! 🚪', 'Who\'s there?', '🐕 Woof!', 'Dinner\'s ready!'], color: '#ffc9c9', sfx: 'woof' },
  hotelSingle: { says: ['Do not disturb 🛏️', 'Zzz…', 'Room service!'], color: '#e5dbff', sfx: 'ding' },
  hotelTwin: { says: ['Do not disturb 🛏️', 'Pillow fight! 🪶', 'Zzz…'], color: '#e5dbff', sfx: 'ding' },
  hotelSuite: { says: ['Fancy! 🎩', 'Ooh la la', 'Chocolate on the pillow 🍫'], color: '#e5dbff', sfx: 'ding' },
  housekeeping: { says: ['Sweep sweep 🧹', 'Fresh towels!', 'Spotless! ✨'], color: '#e5dbff', sfx: 'twinkle' },
  security: { says: ['All clear! 👮', '🚨 On it!', 'Nothing to see here'], color: '#74c0fc', sfx: 'alarm' },
  medical: { says: ['Say ahh 🩺', 'Just a tiny poke', 'All better! 🩹'], color: '#ffc9c9', sfx: 'ding' },
  recycling: { says: ['CRUNCH! ♻️', 'Reduce, reuse, recycle!', 'Clank clank'], color: '#8ce99a', sfx: 'build' },
  firePole: { says: ['WHOOOSH! 🚒', 'Slide time!', 'Wee-oo wee-oo! 🚨', 'Fire drill!'], color: '#ffa94d', sfx: 'boing' },
  megaSlide: { says: ['WHEEE! 🛝', 'Faster! Faster!', 'My tummy! 🤢', 'Again! Again!'], color: '#ff8787', sfx: 'whistle' },
  stairs: { says: ['Step step step', 'Phew! 😮‍💨', 'Race you up!'], color: '#ced4da', sfx: 'click' },
  escalator: { says: ['Weee ⬆️', 'Stand on the right!', 'Hold the rail!'], color: '#ced4da', sfx: 'move' },
  observatory: { says: ['I can see your house from here!'], color: '#d0ebff', sfx: 'twinkle' },
  helipad: { says: ['Chopper inbound!'], color: '#ffd43b', sfx: 'rotor' },
  turbine: { says: ['Whoosh!'], color: '#a5d8ff', sfx: 'rotor' },
  waterTower: { says: ['Flutter flutter!'], color: '#ced4da', sfx: 'pop' },
  giantDonut: { says: ['Mmmmm'], color: '#f783ac', sfx: 'pop' },
  crown: { says: ['So shiny!'], color: '#ffd43b', sfx: 'twinkle' },
  dome: { says: ['A garden in the clouds!'], color: '#8ce99a', sfx: 'twinkle' },
  antenna: { says: ['Beep… beep…'], color: '#ff6b6b', sfx: 'ding' },
}

const lastPoke = new Map<number, number>()

export function isPokable(k: FacilityKind) {
  return k in POKES
}

/** Make the room react. Returns the sound to play, or null if this room has nothing to say. */
export function pokeFacility(g: Game, f: Facility, now: number): Sfx | null {
  const p = POKES[f.kind]
  if (!p) return null
  const last = lastPoke.get(f.id) ?? -1e9
  if (now - last < 350) return null
  lastPoke.set(f.id, now)
  if (f.kind === 'fazbear') {
    const night = minuteOfDay(g.time) < 6 * 60
    const says = night ? ['JUMPSCARE! 😱', 'Hurr hurr hurr…', 'Was that Foxy?! 🦊', 'Check the cameras! 📹', 'Close the door!! 🚪']
      : ['Hurr hurr hurr! 🐻', 'Let\'s eat! 🐔', 'Arr, matey! 🦊', '🎸 Guitar solo!', 'Happy birthday! 🎂', 'Pizza time! 🍕']
    fx(g, f.x + f.width / 2, f.floor + f.height - 1, says[Math.floor(Math.random() * says.length)], night ? '#ff6b6b' : '#ffd43b')
    return night ? 'scare' : 'party'
  }
  const late = minuteOfDay(g.time) >= 20 * 60 || minuteOfDay(g.time) < 6 * 60
  const spooky: Partial<Record<FacilityKind, string[]>> = {
    toyFactory: g.flags.huggy ? ['The case is EMPTY! 😱', 'Where did Huggy go?!', 'Check the vents… 👀'] : [],
    indigoPark: ['…friend? Is that you? 📺', '*static* 📺', 'The park is closed… 🌙'],
    library: ['Shhh… it can HEAR you 🤫', '…tiptoe… tiptoe…'],
  }
  const scary = late ? spooky[f.kind] : undefined
  if (scary?.length) {
    fx(g, f.x + f.width / 2, f.floor + f.height - 1, scary[Math.floor(Math.random() * scary.length)], '#ff8787')
    return 'heartbeat'
  }
  if (f.kind === 'waterTower') g.flags.pigeon = { id: f.id, at: now }
  const train = f.kind === 'metro' ? trainPhase(g) : null
  const says = !train ? p.says
    : train.phase === 'doors' ? ['Doors closing! 🚪', 'All aboard! 🚇', 'Tickets, please! 🎫', 'Mind the gap!']
    : ['TOOT TOOT! 🚆', 'Here comes the train!', 'Clickety-clack!']
  const text = says[Math.floor(Math.random() * says.length)]
  fx(g, f.x + f.width / 2, f.floor + f.height - 1, text, p.color)
  return p.sfx ?? null
}
