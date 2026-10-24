import { useLayoutEffect, useState } from 'react'
import { Button, ChevronDown, Panel } from './ui.jsx'

const TOTAL = 3

function Dots({ step }) {
  return (
    <div className="flex justify-center gap-1.5" aria-hidden="true">
      {Array.from({ length: TOTAL }, (_, i) => (
        <span key={i} className={`h-1.5 rounded-full transition-all ${i === Math.min(step, TOTAL - 1) ? 'w-5 bg-orb' : 'w-1.5 bg-white/25'}`} />
      ))}
    </div>
  )
}

function Callout({ step, eyebrow, title, children, footer, className = '', style }) {
  return (
    <Panel className={`animate-rise mx-auto w-[min(88vw,340px)] p-5 text-center ${className}`} style={style} role="dialog" aria-label={title}>
      <div className="font-pixel text-[11px] font-black uppercase tracking-[0.14em] text-label-secondary">{eyebrow}</div>
      <h2 className="mt-1 font-display text-[24px] font-black tracking-tight">{title}</h2>
      <p className="mt-2 text-[17px] leading-snug text-label-secondary">{children}</p>
      <div className="mt-4"><Dots step={step} /></div>
      {footer}
    </Panel>
  )
}

const B = ({ children }) => <b className="font-bold text-label">{children}</b>

// Interactive onboarding. Steps 0-2 gate the physics (the engine freezes or slows the
// world); step 3 lets the launch play out before handing over to the live run.
export default function Tutorial({ step, metrics, progress, onNext, onSkip }) {
  const [rect, setRect] = useState(null)

  useLayoutEffect(() => {
    if (step !== 0) return undefined
    const measure = () => {
      const el = document.querySelector('[data-tour="score"]')
      if (!el) return
      const b = el.getBoundingClientRect()
      setRect({ x: b.left, y: b.top, w: b.width, h: b.height })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [step])

  const skip = (
    <button type="button" onClick={onSkip} className="pointer-events-auto mt-1 min-h-[44px] w-full text-[15px] text-label-tertiary active:text-label">
      Skip tutorial
    </button>
  )
  const calloutTop = 'calc(max(env(safe-area-inset-top), 12px) + 118px)'

  if (step === 0) {
    return (
      <div className="absolute inset-0 overflow-hidden">
        {/* Blocks touches while the player reads. */}
        <div className="absolute inset-0" />
        {rect && (
          <div
            className="pointer-events-none absolute animate-pulse-ring rounded-[26px] border-2 border-orb"
            style={{
              left: rect.x - 8,
              top: rect.y - 8,
              width: rect.w + 16,
              height: rect.h + 16,
              boxShadow: '0 0 0 100vmax rgba(5,7,12,0.72), 0 0 24px rgba(0,245,212,0.5)',
            }}
          />
        )}
        <div className="absolute inset-x-0" style={{ top: rect ? rect.y + rect.h + 28 : 160 }}>
          <Callout step={0} eyebrow="Step 1 of 3" title="The Goal" footer={<><Button variant="green" className="mt-4" onClick={onNext}>Continue</Button>{skip}</>}>
            <B>Survive the conduit</B> and <B>stack your multiplier!</B>
          </Callout>
        </div>
      </div>
    )
  }

  if (step === 1) {
    const floorTop = metrics.floorTop
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Highlight the pink Slipstream floor. */}
        <div
          className="absolute inset-x-0 animate-pulse-ring border-t-2 border-white/80 bg-slip/10"
          style={{ top: floorTop, bottom: 0, boxShadow: 'inset 0 0 40px rgba(255,45,85,0.55)' }}
        />
        <div className="absolute left-1/2 -translate-x-1/2 text-slip drop-shadow-[0_0_14px_rgba(255,45,85,0.8)]" style={{ top: floorTop - 96 }}>
          <ChevronDown className="animate-bob" />
        </div>
        <div className="absolute inset-x-0" style={{ top: calloutTop }}>
          <Callout
            step={1}
            eyebrow="Step 2 of 3"
            title="The Slipstream Zone"
            footer={
              <>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10" aria-label="Hold progress">
                  <div className="h-full rounded-full bg-slip transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
                </div>
                <div className="mt-2 text-[13px] text-label-tertiary">{progress > 0 ? 'Keep holding…' : 'Touch and hold anywhere'}</div>
                {skip}
              </>
            }
          >
            <B>TAP &amp; HOLD</B> to ride the Slipstream floor to build speed
          </Callout>
        </div>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: metrics.floorTop - 150 }}>
          <div className="relative grid h-28 w-28 place-items-center">
            <span className="absolute inset-0 animate-release rounded-full border-[3px] border-orb" />
            <span className="rounded-full bg-orb/90 px-3 py-1 text-[13px] font-extrabold tracking-wide text-obsidian shadow-glow-orb">LET GO</span>
          </div>
        </div>
        <div className="absolute inset-x-0" style={{ top: calloutTop }}>
          <Callout step={2} eyebrow="Step 3 of 3" title="The Jump" footer={skip}>
            <B>RELEASE</B> to launch over incoming laser barriers
          </Callout>
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 flex justify-center" style={{ top: calloutTop }}>
      <div className="chunk btn-green animate-pop px-5 py-3 font-display text-[18px] font-black">Nice launch! You&rsquo;re live…</div>
    </div>
  )
}
