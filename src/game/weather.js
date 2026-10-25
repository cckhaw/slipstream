// Weather and time of day for every world, 2D and 3D.
//
// As the score climbs through a few thresholds the sky moves to the next condition in the
// world's cycle (day -> cloudy -> rain -> dusk -> night -> storm ...), easing between them.
// It is renderer-agnostic: a CSS `multiply` layer tints / darkens whatever is below it and
// a transparent canvas on top draws stars, clouds, rain, snow, fog, wind and lightning.
// Weather is visual and audio only; it never changes the physics or the obstacles.

const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const rand = (a, b) => a + Math.random() * (b - a)
const lerp = (a, b, t) => a + (b - a) * t

// Score at which each phase begins; after the list a new phase starts every STEP points.
export const THRESHOLDS = [0, 800, 2000, 3600, 5600, 8000, 11000]
const STEP = 3000

export function phaseAt(score) {
  let p = 0
  while (p + 1 < THRESHOLDS.length && score >= THRESHOLDS[p + 1]) p++
  if (p === THRESHOLDS.length - 1) p += Math.floor((score - THRESHOLDS[p]) / STEP)
  return p
}

// `tint` multiplies the scene (white = no change). The rest are 0..1 amounts.
export const CONDITIONS = {
  clear: { tint: [255, 255, 255], cloud: 0, rain: 0, snow: 0, fog: 0, wind: 0, bolt: 0, stars: 0 },
  day: { tint: [255, 255, 255], cloud: 0.1, rain: 0, snow: 0, fog: 0, wind: 0, bolt: 0, stars: 0 },
  dusk: { tint: [255, 168, 120], cloud: 0.25, rain: 0, snow: 0, fog: 0, wind: 0, bolt: 0, stars: 0.15 },
  night: { tint: [74, 88, 158], cloud: 0.1, rain: 0, snow: 0, fog: 0, wind: 0, bolt: 0, stars: 1 },
  cloudy: { tint: [196, 204, 216], cloud: 1, rain: 0, snow: 0, fog: 0, wind: 0.1, bolt: 0, stars: 0 },
  rain: { tint: [148, 164, 190], cloud: 0.9, rain: 0.6, snow: 0, fog: 0.1, wind: 0.15, bolt: 0, stars: 0 },
  storm: { tint: [88, 100, 134], cloud: 1, rain: 1, snow: 0, fog: 0.1, wind: 0.6, bolt: 1, stars: 0 },
  windy: { tint: [238, 238, 228], cloud: 0.35, rain: 0, snow: 0, fog: 0, wind: 1, bolt: 0, stars: 0 },
  fog: { tint: [210, 216, 226], cloud: 0.2, rain: 0, snow: 0, fog: 1, wind: 0, bolt: 0, stars: 0 },
  snow: { tint: [222, 230, 246], cloud: 0.6, rain: 0, snow: 1, fog: 0.25, wind: 0.1, bolt: 0, stars: 0 },
}
const KEYS = ['cloud', 'rain', 'snow', 'fog', 'wind', 'bolt', 'stars']

const LABELS = {
  clear: ['Clear skies', '✨'],
  day: ['Sunny day', '☀️'],
  dusk: ['Sunset', '🌇'],
  night: ['Night falls', '🌙'],
  cloudy: ['Cloudy', '☁️'],
  rain: ['Rain', '🌧️'],
  storm: ['Thunderstorm', '⛈️'],
  windy: ['Windy', '💨'],
  fog: ['Fog', '🌫️'],
  snow: ['Snowfall', '❄️'],
}

