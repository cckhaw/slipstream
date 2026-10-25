import { useEffect, useRef, useState } from 'react'
import { buildMatrix, buildShareText, EMOJI, LEGEND, shareText, type RunEvent } from '../lib/share'
import { Board } from './Leaderboard.jsx'

export interface RunResult {
  score: number
  maxMult: number
  events: RunEvent[]
  seed: string
  isNewBest: boolean
  rank: number | null
  view?: unknown // leaderboard snapshot (see Board)
}

interface Props {
  world: { id: string; name: string }
  result: RunResult
  profile: unknown
  onRetry: () => void
  onWorlds: () => void
  onMenu: () => void
}

const COPIED_MS = 2500

const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)
const CheckIcon = () => (
  <Icon>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
)
const ShareIcon = () => (
  <Icon>
    <path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </Icon>
)

// Apple-style glass sheet: blur, translucent charcoal, hairline border, squircle corners.
const glass: React.CSSProperties = {
  background: 'rgba(19, 23, 34, 0.8)',
  backdropFilter: 'blur(32px)',
  WebkitBackdropFilter: 'blur(32px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 28,
  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
}

function Metric({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 ${className}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">{label}</div>
      <div className="mt-1 leading-none text-white">{children}</div>
    </div>
  )
}

export default function GameOverModal({ world, result, profile, onRetry, onWorlds, onMenu }: Props) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const rows = buildMatrix(result.events)

  const handleShare = async () => {
    const text = buildShareText({ score: result.score, maxMult: result.maxMult, events: result.events, seed: result.seed })
    const outcome = await shareText(text)
    if (outcome === 'copied') {
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), COPIED_MS)
    }
  }

  return (
    <div
      className="absolute inset-0 grid animate-fade-in place-items-center bg-black/45 px-3 pb-safe pt-safe"
      role="dialog"
      aria-modal="true"
      aria-label="Game over"
    >
      <div className="animate-rise my-3 max-h-[calc(100dvh_-_24px)] w-full max-w-[400px] touch-pan-y overflow-y-auto overscroll-contain p-4 font-sans text-white" style={glass}>
        <div className="mx-auto mb-2 h-[5px] w-9 rounded-full bg-white/25" aria-hidden="true" />

        <div className="text-center">
          <h2 className="font-display text-[26px] font-bold leading-none tracking-tight">Game Over</h2>
          <p className="mt-1.5 text-[13px] font-medium text-white/60">{world.name}</p>
          <div className="mt-2 flex items-center justify-center gap-2 text-[14px] font-semibold">
            {result.isNewBest && <span className="animate-pop rounded-full bg-[#FFD60A] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-black">New best</span>}
            {result.rank ? <span className="text-white/75">Rank #{result.rank}</span> : null}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Metric label="Final score" className="col-span-2 text-center">
            <span className="font-display text-[44px] font-extrabold tabular-nums">{result.score.toLocaleString()}</span>
          </Metric>
          <Metric label="Max multiplier">
            <span className="font-display text-[24px] font-extrabold tabular-nums">×{result.maxMult.toFixed(1)}</span>
          </Metric>
          <Metric label="Seed ID">
            <span className="select-all font-pixel text-[22px] font-bold tracking-[0.06em]">{result.seed}</span>
          </Metric>
        </div>

        {/* Emoji matrix scorecard */}
        <figure className="mt-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-center" aria-label={`Run line: ${rows.join(' ')}`}>
          <div className="text-[22px] leading-[1.3] tracking-[0.05em]" aria-hidden="true">
            {rows.map((r, i) => (
              <div key={i}>{r}</div>
            ))}
          </div>
          <figcaption className="mt-1.5 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[11px] font-medium text-white/60">
            {LEGEND.map(([k, label]) => (
              <span key={k}>
                {EMOJI[k]} {label}
              </span>
            ))}
          </figcaption>
        </figure>

        <button
          type="button"
          onClick={handleShare}
          aria-live="polite"
          className={`mt-2.5 flex min-h-[52px] w-full select-none items-center justify-center gap-2 rounded-[18px] px-4 font-display text-[18px] font-bold text-white transition-colors duration-200 active:scale-[0.98] ${copied ? 'bg-[#30D158]' : 'bg-[#0A84FF]'}`}
        >
          {copied ? <CheckIcon /> : <ShareIcon />}
          {copied ? 'Copied to Clipboard!' : 'Challenge a friend'}
        </button>

        <div className="mt-3">
          <h3 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/60">Leaderboard</h3>
          <div className="touch-pan-y max-h-[22dvh] min-h-[132px] overflow-y-auto rounded-xl pr-0.5">
            <Board worldId={world.id} profile={profile} data={result.view} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={onRetry} className="col-span-2 min-h-[50px] rounded-[18px] bg-white font-display text-[17px] font-bold text-black active:scale-[0.98]">
            Play Again
          </button>
          <button type="button" onClick={onWorlds} className="min-h-[46px] rounded-[16px] bg-white/10 font-display text-[16px] font-semibold text-white active:bg-white/20">
            Worlds
          </button>
          <button type="button" onClick={onMenu} className="min-h-[46px] rounded-[16px] bg-white/10 font-display text-[16px] font-semibold text-white active:bg-white/20">
            Menu
          </button>
        </div>
      </div>
    </div>
  )
}
