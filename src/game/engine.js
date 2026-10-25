// Slipstream game engine: physics, spawning, collisions and the main loop.
// Rendering lives in render2d.js / render3d.js; this file is framework-agnostic.
// React talks to it through a handful of methods and an `onEvent(name, data)` hook.
//
// Modes:
//   idle      - menu backdrop, orb coasts on the floor
//   tutorial  - scripted onboarding (steps 0-3), collisions disabled
//   playing   - live run
//   over      - crash animation, then emits 'gameover'

import { COLORS } from './constants.js'
import { getWorld } from './worlds.js'
import { Renderer2D } from './render2d.js'
import { Weather } from './weather.js'

export { COLORS }

const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const rand = (a, b) => a + Math.random() * (b - a)

// Physics tuning (px / s, scaled by the layout factor `s` and the world rules).
const G_AIR = 1500
const G_HOLD = 4600 // holding in mid-air dives the orb back to the floor
const LAUNCH_BASE = 620
const LAUNCH_PER_MULT = 22
const BASE_SPEED = 250
const SPEED_PER_MULT = 46
const IDLE_SPEED = 130
const RIDE_RATE = 0.12 // charge per second while riding (full = x10)
const AIR_DECAY = 0.02
const GROUND_DECAY = 0.05
const HOLD_NEEDED = 1.1 // seconds of riding before the tutorial prompts the jump

// Danger levels: every 10,000 points unlocks harder obstacle kinds (and a little more speed).
export const TIER_SCORE = 10000
const TIER_NEW = {
  1: ['RUSHERS + FLOATERS', ['rush', 'float']],
  2: ['BLINK LASERS + HURDLES', ['blink', 'hurdles']],
  3: ['MOVING GATES', ['gate']],
  4: ['PIT COMBOS', ['combo']],
}
const TIER_KINDS = (t) => Object.entries(TIER_NEW).flatMap(([k, [, kinds]]) => (+k <= t ? kinds : []))

const haptic = (p) => {
  try {
    navigator.vibrate?.(p)
  } catch {
    /* ignore */
  }
}

