import { registerSW } from 'virtual:pwa-register'

// Registers the offline service worker. In autoUpdate mode a newer version activates as soon as it
// is downloaded and the page reloads onto it. Settings and lesson progress are kept on the device.
registerSW({ immediate: true })
