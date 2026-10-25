import { getWorld } from '../game/worlds.js'
import Avatar from './Avatar.jsx'
import { Button, IconButton, MusicIcon, PencilIcon, PlayIcon, SpeakerIcon, TrophyIcon } from './ui.jsx'
import { Panel } from './ui.jsx'

export default function Menu({ profile, muted, musicOn, challenge, onPlayChallenge, onDismissChallenge, onPlay, onLeaderboard, onTutorial, onEditProfile, onToggleMute, onToggleMusic }) {
  const challengeWorld = challenge ? getWorld(challenge.worldId) : null
  return (
    <div className="absolute inset-0 grid animate-fade-in place-items-center overflow-y-auto px-safe pb-safe pt-safe">
      <div className="my-4 w-full max-w-[360px]">
        <div className="mb-5 text-center">
          <div className="animate-floaty mx-auto w-fit">
            <Avatar color={profile.color} size={64} />
          </div>
          <h1 className="title-pixel mt-3 text-[38px] leading-none">Slipstream</h1>
          <p className="mt-3 font-display text-[17px] font-bold text-label-secondary">Ride the floor. Launch the arc.</p>
        </div>

        <Panel className="animate-rise p-4">
          <button
            type="button"
            onClick={onEditProfile}
            aria-label={`Welcome back, ${profile.name}. Edit profile`}
            className="slot flex min-h-[60px] w-full items-center gap-3 px-3 text-left active:brightness-125"
          >
            <Avatar color={profile.color} size={34} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block font-pixel text-[10px] font-black uppercase tracking-[0.14em] text-label-tertiary">Welcome back</span>
              <span className="block truncate font-display text-[20px] font-black">{profile.name}</span>
            </span>
            <span className="grid h-10 w-10 place-items-center text-label-secondary"><PencilIcon /></span>
          </button>

          {challenge && (
            <div className="mt-4 rounded-2xl border border-white/15 bg-white/[0.07] p-3 text-center" role="status">
              <div className="font-pixel text-[10px] font-black uppercase tracking-[0.14em] text-coin">Challenge from a friend</div>
              <div className="mt-1 font-display text-[16px] font-extrabold">{challengeWorld.name}</div>
              <div className="font-pixel text-[13px] tracking-[0.1em] text-label-secondary">Seed {challenge.seed}</div>
              <div className="mt-2 flex gap-2">
                <Button variant="green" size="md" onClick={onPlayChallenge}><PlayIcon /> Play challenge</Button>
                <IconButton label="Dismiss challenge" onClick={onDismissChallenge}>×</IconButton>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3">
            <Button variant="green" onClick={onPlay}><PlayIcon /> Play</Button>
            <Button variant="gold" onClick={onLeaderboard}><TrophyIcon size={22} /> Leaderboard</Button>
            <div className="flex gap-3">
              <Button variant="dark" size="md" onClick={onTutorial}>How to Play</Button>
              <IconButton label={muted ? 'Unmute sound' : 'Mute sound'} onClick={onToggleMute}>
                <SpeakerIcon off={muted} />
              </IconButton>
              <IconButton label={musicOn ? 'Turn music off' : 'Turn music on'} onClick={onToggleMusic}>
                <MusicIcon off={!musicOn} />
              </IconButton>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