export class Engine {
  constructor(canvases, hooks = {}) {
    this.canvas2d = canvases.c2d
    this.canvas3d = canvases.c3d
    this.host = this.canvas2d.parentElement
    this.hooks = hooks
    this.audio = hooks.audio
    this.holding = false
    this.userPaused = false
    this.clock = 0
    this.mode = 'idle'
    this.playerColor = '#00F5D4'
    this.reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    this.streaks = Array.from({ length: 14 }, () => ({
      x: Math.random(),
      y: Math.random(),
      len: rand(0.05, 0.16),
      v: rand(1.4, 2.6),
    }))

    this.world = getWorld('neon')
    this.rules = this.world.rules
    this.r2d = new Renderer2D(this, this.canvas2d)
    this.weather = new Weather(this, canvases.mul, canvases.fx)
    this.r3d = null
    this.renderer = this.r2d

    this.handleResize = () => this.resize()
    window.addEventListener('resize', this.handleResize)
    this.resize()
    this.toIdle()

    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.handleResize)
    this.audio?.ride(false, 0)
    this.r3d?.dispose()
  }

  emit(name, data) {
    this.hooks.onEvent?.(name, data)
  }

  // ---- worlds --------------------------------------------------------------

  // Switch world (and renderer). 3D worlds load three.js on first use.
  async setWorld(id) {
    const w = getWorld(id)
    if (w.kind === '3d') {
      if (!this.r3d) {
        const { Renderer3D } = await import('./render3d.js')
        this.r3d = new Renderer3D(this, this.canvas3d)
      }
      this.renderer = this.r3d
    } else {
      this.renderer = this.r2d
    }
    this.world = w
    this.rules = w.rules
    this.canvas2d.style.display = w.kind === '3d' ? 'none' : 'block'
    this.canvas3d.style.display = w.kind === '3d' ? 'block' : 'none'
    this.resize()
    this.renderer.setWorld?.(w)
    this.weather.setWorld(w)
  }

  // ---- layout --------------------------------------------------------------

  resize() {
    const w = this.host.clientWidth || window.innerWidth
    const h = this.host.clientHeight || window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.W = w
    this.H = h
    this.dpr = dpr
    this.s = clamp(Math.min(h / 780, w / 390), 0.75, 1.35)
    this.r = 14 * this.s
    this.floorH = 96 * this.s
    this.floorTop = h - this.floorH
    this.orbX = w * 0.26
    this.r2d.resize(w, h, dpr)
    this.r3d?.resize(w, h, dpr)
    this.weather.resize(w, h, dpr)
    this.hooks.onResize?.({ floorTop: this.floorTop, floorH: this.floorH, s: this.s, W: w, H: h })
  }

  get floorY() {
    return this.floorTop - this.r
  }

  get mult() {
    return 1 + 9 * this.charge
  }

  // ---- lifecycle -----------------------------------------------------------

  reset() {
    this.score = 0
    this.charge = 0
    this.vy = 0
    this.spin = 0
    this.grounded = true
    this.y = this.floorY
    this.obstacles = []
    this.particles = []
    this.speed = 0
    this.spawnTimer = 1.6
    this.runTime = 0
    this.lastLevel = 1
    this.tier = 0
    this.overTimer = 0
    this.overSent = false
    this.releaseBuffer = 0
    this.tut = null
    this.hudTimer = 0
    this.rideTimer = 0
    this.trailAcc = 0
    this.bgOffset = 0
    this.shake = 0
    this.flash = 0
    this.gust = { state: 'idle', timer: 4 }
    this.weather?.reset()
  }

  toIdle() {
    this.reset()
    this.mode = 'idle'
    this.holding = false
    this.userPaused = false
    this.speed = IDLE_SPEED * this.s
    this.audio?.ride(false, 0)
    this.audio?.stopMusic(0.5)
    this.pushHud()
  }

  startTutorial() {
    this.reset()
    this.mode = 'tutorial'
    this.holding = false
    this.userPaused = false
    this.tut = { step: 0, hold: 0, t: 0, barrier: null }
    this.speed = BASE_SPEED * this.s
    this.audio?.playMusic(this.world.id)
    this.emit('tutorial-step', 0)
    this.pushHud()
  }

  tutorialNext() {
    if (this.mode === 'tutorial' && this.tut.step === 0) {
      this.tut.step = 1
      this.emit('tutorial-step', 1)
    }
  }

  startRun() {
    this.reset()
    this.mode = 'playing'
    this.holding = false
    this.userPaused = false
    this.speed = BASE_SPEED * this.rules.speed * this.s
    this.audio?.playMusic(this.world.id)
    this.pushHud()
  }

  // Seamless hand-off: the orb keeps its momentum, the score starts fresh.
  finishTutorial() {
    this.mode = 'playing'
    this.tut = null
    this.score = 0
    this.runTime = 0
    this.spawnTimer = 1.5
    this.obstacles = this.obstacles.filter((o) => o.x + o.w > this.orbX)
    this.audio?.chime()
    this.emit('tutorial-complete')
  }

  setPaused(v) {
    this.userPaused = v
    if (v) {
      this.holding = false
      this.audio?.ride(false, 0)
    }
    this.audio?.duckMusic(v)
  }

  // ---- input ---------------------------------------------------------------

  setHold(v) {
    if (this.mode === 'idle' || this.mode === 'over' || this.userPaused) v = false
    if (v === this.holding) return
    this.holding = v
    if (!v) this.onRelease()
  }

  onRelease() {
    if (this.mode === 'tutorial') {
      if (this.tut.step !== 2 || !this.grounded) return
      this.tut.step = 3
      this.tut.t = 0
      this.emit('tutorial-step', 3)
      this.launch()
      return
    }
    if (this.grounded) this.launch()
    else this.releaseBuffer = 0.12 // forgiving: release just before landing still launches
  }

  launchSpeed(m = this.mult) {
    return (LAUNCH_BASE + LAUNCH_PER_MULT * (m - 1)) * this.rules.launch * this.s
  }

  launch() {
    this.vy = -this.launchSpeed()
    this.grounded = false
    this.burstAt(this.orbX, this.floorTop, 14, COLORS.slip, { up: true })
    this.audio?.launch(this.mult)
    haptic(8)
  }

  // ---- simulation ----------------------------------------------------------

  frame = (now) => {
    const dt = Math.min((now - this.last) / 1000, 1 / 30)
    this.last = now
    this.update(dt)
    this.renderer.draw()
    this.weather.draw()
    this.raf = requestAnimationFrame(this.frame)
  }

  update(rawDt) {
    this.clock += rawDt
    if (this.userPaused) return
    const s = this.s
    const tut = this.tut

    // Time scale: the tutorial freezes / slows the world to teach each step.
    let scale = 1
    if (this.mode === 'tutorial') {
      if (tut.step === 0) scale = 0
      else if (tut.step === 1) scale = this.holding ? 1 : 0
      else if (tut.step === 2) {
        scale = 0.12
        const b = tut.barrier
        if (b && b.x - this.orbX < 150 * s) scale = 0 // wait for the player to release
      }
    } else if (this.mode === 'over') scale = 0.25
    const sdt = rawDt * scale
    this.weather.update(rawDt, this.score, this.mode)

    // World speed eases toward the target set by the multiplier.
    let target = 0
    if (this.mode === 'idle') target = IDLE_SPEED * s
    else if (this.mode === 'playing' || this.mode === 'tutorial') {
      target = (BASE_SPEED + SPEED_PER_MULT * (this.mult - 1)) * this.rules.speed * s * (1 + 0.025 * Math.min(this.tier, 8))
    }
    this.speed += (target - this.speed) * Math.min(1, rawDt * 3)

    if (this.mode !== 'over') this.stepOrb(sdt)

    // Scroll the world.
    const dx = this.speed * sdt
    this.bgOffset += dx
    for (const o of this.obstacles) o.x -= dx * (1 + (o.rush || 0))
    this.obstacles = this.obstacles.filter((o) => o.x + o.w > -80)
    for (const st of this.streaks) {
      st.x -= (st.v * dx) / this.W
      if (st.x < -st.len) {
        st.x = 1 + Math.random() * 0.2
        st.y = Math.random()
      }
    }

    if (this.mode === 'playing') {
      this.score += this.speed * sdt * 0.02 * this.mult
      this.updateTier()
      this.runTime += sdt
      this.updateGust(sdt)
      this.spawnTimer -= sdt
      if (this.spawnTimer <= 0) {
        const extra = this.spawn() || 0
        const [a, b] = this.rules.gap
        this.spawnTimer = (rand(a, b) - Math.min(0.25, this.runTime * 0.004)) * Math.max(0.7, 1 - 0.04 * this.tier) + extra
      }
      this.collide()
    } else if (this.mode === 'tutorial') {
      this.updateTutorial(rawDt, sdt)
    } else if (this.mode === 'over') {
      this.overTimer -= rawDt
      if (this.overTimer <= 0 && !this.overSent) {
        this.overSent = true
        this.emit('gameover', { score: Math.floor(this.score) })
      }
    }

    // Trail particles.
    if (this.mode !== 'over' && sdt > 0) {
      this.trailAcc += sdt * 90
      const riding = this.grounded && this.holding
      while (this.trailAcc >= 1) {
        this.trailAcc -= 1
        this.particles.push({
          x: this.orbX - this.r * 0.6,
          y: this.y + rand(-this.r * 0.4, this.r * 0.4),
          vx: -this.speed * 0.6 + rand(-30, 30),
          vy: rand(-25, 25) + this.vy * 0.08,
          g: 0,
          life: rand(0.35, 0.6),
          max: 0.6,
          size: this.r * rand(0.35, 0.6),
          color: riding ? COLORS.slip : this.playerColor,
        })
      }
    }
    this.updateParticles(this.mode === 'over' ? rawDt * 0.6 : sdt)
    this.shake = Math.max(0, this.shake - rawDt * 2.2)
    this.flash = Math.max(0, this.flash - rawDt * 2.5)

    // Looping ride hum, throttled.
    this.rideTimer -= rawDt
    if (this.rideTimer <= 0) {
      this.rideTimer = 0.08
      const on = this.grounded && this.holding && scale > 0 && this.mode !== 'over'
      this.audio?.ride(on, this.speed / (700 * s))
      this.audio?.setMusicIntensity(this.mode === 'playing' ? this.charge : 0.25)
    }

    this.hudTimer -= rawDt
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.08
      this.pushHud()
    }
  }

  pushHud() {
    const progress =
      this.mode === 'tutorial' && this.tut.step === 1 ? clamp(this.tut.hold / HOLD_NEEDED, 0, 1) : 0
    this.emit('hud', {
      score: Math.floor(this.score),
      mult: this.mult,
      charge: this.charge,
      progress,
    })
  }

  updateGust(sdt) {
    if (!this.rules.gusts) return
    const g = this.gust
    g.timer -= sdt
    if (g.timer > 0) return
    if (g.state === 'idle') {
      g.state = 'warn'
      g.timer = 0.9
    } else if (g.state === 'warn') {
      g.state = 'active'
      g.timer = 1.3
    } else {
      g.state = 'idle'
      g.timer = rand(3.5, 6)
    }
  }

  stepOrb(sdt) {
    const s = this.s
    const floorY = this.floorY
    const gm = this.rules.gravity

    if (!this.grounded) {
      let g = (this.holding ? G_HOLD : G_AIR) * gm * s
      if (this.gust.state === 'active' && !this.holding) g -= G_AIR * s * 0.75 // updraft
      this.vy += g * sdt
      this.y += this.vy * sdt
      this.spin += 7 * sdt
      if (this.y < this.r + 2) {
        this.y = this.r + 2
        if (this.vy < 0) this.vy = 0
      }
      if (this.y >= floorY) {
        const impact = this.vy
        this.y = floorY
        this.vy = 0
        this.grounded = true
        this.spin = 0
        this.onLand(impact)
      }
    } else {
      this.y = floorY
    }
    this.releaseBuffer = Math.max(0, this.releaseBuffer - sdt)

    if (this.grounded && this.holding) {
      this.charge += (this.mode === 'tutorial' ? 0.2 : RIDE_RATE) * sdt
    } else if (!this.grounded) {
      this.charge -= AIR_DECAY * sdt
    } else {
      this.charge -= GROUND_DECAY * sdt
    }
    this.charge = clamp(this.charge, 0, 1)

    const level = Math.floor(this.mult)
    if (level > this.lastLevel && this.mode === 'playing') {
      this.audio?.tick(level)
      haptic(6)
      this.emit('level', level)
    }
    this.lastLevel = level
  }

  onLand(impact) {
    const s = this.s
    if (impact > 450 * s) {
      this.audio?.land(clamp(impact / (1200 * s), 0.3, 1))
      this.burstAt(this.orbX, this.floorTop, 8, COLORS.slip, { up: true })
    }
    if (this.releaseBuffer > 0 && !this.holding && this.mode === 'playing') this.launch()
  }

  updateTutorial(rawDt, sdt) {
    const tut = this.tut
    const s = this.s
    if (tut.step === 1) {
      if (this.holding && this.grounded) tut.hold += sdt
      if (tut.hold >= HOLD_NEEDED) {
        tut.step = 2
        this.charge = Math.max(this.charge, 0.15)
        tut.barrier = this.makeObstacle('floor', this.orbX + 330 * s, 58)
        this.obstacles.push(tut.barrier)
        this.audio?.nearMiss()
        this.emit('tutorial-step', 2)
      }
    } else if (tut.step === 3) {
      tut.t += rawDt
      const b = tut.barrier
      const passed = b && b.x + b.w < this.orbX - this.r
      if ((passed && tut.t > 0.5) || tut.t > 4) this.finishTutorial()
    }
  }

  // ---- obstacles -----------------------------------------------------------

  makeObstacle(type, x, heightUnits = 0, width = rand(16, 24) * this.s) {
    return {
      type, // floor | wide | ceil | pit
      x,
      w: width,
      hu: heightUnits,
      passed: false,
      minD: Infinity,
      seed: Math.random() * TAU,
      amp: 0, // oscillation amplitude (px units, scaled), 0 = static
      freq: rand(2, 3.2),
    }
  }

  // Horizontal distance (px) the orb stays above height `hPx` during a launch.
  clearDistance(hPx, m = this.mult) {
    const g = G_AIR * this.rules.gravity * this.s
    const v = this.launchSpeed(m)
    const disc = v * v - 2 * g * hPx
    if (disc <= 0) return 0
    return ((2 * Math.sqrt(disc)) / g) * this.speed
  }

  pickType() {
    const { weights, after } = this.rules
    const entries = Object.entries(weights).filter(([t]) => !after[t] || this.runTime >= after[t])
    let total = entries.reduce((a, [, w]) => a + w, 0)
    let roll = Math.random() * total
    for (const [t, w] of entries) {
      roll -= w
      if (roll <= 0) return t
    }
    return 'floor'
  }

  // Check whether a new danger level was reached and announce what it unlocks.
  updateTier() {
    const t = Math.floor(this.score / TIER_SCORE)
    if (t <= this.tier) return
    this.tier = t
    const info = TIER_NEW[t]
    this.emit('popup', { text: `DANGER LEVEL ${t}${info ? `: ${info[0]}` : ''}` })
    this.audio?.chime()
  }

  // Advanced obstacle kinds for the current danger level. Returns extra seconds to wait
  // before the next spawn (patterns take longer to play out).
  spawnAdvanced(kind, x) {
    const s = this.s
    const m = this.mult
    const air = ((2 * this.launchSpeed(Math.min(m, 3))) / (G_AIR * this.rules.gravity * s)) * this.speed // distance covered by a flat jump
    const hu = () => Math.min(rand(46, 66) + (m - 1) * 2, 88)
    const push = (o) => (this.obstacles.push(o), o)
    switch (kind) {
      case 'rush': {
        // Closes in faster than the world scrolls. Only when nothing else is still ahead (no overlaps).
        if (this.obstacles.some((o) => o.x + o.w > this.orbX)) return this.spawnAdvanced('float', x)
        push(this.makeObstacle('floor', x, hu())).rush = rand(0.45, 0.7)
        return 0
      }
      case 'float':
        push(this.makeObstacle('float', x, rand(34, 50), rand(56, 92) * s))
        return 0
      case 'blink': {
        const o = push(this.makeObstacle('floor', x, rand(62, 84), rand(18, 24) * s))
        o.blink = rand(1.5, 2.1)
        return 0
      }
      case 'hurdles': {
        const gap = air * 1.3
        for (let i = 0; i < 3; i++) push(this.makeObstacle('floor', x + i * gap, rand(44, 56), rand(16, 22) * s))
        return (2 * gap) / Math.max(1, this.speed)
      }
      case 'gate': {
        const o = push(this.makeObstacle('gate', x, 0, rand(20, 26) * s))
        o.freq = rand(1.6, 2.2)
        return 0
      }
      case 'combo': {
        // A lava pit with a wall right after it: land, then jump again.
        const w = clamp(rand(0.35, 0.55) * air, 56 * s, 170 * s)
        push(this.makeObstacle('pit', x, 0, w))
        const d = 0.6 * air + 40 * s
        push(this.makeObstacle('floor', x + w + d, hu(), rand(16, 22) * s))
        return (w + d) / Math.max(1, this.speed)
      }
    }
    return 0
  }

  spawn() {
    const s = this.s
    const m = this.mult
    let type = this.pickType()
    const x = this.W + Math.max(this.speed * this.rules.lead, 120 * s)
    if (this.tier >= 1 && Math.random() < Math.min(0.6, 0.22 + 0.07 * (this.tier - 1))) {
      const kinds = TIER_KINDS(this.tier)
      return this.spawnAdvanced(kinds[Math.floor(Math.random() * kinds.length)], x)
    }
    let hu = 0
    let w
    if (type === 'floor' || type === 'wide') {
      hu = Math.min(rand(44, 70) + (m - 1) * 2.2, 92)
      if (type === 'wide') {
        // A long wall: width limited to what a launch can actually clear.
        const reach = this.clearDistance(hu * s + this.r, Math.min(m, 3)) * 0.6
        if (reach < 90 * s) type = 'floor'
        else w = clamp(rand(0.4, 1) * reach, 56 * s, 130 * s)
      }
    } else if (type === 'pit') {
      const air = ((2 * this.launchSpeed(Math.min(m, 3))) / (G_AIR * this.rules.gravity * this.s)) * this.speed
      w = clamp(rand(0.35, 0.62) * air, 56 * s, 210 * s)
    }
    const o = this.makeObstacle(type, x, hu, w)
    if ((type === 'floor' || type === 'ceil') && Math.random() < this.rules.moving) o.amp = rand(8, 16)
    this.obstacles.push(o)
    return 0
  }

  // 0..1 height of a blinking laser: it ramps up before it turns on and drops after.
  blinkK(o) {
    const P = o.blink
    const u = ((this.clock + (o.seed * P) / TAU) % P) / P
    if (u < 0.5) return 1
    if (u < 0.58) return 1 - 0.9 * ((u - 0.5) / 0.08)
    if (u < 0.8) return 0.1
    return 0.1 + 0.9 * ((u - 0.8) / 0.2)
  }

  // Gap height of a moving gate, raised by `k` (0..1) of its travel.
  gateK(o) {
    return 0.5 + 0.5 * Math.sin(this.clock * o.freq + o.seed)
  }

  rectOf(o) {
    const s = this.s
    const osc = o.amp ? o.amp * s * Math.sin(this.clock * o.freq + o.seed) : 0
    if (o.type === 'floor' || o.type === 'wide') {
      const h = o.hu * s * (o.blink ? this.blinkK(o) : 1) + osc
      return { x: o.x, y: this.floorTop - h, w: o.w, h }
    }
    if (o.type === 'pit') return { x: o.x, y: this.floorTop, w: o.w, h: this.floorH }
    if (o.type === 'float' || o.type === 'gate') {
      return { x: o.x, y: 0, w: o.w, h: this.floorTop }
    }
    // Ceiling barrier: the grounded orb just fits underneath; jumping hits it.
    const bottom = this.floorTop - this.r * 2 - 24 * s - osc
    return { x: o.x, y: 0, w: o.w, h: bottom }
  }

  // Every solid rectangle of an obstacle (floaters and gates have a different shape).
  rectsOf(o) {
    const s = this.s
    if (o.type === 'float') {
      const under = this.floorTop - this.r * 2 - 24 * s // underside: the grounded orb just fits beneath
      const h = o.hu * s
      return [{ x: o.x, y: under - h, w: o.w, h }]
    }
    if (o.type === 'gate') {
      const gap = this.r * 2 + 54 * s
      const lift = 70 * s * this.gateK(o) // how far the gap has risen off the floor
      const gapBottom = this.floorTop - lift
      return [
        { x: o.x, y: 0, w: o.w, h: gapBottom - gap },
        { x: o.x, y: gapBottom, w: o.w, h: lift },
      ]
    }
    return [this.rectOf(o)]
  }

  collide() {
    const cx = this.orbX
    const cy = this.y
    const r = this.r
    for (const o of this.obstacles) {
      if (o.type === 'pit') {
        const rc = this.rectOf(o)
        // Falling in: on (or skimming) the floor while over the gap.
        if (cy >= this.floorY - r * 0.35 && cx > rc.x + r * 0.3 && cx < rc.x + rc.w - r * 0.3) {
          this.crash(o)
          return
        }
      } else if (!(o.blink && this.blinkK(o) < 0.55)) {
        let d = Infinity
        for (const rc of this.rectsOf(o)) {
          if (rc.h <= 0) continue
          const nx = clamp(cx, rc.x, rc.x + rc.w)
          const ny = clamp(cy, rc.y, rc.y + rc.h)
          d = Math.min(d, Math.hypot(cx - nx, cy - ny))
        }
        if (Math.abs(o.x + o.w / 2 - cx) < o.w / 2 + r * 3) o.minD = Math.min(o.minD, d - r)
        if (d < r * 0.82) {
          this.crash(o)
          return
        }
      }
      if (!o.passed && o.x + o.w < cx - r) {
        o.passed = true
        this.onPass(o)
      }
    }
  }

  onPass(o) {
    const m = this.mult
    if (o.minD < 11 * this.s) {
      const bonus = Math.round(25 * m)
      this.score += bonus
      this.charge = Math.min(1, this.charge + 0.06)
      this.emit('popup', { text: `NEAR MISS +${bonus}` })
      this.audio?.nearMiss()
      haptic(10)
    } else {
      this.score += Math.round((o.type === 'pit' ? 14 : 10) * m)
      this.charge = Math.min(1, this.charge + 0.04)
    }
  }

  crash(o) {
    this.killer = o?.type
    this.mode = 'over'
    this.holding = false
    this.overTimer = 0.9
    this.shake = 1
    this.flash = 1
    this.burstAt(this.orbX, this.y, 46, this.playerColor, { speed: 420 })
    this.burstAt(this.orbX, this.y, 18, '#ffffff', { speed: 300 })
    this.audio?.crash()
    this.audio?.ride(false, 0)
    this.audio?.stopMusic(1.6)
    haptic([30, 40, 60])
    this.emit('crashed')
  }

  burstAt(x, y, n, color, { up = false, speed = 240 } = {}) {
    const s = this.s
    for (let i = 0; i < n; i++) {
      const a = up ? rand(-Math.PI * 0.95, -Math.PI * 0.05) : rand(0, TAU)
      const v = rand(0.3, 1) * speed * s
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v - this.speed * 0.3,
        vy: Math.sin(a) * v,
        g: up ? 900 * s : 300 * s,
        life: rand(0.35, 0.8),
        max: 0.8,
        size: rand(1.5, 4) * s,
        color,
      })
    }
    if (this.particles.length > 500) this.particles.splice(0, this.particles.length - 500)
  }

  updateParticles(dt) {
    if (dt <= 0) return
    for (const p of this.particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += p.g * dt
      p.life -= dt
    }
    this.particles = this.particles.filter((p) => p.life > 0)
  }
}
