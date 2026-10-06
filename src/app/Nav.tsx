import { href, type Route, route } from './router.ts'

const ITEMS: { id: Route; label: string; path: string }[] = [
  { id: 'home', label: 'Home', path: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z' },
  { id: 'learn', label: 'Learn', path: 'M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z' },
  { id: 'play', label: 'Play', path: 'M5 8l7-4 7 4v8l-7 4-7-4zM5 8l7 4 7-4M12 12v8' },
  { id: 'daily', label: 'Daily', path: 'M5 6h14v14H5zM5 10h14M9 3v4M15 3v4M9 14h2v2H9z' },
  { id: 'decode', label: 'Decode', path: 'M10 4a6 6 0 1 0 0 12a6 6 0 1 0 0-12M15 15l5 5' },
]

export function Nav() {
  return (
    <nav class="tabs" aria-label="Sections">
      {ITEMS.map((item) => (
        <a key={item.id} href={href(item.id)} aria-current={route.value === item.id ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={item.path} />
          </svg>
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  )
}