// Per-world cycle plus a little skin (names, colours, how strongly the scene is tinted:
// the neon / space worlds are already dark, so day-night tints are softened there).
const SKINS = {
  neon: {
    cycle: ['clear', 'fog', 'rain', 'windy', 'dusk', 'storm', 'night', 'cloudy'],
    dim: 0.6,
    rain: 'rgba(0,245,212,0.55)',
    wind: 'rgba(255,45,200,0.5)',
    fog: [190, 120, 255],
    names: { fog: ['Data mist', '🌫️'], rain: ['Acid rain', '🌧️'], windy: ['Static wind', '💨'], dusk: ['Synth sunset', '🌇'], storm: ['Thunder grid', '⛈️'], night: ['Blackout', '🌙'], cloudy: ['Smog', '☁️'] },
  },
  quarry: {
    cycle: ['day', 'cloudy', 'windy', 'rain', 'dusk', 'night', 'snow', 'storm', 'fog'],
    dim: 1,
    rain: 'rgba(190,225,255,0.6)',
    wind: 'rgba(255,255,255,0.4)',
    fog: [225, 228, 232],
    names: { windy: ['Dust wind', '💨'], storm: ['Thunderstorm', '⛈️'] },
  },
  ship: {
    cycle: ['clear', 'rain', 'windy', 'cloudy', 'snow', 'storm', 'fog', 'night'],
    dim: 0.55,
    rain: 'rgba(255,170,90,0.75)',
    wind: 'rgba(180,220,255,0.5)',
    fog: [170, 110, 240],
    meteor: true,
    names: { rain: ['Meteor shower', '☄️'], windy: ['Solar wind', '💨'], cloudy: ['Nebula cloud', '☁️'], snow: ['Stardust', '✨'], storm: ['Ion storm', '⚡'], fog: ['Gas cloud', '🌫️'], night: ['Eclipse', '🌑'] },
  },
  voxel: {
    cycle: ['day', 'cloudy', 'windy', 'rain', 'dusk', 'night', 'snow', 'storm', 'fog'],
    dim: 1,
    rain: 'rgba(190,225,255,0.6)',
    wind: 'rgba(255,255,255,0.45)',
    fog: [226, 230, 234],
    names: {},
  },
  obby: {
    cycle: ['day', 'windy', 'dusk', 'cloudy', 'rain', 'night', 'storm', 'snow', 'fog'],
    dim: 1,
    rain: 'rgba(200,230,255,0.6)',
    wind: 'rgba(255,230,120,0.5)',
    fog: [230, 226, 240],
    names: { storm: ['Big storm', '⛈️'], windy: ['Gusty', '💨'] },
  },
  grid: {
    cycle: ['clear', 'fog', 'rain', 'windy', 'storm', 'snow', 'night', 'dusk'],
    dim: 0.6,
    rain: 'rgba(0,245,212,0.55)',
    wind: 'rgba(255,45,200,0.5)',
    fog: [160, 100, 255],
    names: { fog: ['Haze', '🌫️'], rain: ['Pixel rain', '🌧️'], snow: ['Data flurry', '❄️'], storm: ['Overload', '⚡'], windy: ['Static wind', '💨'], night: ['Blackout', '🌙'], dusk: ['Neon dusk', '🌇'] },
  },
}

const N_RAIN = 150
const N_SNOW = 90
const N_WIND = 22
const N_LEAF = 14
const N_STARS = 70
const N_CLOUD = 8

export class Weather {
  // mul: a div with mix-blend-mode: multiply; fx: a transparent canvas above the game.
  constructor(engine, mul, fx) {
    this.e = engine
    this.mul = mul
    this.fx = fx
    this.ctx = fx?.getContext('2d') ?? null
    this.skin = SKINS.neon
    this.phase = 0
    this.id = 'clear'
    this.cur = this.target(CONDITIONS.clear)
    this.flash = 0
    this.bolt = null
    this.nextBolt = 3
    this.idle = true
    this.t = 0
    this.dt = 0
    const pt = () => ({ x: Math.random(), y: Math.random(), z: Math.random() })
    this.rain = Array.from({ length: N_RAIN }, pt)
    this.snow = Array.from({ length: N_SNOW }, () => ({ ...pt(), p: rand(0, TAU) }))
    this.streaks = Array.from({ length: N_WIND }, () => ({ ...pt(), len: rand(0.12, 0.35) }))
    this.leaves = Array.from({ length: N_LEAF }, () => ({ ...pt(), p: rand(0, TAU) }))
    this.stars = Array.from({ length: N_STARS }, () => ({ x: Math.random(), y: Math.random(), r: rand(0.5, 1.6), p: rand(0, TAU) }))
    this.clouds = Array.from({ length: N_CLOUD }, (_, i) => ({ x: i / N_CLOUD + rand(-0.05, 0.05), y: rand(0.02, 0.3), s: rand(0.7, 1.4), v: rand(0.6, 1.2) }))
  }

