# TODO: Galois to v1.0

The finish line for Galois, gathered from the build plan, the focus plan, the discovery doc and `learnings/`. Galois is one of three focus projects (with Prayog and the DSA gym), so v1.0 is scoped to be finished, not to cover every idea. Anything not needed for v1.0 is in **Parked** at the bottom.

**Now:** v0.4.1 live (Phases 0–4). **Next:** Phase 6.

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
- [ ] Let focus mode and the piece tracker work from any starting state, not only solved

## 2. Phase 6: Labs and Decode (v0.6.0)

- [ ] Labs: challenges checked live by the analysis engine, with hints that unlock one at a time (LB-1)
- [ ] Commutator and conjugate detector (AN-6)
- [ ] Algorithm breakdowns: Sune, T-perm, Niklas, beginner's corner algorithm, on a colour-coded setup/core/undo timeline (DC-1)
- [ ] Exit: every breakdown links to the lesson that explains it

## 2b. Lessons 5–8 and the formal layer (v0.5.0)

Phase 5 (competition backend) is deferred, so v0.5.0 carries these lessons.

- [x] Lesson format stays TypeScript data (decided Oct 8)
- [x] 5 Commutators, 6 Conjugates, 7 Parity, 8 Twists and flips
- [x] Formal layer with KaTeX, loaded only when "Go deeper" opens (LP-4)

## 3. Phase 7: full lesson path (v0.7.0, rescoped)

The licence-code unlock is dropped because everything is free.

- [ ] Lessons 9–12: subgroups, cosets and Lagrange, where 43 quintillion comes from, God's number (LP-3)
- [ ] Beginner's method walkthrough (DC-2, beginner part only)
- [ ] Solve of the Day archive: play any past day, unranked (SD-12)
- [ ] Exit: a non-maths friend finishes lessons 1–3 on a phone without help

## 4. Phase 8: God's number and solver bots (v1.0.0)

Phase 8 and the solver-bot section of the discovery doc are combined here, so one piece of work covers the God's number chapter and the focus-plan bot requirement.

- [ ] Bot interface: cube state in, move list out
- [ ] Layer-by-layer bot (rule-based)
- [ ] Kociemba two-phase bot (wrap the cubing.js solver)
- [ ] IDA* bot with a pattern database, with a search you can watch (the finale, GN-1)
- [ ] God's number chapter: cosets, subgroup chains, Thistlethwaite, Kociemba
- [ ] Bot comparison on a seeded scramble set: move count, time, gap to 20
- [ ] Exit: any scramble solves in the browser, and the search view runs smoothly on a phone

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

- Offline arena round on the shared service with Prayog. It needs Prayog's arena service first; this is the one focus-plan item that depends on another project, so it's v1.1.
- Phase 5 online features: sign-in, leaderboards, verified Speed times, true optimal from a nightly job
- Section 6, algebra in code: Terraform, Git and CRDTs checked against the group axioms (a good v1.1 chapter)
- CFOP walkthrough and CFOP bot
- Neural (DeepCubeA-style) solver bot
- Bluetooth smart cube (PZ-6)
- Ebook, freemium tiers and licence-code unlock (UX-3)
- Colour schemes (cubing.js has no option for them) and idle spin
- Weekly themed challenge; avatars or countries on leaderboards
