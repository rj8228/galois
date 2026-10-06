import { render } from 'preact'
import './styles/fonts.ts'
import './styles/looks.css'
import './styles/app.css'
import './settings/settings.ts'
import { App } from './app/App.tsx'

const root = document.getElementById('app')
if (root) render(<App />, root)
