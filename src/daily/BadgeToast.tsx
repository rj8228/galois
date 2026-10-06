import { useEffect } from 'preact/hooks'
import { BADGES, justEarned } from './badges.ts'

/** A short "badge earned" note that disappears after a few seconds. */
export function BadgeToast() {
  const id = justEarned.value
  useEffect(() => {
    if (!id) return
    const t = setTimeout(() => {
      justEarned.value = null
    }, 4000)
    return () => clearTimeout(t)
  }, [id])
  const badge = BADGES.find((b) => b.id === id)
  if (!badge) return null
  return (
    <div class="toast" role="status">
      Badge earned: <b>{badge.name}</b>
    </div>
  )
}
