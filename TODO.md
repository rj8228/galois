# TODO: Galois to v1.0

The finish line for Galois, gathered from the build plan, the focus plan, the discovery doc and `learnings/`. Galois is one of three focus projects (with Prayog and the DSA gym), so v1.0 is scoped to be finished, not to cover every idea. Anything not needed for v1.0 is in **Parked** at the bottom.

**Now:** v0.6.2 live: Phases 0–4 and 6, lessons 1–12, Labs, Decode, the 2×2 Solver and the Paper. **Next (decided Nov 1):** the 3×3 Solver in the app, on the speed lab's web engine, which proves any scramble optimal in a browser. Then the bots, the God's number chapter and the wrap-up. A1 is still open. The rest of Phase 7 is parked.

**Done means** a stranger can use it, and you can defend every design choice for 45 minutes.

## 0. Close the review pause

- [ ] Review v0.4.x Solve of the Day on phone, tablet and laptop
- [x] Give feedback on the 4 draft lessons (Oct 8: they work; plan more)
- [x] Textbook: not needed for now; lessons follow the usual path (decided Oct 8)
- [ ] Analytics: GoatCounter chosen (Oct 8); needs a site code from a goatcounter.com account (NF-9)

## 1. Hardening (small, do first)

- [x] Automated upgrade test: serve build A, let its service worker take control, swap in build B, assert the page reaches B within one reload (from `learnings/`)
- [x] Show "Updated to vX.Y" after an automatic reload (from `learnings/`)
- [x] Add Lighthouse CI to `ci.yml`, with mobile performance and accessibility at 90+ (NF-11)
- [ ] **A1.** Let focus mode and the piece tracker work from any starting state, not only solved

## 2. Phase 6: Labs and Decode (v0.6.0)

- [x] Labs: challenges checked live by the analysis engine, with hints that unlock one at a time (LB-1)
- [x] Commutator and conjugate detector (AN-6)
- [x] Algorithm breakdowns: Sune, T-perm, Niklas, beginner's corner algorithm, on a colour-coded setup/core/undo timeline (DC-1)
- [x] Exit: every breakdown links to the lesson that explains it

## 2b. Lessons 5–8 and the formal layer (v0.5.0)

Phase 5 (competition backend) is deferred, so v0.5.0 carries these lessons.

- [x] Lesson format stays TypeScript data (decided Oct 8)
- [x] 5 Commutators, 6 Conjugates, 7 Parity, 8 Twists and flips
- [x] Formal layer with KaTeX, loaded only when "Go deeper" opens (LP-4)

## 3. Phase 7: full lesson path (v0.7.0, rescoped)

The licence-code unlock is dropped because everything is free.

- [x] Lessons 9–12: subgroups, cosets and Lagrange, where 43 quintillion comes from, God's number (LP-3) (v0.6.1)
- [ ] Exit: a non-maths friend finishes lessons 1–3 on a phone without help

## 4. Phase 8: God's number and solver bots (v1.0.0)

Discuss before building: which bots ship, pattern database size against phone memory and load size, how the search view looks, and whether the comparison feeds the later arena shared with Prayog.

Phase 8 and the solver-bot section of the discovery doc are combined here, so one piece of work covers the God's number chapter and the focus-plan bot requirement.

