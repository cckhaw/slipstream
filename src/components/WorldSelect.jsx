import { WORLDS } from '../game/worlds.js'
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

export default function WorldSelect({ profile, onPlay, onBoard, onBack }) {
  const groups = [
    ['2D Worlds', WORLDS.filter((w) => w.kind === '2d')],
    ['3D Worlds', WORLDS.filter((w) => w.kind === '3d')],
  ]
  return (
    <Page title="Choose a World" onBack={onBack}>
      {groups.map(([label, list]) => (
        <section key={label} className="mb-5">
          <h2 className="mb-2 px-1 font-pixel text-[13px] font-black uppercase tracking-[0.16em] text-label-secondary">{label}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((w) => (
              <WorldCard key={w.id} world={w} best={bestFor(w.id, profile)} onPlay={() => onPlay(w.id)} onBoard={() => onBoard(w.id)} />
            ))}
          </div>
        </section>
      ))}
    </Page>
  )
}
