import plugin from 'tailwindcss/plugin'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: { DEFAULT: '#0A0D14', 800: '#111623', 700: '#1A2030' },
        orb: { DEFAULT: '#00F5D4', dim: '#00B8A0' },
        slip: { DEFAULT: '#FF2D55', dim: '#C9203F' },
        gold: '#FF9500',
        danger: '#FF3B30',
        label: {
          DEFAULT: 'rgba(255,255,255,0.96)',
          secondary: 'rgba(235,235,245,0.62)',
          tertiary: 'rgba(235,235,245,0.34)',
        },
      },
      fontFamily: {
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
