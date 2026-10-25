import { useEffect, useMemo, useRef, useState } from 'react'
import { ACHIEVEMENTS, buildSharePayload, countEvents, EMOJI, LABEL, shareRun, type Achievement, type RunEvent } from '../lib/share'
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
  world: { id: string; name: string; accent?: string }
  result: RunResult
  profile: unknown
  onRetry: () => void
  onWorlds: () => void
  onMenu: () => void
}

const COPIED_MS = 2500

const Icon = ({ children, size = 22 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
const CopyIcon = () => (
  <Icon size={16}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
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

const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Counts up from 0 to `target` (instantly with Reduce Motion).
function useCountUp(target: number, ms = 900, delay = 0): number {
  const [v, setV] = useState(() => (reduceMotion() ? target : 0))
  useEffect(() => {
    if (reduceMotion() || target <= 0) {
      setV(target)
      return undefined
    }
    let raf = 0
    let start = 0
    const t0 = setTimeout(() => {
      const tick = (now: number) => {
        start ||= now
        const k = Math.min(1, (now - start) / ms)
        setV(Math.round(target * (1 - Math.pow(1 - k, 3)))) // ease-out
        if (k < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, delay)
    return () => {
      clearTimeout(t0)
      cancelAnimationFrame(raf)
    }
  }, [target, ms, delay])
  return v
}

// One line of personality under the title: the most impressive thing about the run.
function verdict(r: RunResult, c: Record<Achievement, number>): { text: string; tone: string } {
  if (r.isNewBest) return { text: 'New personal best!', tone: 'text-[#FFD60A]' }
  if (r.rank && r.rank <= 3) return { text: 'On the podium!', tone: 'text-[#FFD60A]' }
  if (r.maxMult >= 9.5) return { text: 'Full speed reached!', tone: 'text-[#FF6B9A]' }
  if (c.near_miss >= 5) return { text: 'Near-miss master', tone: 'text-[#C9A7FF]' }
  if (c.slipstream >= 8) return { text: 'Lane surfer', tone: 'text-[#5EEAD4]' }
  return { text: 'Nice run!', tone: 'text-white/70' }
}

// Multiplier colour follows the in-game badge: cyan, then gold, then pink.
const multTone = (m: number) => (m >= 8 ? '#FF6B9A' : m >= 4 ? '#FFC83D' : '#5EEAD4')

const CHIP: Record<Achievement, { ring: string; glow: string; text: string }> = {
  slipstream: { ring: 'rgba(255,214,10,0.55)', glow: 'rgba(255,214,10,0.18)', text: '#FFE27A' },
  near_miss: { ring: 'rgba(191,140,255,0.55)', glow: 'rgba(191,140,255,0.2)', text: '#D9C2FF' },
  safe: { ring: 'rgba(80,220,120,0.55)', glow: 'rgba(80,220,120,0.18)', text: '#9DF0B3' },
}

function Chip({ kind, count, delay }: { kind: Achievement; count: number; delay: number }) {
  const n = useCountUp(count, 700, delay + 250)
  const c = CHIP[kind]
  return (
    <div
      role="listitem"
      aria-label={`${LABEL[kind]}: ${count}`}
      className="animate-pop rounded-2xl px-2 py-2.5 text-center"
      style={{
        animationDelay: `${delay}ms`,
        background: `linear-gradient(180deg, ${c.glow}, rgba(0,0,0,0.28))`,
        border: `1px solid ${count ? c.ring : 'rgba(255,255,255,0.1)'}`,
        boxShadow: count ? `0 0 18px ${c.glow}` : undefined,
        opacity: count ? 1 : 0.55,
      }}
    >
      <span className="text-[26px] leading-none" aria-hidden="true">{EMOJI[kind]}</span>
      <span className="ml-1.5 font-display text-[23px] font-extrabold tabular-nums" style={{ color: count ? c.text : 'rgba(255,255,255,0.5)' }} aria-hidden="true">
        x{n}
      </span>
    </div>
  )
}

const CONFETTI = ['#FFD60A', '#FF6B9A', '#5EEAD4', '#0A84FF', '#C9A7FF', '#FF9F0A']

// A short burst from the top of the sheet for a personal best or a podium finish.
function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const a = (i / 26) * Math.PI * 2 + (i % 3) * 0.4
        const d = 90 + ((i * 37) % 110)
        return {
          color: CONFETTI[i % CONFETTI.length],
          style: {
            '--dx': `${Math.cos(a) * d}px`,
            '--dy': `${Math.sin(a) * d * 0.8 - 30}px`,
            '--rot': `${(i % 2 ? 1 : -1) * (180 + i * 23)}deg`,
            animationDelay: `${(i % 5) * 40}ms`,
          } as React.CSSProperties,
          round: i % 3 === 0,
        }
      }),
    [],
  )
  return (
    <div className="pointer-events-none absolute left-1/2 top-24 motion-reduce:hidden" aria-hidden="true">
      {bits.map((b, i) => (
        <span key={i} className={`absolute block h-2 w-2 animate-confetti ${b.round ? 'rounded-full' : 'rounded-[2px]'}`} style={{ ...b.style, background: b.color }} />
      ))}
    </div>
  )
}

function Tile({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 ${className}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">{label}</div>
      <div className="mt-1 leading-none text-white">{children}</div>
    </div>
  )
}

export default function GameOverModal({ world, result, profile, onRetry, onWorlds, onMenu }: Props) {
  const [copied, setCopied] = useState(false)
  const [seedCopied, setSeedCopied] = useState(false)
  const [tab, setTab] = useState<'run' | 'board'>('run')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const seedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      clearTimeout(seedTimer.current)
    },
    [],
  )

  const counts = countEvents(result.events)
  const score = useCountUp(result.score, 1100, 150)
  const accent = world.accent ?? '#00F5D4'
  const v = verdict(result, counts)
  const celebrate = result.isNewBest || (!!result.rank && result.rank <= 3)
  const mult = Math.floor(result.maxMult)

  const handleShare = async () => {
    const outcome = await shareRun(buildSharePayload({ score: result.score, maxMult: result.maxMult, events: result.events, seed: result.seed }))
    if (outcome === 'copied') {
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), COPIED_MS)
    }
  }

  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(result.seed)
      setSeedCopied(true)
      clearTimeout(seedTimer.current)
      seedTimer.current = setTimeout(() => setSeedCopied(false), 1500)
    } catch {
      /* the seed is selectable as a fallback */
    }
  }

  return (
    <div
      className="absolute inset-0 grid animate-fade-in place-items-center bg-black/45 px-3 pb-safe pt-safe"
      role="dialog"
      aria-modal="true"
      aria-label="Game over"
    >
      <div className="animate-rise relative my-3 max-h-[calc(100dvh_-_24px)] w-full max-w-[400px] touch-pan-y overflow-y-auto overscroll-contain p-4 font-sans text-white" style={glass}>
        {/* The world's colour glows from behind the score */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-60" style={{ background: `radial-gradient(ellipse 75% 100% at 50% 0%, ${accent}55, transparent 70%)`, borderRadius: '28px 28px 0 0' }} aria-hidden="true" />
        {celebrate && <Confetti />}

        <div className="relative">
          <div className="mx-auto mb-2 h-[5px] w-9 rounded-full bg-white/25" aria-hidden="true" />

          <div className="text-center">
            <h2 className="font-display text-[26px] font-bold leading-none tracking-tight">Game Over</h2>
            <p className="mt-1.5 text-[13px] font-medium text-white/60">{world.name}</p>
            <div className="mt-1.5 flex items-center justify-center gap-2 text-[15px] font-bold">
              <span className={`animate-pop ${v.tone}`}>{v.text}</span>
              {result.rank ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[12px] font-semibold text-white/80">Rank #{result.rank}</span> : null}
            </div>
          </div>

          {/* iOS-style segmented control: the leaderboard gets its own page instead of being squeezed in */}
          <div className="mt-3 grid grid-cols-2 rounded-xl bg-white/10 p-[3px]" role="tablist" aria-label="Game over sections">
            {([['run', 'Your run'], ['board', 'Leaderboard']] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`min-h-[34px] rounded-[10px] font-display text-[14px] font-semibold transition-colors ${tab === k ? 'bg-white/90 text-black shadow' : 'text-white/75'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'run' ? (
            <div role="tabpanel">
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Tile label="Final score" className="col-span-2 text-center" >
                  <span
                    className="font-display text-[50px] font-extrabold tabular-nums"
                    style={{ backgroundImage: `linear-gradient(180deg, #fff 35%, ${accent})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: `drop-shadow(0 0 14px ${accent}66)` }}
                  >
                    {score.toLocaleString()}
                  </span>
                </Tile>

                <Tile label="Max multiplier">
                  <span className="font-display text-[26px] font-extrabold tabular-nums" style={{ color: multTone(result.maxMult) }}>
                    ×{result.maxMult.toFixed(1)}
                  </span>
                  <div className="mt-1.5 flex gap-[3px]" aria-hidden="true">
                    {Array.from({ length: 10 }, (_, i) => (
                      <span key={i} className="h-[6px] flex-1 rounded-full" style={{ background: i < mult ? multTone(result.maxMult) : 'rgba(255,255,255,0.15)' }} />
                    ))}
                  </div>
                </Tile>

                <button type="button" onClick={copySeed} aria-label={`Seed ${result.seed}. Tap to copy`} className="rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-left active:bg-white/10">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
                    Seed ID
                    <span className={seedCopied ? 'text-[#30D158]' : ''}>{seedCopied ? <CheckIcon /> : <CopyIcon />}</span>
                  </div>
                  <div className="mt-1 font-pixel text-[22px] font-bold leading-none tracking-[0.06em]">{result.seed}</div>
                  <div className="mt-1.5 text-[10px] font-medium text-white/45">{seedCopied ? 'Copied!' : 'Tap to copy'}</div>
                </button>
              </div>

              {/* Scorecard: one count per achievement */}
              <div className="mt-2 grid grid-cols-3 gap-2" role="list" aria-label="Run highlights">
                {ACHIEVEMENTS.map((k, i) => (
                  <Chip key={k} kind={k} count={counts[k]} delay={150 + i * 110} />
                ))}
              </div>

              <button
                type="button"
                onClick={handleShare}
                aria-live="polite"
                className={`relative mt-2.5 flex min-h-[54px] w-full select-none items-center justify-center gap-2 overflow-hidden rounded-[18px] px-4 font-display text-[18px] font-bold text-white shadow-[0_8px_24px_rgba(10,132,255,0.35)] transition-colors duration-200 active:scale-[0.98] ${copied ? 'bg-[#30D158]' : 'bg-gradient-to-b from-[#3D9BFF] to-[#0A6BE0]'}`}
              >
                {!copied && <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-shine bg-white/25 motion-reduce:hidden" aria-hidden="true" />}
                <span className="relative flex items-center gap-2">
                  {copied ? <CheckIcon /> : <ShareIcon />}
                  {copied ? 'Copied to Clipboard!' : 'Challenge a friend'}
                </span>
              </button>
            </div>
          ) : (
            <div role="tabpanel" className="mt-3">
              <div className="touch-pan-y max-h-[46dvh] min-h-[200px] overflow-y-auto overscroll-contain rounded-xl pr-0.5">
                <Board worldId={world.id} profile={profile} data={result.view} />
              </div>
            </div>
          )}

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
    </div>
  )
}