  // Full-strength parameter set for a condition, softened for dark worlds.
  target(c) {
    const dim = this.skin.dim
    return { r: lerp(255, c.tint[0], dim), g: lerp(255, c.tint[1], dim), b: lerp(255, c.tint[2], dim), ...Object.fromEntries(KEYS.map((k) => [k, c[k]])) }
  }

  setWorld(world) {
    this.skin = SKINS[world.id] ?? SKINS.neon
    this.reset()
  }

  reset() {
    this.phase = 0
    this.id = this.skin.cycle[0]
    this.goal = this.target(CONDITIONS[this.id])
    this.cur = { ...this.goal }
    this.flash = 0
    this.bolt = null
    this.nextBolt = rand(2, 5)
    this.audioOff()
    this.apply()
  }

  condition(phase) {
    const { cycle } = this.skin
    // From the second lap on, shift the start so the order is not identical each time.
    return cycle[(phase + Math.floor(phase / cycle.length)) % cycle.length]
  }

  label(id) {
    return this.skin.names[id] ?? LABELS[id]
  }

  // dt in real seconds. The score only counts in a live run; the sky holds still on the
  // game-over screen and eases back to clear skies in menus and the tutorial.
  update(dt, score, mode) {
    const live = mode === 'playing'
    this.dt = dt
    this.t += dt
    if (live) {
      const phase = phaseAt(score)
      if (phase !== this.phase) {
        this.phase = phase
        this.id = this.condition(phase)
        this.goal = this.target(CONDITIONS[this.id])
        const [label, icon] = this.label(this.id)
        this.e.emit('weather', { id: this.id, label, icon })
      }
    } else if (mode !== 'over' && this.phase !== 0) {
      this.phase = 0
      this.id = this.skin.cycle[0]
      this.goal = this.target(CONDITIONS[this.id])
    }
    const k = 1 - Math.exp(-dt / 1.3) // about four seconds to settle
    const c = this.cur
    const g = this.goal
    for (const key of ['r', 'g', 'b', ...KEYS]) c[key] += (g[key] - c[key]) * k

    // Lightning.
    if (c.bolt > 0.3 && live) {
      this.nextBolt -= dt
      if (this.nextBolt <= 0) {
        this.nextBolt = rand(2.5, 7)
        this.strike()
      }
    }
    this.flash = Math.max(0, this.flash - dt * 2.8)
    if (this.bolt && (this.bolt.life -= dt) <= 0) this.bolt = null

    this.e.audio?.ambience(c.rain, c.wind)
    this.apply()
  }

  strike() {
    const e = this.e
    if (!e.reduceMotion) {
      this.flash = 1
      const pts = [[rand(0.15, 0.85), -0.02]]
      const bottom = e.world.kind === '3d' ? 0.5 : (e.floorTop / e.H) * 0.95
      while (pts[pts.length - 1][1] < bottom) {
        const [x, y] = pts[pts.length - 1]
        pts.push([x + rand(-0.06, 0.06), y + rand(0.05, 0.1)])
      }
      this.bolt = { pts, life: 0.14 }
    }
    e.audio?.thunder()
  }

  audioOff() {
    this.e.audio?.ambience(0, 0)
  }

  // Push the tint to the multiply layer.
  apply() {
    const { mul, cur: c } = this
    if (!mul) return
    const white = c.r > 253 && c.g > 253 && c.b > 253
    mul.style.opacity = white ? '0' : '1'
    if (!white) mul.style.backgroundColor = `rgb(${c.r | 0},${c.g | 0},${c.b | 0})`
  }

  // ---- drawing -------------------------------------------------------------

