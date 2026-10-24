import { IconButton, PauseIcon } from './Glass.jsx'

// Score, multiplier and pause. Sits over the canvas; only the pause button takes touches.
export default function Hud({ hud, best, showPause, onPause }) {
  const level = Math.floor(hud.mult)
  const hot = hud.mult >= 5
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 px-safe pt-safe">
      <div className="flex items-start justify-between gap-3">
        <div className="w-11">
          {showPause && (
            <IconButton label="Pause" onClick={onPause} className="pointer-events-auto">
              <PauseIcon />
            </IconButton>
          )}
        </div>

        <div data-tour="score" className="glass squircle rounded-squircle-sm px-5 py-2 text-center" aria-live="off">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-label-secondary">Score</div>
          <div className="text-[28px] font-bold leading-none tracking-tight tabular-nums">{hud.score.toLocaleString()}</div>
          <div className="mt-1 text-[11px] text-label-tertiary tabular-nums">Best {Math.max(best, hud.score).toLocaleString()}</div>
        </div>

        <div className="flex w-11 justify-end">
          <div
            key={level}
            className={`glass-pill animate-pop px-3 py-2 text-[17px] font-bold tabular-nums ${hot ? 'text-slip' : 'text-orb'}`}
            aria-label={`Multiplier ${hud.mult.toFixed(1)}`}
          >
            ×{hud.mult.toFixed(1)}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-3 h-1 w-40 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div className="h-full rounded-full bg-slip shadow-glow-slip transition-[width] duration-100" style={{ width: `${hud.charge * 100}%` }} />
      </div>
    </div>
  )
}
