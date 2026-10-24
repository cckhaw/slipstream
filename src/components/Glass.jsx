// Shared Apple-HIG building blocks: frosted panels, buttons and icons.

export function GlassPanel({ className = '', children, ...rest }) {
  return (
    <div className={`glass-strong squircle rounded-squircle ${className}`} {...rest}>
      {children}
    </div>
  )
}

const VARIANTS = {
  primary: 'bg-orb text-obsidian shadow-glow-orb active:brightness-90',
  secondary: 'glass text-label active:bg-white/20',
  plain: 'text-label-secondary active:text-label',
  danger: 'bg-slip text-white shadow-glow-slip active:brightness-90',
}

// 50pt-high targets (HIG minimum is 44pt), 16px squircle corners.
export function Button({ variant = 'secondary', className = '', children, ...rest }) {
  return (
    <button
      type="button"
      className={`squircle min-h-[50px] w-full select-none rounded-squircle-sm px-5 text-[17px] font-semibold tracking-tight transition-transform duration-100 active:scale-[0.97] ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function IconButton({ label, className = '', children, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`glass-pill grid h-11 w-11 place-items-center text-label transition-transform active:scale-90 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export const PauseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
    <rect x="3.5" y="2.5" width="3.8" height="13" rx="1.4" />
    <rect x="10.7" y="2.5" width="3.8" height="13" rx="1.4" />
  </svg>
)

export const SpeakerIcon = ({ off }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
    {off ? (
      <path d="m16 9 5 6m0-6-5 6" />
    ) : (
      <>
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </>
    )}
  </svg>
)

export const ChevronDown = ({ size = 56, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="m6 6 6 6 6-6" />
    <path d="m6 13 6 6 6-6" />
  </svg>
)
