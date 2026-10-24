import { shade } from '../lib/colors.js'

const INK = '#05070C'

// Crewmate-style bean in the player's colour.
export default function Avatar({ color, size = 44, className = '' }) {
  const dark = shade(color, -0.28)
  const mid = shade(color, -0.14)
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 64 70" className={className} aria-hidden="true">
      <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
        <rect x="2" y="26" width="14" height="26" rx="6" fill={dark} />
        <rect x="16" y="50" width="15" height="16" rx="6" fill={mid} />
        <rect x="35" y="50" width="15" height="16" rx="6" fill={mid} />
        <rect x="10" y="4" width="44" height="56" rx="22" fill={color} />
        <rect x="31" y="15" width="30" height="21" rx="10.5" fill="#9FE3FF" />
      </g>
      <rect x="17" y="11" width="7" height="19" rx="3.5" fill="#fff" opacity=".35" />
      <rect x="42" y="19" width="12" height="5" rx="2.5" fill="#fff" opacity=".9" />
    </svg>
  )
}