- [x] 2×2 solver you can watch (Solver section): pick any position, floors from smaller puzzles (weak, medium, strong), IDA* that proves the answer round by round, rings of all 3,674,160 positions, solution played on a 2×2. Unit tests check every floor on every position and the solutions against cubing.js
- [x] Paper section: the framework (ceiling, floor, prover) written up like a research paper on the 2×2, with the lab's results, two short proofs, figures with hover readouts, and a worked example that opens in the Solver. Loads only when opened
- [x] Paper, Figure 7: God's number for the 3×3, closed in from both sides (#19)
- [x] 3×3 engine (`src/solver3`): six coordinate floors, IDA* prover, cubing.js ceiling, a web worker (#15). Proves scrambles up to about 12 moves in under a second; no UI yet
- [x] 3×3 floor lab (`lab/3x3`, #18): a 12 MB phone set and a 77 MB desktop set. A random state is proven in 11.5 min on one thread
- [x] Speed lab, rounds 1–3 (`lab/speed`, #30, #34, #39): a native solver and a browser engine, both verified against `lab/3x3`
  - the ceiling race: a two-phase solver finds the solution while the prover only proves
  - downhill masks: every round 1.46× faster, in 331 MB
  - the combined solver on 4 threads: random states in a mean of 177 s and a median of 72 s; the two `lab/3x3` never finished are proven to need 19
  - the web engine: one shared table copy, a ceiling worker, one stop flag, isolation from a service worker
- [ ] **Next: the 3×3 Solver in the app** (the finale, GN-1), on the web engine:
  - [ ] Bring `lab/speed/webengine` into `src/solver3/`:
    - the wasm core, the shared pool and the ceiling worker, with T7's help rule (help once ceiling ≤ bound + 1)
    - IndexedDB tables, built on first use with progress (about 25 s, once)
    - a fallback to per-worker copies without isolation
  - [ ] Cross-origin isolation from the app's own service worker (vite-plugin-pwa `injectManifest`, COOP and COEP added to every response, as T8 describes); check every cross-origin load
  - [ ] UI: paste, type or generate a scramble, then "Prove optimal"
    - each round shown as it is proven, and the best solution so far
    - the certificate when the two meet, and the solution played on a 3×3
  - [ ] Phones: the phone tables and a time budget; when the proof doesn't finish, show "needs at least N moves; best found M"
  - [ ] Tests:
    - the engine against `lab/3x3`'s lengths and node counts on short scrambles
    - an e2e solve on phone, tablet and laptop
    - Lighthouse at 90+, with the engine loaded only when the Solver opens
- [ ] Bot interface: cube state in, move list out
- [ ] Layer-by-layer bot (rule-based)
- [ ] Kociemba two-phase bot (the race's two-phase solver is already in wasm, or wrap the cubing.js solver)
- [ ] IDA* bot with a pattern database, with a search you can watch (the finale, GN-1): the 3×3 Solver above
- [ ] God's number chapter: cosets, subgroup chains, Thistlethwaite, Kociemba
- [ ] Paper: a speed-lab section (proof against find, the ceiling race, the masks, the shared engine)
- [ ] Bot comparison on a seeded scramble set: move count, time, gap to 20
- [ ] Exit: any scramble solves in the browser, and the search view runs smoothly on a phone

Optional, as cloud tasks if the credit allows:

- [ ] Masks in wasm: 331 MB in shared memory, about 1.5× more speed in the browser
- [ ] A stronger floor: research, and the only route to proofs in seconds
- [ ] Numbers from a real laptop and phone, and from Firefox and Safari

## 5. Wrap-up: definition of done

- [ ] 2-minute demo video
- [ ] README: architecture diagram and at least 5 decision records (start with: static only with no backend, cubing.js bundled from npm, date-seeded daily scramble, offline arena format, everything free)
- [ ] Measured numbers with method and hardware: first-load size, Lighthouse, fps on a mid-range phone, solver time per bot
- [ ] Written design for 1 million users (static site on a CDN, then an arena verifier with idempotent scoring, then more verification workers and cached boards)
- [ ] Interview companion `projects/galois/`: pitch, architecture, decisions, numbers, scale-1m, failures (the stale service worker is the first entry)
- [ ] v1.0 launch post and update the Ideas hub
- [ ] Add Galois to the portfolio home page

## Open questions

- Should Optimal get a 60-minute timed variant, like the official fewest-moves event?
- Custom domain, for example a subdomain of the portfolio's domain?

## Parked (after v1.0, or never)

- Rest of Phase 7: beginner's method walkthrough (DC-2) and Solve of the Day archive (SD-12)
- Offline arena round on the shared service with Prayog. It needs Prayog's arena service first; this is the one focus-plan item that depends on another project, so it's v1.1.
- Phase 5 online features: sign-in, leaderboards, verified Speed times, true optimal from a nightly job
- Section 6, algebra in code: Terraform, Git and CRDTs checked against the group axioms (a good v1.1 chapter)
- CFOP walkthrough and CFOP bot
- Neural (DeepCubeA-style) solver bot
- Bluetooth smart cube (PZ-6)
- Ebook, freemium tiers and licence-code unlock (UX-3)
- Colour schemes (cubing.js has no option for them) and idle spin
- Weekly themed challenge; avatars or countries on leaderboards
