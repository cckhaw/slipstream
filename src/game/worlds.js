// World definitions. `rules` are the per-world challenges consumed by the engine;
// `theme` selects the 2D / 3D art; `avatar` is how the player is drawn in that world.

const BASE_RULES = {
  gravity: 1, // multiplies air + dive gravity
  launch: 1, // multiplies launch impulse
  speed: 1, // multiplies world speed
  weights: { floor: 0.66, ceil: 0.34 }, // obstacle mix
  after: { ceil: 10, pit: 3, wide: 6 }, // seconds into a run before a type can appear
  moving: 0, // chance a floor/ceiling barrier oscillates
  gusts: false, // periodic updrafts (floaty airtime)
  gap: [1.3, 2.1], // seconds between obstacles
  lead: 0.55, // spawn distance in seconds of travel beyond the screen edge
}

const make = (w) => ({ ...w, rules: { ...BASE_RULES, ...w.rules, after: { ...BASE_RULES.after, ...w.rules?.after } } })

export const WORLDS = [
  make({
    id: 'neon',
    name: 'Neon Conduit',
    kind: '2d',
    theme: 'neon',
    avatar: 'orb',
    accent: '#00F5D4',
    difficulty: 1,
    challenge: 'The original. Gold floor lasers and red ceiling lasers: stack your multiplier.',
    rules: {},
  }),
  make({
    id: 'quarry',
    name: 'Pixel Quarry',
    kind: '2d',
    theme: 'quarry',
    avatar: 'cube',
    accent: '#6EE35A',
    difficulty: 2,
    challenge: 'Lava pits! Stay airborne over the gaps and clear the TNT stacks.',
    rules: {
      speed: 1.05,
      weights: { floor: 0.3, wide: 0.15, pit: 0.45, ceil: 0.1 },
    },
  }),
  make({
    id: 'ship',
    name: 'Starship Drift',
    kind: '2d',
    theme: 'ship',
    avatar: 'blob',
    accent: '#FF5FBF',
    difficulty: 3,
    challenge: 'Low gravity and air-jet gusts. Floaty jumps, tricky landings, lots of ceiling pipes.',
    rules: {
      gravity: 0.62,
      launch: 0.8,
      gusts: true,
      weights: { floor: 0.35, ceil: 0.4, pit: 0.15, wide: 0.1 },
      after: { ceil: 6 },
    },
  }),
  make({
    id: 'voxel',
    name: 'Voxel Valley',
    kind: '3d',
    theme: 'voxel',
    avatar: 'cube',
    accent: '#7BD34F',
    difficulty: 3,
    challenge: 'Heavy gravity, long block walls and lava rivers. Big launches, no second chances.',
    rules: {
      gravity: 1.25,
      launch: 1.12,
      speed: 1.05,
      weights: { floor: 0.3, wide: 0.3, pit: 0.3, ceil: 0.1 },
      lead: 1.5,
    },
  }),
  make({
    id: 'obby',
    name: 'Obby Rush',
    kind: '3d',
    theme: 'obby',
    avatar: 'blob',
    accent: '#FFC83D',
    difficulty: 4,
    challenge: 'Fast and fiendish. Bricks pulse up and down, so time your launch.',
    rules: {
      speed: 1.3,
      moving: 0.6,
      weights: { floor: 0.5, ceil: 0.2, wide: 0.3 },
      lead: 1.5,
    },
  }),
  make({
    id: 'grid',
    name: 'Neon Void',
    kind: '3d',
    theme: 'grid',
    avatar: 'orb',
    accent: '#B14CFF',
    difficulty: 5,
    challenge: 'Everything at once: ceilings, pits, walls and moving lasers at high speed.',
    rules: {
      gravity: 1.1,
      speed: 1.18,
      moving: 0.35,
      weights: { floor: 0.25, ceil: 0.25, pit: 0.25, wide: 0.25 },
      after: { ceil: 6, pit: 4, wide: 5 },
      lead: 1.5,
    },
  }),
]

export const getWorld = (id) => WORLDS.find((w) => w.id === id) ?? WORLDS[0]
