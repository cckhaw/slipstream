// Slipstream game engine: physics, spawning, collisions and Canvas rendering.
// Framework-agnostic. React talks to it through a handful of methods and an
// `onEvent(name, data)` hook.
//
// Modes:
//   idle      - menu backdrop, orb coasts on the floor
//   tutorial  - scripted onboarding (steps 0-3), collisions disabled
//   playing   - live run
//   over      - crash animation, then emits 'gameover'

export const COLORS = {
  bg: '#0A0D14',
  orb: '#00F5D4',
  slip: '#FF2D55',
  gold: '#FF9500',
  danger: '#FF3B30',
}

const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const rand = (a, b) => a + Math.random() * (b - a)

// Physics tuning (px / s, scaled by the layout factor `s`).
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

const haptic = (p) => {
  try {
    navigator.vibrate?.(p)
  } catch {
    /* ignore */
  }
}

export class Engine {
  constructor(canvas, hooks = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.hooks = hooks
    this.audio = hooks.audio
    this.holding = false
    this.userPaused = false
    this.clock = 0
    this.mode = 'idle'
    this.reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    this.streaks = Array.from({ length: 14 }, () => ({
      x: Math.random(),
      y: Math.random(),
      len: rand(0.05, 0.16),
      v: rand(1.4, 2.6),
    }))

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
  }

  emit(name, data) {
    this.hooks.onEvent?.(name, data)
  }

