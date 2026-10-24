import { useState } from 'react'
import { PLAYER_COLORS } from '../lib/colors.js'
import { sanitizeName } from '../lib/leaderboard.js'
import Avatar from './Avatar.jsx'
import { Button, Panel } from './ui.jsx'

// "Who's playing?" - shown once for new players; also used to edit name / colour.
export default function ProfileSetup({ initial, onSave, onCancel }) {
  const editing = Boolean(initial)
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? PLAYER_COLORS[5].hex)
  const [touched, setTouched] = useState(false)
  const clean = sanitizeName(name)
  const valid = clean.length >= 2
  const submit = (e) => {
    e.preventDefault()
    setTouched(true)
    if (valid) onSave({ name: clean, color })
  }

  return (
    <div className="absolute inset-0 grid animate-fade-in place-items-center overflow-y-auto bg-[#070A14]/70 px-safe pb-safe pt-safe backdrop-blur-md">
      <Panel className="animate-rise my-4 w-full max-w-[360px] p-5 text-center">
        <form onSubmit={submit} noValidate>
          <h1 className="title-outline text-[32px] leading-none">{editing ? 'Your Profile' : "Who's playing?"}</h1>
          <p className="mt-3 text-[15px] text-label-secondary">
            {editing ? 'Change your name or colour. Your scores stay put.' : 'Pick a name and colour for the leaderboards. We will remember you next time.'}
          </p>

          <div className="mt-4 grid place-items-center">
            <div className="animate-floaty">
              <Avatar color={color} size={84} />
            </div>
          </div>

          <label htmlFor="player-name" className="mt-3 block text-left font-pixel text-[11px] font-black uppercase tracking-[0.14em] text-label-secondary">
            Name
          </label>
          <input
            id="player-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={14}
            autoComplete="nickname"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="Your name"
            aria-invalid={touched && !valid}
            aria-describedby="name-hint"
            className="slot mt-1 h-[52px] w-full px-4 text-center font-display text-[20px] font-extrabold text-white placeholder:text-label-tertiary focus:outline-none focus:ring-[3px] focus:ring-orb"
          />
          <p id="name-hint" className={`mt-1.5 h-5 text-[13px] ${touched && !valid ? 'text-danger' : 'text-label-tertiary'}`}>
            {touched && !valid ? 'Pick a name with at least 2 characters.' : 'Up to 12 letters, numbers, spaces, _ or -'}
          </p>

          <div role="radiogroup" aria-label="Colour" className="mt-2 grid grid-cols-5 justify-items-center gap-x-1 gap-y-2">
            {PLAYER_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={color === c.hex}
                aria-label={c.label}
                onClick={() => setColor(c.hex)}
                className="grid h-11 w-11 place-items-center rounded-full"
              >
                <span
                  className={`block h-9 w-9 rounded-full border-[3px] border-ink transition-transform ${color === c.hex ? 'scale-110 ring-[3px] ring-white' : ''}`}
                  style={{ background: c.hex, boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -4px 0 rgba(0,0,0,0.25)' }}
                />
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <Button type="submit" variant="green">{editing ? 'Save' : "Let's go!"}</Button>
            {editing && (
              <Button variant="dark" size="md" onClick={onCancel}>Cancel</Button>
            )}
          </div>
        </form>
      </Panel>
    </div>
  )
}
