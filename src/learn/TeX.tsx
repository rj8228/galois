import { signal } from '@preact/signals'

type Katex = typeof import('katex').default

// KaTeX is only needed inside "Go deeper", so it loads the first time a formula is drawn,
// keeping it out of the first screen. Until then the formula shows as plain source text.
const katex = signal<Katex | null>(null)
let started = false
function load() {
  if (started) return
  started = true
  Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([m]) => {
    katex.value = m.default
  })
}

/** A formula in TeX notation: inline by default, or on its own line with `block`. */
export function TeX({ children, block = false }: { children: string; block?: boolean }) {
  const k = katex.value
  if (!k) {
    load()
    return <code class="tex-fallback">{children}</code>
  }
  const html = k.renderToString(children, { displayMode: block, throwOnError: false, output: 'htmlAndMathml' })
  // KaTeX output, for formulas written in this repo.
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}
