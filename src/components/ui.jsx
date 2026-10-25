// Shared chunky game-UI primitives: bevelled, heavily outlined, press-down buttons,
// while keeping HIG basics:
// 44pt+ touch targets, safe areas, high-contrast labels and Reduce Motion support.

export function Panel({ className = '', children, ...rest }) {
  return (
    <div className={`panel squircle ${className}`} {...rest}>
      {children}
    </div>
  )
}

const SIZES = {
  lg: 'min-h-[56px] px-5 text-[19px]',
  md: 'min-h-[48px] px-4 text-[16px]',
}

// variant: green | cyan | gold | pink | dark
export function Button({ variant = 'green', size = 'lg', className = '', children, ...rest }) {
  return (
    <button
      type="button"
      className={`chunk btn-${variant} flex w-full select-none items-center justify-center gap-2 font-display font-black tracking-tight disabled:opacity-50 ${SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function IconButton({ label, variant = 'dark', className = '', children, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`chunk btn-${variant} grid h-12 w-12 shrink-0 select-none place-items-center ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Tag({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-md border-2 border-ink px-1.5 py-0.5 font-pixel text-[10px] font-black uppercase tracking-wider ${className}`}>
      {children}
    </span>
  )
}

const I = ({ children, size = 24, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
)

export const PauseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <rect x="3" y="2" width="5" height="16" rx="1.5" />
    <rect x="12" y="2" width="5" height="16" rx="1.5" />
  </svg>
)
export const PlayIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M5 2.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 5 2.5Z" />
  </svg>
)
export const BackIcon = () => (
  <I>
    <path d="m15 5-7 7 7 7" />
  </I>
)
export const PencilIcon = () => (
  <I size={20}>
    <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
    <path d="m13 7 4 4" />
  </I>
)
export const TrophyIcon = ({ size = 24 }) => (
  <I size={size} strokeWidth="2.6">
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
    <path d="M12 14v4M8 20h8" />
  </I>
)
export const SpeakerIcon = ({ off }) => (
  <I size={22} strokeWidth="2.6">
    <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
    {off ? <path d="m16 9 5 6m0-6-5 6" /> : <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>}
  </I>
)
export const CubeIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z" />
    <path d="m3 7 9 5 9-5M12 12v10" />
  </svg>
)
export const TurnArrow = ({ dir }) => (
  <I size={22} strokeWidth="3.2">
    {dir === 'left' && <path d="M19 19v-6a4 4 0 0 0-4-4H6m0 0 4-4M6 9l4 4" />}
    {dir === 'right' && <path d="M5 19v-6a4 4 0 0 1 4-4h9m0 0-4-4m4 4-4 4" />}
    {dir === 'uturn' && <path d="M5 20V9a5 5 0 0 1 10 0v11m0 0-3.5-3.5M15 20l3.5-3.5" />}
  </I>
)
export const ChevronDown = ({ size = 56, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="m6 6 6 6 6-6" />
    <path d="m6 13 6 6 6-6" />
  </svg>
)

// Full-screen scrolling page with a sticky header (world select, leaderboard).
export function Page({ title, onBack, right, children }) {
  return (
    <div className="absolute inset-0 flex animate-fade-in flex-col bg-[#070A14]/80 backdrop-blur-xl">
      <header className="px-safe pt-safe">
        <div className="mx-auto flex max-w-4xl items-center gap-3 py-3">
          <IconButton label="Back" onClick={onBack}>
            <BackIcon />
          </IconButton>
          <h1 className="title-outline flex-1 text-[30px] leading-none">{title}</h1>
          {right}
        </div>
      </header>
      <div className="touch-pan-y flex-1 overflow-y-auto overscroll-contain px-safe pb-safe">
        <div className="mx-auto max-w-4xl pb-6 pt-2">{children}</div>
      </div>
    </div>
  )
}
