import { CO, CP, type Cube, EO, EP } from '../../solver3/cube3.ts'
import { CORNER_LABELS, EDGE_LABELS } from '../labels.ts'

/** Where a piece is: home and straight, home but turned, or in another slot. */
export type PieceState = 'home' | 'turned' | 'away'

export type PieceReport = { name: string; kind: 'corner' | 'edge'; state: PieceState }

export type LayerReport = { name: 'Top' | 'Middle' | 'Bottom'; pieces: PieceReport[]; home: number }

export type Step = { name: 'Cross' | 'Layer 1' | 'Layer 2' | 'Top colour' | 'Top pieces'; done: boolean }

export type Progress = {
  /** Pieces home and straight, out of 20. */
  home: number
  layers: LayerReport[]
  steps: Step[]
  /** The first step not yet done, or null when solved. */
  next: Step['name'] | null
  /** One sentence on what to do next. */
  advice: string
}

// Kociemba's slots: corners 0–3 top, 4–7 bottom; edges 0–3 top, 4–7 bottom, 8–11 middle.
const TOP_CORNERS = [0, 1, 2, 3]
const BOTTOM_CORNERS = [4, 5, 6, 7]
const TOP_EDGES = [0, 1, 2, 3]
const BOTTOM_EDGES = [4, 5, 6, 7]
const MIDDLE_EDGES = [8, 9, 10, 11]

export function cornerState(c: Cube, piece: number): PieceState {
  if (c[CP + piece] !== piece) return 'away'
  return c[CO + piece] === 0 ? 'home' : 'turned'
}

export function edgeState(c: Cube, piece: number): PieceState {
  if (c[EP + piece] !== piece) return 'away'
  return c[EO + piece] === 0 ? 'home' : 'turned'
}

const corner = (c: Cube, p: number): PieceReport => ({
  name: CORNER_LABELS[p],
  kind: 'corner',
  state: cornerState(c, p),
})
const edge = (c: Cube, p: number): PieceReport => ({ name: EDGE_LABELS[p], kind: 'edge', state: edgeState(c, p) })

function layer(name: LayerReport['name'], pieces: PieceReport[]): LayerReport {
  return { name, pieces, home: pieces.filter((p) => p.state === 'home').length }
}

const allHome = (pieces: PieceReport[]) => pieces.every((p) => p.state === 'home')

/** Top slots that hold a top piece with its top colour facing up. */
export function topColourUp(c: Cube): { corners: number; edges: number } {
  let corners = 0
  let edges = 0
  for (const s of TOP_CORNERS) if (c[CP + s] < 4 && c[CO + s] === 0) corners++
  for (const s of TOP_EDGES) if (c[EP + s] < 4 && c[EO + s] === 0) edges++
  return { corners, edges }
}

function count(n: number, one: string, many: string): string {
  if (n === 0) return many.includes(' ') ? `no ${many}` : `none ${many}`
  return `${n === 4 ? 'all four' : n} ${n === 1 ? one : many}`
}

export function progressOf(c: Cube): Progress {
  const top = layer('Top', [...TOP_CORNERS.map((p) => corner(c, p)), ...TOP_EDGES.map((p) => edge(c, p))])
  const middle = layer(
    'Middle',
    MIDDLE_EDGES.map((p) => edge(c, p)),
  )
  const bottom = layer('Bottom', [...BOTTOM_CORNERS.map((p) => corner(c, p)), ...BOTTOM_EDGES.map((p) => edge(c, p))])
  const bottomEdges = bottom.pieces.slice(4)
  const bottomCorners = bottom.pieces.slice(0, 4)
  const up = topColourUp(c)

  const cross = allHome(bottomEdges)
  const layer1 = cross && allHome(bottomCorners)
  const layer2 = layer1 && allHome(middle.pieces)
  const topColour = up.corners === 4 && up.edges === 4
  const topPieces = allHome(top.pieces)
  const steps: Step[] = [
    { name: 'Cross', done: cross },
    { name: 'Layer 1', done: layer1 },
    { name: 'Layer 2', done: layer2 },
    { name: 'Top colour', done: topColour && layer2 },
    { name: 'Top pieces', done: topPieces && layer2 },
  ]
  const next = steps.find((s) => !s.done)?.name ?? null

  const homeIn = (ps: PieceReport[]) => ps.filter((p) => p.state === 'home').length
  let advice: string
  if (next === null) advice = 'Solved: every piece is home and straight.'
  else if (next === 'Cross')
    advice = `Start with the bottom cross: ${count(homeIn(bottomEdges), 'bottom edge is', 'bottom edges are')} home so far.`
  else if (next === 'Layer 1')
    advice = `Cross done. Next, the bottom corners: ${count(homeIn(bottomCorners), 'is', 'are')} home so far.`
  else if (next === 'Layer 2')
    advice = `Layer 1 done. Next, the middle edges: ${count(homeIn(middle.pieces), 'is', 'are')} home so far.`
  else if (next === 'Top colour') {
    const flipped = 4 - up.edges
    const twisted = 4 - up.corners
    const edges = flipped === 0 ? 'Edges are already flat' : `${count(flipped, 'edge is', 'edges are')} flipped`
    const corners = twisted === 0 ? 'no corner is twisted' : `${count(twisted, 'corner is', 'corners are')} twisted`
    advice = `Two layers done. Next, turn the top all one colour. ${edges}; ${corners}.`
  } else {
    const away = top.pieces.filter((p) => p.state !== 'home').length
    advice = `The top is one colour. Last, move the top pieces home: ${away} ${away === 1 ? 'is' : 'are'} in the wrong slot.`
  }
  return { home: top.home + middle.home + bottom.home, layers: [top, middle, bottom], steps, next, advice }
}
