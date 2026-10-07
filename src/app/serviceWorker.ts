import { registerSW } from 'virtual:pwa-register'
import { signal } from '@preact/signals'

export const APP_VERSION = `v${__APP_VERSION__}`
export const BUILD = `${__BUILD_SHA__}, built ${__BUILD_DATE__}`

/** What "Update now" in Settings is doing. */
export const updateStatus = signal<'idle' | 'checking' | 'reloading'>('idle')

// An automatic update reloads the page without asking, so say so afterwards rather than surprise.
// The first visit sets the version silently; a later visit on a different version shows the note.
const VERSION_KEY = 'galois.version'
export const updatedTo = signal<string | null>(null)
try {
  const last = localStorage.getItem(VERSION_KEY)
  if (last && last !== APP_VERSION) updatedTo.value = APP_VERSION
  localStorage.setItem(VERSION_KEY, APP_VERSION)
} catch {
  // Storage blocked (private mode): skip the note.
}

let registration: ServiceWorkerRegistration | undefined

// Registers the offline service worker. In autoUpdate mode a newer version activates as soon as it
// is downloaded and the page reloads onto it. Settings and lesson progress are kept on the device.
registerSW({
  immediate: true,
  onRegisteredSW(_url, r) {
    registration = r
  },
})

// Phones often resume a tab or home-screen app without reloading it, so the browser never looks for
// a new version. Check whenever the app comes back to the foreground, and every hour while open.
const check = () => registration?.update().catch(() => undefined)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') check()
})
setInterval(check, 60 * 60 * 1000)

/**
 * The escape hatch: drop the offline copy entirely and load the latest version from the network.
 * Settings, progress and results are in localStorage, so they are kept.
 */
export async function updateNow() {
  updateStatus.value = 'checking'
  try {
    const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? []
    await Promise.all(registrations.map((r) => r.unregister()))
    const keys = (await caches?.keys()) ?? []
    await Promise.all(keys.map((k) => caches.delete(k)))
  } finally {
    updateStatus.value = 'reloading'
    location.reload()
  }
}
