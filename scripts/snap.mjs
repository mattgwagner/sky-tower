// Screenshot harness: boots the game in headless Chromium, starts a tower and captures a few views.
// Usage: node scripts/snap.mjs [url] [outDir]   (needs playwright on PLAYWRIGHT_DIR or resolvable as a package)
const url = process.argv[2] ?? 'http://127.0.0.1:5320/'
const out = process.argv[3] ?? 'shots'
const pw = process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR}/index.mjs` : 'playwright'
const { chromium } = await import(pw)
const { mkdirSync } = await import('node:fs')
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })
const pg = await b.newPage({ viewport: { width: 1400, height: 860 } })
pg.on('pageerror', (e) => console.log('PAGEERR', e.message))
await pg.goto(url); await pg.waitForTimeout(700)
await pg.screenshot({ path: `${out}/title.png` })
await pg.click('button.mode:has-text("Sandbox")'); await pg.click('button.big.primary'); await pg.waitForTimeout(500)
const help = await pg.$('.modal button'); if (help) await help.click()
await pg.evaluate(() => { window.skytower.speed = 0 })
for (const cat of ['build', 'homes', 'hotel', 'food', 'shops', 'fun', 'services']) {
  await pg.click(`button.cat.${cat}`); await pg.waitForTimeout(120)
  await pg.screenshot({ path: `${out}/palette-${cat}.png` })
}
for (const [label, h] of [['noon', 12], ['dusk', 18.6], ['night', 23]]) {
  await pg.evaluate((hh) => { const g = window.skytower.g; g.time = Math.floor(g.time / 1440) * 1440 + hh * 60 }, h)
  await pg.waitForTimeout(300); await pg.screenshot({ path: `${out}/${label}.png` })
}
await b.close()
console.log(`wrote screenshots to ${out}/`)
