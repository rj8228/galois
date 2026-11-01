import type { KPattern } from 'cubing/kpuzzle'
import { CORNER_NAMES, EDGE_NAMES } from '../../engine/pieces.ts'

/** The six faces in net order: U on top, L F R B across, D below. */
export const NET_FACES = ['U', 'L', 'F', 'R', 'B', 'D'] as const
export type Face = (typeof NET_FACES)[number]

/** Where a sticker sits on the net: a face, then row and column as you look straight at that face. */
export type Slot = { face: Face; row: number; col: number }

/** Which sticker of which piece a slot belongs to on a solved cube. */
type Source = { orbit: 'CENTERS'; position: number } | { orbit: 'EDGES' | 'CORNERS'; position: number; sticker: number }

/** One sticker on the net after a sequence: its colour (the face it belongs to) and where it started. */
export type Facelet = Slot & { color: Face; home: number }

/**
 * A sticker's 3D position (x right, y up, z towards you) from its place on the net.
 * Rows run top to bottom and columns left to right as you face each side, with U seen from above
 * (B at its top edge) and D from below (F at its top edge).
 */
function coords({ face, row: r, col: c }: Slot): [number, number, number] {
  switch (face) {
    case 'U':
      return [c - 1, 1, r - 1]
    case 'F':
      return [c - 1, 1 - r, 1]
    case 'R':
      return [1, 1 - r, 1 - c]
    case 'B':
      return [1 - c, 1 - r, -1]
    case 'L':
      return [-1, 1 - r, c - 1]
    case 'D':
      return [c - 1, -1, 1 - r]
  }
}

const lettersAt = ([x, y, z]: [number, number, number]) =>
  (x === 1 ? 'R' : x === -1 ? 'L' : '') + (y === 1 ? 'U' : y === -1 ? 'D' : '') + (z === 1 ? 'F' : z === -1 ? 'B' : '')

const sameLetters = (a: string, b: string) => a.length === b.length && [...a].every((l) => b.includes(l))

/** All 54 slots, face by face in net order, each row-major. */
export const SLOTS: Slot[] = NET_FACES.flatMap((face) =>
  Array.from({ length: 9 }, (_, i) => ({ face, row: Math.floor(i / 3), col: i % 3 })),
)

/**
 * Each slot's piece and sticker. cubing.js names pieces by their faces in sticker order
 * (UFR: sticker 0 on U, then F, then R), so a slot's sticker is the index of its face in the name.
 */
const SOURCES: Source[] = SLOTS.map((slot) => {
  const letters = lettersAt(coords(slot))
  if (letters.length === 1) return { orbit: 'CENTERS', position: NET_FACES.indexOf(slot.face) }
  const names: readonly string[] = letters.length === 2 ? EDGE_NAMES : CORNER_NAMES
  const position = names.findIndex((n) => sameLetters(n, letters))
  return {
    orbit: letters.length === 2 ? 'EDGES' : 'CORNERS',
    position,
    sticker: names[position].indexOf(slot.face),
  }
})

/** cubing.js's centre order (U L F R B D) matches NET_FACES, so a centre's index is its face. */
const CENTRE_FACES: readonly Face[] = NET_FACES

/** The slot (0–53) where a given piece's given sticker sits on a solved cube. */
const homeSlot = new Map<string, number>(
  SOURCES.map((s, i) => [s.orbit === 'CENTERS' ? `C${s.position}` : `${s.orbit[0]}${s.position}.${s.sticker}`, i]),
)

/**
 * The 54 stickers of a pattern, laid out on the net. A piece at a position with orientation o shows,
 * in that position's sticker k, its own sticker (k + o) mod n (checked against single face turns in the tests).
 */
export function facelets(pattern: KPattern): Facelet[] {
  const data = pattern.patternData
  return SLOTS.map((slot, i) => {
    const src = SOURCES[i]
    if (src.orbit === 'CENTERS') {
      const piece = data.CENTERS.pieces[src.position]
      return { ...slot, color: CENTRE_FACES[piece], home: homeSlot.get(`C${piece}`) ?? i }
    }
    const n = src.orbit === 'EDGES' ? 2 : 3
    const names: readonly string[] = src.orbit === 'EDGES' ? EDGE_NAMES : CORNER_NAMES
    const piece = data[src.orbit].pieces[src.position]
    const o = data[src.orbit].orientation[src.position]
    const sticker = (src.sticker + o) % n
    return {
      ...slot,
      color: names[piece][sticker] as Face,
      home: homeSlot.get(`${src.orbit[0]}${piece}.${sticker}`) ?? i,
    }
  })
}

/** Stickers that are no longer in their home slot. */
export const movedCount = (f: Facelet[]) => f.filter((x, i) => x.home !== i).length
