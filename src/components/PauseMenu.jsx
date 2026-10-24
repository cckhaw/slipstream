import { Button, IconButton, Panel, PlayIcon, SpeakerIcon } from './ui.jsx'

export default function PauseMenu({ muted, onResume, onQuit, onToggleMute }) {
  return (
    <div className="absolute inset-0 grid animate-fade-in place-items-center bg-black/45 px-safe backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Paused">
      <Panel className="animate-rise w-full max-w-[320px] p-5 text-center">
        <h2 className="title-outline text-[36px] leading-none">Paused</h2>
        <div className="mt-5 flex flex-col gap-3">
          <Button variant="green" onClick={onResume}><PlayIcon /> Resume</Button>
          <div className="flex gap-3">
            <Button variant="dark" size="md" onClick={onQuit}>Quit to Menu</Button>
            <IconButton label={muted ? 'Unmute sound' : 'Mute sound'} onClick={onToggleMute}>
              <SpeakerIcon off={muted} />
            </IconButton>
          </div>
        </div>
      </Panel>
    </div>
  )
}
