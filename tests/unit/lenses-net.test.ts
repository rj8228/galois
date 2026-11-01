import { cube3x3x3 } from 'cubing/puzzles'
import { describe, expect, it } from 'vitest'
import { type Face, facelets, movedCount, NET_FACES } from '../../src/lenses/net/facelets'

const kpuzzle = await cube3x3x3.kpuzzle()
const net = (alg: string) => facelets(kpuzzle.defaultPattern().applyAlg(alg))
const face = (f: ReturnType<typeof net>, name: Face) =>
  f
    .filter((x) => x.face === name)
    .map((x) => x.color)
    .join('')

describe('facelet mapping', () => {
  it('shows a solved cube face by face', () => {
    const f = net('')
    for (const name of NET_FACES) expect(face(f, name)).toBe(name.repeat(9))
    expect(movedCount(f)).toBe(0)
  })

  it('R moves exactly 20 stickers, and R four times is solved', () => {
    expect(movedCount(net('R'))).toBe(20)
    expect(movedCount(net('R R R R'))).toBe(0)
    expect(net('R R R R').map((x) => x.color)).toEqual(net('').map((x) => x.color))
  })

  it('turns the right stickers the right way', () => {
    // R brings the front's right column up onto the top.
    expect(face(net('R'), 'U')).toBe('UUFUUFUUF')
    // F brings the left side's right column onto the top's bottom row.
    expect(face(net('F'), 'U')).toBe('UUUUUULLL')
    // U turns the right side's top row onto the front.
    expect(face(net('U'), 'F')).toBe('RRRFFFFFF')
    // D turns the front's bottom row onto the right side.
    expect(face(net('D'), 'R')).toBe('RRRRRRFFF')
    // L brings the back's right column (as seen from behind) down onto the front's left.
    expect(face(net('L'), 'F')).toBe('UFFUFFUFF')
    // B brings the right side's right column up onto the top's top row.
    expect(face(net('B'), 'U')).toBe('RRRUUUUUU')
  })

  it('keeps nine stickers of each colour, and every corner reads as a real corner', () => {
    const f = net("R U2 D' B D' F2 L U' x M")
    for (const name of NET_FACES) expect(f.filter((x) => x.color === name)).toHaveLength(9)
    expect(new Set(f.map((x) => x.home)).size).toBe(54)
  })
})
