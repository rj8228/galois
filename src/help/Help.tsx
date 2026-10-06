import type { ComponentChildren } from 'preact'
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { settings } from '../settings/settings.ts'
import { HELP, type HelpTopic } from './topics.ts'

type Props = {
  topic: HelpTopic
  /** The heading or label the ? button sits next to. */
  children: ComponentChildren
  level?: 'h2' | 'h3'
  /** "overlay" floats the note over its container (used on the cube stage). */
  placement?: 'below' | 'overlay'
  /** Name for screen readers when the heading isn't plain text. */
  label?: string
}

/** A heading with a ? button that opens a short how-to note. Tap again, press Escape or click away to close. */
export function HelpHeading({ topic, children, level = 'h3', placement = 'below', label }: Props) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const Heading = level

  // Layout effect: the close handlers are live as soon as the note is on screen.
  useLayoutEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  const showButton = settings.value.showHelp
  return (
    <div class={`help-head help-${placement}`} ref={root}>
      <div class="help-row">
        {children && <Heading>{children}</Heading>}
        {showButton && (
          <button
            type="button"
            class="help-btn"
            aria-expanded={open}
            aria-controls={id}
            aria-label={`How to use: ${label ?? (typeof children === 'string' ? children : topic)}`}
            onClick={() => setOpen(!open)}
          >
            ?
          </button>
        )}
      </div>
      {showButton && open && (
        <div id={id} class="help-note" role="note">
          {HELP[topic]}
        </div>
      )}
    </div>
  )
}
