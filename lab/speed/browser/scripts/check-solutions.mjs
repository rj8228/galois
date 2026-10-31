// Replays every browser solution with cubing.js (as lab/3x3/scripts/check-solutions.mjs does):
// scramble + solution must give the solved cube, with as many moves as the reported length.
//   node scripts/check-solutions.mjs        (reads results/runs/*.json, writes results/cubing-check.json)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cube3x3x3 } from 'cubing/puzzles'

const results = join(dirname(fileURLToPath(import.meta.url)), '..', 'results')
const kpuzzle = await cube3x3x3.kpuzzle()
const solved = kpuzzle.defaultPattern()
const report = { files: {}, solutions: 0, failures: [] }
for (const file of readdirSync(join(results, 'runs')).filter((f) => f.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(join(results, 'runs', file), 'utf8'))
  let checked = 0
  for (const s of data.solves ?? []) {
    if (s.dnf) continue
    const ok = solved.applyAlg(s.scramble).applyAlg(s.solution).isIdentical(solved)
    const moves = s.solution.trim() === '' ? 0 : s.solution.trim().split(/\s+/).length
    checked++
    if (!ok || moves !== s.length || !s.verified) report.failures.push({ file, scramble: s.scramble, solution: s.solution })
  }
  report.files[file] = checked
  report.solutions += checked
}
writeFileSync(join(results, 'cubing-check.json'), `${JSON.stringify(report, null, 1)}\n`)
console.log(`${report.solutions} solutions checked with cubing.js, ${report.failures.length} failures`)
process.exit(report.failures.length ? 1 : 0)
