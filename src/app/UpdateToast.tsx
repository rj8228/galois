import { registerSW } from 'virtual:pwa-register'
import { signal } from '@preact/signals'

const needRefresh = signal(false)

// Registers the offline service worker. When a newer version of the app has been downloaded,
// it waits until the person chooses to reload, so a lesson or solve is never cut off.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    needRefresh.value = true
  },
})

export function UpdateToast() {
  if (!needRefresh.value) return null
  return (
    <div class="toast" role="status">
      <span>A new version of Galois is ready.</span>
      <button type="button" class="btn small primary" onClick={() => updateSW(true)}>
        Reload
      </button>
      <button type="button" class="btn small" onClick={() => (needRefresh.value = false)}>
        Later
      </button>
    </div>
  )
}