  draw() {
    const { ctx, e, cur: c } = this
    if (!ctx) return
    const calm = c.cloud < 0.01 && c.rain < 0.01 && c.snow < 0.01 && c.fog < 0.01 && c.wind < 0.01 && c.stars < 0.01 && this.flash <= 0
    if (calm) {
      if (!this.idle) ctx.clearRect(0, 0, this.fx.width, this.fx.height)
      this.idle = true
      return
    }
    this.idle = false
    const W = e.W
    const H = e.H
    const s = e.s
    ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const horizon = e.world.kind === '3d' ? H * 0.44 : e.floorTop * 0.92
    // Scenery drifts by at a fraction of the game speed, or a gentle default in menus.
    const drift = Math.max(0.05, e.speed / (900 * s)) * (e.userPaused ? 0 : 1)
    const dt = e.userPaused ? 0 : this.dt
    const white = [c.r / 255, c.g / 255, c.b / 255]
    const shade = (rgb, a) => `rgba(${(rgb[0] * white[0]) | 0},${(rgb[1] * white[1]) | 0},${(rgb[2] * white[2]) | 0},${a})`

    if (c.stars > 0.02) this.drawStars(W, horizon, s)
    if (c.cloud > 0.02) this.drawClouds(W, H, s, drift, dt, shade, c)
    if (c.fog > 0.02) this.drawFog(W, H, horizon, drift, dt, shade, c)
    if (c.rain > 0.02) this.drawRain(W, H, s, dt, c)
    if (c.snow > 0.02) this.drawSnow(W, H, s, dt, c)
    if (c.wind > 0.05) this.drawWind(W, H, s, dt, c)
    if (this.bolt) this.drawBolt(W, H, s)
    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(235,240,255,${this.flash * 0.5})`
      ctx.fillRect(0, 0, W, H)
    }
  }

  drawStars(W, horizon, s) {
    const { ctx, cur: c, t } = this
    for (const st of this.stars) {
      const y = st.y * horizon * 0.95
      ctx.fillStyle = `rgba(255,255,255,${c.stars * (0.45 + 0.4 * Math.sin(t * 1.6 + st.p))})`
      ctx.fillRect(st.x * W, y, st.r * s, st.r * s)
    }
    if (c.stars > 0.5) {
      const x = W * 0.8
      const y = horizon * 0.22
      const r = 20 * s
      ctx.fillStyle = `rgba(255,248,205,${c.stars * 0.9})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, TAU)
      ctx.fill()
      ctx.fillStyle = `rgba(210,200,160,${c.stars * 0.6})`
      for (const [dx, dy, rr] of [[-0.35, -0.2, 0.22], [0.25, 0.25, 0.3], [0.3, -0.35, 0.14]]) {
        ctx.beginPath()
        ctx.arc(x + dx * r, y + dy * r, rr * r, 0, TAU)
        ctx.fill()
      }
    }
  }

  drawClouds(W, H, s, drift, dt, shade, c) {
    const { ctx } = this
    const a = clamp(c.cloud, 0, 1) * 0.6
    ctx.fillStyle = shade([236, 240, 246], a)
    for (const cl of this.clouds) {
      cl.x -= (drift * 0.06 + 0.004 * (1 + c.wind * 3)) * cl.v * dt * 4
      if (cl.x < -0.3) cl.x += 1.6
      const x = cl.x * W
      const y = cl.y * H
      const w = 120 * s * cl.s
      ctx.beginPath()
      ctx.ellipse(x, y, w * 0.5, w * 0.17, 0, 0, TAU)
      ctx.ellipse(x - w * 0.25, y + w * 0.04, w * 0.3, w * 0.13, 0, 0, TAU)
      ctx.ellipse(x + w * 0.28, y + w * 0.05, w * 0.32, w * 0.12, 0, 0, TAU)
      ctx.ellipse(x + w * 0.02, y - w * 0.1, w * 0.26, w * 0.13, 0, 0, TAU)
      ctx.fill()
    }
  }

  drawFog(W, H, horizon, drift, dt, shade, c) {
    const { ctx, t } = this
    const f = this.skin.fog
    const a = clamp(c.fog, 0, 1)
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, shade(f, 0.15 * a))
    g.addColorStop(clamp(horizon / H, 0.2, 0.9), shade(f, 0.5 * a))
    g.addColorStop(1, shade(f, 0.28 * a))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    // Slow banks of mist.
    ctx.fillStyle = shade(f, 0.14 * a)
    for (let i = 0; i < 4; i++) {
      const x = (((i * 0.31 - t * (0.01 + drift * 0.05)) % 1.4) + 1.4) % 1.4 - 0.2
      ctx.beginPath()
      ctx.ellipse(x * W, horizon + (i - 1.5) * 0.06 * H, W * 0.35, H * 0.07, 0, 0, TAU)
      ctx.fill()
    }
  }

  drawRain(W, H, s, dt, c) {
    const { ctx } = this
    const n = Math.round(N_RAIN * clamp(c.rain, 0, 1))
    const meteor = this.skin.meteor
    const slant = (0.22 + c.wind * 0.5) * (meteor ? 1.6 : 1)
    const fall = (meteor ? 1.5 : 1.15) * (0.8 + 0.5 * c.rain)
    const len = (meteor ? 46 : 26) * s
    ctx.strokeStyle = this.skin.rain
    ctx.lineWidth = (meteor ? 2.6 : 1.5) * s
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const d = this.rain[i]
      d.y += fall * (0.7 + d.z * 0.6) * dt * 1.6
      d.x -= slant * (0.7 + d.z * 0.6) * dt * 1.6 * (H / W)
      if (d.y > 1.05) {
        d.y = -0.05
        d.x = Math.random() * 1.3
      }
      if (d.x < -0.1) d.x += 1.2
      const x = d.x * W
      const y = d.y * H
      const l = len * (0.6 + d.z * 0.6)
      ctx.moveTo(x, y)
      ctx.lineTo(x + slant * l * 0.5, y - l)
    }
    ctx.stroke()
  }

  drawSnow(W, H, s, dt, c) {
    const { ctx, t } = this
    const n = Math.round(N_SNOW * clamp(c.snow, 0, 1))
    ctx.fillStyle = `rgba(255,255,255,${0.85 * clamp(c.snow * 1.2, 0, 1)})`
    for (let i = 0; i < n; i++) {
      const f = this.snow[i]
      f.y += (0.1 + f.z * 0.16) * dt * 1.6
      f.x += (-0.04 - c.wind * 0.1 + Math.sin(t * 1.3 + f.p) * 0.02) * dt * 1.6
      if (f.y > 1.03) {
        f.y = -0.03
        f.x = Math.random() * 1.2
      }
      if (f.x < -0.05) f.x += 1.1
      const r = (1.2 + f.z * 2.2) * s
      ctx.beginPath()
      ctx.arc(f.x * W, f.y * H, r, 0, TAU)
      ctx.fill()
    }
  }

  drawWind(W, H, s, dt, c) {
    const { ctx } = this
    const k = clamp(c.wind, 0, 1)
    ctx.strokeStyle = this.skin.wind
    ctx.lineWidth = 1.6 * s
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (const st of this.streaks) {
      st.x -= (0.9 + st.z * 0.8) * (0.4 + k) * dt * 1.6
      if (st.x < -st.len) {
        st.x = 1 + Math.random() * 0.3
        st.y = Math.random()
      }
      const x = st.x * W
      const y = st.y * H
      ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x + st.len * W * 0.5, y - 6 * s, x + st.len * W, y)
    }
    ctx.globalAlpha = k
    ctx.stroke()
    ctx.globalAlpha = 1
    // Leaves / dust tumbling past.
    const n = Math.round(N_LEAF * k)
    ctx.fillStyle = this.skin.wind
    for (let i = 0; i < n; i++) {
      const l = this.leaves[i]
      l.p += dt * 6
      l.x -= (0.5 + l.z * 0.6) * (0.5 + k) * dt * 1.6
      l.y += Math.sin(l.p * 0.5) * dt * 0.12
      if (l.x < -0.05) {
        l.x = 1.05
        l.y = Math.random()
      }
      ctx.save()
      ctx.translate(l.x * W, l.y * H)
      ctx.rotate(l.p)
      ctx.fillRect(-3 * s, -1.5 * s, 6 * s, 3 * s)
      ctx.restore()
    }
  }

  drawBolt(W, H, s) {
    const { ctx, bolt } = this
    ctx.strokeStyle = 'rgba(245,248,255,0.95)'
    ctx.lineWidth = 3 * s
    ctx.lineJoin = 'round'
    ctx.shadowColor = '#BFD4FF'
    ctx.shadowBlur = 16 * s
    ctx.beginPath()
    bolt.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)))
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  resize(w, h, dpr) {
    if (!this.fx) return
    this.fx.width = Math.round(w * dpr)
    this.fx.height = Math.round(h * dpr)
    this.idle = false
  }
}
