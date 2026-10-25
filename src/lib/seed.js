// Run seeds: every run has a short ID such as "V7K3F9". The first letter is the world
// (N Neon Conduit, Q Pixel Quarry, S Starship Drift, V Voxel Valley, O Obby Rush, G Neon
// Void), the rest is random, so one seed in a link is enough to reproduce a world's course.
// The same seed gives the same obstacle order and the same turns on the 3D track.

const LETTER = { neon: 'N', quarry: 'Q', ship: 'S', voxel: 'V', obby: 'O', grid: 'G' }
const WORLD = Object.fromEntries(Object.entries(LETTER).map(([id, l]) => [l, id]))
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I lookalikes

export function newSeed(worldId) {
  const bytes = new Uint8Array(5)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes)
  else for (let i = 0; i < 5; i++) bytes[i] = Math.floor(Math.random() * 256)
  return (LETTER[worldId] ?? 'N') + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

// "v7k3f9" -> { seed: 'V7K3F9', worldId: 'voxel' }, or null when it is not a valid seed.
export function parseSeed(raw) {
  const seed = String(raw ?? '').trim().toUpperCase()
  if (!/^[NQSVOG][A-HJ-NP-Z2-9]{5}$/.test(seed)) return null
  return { seed, worldId: WORLD[seed[0]] }
}

export function seedFromUrl(search = globalThis.location?.search ?? '') {
  return parseSeed(new URLSearchParams(search).get('seed'))
}

// Small fast PRNG (mulberry32) seeded from a string plus a salt, so each stream of random
// numbers (one per spawned obstacle, the track, the gusts) is independent of the others.
export function rngFromSeed(seed, salt = '') {
  let h = 1779033703 ^ `${seed}|${salt}`.length
  for (const ch of `${seed}|${salt}`) {
    h = Math.imul(h ^ ch.charCodeAt(0), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
