import { useEffect } from 'preact/hooks'
import { CubeStage } from '../cube/CubeStage.tsx'
import { MovePad } from '../cube/MovePad.tsx'
import { SequenceBar } from '../cube/SequenceBar.tsx'
import { installShortcuts } from '../cube/shortcuts.ts'
import { About } from '../pages/About.tsx'
import { ComingSoon } from '../pages/ComingSoon.tsx'
import { Home } from '../pages/Home.tsx'
import { Learn } from '../pages/Learn.tsx'
import { Play } from '../pages/Play.tsx'
import { SettingsPage } from '../pages/Settings.tsx'
import { Nav } from './Nav.tsx'
import { href, route, routeParam } from './router.ts'

function Panel() {
  switch (route.value) {
    case 'home':
      return <Home />
    case 'play':
      return <Play />
    case 'settings':
      return <SettingsPage />
    case 'about':
      return <About />
    case 'learn':
      return <Learn />
    case 'daily':
      return (
        <ComingSoon
          title="Solve of the Day"
          phase={4}
          text="One scramble for everyone each day at midnight IST. Race it (best of 3) or find the fewest moves, and keep your streak going."
        />
      )
    case 'decode':
      return (
        <ComingSoon
          title="Decode"
          phase={6}
          text="Famous algorithms taken apart: which part sets up, which part does the work, and which lesson explains why it works."
        />
      )
  }
}

export function App() {
  useEffect(() => installShortcuts(), [])
  useEffect(() => {
    document.getElementById('panel')?.scrollTo?.({ top: 0 })
  }, [route.value, routeParam.value])

  return (
    <div class="app" data-route={route.value}>
      <a class="skip" href="#panel">
        Skip to content
      </a>
      <header class="top">
        <a class="wordmark" href={href('home')}>
          Galois
        </a>
        <span class="tagline">Group theory you can turn</span>
        <span class="spacer" />
        <a class="icon-btn" href={href('settings')} aria-current={route.value === 'settings' ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3a1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
          <span class="sr-only">Settings</span>
        </a>
        <a class="icon-btn" href={href('about')} aria-current={route.value === 'about' ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 11v6M12 7.5v.5" />
          </svg>
          <span class="sr-only">About Galois</span>
        </a>
      </header>

      <Nav />

      <main class="body">
        <CubeStage />
        <section class="controls" aria-label="Moves">
          <MovePad />
          <SequenceBar />
        </section>
        <section class="panel" id="panel" tabIndex={-1}>
          <Panel />
        </section>
      </main>
    </div>
  )
}
