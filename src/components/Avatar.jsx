import { shade } from '../lib/colors.js'

const INK = '#05070C'

// "Zip", the Slipstream mascot: a round comet blob with a swoosh tail and a glowing antenna.
export default function Avatar({ color, size = 44, className = '' }) {
  const dark = shade(color, -0.3)
  return (
    <svg width={size * 1.12} height={size} viewBox="0 0 72 64" className={`overflow-visible ${className}`} aria-hidden="true">
      <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M22 31 3 19q7 13 0 26l19-8Z" fill={dark} />
        <path d="M46 11l5-8" fill="none" />
        <circle cx="52" cy="4.5" r="4.5" fill="#FFE27A" />
        <circle cx="42" cy="35" r="24.5" fill={color} />
      </g>
      <ellipse cx="31" cy="24" rx="4.5" ry="8" transform="rotate(35 31 24)" fill="#fff" opacity=".38" />
      <ellipse cx="45" cy="32" rx="6.5" ry="8.5" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <ellipse cx="59" cy="32" rx="6.5" ry="8.5" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <circle cx="47.5" cy="33" r="3.8" fill={INK} />
      <circle cx="61.5" cy="33" r="3.8" fill={INK} />
      <circle cx="48.8" cy="31.4" r="1.3" fill="#fff" />
      <circle cx="62.8" cy="31.4" r="1.3" fill="#fff" />
      <path d="M47 47q5.5 5 11 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
