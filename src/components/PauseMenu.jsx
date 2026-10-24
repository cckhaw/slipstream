import { Button, GlassPanel, IconButton, SpeakerIcon } from './Glass.jsx'

export default function PauseMenu({ muted, onResume, onQuit, onToggleMute }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/35 px-safe animate-fade-in" role="dialog" aria-modal="true" aria-label="Paused">
      <GlassPanel className="animate-rise w-full max-w-[320px] p-6 text-center">
        <h2 className="text-[28px] font-bold tracking-tight">Paused</h2>
        <div className="mt-5 flex flex-col gap-3">
          <Button variant="primary" onClick={onResume}>Resume</Button>
          <Button onClick={onQuit}>Quit to Menu</Button>
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
