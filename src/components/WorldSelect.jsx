import { useState } from 'react'
import { WORLDS } from '../game/worlds.js'
import * as store from '../lib/storage.js'
import { bestFor } from '../lib/leaderboard.js'
import WorldArt from './WorldArt.jsx'
import { Button, CubeIcon, IconButton, Page, Panel, PlayIcon, TrophyIcon } from './ui.jsx'

function Pips({ n }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`Difficulty ${n} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-sm border-2 border-ink ${i < n ? 'bg-danger' : 'bg-white/25'}`} />
      ))}
    </span>
  )
}

function WorldCard({ world, best, onPlay, onBoard }) {
  const is3d = world.kind === '3d'
  return (
    <Panel className="flex flex-col gap-3 p-3">
      <div className="relative h-[116px] overflow-hidden rounded-xl border-[3px] border-ink">
        <WorldArt theme={world.theme} className="absolute inset-0 h-full w-full" />
        <span className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-lg border-[3px] border-ink px-2 py-0.5 font-pixel text-[11px] font-black ${is3d ? 'bg-violet text-white' : 'bg-white text-ink'}`}>
          {is3d && <CubeIcon size={12} />}
          {is3d ? '3D' : '2D'}
        </span>
        <span className="absolute right-2 top-2 rounded-lg border-[3px] border-ink bg-panel-lo/90 px-2 py-1">
          <Pips n={world.difficulty} />
        </span>
      </div>
      <div>
        <h3 className="font-display text-[22px] font-black leading-tight">{world.name}</h3>
        <p className="mt-1 text-[14px] leading-snug text-label-secondary">{world.challenge}</p>
      </div>
      <div className="mt-auto flex items-center gap-2">
        <div className="slot flex h-12 min-w-[84px] flex-col items-center justify-center px-2 leading-none">
          <span className="font-pixel text-[9px] font-black uppercase tracking-wider text-label-tertiary">Best</span>
          <span className="mt-0.5 font-pixel text-[16px] font-black tabular-nums text-coin">{best.toLocaleString()}</span>
        </div>
        <IconButton label={`${world.name} leaderboard`} variant="gold" onClick={onBoard}>
          <TrophyIcon />
        </IconButton>
        <Button variant="green" size="md" onClick={onPlay} aria-label={`Play ${world.name}`}>
          <PlayIcon /> Play
        </Button>
      </div>
    </Panel>
  )
}

const KIND_KEY = 'worldKind'

// 2D and 3D side by side at the top: on a phone the 3D worlds would otherwise sit below the fold.
export default function WorldSelect({ profile, initialKind = '2d', onPlay, onBoard, onBack }) {
  const [kind, setKind] = useState(() => {
    const saved = store.read(KIND_KEY)
    return saved === '2d' || saved === '3d' ? saved : initialKind
  })
  const pick = (k) => {
    setKind(k)
    store.write(KIND_KEY, k)
  }
  const tabs = [
    ['2d', '2D Worlds'],
    ['3d', '3D Worlds'],
  ]
  return (
    <Page title="Choose a World" onBack={onBack}>
      <div className="mb-4 grid grid-cols-2 gap-2" role="tablist" aria-label="World type">
        {tabs.map(([k, label]) => {
          const on = k === kind
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => pick(k)}
              className={`chunk flex min-h-[52px] items-center justify-center gap-2 font-display text-[18px] font-black ${on ? 'btn-gold' : 'btn-dark'}`}
            >
              {k === '3d' && <CubeIcon size={18} />}
              {label}
              <span className="font-pixel text-[11px] opacity-70">{WORLDS.filter((w) => w.kind === k).length}</span>
            </button>
          )
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="tabpanel">
        {WORLDS.filter((w) => w.kind === kind).map((w) => (
          <WorldCard key={w.id} world={w} best={bestFor(w.id, profile)} onPlay={() => onPlay(w.id)} onBoard={() => onBoard(w.id)} />
        ))}
      </div>
    </Page>
  )
}
