import { useEffect } from 'preact/hooks'
import { updatedTo } from './serviceWorker.ts'

/** "Updated to vX.Y" after the app reloaded itself onto a new version, with a link to what changed. */
export function UpdateToast() {
  const version = updatedTo.value
  useEffect(() => {
    if (!version) return
    const t = setTimeout(() => {
      updatedTo.value = null
    }, 6000)
    return () => clearTimeout(t)
  }, [version])
  if (!version) return null
  return (
    <div class="toast" role="status">
      Updated to <b>{version}</b> ·{' '}
      <a href={`https://github.com/rj8228/galois/releases/tag/${version}`} target="_blank" rel="noopener">
        What's new
      </a>
    </div>
  )
}