  // ---- layout --------------------------------------------------------------

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.W = w
    this.H = h
    this.dpr = dpr
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.s = clamp(Math.min(h / 780, w / 390), 0.75, 1.35)
    this.r = 14 * this.s
    this.floorH = 96 * this.s
    this.floorTop = h - this.floorH
    this.orbX = w * 0.26
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
    this.grounded = true
    this.y = this.floorY
    this.obstacles = []
    this.particles = []
    this.popups = []
    this.speed = 0
    this.spawnTimer = 1.6
    this.runTime = 0
    this.lastLevel = 1
    this.lastType = null
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
  }

  toIdle() {
    this.reset()
    this.mode = 'idle'
    this.holding = false
    this.userPaused = false
    this.speed = IDLE_SPEED * this.s
    this.audio?.ride(false, 0)
    this.pushHud()
  }

  startTutorial() {
    this.reset()
    this.mode = 'tutorial'
    this.holding = false
    this.userPaused = false
    this.tut = { step: 0, hold: 0, t: 0, barrier: null }
    this.speed = BASE_SPEED * this.s
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
    this.speed = BASE_SPEED * this.s
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

  launch() {
    const m = this.mult
    this.vy = -(LAUNCH_BASE + LAUNCH_PER_MULT * (m - 1)) * this.s
    this.grounded = false
    this.burstAt(this.orbX, this.floorTop, 14, COLORS.slip, { up: true })
    this.audio?.launch(m)
    haptic(8)
  }

  // ---- simulation ----------------------------------------------------------

  frame = (now) => {
    const dt = Math.min((now - this.last) / 1000, 1 / 30)
    this.last = now
    this.update(dt)
    this.draw()
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

    // World speed eases toward the target set by the multiplier.
    let target = 0
    if (this.mode === 'idle') target = IDLE_SPEED * s
    else if (this.mode === 'playing' || this.mode === 'tutorial') {
      target = (BASE_SPEED + SPEED_PER_MULT * (this.mult - 1)) * s
    }
    this.speed += (target - this.speed) * Math.min(1, rawDt * 3)

    if (this.mode !== 'over') this.stepOrb(sdt)

    // Scroll the world.
    const dx = this.speed * sdt
    this.bgOffset += dx
    for (const o of this.obstacles) o.x -= dx
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
      this.runTime += sdt
      this.spawnTimer -= sdt
      if (this.spawnTimer <= 0) {
        this.spawn()
        this.spawnTimer = rand(1.3, 2.1) - Math.min(0.25, this.runTime * 0.004)
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
          color: riding ? COLORS.slip : COLORS.orb,
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

  stepOrb(sdt) {
    const s = this.s
    const floorY = this.floorY

    if (!this.grounded) {
      this.vy += (this.holding ? G_HOLD : G_AIR) * s * sdt
      this.y += this.vy * sdt
      if (this.y < this.r + 2) {
        this.y = this.r + 2
        if (this.vy < 0) this.vy = 0
      }
      if (this.y >= floorY) {
        const impact = this.vy
        this.y = floorY
        this.vy = 0
        this.grounded = true
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

  makeObstacle(type, x, heightUnits = 0) {
    return {
      type,
      x,
      w: rand(16, 24) * this.s,
      hu: heightUnits,
      passed: false,
      minD: Infinity,
      seed: Math.random() * TAU,
    }
  }

  spawn() {
    const m = this.mult
    const ceilOK = this.runTime > 10
    const type = ceilOK && Math.random() < 0.34 ? 'ceil' : 'floor'
    const hu = type === 'floor' ? Math.min(rand(44, 70) + (m - 1) * 2.2, 92) : 0
    const x = this.W + Math.max(this.speed * 0.55, 120 * this.s)
    this.obstacles.push(this.makeObstacle(type, x, hu))
    this.lastType = type
  }

  rectOf(o) {
    if (o.type === 'floor') {
      const h = o.hu * this.s
      return { x: o.x, y: this.floorTop - h, w: o.w, h }
    }
    // Ceiling barrier: the grounded orb just fits underneath; jumping hits it.
    const bottom = this.floorTop - this.r * 2 - 24 * this.s
    return { x: o.x, y: 0, w: o.w, h: bottom }
  }

  collide() {
    const cx = this.orbX
    const cy = this.y
    const r = this.r
    for (const o of this.obstacles) {
      const rc = this.rectOf(o)
      const nx = clamp(cx, rc.x, rc.x + rc.w)
      const ny = clamp(cy, rc.y, rc.y + rc.h)
      const d = Math.hypot(cx - nx, cy - ny)
      if (Math.abs(rc.x + rc.w / 2 - cx) < rc.w / 2 + r * 3) o.minD = Math.min(o.minD, d - r)
      if (d < r * 0.82) {
        this.crash()
        return
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
      this.popups.push({ x: this.orbX + 24 * this.s, y: this.y - 26 * this.s, text: `NEAR MISS +${bonus}`, life: 1, color: COLORS.gold })
      this.audio?.nearMiss()
      haptic(10)
    } else {
      this.score += Math.round(10 * m)
      this.charge = Math.min(1, this.charge + 0.04)
    }
  }

  crash() {
    this.mode = 'over'
    this.holding = false
    this.overTimer = 0.9
    this.shake = 1
    this.flash = 1
    this.burstAt(this.orbX, this.y, 46, COLORS.orb, { speed: 420 })
    this.burstAt(this.orbX, this.y, 18, '#ffffff', { speed: 300 })
    this.audio?.crash()
    this.audio?.ride(false, 0)
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
    for (const q of this.popups) {
      q.y -= 40 * this.s * dt
      q.life -= dt
    }
    this.popups = this.popups.filter((q) => q.life > 0)
  }

  // ---- rendering -----------------------------------------------------------

  draw() {
    const { ctx, W, H, dpr } = this
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.save()
    if (this.shake > 0 && !this.reduceMotion) {
      const a = this.shake * 10 * this.s
      ctx.translate(rand(-a, a), rand(-a, a))
    }
    this.drawBackground()
    this.drawStreaks()
    this.drawFloor()
    for (const o of this.obstacles) this.drawObstacle(o)
    this.drawParticles()
    if (this.mode !== 'over') this.drawOrb()
    this.drawPopups()
    ctx.restore()

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.35})`
      ctx.fillRect(0, 0, W, H)
    }
  }

  drawBackground() {
    const { ctx, W, H, s } = this
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(-30, -30, W + 60, H + 60)

    const top = ctx.createRadialGradient(W * 0.5, -H * 0.1, 0, W * 0.5, -H * 0.1, H * 0.8)
    top.addColorStop(0, 'rgba(0,245,212,0.07)')
    top.addColorStop(1, 'rgba(0,245,212,0)')
    ctx.fillStyle = top
    ctx.fillRect(-30, -30, W + 60, H + 60)

    // Two parallax grid layers.
    const layers = [
      { cell: 140 * s, par: 0.18, alpha: 0.035 },
      { cell: 56 * s, par: 0.4, alpha: 0.055 },
    ]
    ctx.lineWidth = 1
    for (const L of layers) {
      ctx.strokeStyle = `rgba(255,255,255,${L.alpha})`
      ctx.beginPath()
      const off = (this.bgOffset * L.par) % L.cell
      for (let x = -off; x < W + L.cell; x += L.cell) {
        ctx.moveTo(Math.round(x) + 0.5, 0)
        ctx.lineTo(Math.round(x) + 0.5, this.floorTop)
      }
      for (let y = this.floorTop; y > -L.cell; y -= L.cell) {
        ctx.moveTo(0, Math.round(y) + 0.5)
        ctx.lineTo(W, Math.round(y) + 0.5)
      }
      ctx.stroke()
    }
  }

  drawStreaks() {
    const { ctx, W, s } = this
    const k = clamp((this.mult - 1) / 9, 0, 1)
    if (k < 0.05) return
    ctx.lineCap = 'round'
    ctx.lineWidth = 2 * s
    for (const st of this.streaks) {
      const x = st.x * W
      const y = st.y * (this.floorTop - 20 * s) + 10 * s
      ctx.strokeStyle = `rgba(0,245,212,${0.28 * k})`
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + st.len * W * (0.5 + k), y)
      ctx.stroke()
    }
  }

  drawFloor() {
    const { ctx, W, H, s } = this
    const top = this.floorTop
    const riding = this.grounded && this.holding && this.mode !== 'over'
    const k = clamp(this.charge, 0, 1)
    const glow = 0.5 + 0.5 * k + (riding ? 0.2 : 0)

    const g = ctx.createLinearGradient(0, top, 0, H)
    g.addColorStop(0, `rgba(255,45,85,${0.5 * Math.min(1, glow)})`)
    g.addColorStop(1, 'rgba(255,45,85,0.06)')
    ctx.fillStyle = g
    ctx.fillRect(-30, top, W + 60, this.floorH + 30)

    ctx.save()
    ctx.shadowColor = COLORS.slip
    ctx.shadowBlur = (10 + 14 * k) * s
    ctx.strokeStyle = COLORS.slip
    ctx.lineWidth = 2.5 * s
    ctx.beginPath()
    ctx.moveTo(-30, top)
    ctx.lineTo(W + 30, top)
    ctx.stroke()
    ctx.restore()

    // Directional chevrons ("boost pad") streaming past the orb.
    const size = 13 * s
    const gap = 64 * s
    const off = this.bgOffset % gap
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (let row = 0; row < 2; row++) {
      const cy = top + this.floorH * (row === 0 ? 0.36 : 0.7)
      ctx.lineWidth = (row === 0 ? 3.2 : 2.2) * s
      ctx.strokeStyle = `rgba(255,255,255,${(row === 0 ? 0.5 : 0.22) * (0.6 + 0.4 * glow)})`
      ctx.beginPath()
      for (let x = -off - gap * (row ? 0.5 : 0); x < W + gap; x += gap) {
        ctx.moveTo(x, cy - size)
        ctx.lineTo(x + size, cy)
        ctx.lineTo(x, cy + size)
      }
      ctx.stroke()
    }

    if (riding) {
      const rg = ctx.createRadialGradient(this.orbX, top, 0, this.orbX, top, this.r * 5)
      rg.addColorStop(0, 'rgba(255,45,85,0.55)')
      rg.addColorStop(1, 'rgba(255,45,85,0)')
      ctx.fillStyle = rg
      ctx.fillRect(this.orbX - this.r * 5, top - this.r * 5, this.r * 10, this.r * 10)
    }
  }

  drawObstacle(o) {
    const { ctx, s, W } = this
    const rc = this.rectOf(o)
    const col = o.type === 'floor' ? COLORS.gold : COLORS.danger
    const pulse = 0.75 + 0.25 * Math.sin(this.clock * 14 + o.seed)
    const cx = rc.x + rc.w / 2

    ctx.save()
    ctx.shadowColor = col
    ctx.shadowBlur = 18 * s
    ctx.globalAlpha = 0.5 * pulse + 0.2
    ctx.fillStyle = col
    ctx.fillRect(rc.x, rc.y, rc.w, rc.h)
    ctx.globalAlpha = 1
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(cx - 1.5 * s, rc.y, 3 * s, rc.h)
    // Emitter nodes at both ends of the beam.
    const nodeY = o.type === 'floor' ? rc.y : rc.y + rc.h
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.arc(cx, nodeY, rc.w * 0.75, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(cx, nodeY, rc.w * 0.28, 0, TAU)
    ctx.fill()
    ctx.restore()

    // Off-screen warning marker at the right edge.
    if (o.x > W - 4) {
      const y = o.type === 'floor' ? rc.y + rc.h / 2 : rc.h / 2
      const sz = 15 * s * (0.9 + 0.2 * Math.sin(this.clock * 12))
      const x = W - 26 * s
      ctx.save()
      ctx.fillStyle = col
      ctx.globalAlpha = 0.95
      ctx.lineJoin = 'round'
      ctx.lineWidth = 4 * s
      ctx.strokeStyle = col
      ctx.beginPath()
      ctx.moveTo(x, y - sz)
      ctx.lineTo(x + sz * 0.95, y + sz * 0.7)
      ctx.lineTo(x - sz * 0.95, y + sz * 0.7)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = COLORS.bg
      ctx.font = `800 ${Math.round(sz * 1.1)}px -apple-system, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('!', x, y + sz * 0.25)
      ctx.restore()
    }
  }

  drawParticles() {
    const { ctx } = this
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const p of this.particles) {
      const a = clamp(p.life / p.max, 0, 1)
      ctx.globalAlpha = a * 0.9
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, Math.max(0.5, p.size * (0.4 + 0.6 * a)), 0, TAU)
      ctx.fill()
    }
    ctx.restore()
  }

  drawOrb() {
    const { ctx, r, s } = this
    const x = this.orbX
    const riding = this.grounded && this.holding
    const stretch = clamp(Math.abs(this.vy) / (900 * s), 0, 0.35)
    let sx = 1 - stretch * 0.45
    let sy = 1 + stretch
    if (riding) {
      sx = 1.22
      sy = 0.8
    }
    const y = this.y + r * (1 - sy) // keep the bottom of the orb anchored while squashed

    const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4)
    halo.addColorStop(0, 'rgba(0,245,212,0.5)')
    halo.addColorStop(1, 'rgba(0,245,212,0)')
    ctx.fillStyle = halo
    ctx.fillRect(x - r * 3.4, y - r * 3.4, r * 6.8, r * 6.8)

    ctx.save()
    ctx.translate(x, y)
    ctx.scale(sx, sy)
    const body = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r)
    body.addColorStop(0, '#E8FFFB')
    body.addColorStop(0.45, COLORS.orb)
    body.addColorStop(1, '#00A896')
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, TAU)
    ctx.fill()
    ctx.restore()

    // Multiplier charge ring.
    if (this.charge > 0.01) {
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineWidth = 3 * s
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'
      ctx.beginPath()
      ctx.arc(x, this.y, r * 1.75, 0, TAU)
      ctx.stroke()
      ctx.strokeStyle = COLORS.slip
      ctx.shadowColor = COLORS.slip
      ctx.shadowBlur = 8 * s
      ctx.beginPath()
      ctx.arc(x, this.y, r * 1.75, -Math.PI / 2, -Math.PI / 2 + TAU * this.charge)
      ctx.stroke()
      ctx.restore()
    }
  }

  drawPopups() {
    const { ctx, s } = this
    ctx.save()
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = `700 ${Math.round(14 * s)}px -apple-system, system-ui, sans-serif`
    for (const q of this.popups) {
      ctx.globalAlpha = clamp(q.life * 1.5, 0, 1)
      ctx.fillStyle = q.color
      ctx.fillText(q.text, q.x, q.y)
    }
    ctx.restore()
  }
}
