import { Board } from './Leaderboard.jsx'
import { Button, Panel, Tag } from './ui.jsx'

export default function GameOver({ world, result, profile, onRetry, onWorlds, onMenu }) {
  return (
    <div className="absolute inset-0 grid animate-fade-in place-items-center overflow-y-auto bg-black/45 px-safe pb-safe pt-safe backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Game over">
      <Panel className="animate-rise my-4 w-full max-w-[380px] p-4 text-center">
        <h2 className="title-outline text-[34px] leading-none text-danger" style={{ color: '#FF5C5C' }}>Game Over</h2>
        <p className="mt-2 font-pixel text-[11px] font-black uppercase tracking-[0.14em] text-label-secondary">{world.name}</p>

        <div className="mt-2 font-display text-[58px] font-black leading-none tabular-nums">{result.score.toLocaleString()}</div>
        <div className="mt-2 flex items-center justify-center gap-2">
          {result.isNewBest && <Tag className="animate-pop bg-coin px-2 py-1 text-[11px] text-[#3A2300]">New best</Tag>}
          {result.rank && <span className="font-display text-[16px] font-extrabold text-label-secondary">Rank #{result.rank}</span>}
        </div>

        <div className="touch-pan-y mt-3 max-h-[34vh] overflow-y-auto rounded-xl pr-0.5">
          <Board worldId={world.id} profile={profile} refresh={result} />
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <Button variant="green" onClick={onRetry}>Play Again</Button>
          <div className="flex gap-3">
            <Button variant="gold" size="md" onClick={onWorlds}>Worlds</Button>
            <Button variant="dark" size="md" onClick={onMenu}>Menu</Button>
          </div>
        </div>
      </Panel>
    </div>
  )
}
