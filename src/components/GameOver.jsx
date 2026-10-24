import { Button, GlassPanel } from './Glass.jsx'

export default function GameOver({ score, best, isNewBest, onRetry, onMenu }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/30 px-safe animate-fade-in" role="dialog" aria-modal="true" aria-label="Game over">
      <GlassPanel className="animate-rise w-full max-w-[340px] p-6 text-center">
        <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-danger">Crashed</div>
        <div className="mt-2 text-[56px] font-bold leading-none tracking-tight tabular-nums">{score.toLocaleString()}</div>
        {isNewBest ? (
          <div className="mx-auto mt-3 w-fit animate-pop rounded-full bg-gold/20 px-3 py-1 text-[13px] font-semibold text-gold">New Best</div>
        ) : (
          <div className="mt-3 text-[15px] text-label-secondary">Best {best.toLocaleString()}</div>
        )}
        <div className="mt-6 flex flex-col gap-3">
          <Button variant="primary" onClick={onRetry}>Play Again</Button>
          <Button onClick={onMenu}>Menu</Button>
        </div>
      </GlassPanel>
    </div>
  )
}
