import { render } from 'preact'
import '@fontsource/kalam/700.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import './styles/looks.css'
import './styles/app.css'
import { App } from './app.tsx'

const root = document.getElementById('app')
if (root) render(<App />, root)
