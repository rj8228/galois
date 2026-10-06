import type { TwistyPlayer } from 'cubing/twisty'

export type RenderId = '3d' | 'hints' | 'sharp' | 'net' | 'last-layer'
export type MirrorId = 'none' | 'side-by-side' | 'top-right'

type PlayerProps = Pick<TwistyPlayer, 'visualization' | 'hintFacelets'>

export const RENDERINGS: { id: RenderId; name: string; detail: string; props: PlayerProps }[] = [
  { id: '3d', name: '3D', detail: 'Standard 3D cube', props: { visualization: '3D', hintFacelets: 'none' } },
  {
    id: 'hints',
    name: '3D + hidden faces',
    detail: 'Floating copies of the back faces',
    props: { visualization: '3D', hintFacelets: 'floating' },
  },
  {
    id: 'sharp',
    name: 'Sharp 3D',
    detail: 'Crisper stickers, lighter on old phones',
    props: { visualization: 'PG3D', hintFacelets: 'none' },
  },
  { id: 'net', name: 'Flat net', detail: 'The cube unfolded flat', props: { visualization: '2D', hintFacelets: 'none' } },
  {
    id: 'last-layer',
    name: 'Last-layer view',
    detail: 'Top-down view of the top layer',
    props: { visualization: 'experimental-2D-LL', hintFacelets: 'none' },
  },
]

export const MIRRORS: { id: MirrorId; name: string }[] = [
  { id: 'none', name: 'Off' },
  { id: 'side-by-side', name: 'Side by side' },
  { id: 'top-right', name: 'In the corner' },
]

/** cubing.js stickerings: grey out pieces that don't matter for a solving stage. */
export const STICKERINGS: { id: string; name: string }[] = [
  { id: 'full', name: 'All pieces' },
  { id: 'Cross', name: 'Cross' },
  { id: 'F2L', name: 'First two layers' },
  { id: 'OLL', name: 'OLL' },
  { id: 'PLL', name: 'PLL' },
  { id: 'LL', name: 'Last layer' },
  { id: 'centers-only', name: 'Centres only' },
]
