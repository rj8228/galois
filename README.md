# Galois

Learn group theory by turning a Rubik's cube.

**Live:** https://rj8228.github.io/galois/

Galois is a free web app for phone, tablet and laptop. You turn a 3D cube, notice what happens, and then learn the name for it: identity, order, permutations, commutators, invariants, and finally why every position can be solved in 20 moves or fewer. A daily competition, **Solve of the Day**, has two segments: Speed (fastest solve) and Optimal (fewest moves).

## Named for Évariste Galois

Évariste Galois (1811–1832) invented the idea of a *group* while asking which equations can be solved by a formula. He wrote down his ideas the night before a duel and died at 20, the same number as God's number for the cube. This app is a small tribute to him.

## Status

| Phase | Scope | Tag |
| --- | --- | --- |
| 0 | Setup, CI, GitHub Pages, a turnable cube | v0.0.0 |
| 1 | App shell, Playzone, 9 looks, rendering options | v0.1.0 |
| 2 | Analysis engine | v0.2.0 |
| 3 | First lessons (soft launch) | v0.3.0 |
| 4 | Solve of the Day, on the device | v0.4.0 |
| 5 | Lessons 5–8 and the formal layer (the competition backend is deferred) | v0.5.0 |
| 6 | Labs and algorithm breakdowns | v0.6.0 |
| 7 | Full lesson path, formal layer, ebook unlock | v0.7.0 |
| 8 | God's number | v1.0.0 |

## Develop

```sh
npm install
npm run dev        # http://localhost:5173/galois/
npm run lint       # Biome
npm run typecheck
npm test           # unit tests (Vitest)
npm run build && npx playwright install chromium && npm run e2e   # phone, tablet, laptop
```

Every push to `main` deploys to GitHub Pages. Each phase is developed on a `phase-N-<name>` branch, merged by pull request, and tagged `v0.N.0`.

## Credits

- [cubing.js](https://js.cubing.net/cubing/) by Lucas Garron and contributors, for the cube, notation and puzzle maths.
- Fonts: Kalam, IBM Plex Sans and IBM Plex Mono (SIL Open Font License), self-hosted via Fontsource.

## Licence

MIT. See [LICENSE](LICENSE).
