// Registers coi-sw.js and reloads once, when the page is not yet crossOriginIsolated.
// Resolves to {isolated, reloaded, sw}: sw = 'none' (no service worker support), 'registered'.
// ?nocoi in the URL skips it (to test the fallback).
export async function ensureIsolation() {
  const reloaded = sessionStorage.getItem('coi-reloaded') === '1'
  if (self.crossOriginIsolated) {
    sessionStorage.removeItem('coi-reloaded')
    return { isolated: true, reloaded, sw: 'registered' }
  }
  if (location.search.includes('nocoi') || !('serviceWorker' in navigator)) return { isolated: false, reloaded, sw: 'none' }
  const reg = await navigator.serviceWorker.register(new URL('./coi-sw.js', import.meta.url), { scope: './' })
  await navigator.serviceWorker.ready
  if (!reloaded) {
    sessionStorage.setItem('coi-reloaded', '1')
    location.reload()
    await new Promise(() => {}) // the page is going away
  }
  // Reloaded once and still not isolated: give up, use copies per worker.
  return { isolated: false, reloaded, sw: reg.active ? 'registered' : 'pending' }
}
