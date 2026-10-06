import type { TwistyPlayer } from 'cubing/twisty'
import { useEffect, useRef } from 'preact/hooks'

type Props = {
  onReady: (player: TwistyPlayer) => void
}

/** Mounts a cubing.js TwistyPlayer with its built-in controls hidden. */
export function Cube({ onReady }: Props) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let player: TwistyPlayer | undefined
    let cancelled = false
    import('cubing/twisty').then(({ TwistyPlayer }) => {
      if (cancelled || !host.current) return
      player = new TwistyPlayer({ puzzle: '3x3x3', background: 'none', controlPanel: 'none', tempoScale: 1.6 })
      host.current.append(player)
      onReady(player)
    })
    return () => {
      cancelled = true
      player?.remove()
    }
  }, [])

  return <div ref={host} style={{ width: '100%', height: '100%' }} />
}
