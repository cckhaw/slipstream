import plugin from 'tailwindcss/plugin'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: { DEFAULT: '#0A0D14', 800: '#111623', 700: '#1A2030' },
        orb: { DEFAULT: '#00F5D4', dim: '#00B8A0' },
        slip: { DEFAULT: '#FF2D55', dim: '#C9203F' },
        gold: '#FF9500',
        ink: '#05070C',
        panel: { DEFAULT: '#1B2440', hi: '#2C3A66', lo: '#121A33' },
        grass: { DEFAULT: '#4ADE80', dark: '#1E9E52' },
        sky: '#4CC9F0',
        coin: '#FFC83D',
        violet: '#8B5CF6',
        danger: '#FF3B30',
        label: {
          DEFAULT: 'rgba(255,255,255,0.96)',
          secondary: 'rgba(235,235,245,0.76)',
          tertiary: 'rgba(235,235,245,0.58)',
        },
      },
      fontFamily: {
        display: ['ui-rounded', '"SF Pro Rounded"', '"Arial Rounded MT Bold"', '-apple-system', 'system-ui', 'sans-serif'],
        pixel: ['ui-monospace', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        squircle: '24px',
        'squircle-sm': '16px',
      },
      boxShadow: {
        ambient: '0 20px 40px rgba(0,0,0,0.4)',
        'glow-orb': '0 0 24px rgba(0,245,212,0.45)',
        'glow-slip': '0 0 24px rgba(255,45,85,0.5)',
      },
      backdropBlur: { glass: '24px' },
      keyframes: {
        bob: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(14px)' } },
        pulseRing: {
          '0%,100%': { transform: 'scale(0.94)', opacity: '0.55' },
          '50%': { transform: 'scale(1.06)', opacity: '1' },
        },
        release: {
          '0%': { transform: 'scale(2.1)', opacity: '0' },
          '30%': { opacity: '1' },
          '100%': { transform: 'scale(0.9)', opacity: '0' },
        },
        pop: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '60%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        rise: {
          '0%': { transform: 'translateY(14px) scale(0.98)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        shrink: { from: { transform: 'scaleX(1)' }, to: { transform: 'scaleX(0)' } },
        wiggle: {
          '0%,100%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(4deg)' },
        },
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        goOut: {
          '0%': { transform: 'scale(0.7)', opacity: '0' },
          '25%': { transform: 'scale(1.05)', opacity: '1' },
          '70%': { opacity: '1' },
          '100%': { transform: 'scale(1.15)', opacity: '0' },
        },
      },
      animation: {
        bob: 'bob 1.1s ease-in-out infinite',
        'pulse-ring': 'pulseRing 1.4s ease-in-out infinite',
        release: 'release 1.3s ease-out infinite',
        pop: 'pop 0.35s cubic-bezier(0.2,0.9,0.3,1.2) both',
        rise: 'rise 0.45s cubic-bezier(0.2,0.8,0.2,1) both',
        'fade-in': 'fadeIn 0.3s ease-out both',
        'go-out': 'goOut 1.1s ease-out both',
        shrink: 'shrink 5s linear forwards',
        wiggle: 'wiggle 0.5s ease-in-out infinite',
        floaty: 'floaty 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [
    // Apple-style frosted glass utilities.
    plugin(({ addComponents, addUtilities }) => {
      addComponents({
        '.glass': {
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          '-webkit-backdrop-filter': 'blur(24px) saturate(160%)',
          'backdrop-filter': 'blur(24px) saturate(160%)',
          'box-shadow': '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.10)',
        },
        '.glass-strong': {
          background: 'rgba(20,26,40,0.62)',
          border: '1px solid rgba(255,255,255,0.14)',
          '-webkit-backdrop-filter': 'blur(24px) saturate(180%)',
          'backdrop-filter': 'blur(24px) saturate(180%)',
          'box-shadow': '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.14)',
        },
        '.glass-pill': {
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          '-webkit-backdrop-filter': 'blur(24px) saturate(160%)',
          'backdrop-filter': 'blur(24px) saturate(160%)',
          'border-radius': '9999px',
          'box-shadow': '0 8px 24px rgba(0,0,0,0.3)',
        },
        // Progressive enhancement: true continuous-curvature corners where supported.
        '.squircle': { 'corner-shape': 'squircle' },

        // ---- Chunky game UI: bevels, heavy outlines, press-down buttons ----
        // Ink outline + top highlight + bottom shade + hard drop that "presses" on tap.
        '.chunk': {
          border: '3px solid #05070C',
          'border-radius': '16px',
          'box-shadow': 'inset 0 3px 0 rgba(255,255,255,0.38), inset 0 -5px 0 rgba(0,0,0,0.26), 0 5px 0 #05070C',
          transition: 'transform 80ms ease, box-shadow 80ms ease, filter 80ms ease',
        },
        '.chunk:active:not(:disabled)': {
          transform: 'translateY(4px)',
          'box-shadow': 'inset 0 3px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.26), 0 1px 0 #05070C',
        },
        '.btn-green': { background: 'linear-gradient(#6CF59C,#27B864)', color: '#04210F' },
        '.btn-cyan': { background: 'linear-gradient(#5DFBE6,#00C7AE)', color: '#032620' },
        '.btn-gold': { background: 'linear-gradient(#FFE27A,#F5A623)', color: '#3A2300' },
        '.btn-pink': { background: 'linear-gradient(#FF7A9C,#E01E52)', color: '#fff' },
        '.btn-dark': { background: 'linear-gradient(#3A4A7C,#27345C)', color: '#fff' },
        // Large rounded panel with a double outline.
        '.panel': {
          background: 'linear-gradient(#27325A,#1A2342)',
          border: '3px solid #05070C',
          'border-radius': '22px',
          'box-shadow': 'inset 0 0 0 2px #3F5090, inset 0 5px 0 2px rgba(255,255,255,0.08), 0 8px 0 #05070C, 0 28px 44px rgba(0,0,0,0.45)',
        },
        // Recessed inventory-slot look (leaderboard rows, inputs).
        '.slot': {
          background: '#0C1124',
          border: '3px solid #05070C',
          'border-radius': '12px',
          'box-shadow': 'inset 0 3px 0 rgba(0,0,0,0.55), inset 0 -2px 0 rgba(255,255,255,0.09)',
        },
        // Stroke-outlined display lettering.
        '.title-outline': {
          'font-family': "ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', -apple-system, system-ui, sans-serif",
          'font-weight': '900',
          'letter-spacing': '0.01em',
          color: '#fff',
          '-webkit-text-stroke': '7px #05070C',
          'paint-order': 'stroke fill',
          'text-shadow': '0 5px 0 #05070C',
        },
        // Blocky monospace wordmark.
        '.title-pixel': {
          'font-family': "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
          'font-weight': '900',
          'text-transform': 'uppercase',
          'letter-spacing': '0.04em',
          color: '#fff',
          'text-shadow': '0 4px 0 #3F5090, 0 8px 0 #05070C, 3px 0 0 #05070C, -3px 0 0 #05070C, 0 -3px 0 #05070C',
        },
      })
      addUtilities({
        '.pt-safe': { 'padding-top': 'max(env(safe-area-inset-top), 12px)' },
        '.pb-safe': { 'padding-bottom': 'max(env(safe-area-inset-bottom), 12px)' },
        '.px-safe': {
          'padding-left': 'max(env(safe-area-inset-left), 16px)',
          'padding-right': 'max(env(safe-area-inset-right), 16px)',
        },
        '.touch-none-all': {
          'touch-action': 'none',
          '-webkit-user-select': 'none',
          'user-select': 'none',
          '-webkit-touch-callout': 'none',
        },
      })
    }),
  ],
}
