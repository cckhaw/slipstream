import { IconButton, PauseIcon, Tag } from './ui.jsx'

// Segmented multiplier meter (a segmented progress bar): one block per ×1.
function Meter({ mult }) {
  return (
    <div className="mx-auto mt-2 flex w-[190px] gap-[3px] rounded-lg border-[3px] border-ink bg-ink p-[3px]" role="img" aria-label={`Multiplier ${mult.toFixed(1)} of 10`}>
      {Array.from({ length: 10 }, (_, i) => {
        const fill = Math.min(1, Math.max(0, mult - 1 - i))
        return (
          <span key={i} className="relative h-[10px] flex-1 overflow-hidden rounded-[3px] bg-white/15">
            <span className="absolute inset-y-0 left-0 bg-gradient-to-b from-[#FF7A9C] to-slip" style={{ width: `${fill * 100}%` }} />
          </span>
        )
      })}
    </div>
  )
}

// Score, multiplier, world tag and pause. Only the pause button takes touches.
export default function Hud({ hud, best, worldName, showPause, onPause }) {
  const level = Math.floor(hud.mult)
  const tone = hud.mult >= 8 ? 'btn-pink' : hud.mult >= 4 ? 'btn-gold' : 'btn-cyan'
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 px-safe pt-safe">
      <div className="flex items-start justify-between gap-3">
        <div className="w-12">
          {showPause && (
            <IconButton label="Pause" onClick={onPause} className="pointer-events-auto">
              <PauseIcon />
            </IconButton>
          )}
        </div>

        <div data-tour="score" className="chunk min-w-[132px] bg-gradient-to-b from-[#27325A] to-[#161E3A] px-5 py-1.5 text-center" aria-live="off">
          <div className="font-pixel text-[10px] font-black uppercase tracking-[0.16em] text-label-secondary">Score</div>
          <div className="font-display text-[30px] font-black leading-none tabular-nums">{hud.score.toLocaleString()}</div>
          <div className="mt-0.5 font-pixel text-[10px] font-bold text-label-tertiary tabular-nums">BEST {Math.max(best, hud.score).toLocaleString()}</div>
        </div>

        <div className="flex w-12 justify-end">
          <div key={level} className={`chunk ${tone} animate-pop whitespace-nowrap px-3 py-1.5 font-display text-[20px] font-black tabular-nums`} aria-label={`Multiplier ${hud.mult.toFixed(1)}`}>
            ×{hud.mult.toFixed(1)}
          </div>
        </div>
      </div>
      <Meter mult={hud.mult} />
      {worldName && (
        <div className="mt-2 flex justify-center">
          <Tag className="bg-panel-lo/90 text-label-secondary">{worldName}</Tag>
        </div>
      )}
    </div>
  )
}
