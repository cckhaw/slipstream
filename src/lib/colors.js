// Player colours (picked on the profile screen).
export const PLAYER_COLORS = [
  { id: 'red', hex: '#E5383B', label: 'Red' },
  { id: 'orange', hex: '#FF8A1F', label: 'Orange' },
  { id: 'yellow', hex: '#FFD93D', label: 'Yellow' },
  { id: 'lime', hex: '#6EE35A', label: 'Lime' },
  { id: 'green', hex: '#1FA34A', label: 'Green' },
  { id: 'cyan', hex: '#00F5D4', label: 'Cyan' },
  { id: 'blue', hex: '#3D6BFF', label: 'Blue' },
  { id: 'purple', hex: '#8B5CF6', label: 'Purple' },
  { id: 'pink', hex: '#FF5FBF', label: 'Pink' },
  { id: 'white', hex: '#E6EDF7', label: 'White' },
]

export const DEFAULT_COLOR = PLAYER_COLORS[5].hex

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v) => {
    const t = amt < 0 ? 0 : 255
    const p = Math.abs(amt)
    return Math.round((t - v) * p + v)
  }
  const r = ch((n >> 16) & 255)
  const g = ch((n >> 8) & 255)
  const b = ch(n & 255)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}
