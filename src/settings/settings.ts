import { effect, signal } from '@preact/signals'
import { type LookId, lookById } from './looks.ts'
import type { MirrorId, RenderId } from './rendering.ts'

export type Settings = {
  look: LookId
  /** When true, `lightLook` or `darkLook` follows the device's light/dark setting. */
  followDevice: boolean
  lightLook: LookId
  darkLook: LookId
  render: RenderId
  mirror: MirrorId
  stickering: string
  /** Animation speed multiplier for cube moves. */
  speed: number
  /** On-screen notation keypad for the sequence box: auto shows it on touch screens. */
  keypad: 'auto' | 'on' | 'off'
}

export const DEFAULT_SETTINGS: Settings = {
  look: 'chalk',
  followDevice: false,
  lightLook: 'notebook',
  darkLook: 'chalk',
  render: '3d',
  mirror: 'none',
  stickering: 'full',
  speed: 1.6,
  keypad: 'auto',
}

const KEY = 'galois.settings.v1'

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // Storage blocked (private mode): fall back to defaults.
  }
  return { ...DEFAULT_SETTINGS }
}

export const settings = signal<Settings>(load())

export function updateSettings(patch: Partial<Settings>) {
  settings.value = { ...settings.value, ...patch }
}

effect(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings.value))
  } catch {
    // Not persisted; the app still works for this visit.
  }
})

const darkQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null
const deviceDark = signal(darkQuery?.matches ?? false)
darkQuery?.addEventListener('change', (e) => {
  deviceDark.value = e.matches
})

/** The look actually shown right now. */
export function activeLook(): LookId {
  const s = settings.value
  if (!s.followDevice) return s.look
  return deviceDark.value ? s.darkLook : s.lightLook
}

effect(() => {
  const look = lookById(activeLook())
  document.documentElement.dataset.look = look.id
  const theme = document.querySelector('meta[name="theme-color"]')
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  if (theme && bg) theme.setAttribute('content', bg)
})
