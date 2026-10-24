import { Button, GlassPanel, IconButton, SpeakerIcon } from './Glass.jsx'

export default function Menu({ best, muted, onPlay, onTutorial, onToggleMute }) {
  return (
    <div className="absolute inset-0 grid place-items-center px-safe pb-safe pt-safe animate-fade-in">
      <GlassPanel className="animate-rise w-full max-w-[340px] p-6 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[18px] bg-obsidian-700 shadow-glow-orb">
          <div className="h-5 w-5 rounded-full bg-orb shadow-glow-orb" />
        </div>
        <h1 className="text-[40px] font-bold leading-none tracking-tight">Slipstream</h1>
        <p className="mt-2 text-[17px] text-label-secondary">Ride the floor. Launch the arc.</p>

        <div className="mt-5 rounded-squircle-sm bg-white/5 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-label-tertiary">Best</div>
          <div className="text-[28px] font-bold tabular-nums">{best.toLocaleString()}</div>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <Button variant="primary" onClick={onPlay}>Play</Button>
          <Button onClick={onTutorial}>How to Play</Button>
        </div>
        <div className="mt-4 flex justify-center">
          <IconButton label={muted ? 'Unmute sound' : 'Mute sound'} onClick={onToggleMute}>
            <SpeakerIcon off={muted} />
          </IconButton>
        </div>
      </GlassPanel>
    </div>
  )
}
