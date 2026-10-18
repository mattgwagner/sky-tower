// Friendly names and thoughts for the people in the tower.
import { FACILITIES } from './defs'
import type { Game, Person } from './state'
import { floorLabel } from './state'

const FIRST = ['Ava', 'Ben', 'Cleo', 'Dev', 'Ella', 'Finn', 'Gus', 'Hana', 'Ivy', 'Jack', 'Kai', 'Lila', 'Max', 'Nia', 'Owen', 'Pia', 'Quinn', 'Rosa', 'Sam', 'Tess', 'Uma', 'Vic', 'Wes', 'Xena', 'Yuki', 'Zed', 'Mo', 'Lou', 'June', 'Otto', 'Bea', 'Raj', 'Luz', 'Theo', 'Mila', 'Ezra', 'Nora', 'Leo', 'Ines', 'Hugo']
const LAST = ['Apple', 'Brooks', 'Chen', 'Diaz', 'Evans', 'Fox', 'Garcia', 'Hill', 'Ito', 'Jones', 'Kim', 'Lopez', 'Moss', 'Nguyen', 'Ortiz', 'Park', 'Reed', 'Singh', 'Tran', 'Vega', 'Wolfe', 'Young']

export function personName(p: Person) {
  if (p.kind === 'vip') return 'Sir Reginald Fancypants'
  return `${FIRST[p.id % FIRST.length]} ${LAST[(p.id * 7) % LAST.length]}`
}

export function personRole(g: Game, p: Person) {
  const home = g.facilities.get(p.home)
  const where = home ? ` · ${floorLabel(home.floor)}` : ''
  switch (p.kind) {
    case 'worker': return `Office worker${where}`
    case 'resident': return `Lives in the condo${where}`
    case 'guest': return `Hotel guest${where}`
    case 'vip': return `Very Important Person${where}`
    case 'visitor': return 'Visitor'
    case 'maid': return 'Housekeeper'
    case 'guard': return 'Security guard'
  }
}

export function personDoing(g: Game, p: Person) {
  const dest = g.facilities.get(p.goalFac)
  const destName = dest ? FACILITIES[dest.kind].name.toLowerCase() : ''
  if (p.state === 'waiting') return `Waiting for the elevator (${Math.round(p.wait / 10)} min)`
  if (p.state === 'riding') return 'Riding the elevator'
  if (p.state === 'climbing') return 'Taking the stairs'
  if (p.state === 'inside') {
    const at = g.facilities.get(p.at)
    return at ? `Inside the ${FACILITIES[at.kind].name.toLowerCase()}` : 'Hanging out'
  }
  if (p.state === 'off') return 'Out of the building'
  switch (p.purpose) {
    case 'work': return 'Heading to work'
    case 'home': return p.kind === 'guest' || p.kind === 'vip' ? 'Going to their room' : 'Going home'
    case 'exit': return 'Leaving the tower'
    case 'shop': return `Going to the ${destName}`
    case 'clean': return 'Off to clean a hotel room'
    case 'fire': return 'Rushing to put out a fire!'
    case 'search': case 'sweep': return 'Searching for the bomb!'
    case 'post': return 'Heading back to the office'
    default: return 'Walking'
  }
}

const PET_NAMES = ['Biscuit', 'Pickles', 'Waffles', 'Noodle', 'Sprinkles', 'Captain Fluff', 'Meatball', 'Pepper', 'Taco', 'Sir Barksalot', 'Mittens', 'Bean']

/** Some residents and visitors bring a pet along. */
export function hasPet(p: Person): 'dog' | 'cat' | null {
  if ((p.kind !== 'resident' && p.kind !== 'visitor') || p.id % 5 !== 0) return null
  return p.id % 10 === 0 ? 'cat' : 'dog'
}

export function petLine(p: Person) {
  const pet = hasPet(p)
  if (!pet) return ''
  return `${pet === 'dog' ? '🐶' : '🐱'} With their ${pet} ${PET_NAMES[Math.floor(p.id / 5) % PET_NAMES.length]}`
}

const FUN_THOUGHTS: Partial<Record<string, string[]>> = {
  iceCream: ['Sprinkles! EXTRA sprinkles! 🍦', 'Two scoops. No, THREE scoops!', 'Mint chocolate chip, here I come!'],
  arcade: ['I\'m gonna beat the high score! 🕹️', 'I WILL win that plushie from the claw machine.', 'Got my lucky quarters!'],
  pool: ['CANNONBALL!!! 🏊', 'Last one in is a rotten egg!', 'I hope the water\'s warm…'],
  aquarium: ['I hope I see the shark! 🦈', 'Do fish ever get thirsty?', 'Finding all the fish!'],
  hauntedHouse: ['I\'m not scared… 👻', 'Was that a ghost?!', 'I am a little bit scared.'],
  dinoMuseum: ['RAWR! 🦖', 'T-Rex has such tiny arms!', 'Are there real dinosaur bones?!'],
  rocketPad: ['To the moon! 🌕', '3… 2… 1… BLAST OFF!', 'I want to be an astronaut!'],
  cinema: ['Popcorn time! 🍿'],
  fastFood: ['Burger, fries, and a shake! 🍔'],
}

export function personThought(g: Game, p: Person) {
  if (p.kind === 'vip') return p.mood > 30 ? 'Hmph. This service is dreadful.' : 'Rather splendid, I must say.'
  if (p.mood > 70) return 'This elevator is SO slow! 😤'
  if (p.mood > 45) return 'Ugh, I\'ve been waiting forever…'
  if (p.mood > 25) return 'Come on, come on…'
  const dest = g.facilities.get(p.goalFac) ?? g.facilities.get(p.at)
  const fun = dest && FUN_THOUGHTS[dest.kind]
  if (fun) return fun[p.id % fun.length]
  if (p.purpose === 'shop') return 'Yum, can\'t wait! 😋'
  if (p.purpose === 'exit') return 'What a day!'
  if (p.purpose === 'work') return 'Another day, another dollar.'
  if (p.purpose === 'fire') return 'Stand back, everyone!'
  return 'I love this tower! 😊'
}
