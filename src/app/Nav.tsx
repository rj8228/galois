import { href, route } from './router.ts'
import { SECTIONS } from './sections.ts'

const ITEMS = [{ id: 'home', label: 'Home', icon: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z' } as const, ...SECTIONS]

export function Nav() {
  return (
    <nav class="tabs" aria-label="Sections">
      {ITEMS.map((item) => (
        <a key={item.id} href={href(item.id)} aria-current={route.value === item.id ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={item.icon} />
          </svg>
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  )
}
