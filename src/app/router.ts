import { signal } from '@preact/signals'

export type Route = 'home' | 'learn' | 'labs' | 'play' | 'daily' | 'decode' | 'settings' | 'about'

const ROUTES: Route[] = ['home', 'learn', 'labs', 'play', 'daily', 'decode', 'settings', 'about']

/** Hash routes (#/play) so deep links work on GitHub Pages without server rewrites. */
function parse(): Route {
  const name = location.hash.replace(/^#\/?/, '').split('/')[0]
  return ROUTES.includes(name as Route) ? (name as Route) : 'home'
}

export const route = signal<Route>(parse())
/** The part after the section, such as the lesson id in #/learn/order. */
export const routeParam = signal(parseParam())

function parseParam(): string {
  return location.hash.replace(/^#\/?/, '').split('/')[1] ?? ''
}

window.addEventListener('hashchange', () => {
  route.value = parse()
  routeParam.value = parseParam()
})

export const href = (r: Route, param?: string) => `#/${r === 'home' ? '' : r}${param ? `/${param}` : ''}`
