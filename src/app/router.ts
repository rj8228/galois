import { signal } from '@preact/signals'

export type Route = 'home' | 'learn' | 'play' | 'daily' | 'decode' | 'settings' | 'about'

const ROUTES: Route[] = ['home', 'learn', 'play', 'daily', 'decode', 'settings', 'about']

/** Hash routes (#/play) so deep links work on GitHub Pages without server rewrites. */
function parse(): Route {
  const name = location.hash.replace(/^#\/?/, '').split('/')[0]
  return ROUTES.includes(name as Route) ? (name as Route) : 'home'
}

export const route = signal<Route>(parse())

window.addEventListener('hashchange', () => {
  route.value = parse()
})

export const href = (r: Route) => `#/${r === 'home' ? '' : r}`
