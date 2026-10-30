// Random-state scrambles from cubing.js (the same generator the app uses), for the benchmark.
//
//   node scripts/export-scrambles.mjs [count]
//
// Writes scrambles/random-state.txt. cubing.js draws from crypto randomness and cannot be
// seeded, so a rerun gives a new set; the committed file is the set the results used.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomScrambleForEvent } from 'cubing/scramble'

const count = Number(process.argv[2] ?? 20)
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'scrambles', 'random-state.txt')
const lines = [`# ${count} random-state scrambles from cubing.js randomScrambleForEvent('333')`]
for (let i = 0; i < count; i++) lines.push((await randomScrambleForEvent('333')).toString())
writeFileSync(out, `${lines.join('\n')}\n`)
console.log(`wrote ${count} scrambles to ${out}`)
process.exit(0)
