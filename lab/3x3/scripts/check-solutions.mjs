// Checks every solution in results/ with cubing.js, independently of the C solver's own check:
// the scramble followed by the solution must give the solved cube.
//
//   node scripts/check-solutions.mjs
//
// Writes results/cubing-check.json and exits non-zero if any solution fails.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cube3x3x3 } from 'cubing/puzzles'

const results = join(dirname(fileURLToPath(import.meta.url)), '..', 'results')
const kpuzzle = await cube3x3x3.kpuzzle()
const solved = kpuzzle.defaultPattern()

const report = { files: {}, solutions: 0, failures: [] }
for (const file of readdirSync(results).filter((f) => /^(bench-.*|superflip)\.json$/.test(f))) {
  const data = JSON.parse(readFileSync(join(results, file), 'utf8'))
  const runs = data.floors ?? data.runs
  let checked = 0
  for (const [floor, run] of Object.entries(runs)) {
    for (const s of run.solves ?? []) {
      if (s.dnf) continue
      const ok = solved.applyAlg(s.scramble).applyAlg(s.solution).isIdentical(solved)
      const moves = s.solution.trim() === '' ? 0 : s.solution.trim().split(/\s+/).length
      checked++
      if (!ok || moves !== s.length) report.failures.push({ file, floor, scramble: s.scramble, solution: s.solution })
    }
  }
  report.files[file] = checked
  report.solutions += checked
}
writeFileSync(join(results, 'cubing-check.json'), `${JSON.stringify(report, null, 1)}\n`)
console.log(`${report.solutions} solutions checked with cubing.js, ${report.failures.length} failures`)
process.exit(report.failures.length ? 1 : 0)
