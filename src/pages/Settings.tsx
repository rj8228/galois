import { HelpHeading } from '../help/Help.tsx'
import { LOOKS, type LookId } from '../settings/looks.ts'
import { MIRRORS, RENDERINGS, STICKERINGS } from '../settings/rendering.ts'
import { activeLook, DEFAULT_SETTINGS, settings, updateSettings } from '../settings/settings.ts'

function LookCard({
  id,
  name,
  feel,
  selected,
  onPick,
}: {
  id: LookId
  name: string
  feel: string
  selected: boolean
  onPick: () => void
}) {
  return (
    <button type="button" class="look-card" data-look={id} aria-pressed={selected} onClick={onPick}>
      <span class="look-swatch" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span class="look-name">{name}</span>
      <span class="look-feel">{feel}</span>
    </button>
  )
}

export function SettingsPage() {
  const s = settings.value
  const lights = LOOKS.filter((l) => !l.dark)
  const darks = LOOKS.filter((l) => l.dark)
  return (
    <div class="stack">
      <div class="card">
        <HelpHeading topic="look" level="h2">
          Look
        </HelpHeading>
        <div class="look-grid">
          {LOOKS.map((l) => (
            <LookCard
              key={l.id}
              {...l}
              selected={!s.followDevice && s.look === l.id}
              onPick={() => updateSettings({ look: l.id, followDevice: false })}
            />
          ))}
        </div>
        <label class="check">
          <input
            type="checkbox"
            checked={s.followDevice}
            onChange={(e) => updateSettings({ followDevice: e.currentTarget.checked })}
          />
          Follow my device's light or dark setting
        </label>
        {s.followDevice && (
          <div class="row">
            <label class="field">
              <span>Light look</span>
              <select
                value={s.lightLook}
                onChange={(e) => updateSettings({ lightLook: e.currentTarget.value as LookId })}
              >
                {lights.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label class="field">
              <span>Dark look</span>
              <select
                value={s.darkLook}
                onChange={(e) => updateSettings({ darkLook: e.currentTarget.value as LookId })}
              >
                {darks.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <p class="muted small">Showing {LOOKS.find((l) => l.id === activeLook())?.name} now.</p>
          </div>
        )}
      </div>

      <div class="card">
        <HelpHeading topic="rendering" level="h2">
          Cube
        </HelpHeading>
        <fieldset class="options">
          <legend>Rendering</legend>
          {RENDERINGS.map((r) => (
            <label key={r.id} class="option">
              <input
                type="radio"
                name="render"
                checked={s.render === r.id}
                onChange={() => updateSettings({ render: r.id })}
              />
              <span>
                <b>{r.name}</b>
                <small>{r.detail}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset class="options">
          <legend>Mirror view (see the back of the cube)</legend>
          <div class="seg">
            {MIRRORS.map((m) => (
              <button
                type="button"
                key={m.id}
                aria-pressed={s.mirror === m.id}
                onClick={() => updateSettings({ mirror: m.id })}
              >
                {m.name}
              </button>
            ))}
          </div>
          <p class="muted small">Works with the 3D renderings.</p>
        </fieldset>
        <label class="field">
          <span>Show pieces for</span>
          <select value={s.stickering} onChange={(e) => updateSettings({ stickering: e.currentTarget.value })}>
            {STICKERINGS.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </label>
        <label class="field">
          <span>Animation speed: {s.speed.toFixed(2)}×</span>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.25"
            value={s.speed}
            onInput={(e) => updateSettings({ speed: Number(e.currentTarget.value) })}
          />
        </label>
      </div>

      <div class="card">
        <HelpHeading topic="typing" level="h2">
          Typing moves
        </HelpHeading>
        <div class="seg" role="group" aria-label="Notation keypad">
          {(['auto', 'on', 'off'] as const).map((k) => (
            <button type="button" key={k} aria-pressed={s.keypad === k} onClick={() => updateSettings({ keypad: k })}>
              {k === 'auto' ? 'Keypad on touch screens' : k === 'on' ? 'Always keypad' : 'System keyboard'}
            </button>
          ))}
        </div>
      </div>

      <div class="card">
        <h2>Help</h2>
        <label class="check">
          <input
            type="checkbox"
            checked={s.showHelp}
            onChange={(e) => updateSettings({ showHelp: e.currentTarget.checked })}
          />
          Show the ? buttons that explain each part of the app
        </label>
      </div>

      <button type="button" class="btn" onClick={() => (settings.value = { ...DEFAULT_SETTINGS })}>
        Restore default settings
      </button>
    </div>
  )
}
