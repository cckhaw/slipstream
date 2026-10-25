// Canvas 2D renderer with one theme per 2D world (neon, quarry, ship) and
// three player avatars (orb, cube head, and the "Zip" comet-blob mascot).
import { COLORS } from './constants.js'
import { shade } from '../lib/colors.js'

const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const INK = COLORS.ink

const hash = (n) => {
  n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  n ^= n >>> 13
  n = Math.imul(n, 0xc2b2ae35)
  n ^= n >>> 16
  return (n >>> 0) / 4294967296
}

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Pixel-style bevelled block.
function block(ctx, x, y, w, h, base) {
  const t = Math.max(2, Math.min(w, h) * 0.14)
  ctx.fillStyle = base
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = shade(base, 0.28)
  ctx.fillRect(x, y, w, t)
  ctx.fillRect(x, y, t, h)
  ctx.fillStyle = shade(base, -0.3)
  ctx.fillRect(x, y + h - t, w, t)
  ctx.fillRect(x + w - t, y, t, h)
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
}

export class Renderer2D {
  constructor(engine, canvas) {
    this.e = engine
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.3 + 0.4, a: Math.random() * 0.6 + 0.3 }))
  }

  resize(w, h, dpr) {
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
  }

  setWorld() {}

  // ---- frame ---------------------------------------------------------------

  draw() {
    const e = this.e
    const { ctx } = this
    ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0)
    ctx.save()
    if (e.shake > 0 && !e.reduceMotion) {
      const a = e.shake * 10 * e.s
      ctx.translate((Math.random() * 2 - 1) * a, (Math.random() * 2 - 1) * a)
    }
    const K = { neon: 'Neon', quarry: 'Quarry', ship: 'Ship' }[e.world.theme] ?? 'Neon'
    this[`bg${K}`]()
    this.drawStreaks()
    this[`floor${K}`]()
    for (const o of e.obstacles) if (o.type === 'pit') this[`pit${K}`](o, e.rectOf(o))
    for (const o of e.obstacles) {
      if (o.type === 'pit') continue
      if (o.type === 'float' || o.type === 'gate') this.obsAdv(o)
      else this[`obs${K}`](o, e.rectOf(o))
      if (o.rush) this.rushTrail(o)
      if (o.blink) this.blinkGhost(o)
    }
    this.drawGust()
    this.drawParticles()
    if (e.mode !== 'over') this.drawAvatar()
    ctx.restore()

    if (e.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${e.flash * 0.35})`
      ctx.fillRect(0, 0, e.W, e.H)
    }
  }

  // ---- advanced obstacles (danger levels) ---------------------------------

  // Floaters and moving gates: hazard-purple slabs with a glowing edge, in every theme.
  obsAdv(o) {
    const e = this.e
    const { ctx } = this
    const s = e.s
    const base = { neon: '#B14CFF', quarry: '#5B3A8C', ship: '#7C5CFF' }[e.world.theme] ?? '#B14CFF'
    const rects = e.rectsOf(o)
    ctx.save()
    ctx.shadowColor = '#E0B3FF'
    ctx.shadowBlur = 12 * s
    for (const rc of rects) {
      if (rc.h <= 0.5) continue
      block(ctx, rc.x, rc.y, rc.w, rc.h, base)
    }
    ctx.restore()
    // Hazard stripes on the edges that matter, plus the gate's guide arrows.
    ctx.fillStyle = '#FFD93D'
    for (const rc of rects) {
      if (rc.h <= 0.5) continue
      const edgeY = o.type === 'gate' && rc === rects[0] ? rc.y + rc.h - 5 * s : o.type === 'gate' ? rc.y : rc.y + rc.h - 5 * s
      for (let x = rc.x; x < rc.x + rc.w; x += 8 * s) ctx.fillRect(x, edgeY, 4 * s, 5 * s)
    }
  }

  // Streak lines behind an obstacle that is closing in faster than the world scrolls.
  rushTrail(o) {
    const e = this.e
    const { ctx } = this
    const rc = e.rectOf(o)
    ctx.save()
    ctx.strokeStyle = 'rgba(255,140,40,0.75)'
    ctx.lineWidth = 3 * e.s
    ctx.lineCap = 'round'
    for (let i = 0; i < 4; i++) {
      const y = rc.y + (rc.h * (i + 0.5)) / 4
      const len = (40 + 24 * ((i * 7 + Math.floor(e.clock * 20)) % 3)) * e.s
      ctx.beginPath()
      ctx.moveTo(rc.x + rc.w + 4 * e.s, y)
      ctx.lineTo(rc.x + rc.w + 4 * e.s + len, y)
      ctx.stroke()
    }
    ctx.restore()
  }

  // Dashed outline of a blinking laser at full height, so you can see where it will rise.
  blinkGhost(o) {
    const e = this.e
    const { ctx } = this
    const h = o.hu * e.s
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.setLineDash([6 * e.s, 5 * e.s])
    ctx.lineWidth = 2 * e.s
    ctx.strokeRect(o.x, e.floorTop - h, o.w, h)
    ctx.restore()
  }

  // ---- shared pieces -------------------------------------------------------

  drawStreaks() {
    const e = this.e
    const { ctx } = this
    const k = clamp((e.mult - 1) / 9, 0, 1)
    if (k < 0.05) return
    ctx.lineCap = 'round'
    ctx.lineWidth = 2 * e.s
    for (const st of e.streaks) {
      const x = st.x * e.W
      const y = st.y * (e.floorTop - 20 * e.s) + 10 * e.s
      ctx.strokeStyle = e.world.theme === 'quarry' ? `rgba(255,255,255,${0.35 * k})` : `rgba(0,245,212,${0.28 * k})`
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + st.len * e.W * (0.5 + k), y)
      ctx.stroke()
    }
  }

  // The pink Slipstream lane: glowing edge + chevrons streaming past.
  lane(top, h, rows) {
    const e = this.e
    const { ctx } = this
    const s = e.s
    const riding = e.grounded && e.holding && e.mode !== 'over'
    const k = clamp(e.charge, 0, 1)
    const glow = 0.5 + 0.5 * k + (riding ? 0.2 : 0)

    const g = ctx.createLinearGradient(0, top, 0, top + h)
    g.addColorStop(0, `rgba(255,45,85,${0.55 * Math.min(1, glow)})`)
    g.addColorStop(1, 'rgba(255,45,85,0.1)')
    ctx.fillStyle = g
    ctx.fillRect(-30, top, e.W + 60, h + 2)

    ctx.save()
    ctx.shadowColor = COLORS.slip
    ctx.shadowBlur = (10 + 14 * k) * s
    ctx.strokeStyle = COLORS.slip
    ctx.lineWidth = 2.5 * s
    ctx.beginPath()
    ctx.moveTo(-30, top)
    ctx.lineTo(e.W + 30, top)
    ctx.stroke()
    ctx.restore()

    const size = Math.min(13 * s, h * 0.3)
    const gap = 64 * s
    const off = e.bgOffset % gap
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (let row = 0; row < rows; row++) {
      const cy = top + h * (rows === 1 ? 0.5 : row === 0 ? 0.36 : 0.7)
      ctx.lineWidth = (row === 0 ? 3.2 : 2.2) * s
      ctx.strokeStyle = `rgba(255,255,255,${(row === 0 ? 0.55 : 0.22) * (0.6 + 0.4 * glow)})`
      ctx.beginPath()
      for (let x = -off - gap * (row ? 0.5 : 0); x < e.W + gap; x += gap) {
        ctx.moveTo(x, cy - size)
        ctx.lineTo(x + size, cy)
        ctx.lineTo(x, cy + size)
      }
      ctx.stroke()
    }

    if (riding) {
      const rg = ctx.createRadialGradient(e.orbX, top, 0, e.orbX, top, e.r * 5)
      rg.addColorStop(0, 'rgba(255,45,85,0.55)')
      rg.addColorStop(1, 'rgba(255,45,85,0)')
      ctx.fillStyle = rg
      ctx.fillRect(e.orbX - e.r * 5, top - e.r * 5, e.r * 10, e.r * 10)
    }
  }

  drawGust() {
    const e = this.e
    const { ctx } = this
    const g = e.gust
    if (!e.rules.gusts || e.mode === 'over' || g.state === 'idle') return
    const active = g.state === 'active'
    const a = active ? 0.35 : 0.14 + 0.1 * Math.sin(e.clock * 18)
    ctx.save()
    ctx.strokeStyle = `rgba(160,225,255,${a})`
    ctx.lineWidth = 3 * e.s
    ctx.lineCap = 'round'
    const cols = 9
    for (let i = 0; i < cols; i++) {
      const x = ((i + 0.5) / cols) * e.W
      const phase = (e.clock * (active ? 1.6 : 0.4) + i * 0.37) % 1
      const y = e.floorTop - phase * e.floorTop * 0.9
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, y - 34 * e.s)
      ctx.stroke()
    }
    ctx.restore()
  }

  drawParticles() {
    const { ctx } = this
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const p of this.e.particles) {
      const a = clamp(p.life / p.max, 0, 1)
      ctx.globalAlpha = a * 0.9
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, Math.max(0.5, p.size * (0.4 + 0.6 * a)), 0, TAU)
      ctx.fill()
    }
    ctx.restore()
  }

  // ---- avatar --------------------------------------------------------------

  drawAvatar() {
    const e = this.e
    const { ctx } = this
    const { r, s } = e
    const kind = e.world.avatar
    const x = e.orbX
    const riding = e.grounded && e.holding
    const stretch = clamp(Math.abs(e.vy) / (900 * s), 0, 0.35)
    let sx = 1 - stretch * 0.45
    let sy = 1 + stretch
    if (riding) {
      sx = 1.22
      sy = 0.8
    }
    const y = e.y + r * (1 - sy)

    if (kind === 'orb') {
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4)
      halo.addColorStop(0, 'rgba(0,245,212,0.5)')
      halo.addColorStop(1, 'rgba(0,245,212,0)')
      ctx.fillStyle = halo
      ctx.fillRect(x - r * 3.4, y - r * 3.4, r * 6.8, r * 6.8)
    } else {
      // Contact shadow so jump height is readable on bright worlds.
      const h = clamp((e.floorY - e.y) / (160 * s), 0, 1)
      ctx.fillStyle = `rgba(0,0,0,${0.3 * (1 - h * 0.7)})`
      ctx.beginPath()
      ctx.ellipse(x, e.floorTop + 2 * s, r * (1.1 - h * 0.4), r * 0.28, 0, 0, TAU)
      ctx.fill()
    }

    ctx.save()
    ctx.translate(x, y)
    ctx.scale(sx, sy)
    if (kind === 'orb') this.avatarOrb()
    else if (kind === 'cube') {
      ctx.rotate(e.grounded ? 0 : e.spin)
      this.avatarCube()
    } else {
      ctx.rotate(clamp(e.vy / (900 * s), -1, 1) * 0.3) // nose up while rising
      this.avatarBlob()
    }
    ctx.restore()

    // Multiplier charge ring.
    if (e.charge > 0.01) {
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineWidth = 3 * s
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'
      ctx.beginPath()
      ctx.arc(x, e.y, r * 1.85, 0, TAU)
      ctx.stroke()
      ctx.strokeStyle = COLORS.slip
      ctx.shadowColor = COLORS.slip
      ctx.shadowBlur = 8 * s
      ctx.beginPath()
      ctx.arc(x, e.y, r * 1.85, -Math.PI / 2, -Math.PI / 2 + TAU * e.charge)
      ctx.stroke()
      ctx.restore()
    }
  }

  avatarOrb() {
    const { ctx } = this
    const { r } = this.e
    const c = this.e.playerColor
    const body = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r)
    body.addColorStop(0, '#F4FFFD')
    body.addColorStop(0.45, c)
    body.addColorStop(1, shade(c, -0.35))
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, TAU)
    ctx.fill()
  }

  avatarCube() {
    const { ctx } = this
    const e = this.e
    const R = e.r
    const c = e.playerColor
    ctx.fillStyle = INK
    ctx.fillRect(-R - 2.5, -R - 2.5, R * 2 + 5, R * 2 + 5)
    block(ctx, -R, -R, R * 2, R * 2, c)
    // Blocky face looking right.
    const ew = R * 0.4
    for (const ex of [R * 0.0, R * 0.55]) {
      ctx.fillStyle = '#fff'
      ctx.fillRect(ex - ew * 0.2, -R * 0.35, ew, ew * 1.1)
      ctx.fillStyle = INK
      ctx.fillRect(ex + ew * 0.3, -R * 0.2, ew * 0.55, ew * 0.8)
    }
  }

  // Zip: round body, swoosh tail, glowing antenna, big eyes.
  avatarBlob() {
    const { ctx } = this
    const R = this.e.r
    const c = this.e.playerColor
    ctx.lineWidth = Math.max(2, R * 0.2)
    ctx.strokeStyle = INK
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    // Tail.
    ctx.beginPath()
    ctx.moveTo(-R * 0.75, -R * 0.35)
    ctx.lineTo(-R * 1.9, -R * 0.95)
    ctx.quadraticCurveTo(-R * 1.4, 0, -R * 1.9, R * 0.95)
    ctx.lineTo(-R * 0.75, R * 0.35)
    ctx.closePath()
    ctx.fillStyle = shade(c, -0.3)
    ctx.fill()
    ctx.stroke()
    // Antenna.
    ctx.beginPath()
    ctx.moveTo(R * 0.2, -R * 0.9)
    ctx.lineTo(R * 0.5, -R * 1.5)
    ctx.stroke()
    ctx.fillStyle = '#FFE27A'
    ctx.beginPath()
    ctx.arc(R * 0.55, -R * 1.58, R * 0.24, 0, TAU)
    ctx.fill()
    ctx.stroke()
    // Body.
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.arc(0, 0, R, 0, TAU)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.38)'
    ctx.beginPath()
    ctx.ellipse(-R * 0.4, -R * 0.45, R * 0.2, R * 0.36, 0.6, 0, TAU)
    ctx.fill()
    // Eyes.
    for (const ex of [R * 0.12, R * 0.62]) {
      ctx.fillStyle = '#fff'
      ctx.lineWidth = Math.max(1.5, R * 0.12)
      ctx.beginPath()
      ctx.ellipse(ex, -R * 0.12, R * 0.26, R * 0.34, 0, 0, TAU)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = INK
      ctx.beginPath()
      ctx.arc(ex + R * 0.08, -R * 0.08, R * 0.15, 0, TAU)
      ctx.fill()
    }
    // Smile.
    ctx.lineWidth = Math.max(1.5, R * 0.12)
    ctx.beginPath()
    ctx.arc(R * 0.37, R * 0.25, R * 0.25, 0.25, Math.PI - 0.25)
    ctx.stroke()
  }

  // ==== NEON CONDUIT ========================================================

  bgNeon() {
    const e = this.e
    const { ctx } = this
    const { W, H, s } = e
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(-30, -30, W + 60, H + 60)
    const top = ctx.createRadialGradient(W * 0.5, -H * 0.1, 0, W * 0.5, -H * 0.1, H * 0.8)
    top.addColorStop(0, 'rgba(0,245,212,0.07)')
    top.addColorStop(1, 'rgba(0,245,212,0)')
    ctx.fillStyle = top
    ctx.fillRect(-30, -30, W + 60, H + 60)

    const layers = [
      { cell: 140 * s, par: 0.18, alpha: 0.035 },
      { cell: 56 * s, par: 0.4, alpha: 0.055 },
    ]
    ctx.lineWidth = 1
    for (const L of layers) {
      ctx.strokeStyle = `rgba(255,255,255,${L.alpha})`
      ctx.beginPath()
      const off = (e.bgOffset * L.par) % L.cell
      for (let x = -off; x < W + L.cell; x += L.cell) {
        ctx.moveTo(Math.round(x) + 0.5, 0)
        ctx.lineTo(Math.round(x) + 0.5, e.floorTop)
      }
      for (let y = e.floorTop; y > -L.cell; y -= L.cell) {
        ctx.moveTo(0, Math.round(y) + 0.5)
        ctx.lineTo(W, Math.round(y) + 0.5)
      }
      ctx.stroke()
    }
  }

  floorNeon() {
    this.lane(this.e.floorTop, this.e.floorH, 2)
  }

  obsNeon(o, rc) {
    const e = this.e
    const { ctx } = this
    const s = e.s
    const col = o.type === 'ceil' ? COLORS.danger : COLORS.gold
    const pulse = 0.75 + 0.25 * Math.sin(e.clock * 14 + o.seed)
    const cx = rc.x + rc.w / 2

    ctx.save()
    ctx.shadowColor = col
    ctx.shadowBlur = 18 * s
    ctx.globalAlpha = 0.5 * pulse + 0.2
    ctx.fillStyle = col
    ctx.fillRect(rc.x, rc.y, rc.w, rc.h)
    ctx.globalAlpha = 1
    ctx.fillStyle = '#ffffff'
    if (o.type === 'wide') ctx.fillRect(rc.x + 2, rc.y, rc.w - 4, 3 * s)
    else ctx.fillRect(cx - 1.5 * s, rc.y, 3 * s, rc.h)
    const nodeY = o.type === 'ceil' ? rc.y + rc.h : rc.y
    const nodes = o.type === 'wide' ? [rc.x + 4 * s, rc.x + rc.w - 4 * s] : [cx]
    for (const nx of nodes) {
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.arc(nx, nodeY, 10 * s, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(nx, nodeY, 4 * s, 0, TAU)
      ctx.fill()
    }
    ctx.restore()
    this.warning(o, rc, col)
  }

  pitNeon(o, rc) {
    this.voidPit(rc, '#05070C', COLORS.slip)
  }

  // Off-screen warning marker at the right edge (2D worlds).
  warning(o, rc, col) {
    const e = this.e
    const { ctx } = this
    const s = e.s
    if (o.x <= e.W - 4) return
    const y = o.type === 'ceil' ? rc.h / 2 : o.type === 'pit' ? e.floorTop + 24 * s : rc.y + rc.h / 2
    const sz = 15 * s * (0.9 + 0.2 * Math.sin(e.clock * 12))
    const x = e.W - 26 * s
    ctx.save()
    ctx.fillStyle = col
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
    ctx.fillStyle = INK
    ctx.font = `800 ${Math.round(sz * 1.1)}px -apple-system, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('!', x, y + sz * 0.25)
    ctx.restore()
  }

  voidPit(rc, fill, edge) {
    const e = this.e
    const { ctx } = this
    ctx.fillStyle = fill
    ctx.fillRect(rc.x, e.floorTop - 3, rc.w, e.floorH + 40)
    ctx.save()
    ctx.shadowColor = edge
    ctx.shadowBlur = 12 * e.s
    ctx.fillStyle = edge
    ctx.fillRect(rc.x - 2 * e.s, e.floorTop - 3, 3 * e.s, e.floorH + 40)
    ctx.fillRect(rc.x + rc.w - 1 * e.s, e.floorTop - 3, 3 * e.s, e.floorH + 40)
    ctx.restore()
  }

  // ==== PIXEL QUARRY ========================================================

  bgQuarry() {
    const e = this.e
    const { ctx } = this
    const { W, H, s } = e
    const sky = ctx.createLinearGradient(0, 0, 0, e.floorTop)
    sky.addColorStop(0, '#5BB8F5')
    sky.addColorStop(1, '#BFE9FF')
    ctx.fillStyle = sky
    ctx.fillRect(-30, -30, W + 60, H + 60)

    // Square sun.
    const sun = 48 * s
    ctx.fillStyle = 'rgba(255,240,150,0.35)'
    ctx.fillRect(W * 0.78 - sun, H * 0.1 - sun * 0.2, sun * 2, sun * 2)
    ctx.fillStyle = '#FFF3A0'
    ctx.fillRect(W * 0.78 - sun * 0.5, H * 0.1 + sun * 0.3, sun, sun)

    // Blocky clouds.
    const span = 760 * s
    const coff = (e.bgOffset * 0.08) % span
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    for (let k = -1; k < W / span + 2; k++) {
      for (const [cx, cy, w] of [[80, 90, 120], [420, 150, 160], [620, 70, 100]]) {
        const x = k * span + cx * s - coff
        const y = cy * s
        ctx.fillRect(x, y, w * s, 22 * s)
        ctx.fillRect(x + 18 * s, y - 16 * s, (w - 40) * s, 18 * s)
      }
    }

    // Stepped hill silhouettes, two parallax layers.
    const layers = [
      { par: 0.14, col: '#58A85C', base: 120 },
      { par: 0.3, col: '#3E8E48', base: 70 },
    ]
    const B = 44 * s
    for (const L of layers) {
      ctx.fillStyle = L.col
      const first = Math.floor((e.bgOffset * L.par) / B)
      const off = (e.bgOffset * L.par) % B
      for (let i = 0; i < W / B + 2; i++) {
        const hgt = (L.base + Math.floor(hash(first + i + L.base) * 4) * 26) * s
        ctx.fillRect(i * B - off, e.floorTop - hgt, B + 1, hgt)
      }
    }
  }

  floorQuarry() {
    const e = this.e
    const { ctx } = this
    const s = e.s
    const laneH = 30 * s
    const top = e.floorTop
    const B = 32 * s
    const first = Math.floor(e.bgOffset / B)
    const off = e.bgOffset % B
    const rows = Math.ceil((e.floorH - laneH) / B)
    const dirt = ['#8B5A2B', '#7A4E25', '#9A6633', '#6E4421']
    const stone = ['#8A8A8A', '#767676', '#9C9C9C']
    for (let i = 0; i < e.W / B + 2; i++) {
      for (let j = 0; j < rows; j++) {
        const h = hash((first + i) * 31 + j * 7)
        const pal = j >= 1 && h > 0.55 ? stone : dirt
        block(ctx, i * B - off, top + laneH + j * B, B, B, pal[Math.floor(hash((first + i) * 13 + j) * pal.length)])
      }
    }
    this.lane(top, laneH, 1)
  }

  obsQuarry(o, rc) {
    const e = this.e
    const { ctx } = this
    const s = e.s
    if (o.type === 'ceil') {
      const bs = 26 * s
      const cols = Math.max(1, Math.round(rc.w / bs))
      const cw = rc.w / cols
      const rowsN = Math.max(1, Math.ceil(rc.h / bs))
      for (let r = 0; r < rowsN; r++) {
        const y = r * bs
        const h = Math.min(bs, rc.h - y)
        const last = r === rowsN - 1
        for (let c = 0; c < cols; c++) {
          const pal = ['#7D7D7D', '#8E8E8E', '#6B6B6B']
          block(ctx, rc.x + c * cw, y, cw, h, last ? '#2A1A3D' : pal[Math.floor(hash(r * 9 + c + (o.seed * 100 | 0)) * 3)])
        }
      }
      // Lava drip.
      ctx.fillStyle = '#FF7A00'
      ctx.fillRect(rc.x + rc.w * 0.4, rc.h, rc.w * 0.2, 8 * s * (0.6 + 0.4 * Math.sin(e.clock * 5 + o.seed)))
    } else {
      const bs = 26 * s
      const rowsN = Math.max(1, Math.round(rc.h / bs))
      const bh = rc.h / rowsN
      const cols = Math.max(1, Math.round(rc.w / bs))
      const cw = rc.w / cols
      for (let r = 0; r < rowsN; r++) {
        for (let c = 0; c < cols; c++) {
          const x = rc.x + c * cw
          const y = rc.y + r * bh
          if (o.type === 'wide') {
            const pal = ['#7D7D7D', '#8E8E8E', '#6B6B6B']
            block(ctx, x, y, cw, bh, pal[Math.floor(hash(r * 9 + c + (o.seed * 100 | 0)) * 3)])
          } else {
            block(ctx, x, y, cw, bh, '#D63A2F') // TNT
            ctx.fillStyle = '#F5F0E6'
            ctx.fillRect(x, y + bh * 0.34, cw, bh * 0.32)
            if (cw > 20 * s) {
              ctx.fillStyle = INK
              ctx.font = `800 ${Math.round(bh * 0.26)}px ui-monospace, Menlo, monospace`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText('TNT', x + cw / 2, y + bh * 0.5)
            }
          }
        }
      }
    }
    this.warning(o, rc, o.type === 'ceil' ? COLORS.danger : COLORS.gold)
  }

  pitQuarry(o, rc) {
    const e = this.e
    const { ctx } = this
    const s = e.s
    ctx.fillStyle = '#B33A00'
    ctx.fillRect(rc.x, e.floorTop, rc.w, e.floorH + 40)
    const B = 14 * s
    for (let i = 0; i < Math.ceil(rc.w / B); i++) {
      for (let j = 0; j < Math.ceil((e.floorH + 40) / B); j++) {
        const t = hash(i * 17 + j * 5 + Math.floor(e.clock * 3 + o.seed * 9))
        ctx.fillStyle = t > 0.66 ? '#FFD23F' : t > 0.33 ? '#FF7A00' : '#E85D04'
        ctx.fillRect(rc.x + i * B, e.floorTop + j * B, Math.min(B, rc.x + rc.w - (rc.x + i * B)), B - 1)
      }
    }
    ctx.save()
    ctx.shadowColor = '#FF7A00'
    ctx.shadowBlur = 20 * s
    ctx.fillStyle = 'rgba(255,122,0,0.5)'
    ctx.fillRect(rc.x, e.floorTop - 6 * s, rc.w, 6 * s)
    ctx.restore()
    ctx.fillStyle = INK
    ctx.fillRect(rc.x - 3, e.floorTop, 3, e.floorH + 40)
    ctx.fillRect(rc.x + rc.w, e.floorTop, 3, e.floorH + 40)
    this.warning(o, rc, '#FF7A00')
  }

  // ==== STARSHIP DRIFT ======================================================

  bgShip() {
    const e = this.e
    const { ctx } = this
    const { W, H, s } = e
    ctx.fillStyle = '#10172A'
    ctx.fillRect(-30, -30, W + 60, H + 60)

    // Wall panel seams + porthole windows at parallax 0.5.
    const par = 0.5
    const seam = 150 * s
    const off = (e.bgOffset * par) % seam
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = -off; x < W + seam; x += seam) {
      ctx.moveTo(x, 44 * s)
      ctx.lineTo(x, e.floorTop)
    }
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.fillRect(0, e.floorTop * 0.62, W, 10 * s)

    const win = 380 * s
    const woff = (e.bgOffset * par) % win
    for (let k = -1; k < W / win + 2; k++) {
      const cx = k * win + win * 0.5 - woff
      const cy = e.floorTop * 0.36
      const R = 40 * s
      ctx.fillStyle = INK
      ctx.beginPath()
      ctx.arc(cx, cy, R + 7 * s, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#3A4668'
      ctx.beginPath()
      ctx.arc(cx, cy, R + 3 * s, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#05091A'
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, TAU)
      ctx.fill()
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, TAU)
      ctx.clip()
      ctx.fillStyle = '#fff'
      for (let i = 0; i < 14; i++) {
        const sx = cx - R + hash(k * 31 + i) * R * 2
        const sy = cy - R + hash(k * 17 + i * 3) * R * 2
        ctx.fillRect(sx, sy, 1.6, 1.6)
      }
      ctx.restore()
    }

    // Ceiling strip with blinking lights.
    ctx.fillStyle = '#1B2540'
    ctx.fillRect(-30, -30, W + 60, 74 * s)
    ctx.fillStyle = INK
    ctx.fillRect(-30, 42 * s, W + 60, 4 * s)
    const lg = 90 * s
    const loff = (e.bgOffset * par) % lg
    for (let x = -loff, i = 0; x < W + lg; x += lg, i++) {
      const on = Math.floor(e.clock * 2 + i) % 3 === 0
      ctx.fillStyle = on ? '#FF5C5C' : '#FFF6D6'
      ctx.globalAlpha = on ? 1 : 0.6
      ctx.fillRect(x, 34 * s, 22 * s, 5 * s)
    }
    ctx.globalAlpha = 1
  }

  floorShip() {
    const e = this.e
    const { ctx } = this
    const s = e.s
    const laneH = 30 * s
    const top = e.floorTop
    ctx.fillStyle = '#242E4A'
    ctx.fillRect(-30, top + laneH, e.W + 60, e.floorH)
    const plate = 78 * s
    const off = e.bgOffset % plate
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    ctx.lineWidth = 3
    ctx.beginPath()
    for (let x = -off; x < e.W + plate; x += plate) {
      ctx.moveTo(x, top + laneH)
      ctx.lineTo(x, e.H)
    }
    ctx.moveTo(0, top + laneH + 30 * s)
    ctx.lineTo(e.W, top + laneH + 30 * s)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    for (let x = -off + 8 * s; x < e.W + plate; x += plate) {
      ctx.fillRect(x, top + laneH + 8 * s, 4 * s, 4 * s)
      ctx.fillRect(x + plate - 20 * s, top + laneH + 8 * s, 4 * s, 4 * s)
    }
    // Hazard stripe along the bottom.
    const hs = 12 * s
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, e.H - hs, e.W, hs)
    ctx.clip()
    for (let x = -off - 40 * s; x < e.W + 40 * s; x += 28 * s) {
      ctx.fillStyle = '#FFC83D'
      ctx.beginPath()
      ctx.moveTo(x, e.H)
      ctx.lineTo(x + 14 * s, e.H)
      ctx.lineTo(x + 14 * s + hs, e.H - hs)
      ctx.lineTo(x + hs, e.H - hs)
      ctx.fill()
    }
    ctx.restore()
    this.lane(top, laneH, 1)
  }

  obsShip(o, rc) {
    const e = this.e
    const { ctx } = this
    const s = e.s
    if (o.type === 'ceil') {
      ctx.fillStyle = INK
      ctx.fillRect(rc.x - 3, -4, rc.w + 6, rc.h + 3 + 4)
      ctx.fillStyle = '#7C879F'
      ctx.fillRect(rc.x, -4, rc.w, rc.h + 4)
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.fillRect(rc.x + 2, -4, 4 * s, rc.h + 4)
      ctx.fillStyle = '#4A546D'
      for (let y = 20 * s; y < rc.h - 8 * s; y += 34 * s) ctx.fillRect(rc.x - 4 * s, y, rc.w + 8 * s, 8 * s)
      const on = Math.sin(e.clock * 9 + o.seed) > 0
      ctx.save()
      ctx.shadowColor = '#FF3B30'
      ctx.shadowBlur = on ? 16 * s : 0
      ctx.fillStyle = on ? '#FF5C5C' : '#7A1F1F'
      ctx.beginPath()
      ctx.arc(rc.x + rc.w / 2, rc.h, 7 * s, 0, TAU)
      ctx.fill()
      ctx.restore()
      this.warning(o, rc, COLORS.danger)
      return
    }
    // Steel cargo crate with a hazard band.
    ctx.fillStyle = INK
    ctx.fillRect(rc.x - 3, rc.y - 3, rc.w + 6, rc.h + 3)
    ctx.fillStyle = '#8791A8'
    ctx.fillRect(rc.x, rc.y, rc.w, rc.h)
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    ctx.fillRect(rc.x, rc.y, rc.w, 4 * s)
    ctx.save()
    ctx.beginPath()
    ctx.rect(rc.x, rc.y + rc.h * 0.4, rc.w, Math.min(18 * s, rc.h * 0.3))
    ctx.clip()
    for (let x = rc.x - 20 * s; x < rc.x + rc.w + 20 * s; x += 14 * s) {
      ctx.fillStyle = (Math.round((x - rc.x) / (14 * s)) & 1) === 0 ? '#FFC83D' : INK
      ctx.beginPath()
      ctx.moveTo(x, rc.y + rc.h)
      ctx.lineTo(x + 8 * s, rc.y + rc.h)
      ctx.lineTo(x + 8 * s + 18 * s, rc.y)
      ctx.lineTo(x + 18 * s, rc.y)
      ctx.fill()
    }
    ctx.restore()
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.fillRect(rc.x + rc.w - 5 * s, rc.y, 5 * s, rc.h)
    this.warning(o, rc, COLORS.gold)
  }

  pitShip(o, rc) {
    const e = this.e
    const { ctx } = this
    const s = e.s
    ctx.fillStyle = '#03050E'
    ctx.fillRect(rc.x, e.floorTop - 3, rc.w, e.floorH + 40)
    ctx.fillStyle = '#fff'
    for (let i = 0; i < Math.ceil(rc.w / 12); i++) {
      ctx.fillRect(rc.x + hash(i + o.seed * 50) * rc.w, e.floorTop + hash(i * 3 + o.seed * 70) * e.floorH, 1.6, 1.6)
    }
    const pulse = 0.5 + 0.5 * Math.sin(e.clock * 8)
    ctx.save()
    ctx.shadowColor = '#FF3B30'
    ctx.shadowBlur = 14 * s * pulse
    ctx.fillStyle = `rgba(255,59,48,${0.6 + 0.4 * pulse})`
    ctx.fillRect(rc.x - 3 * s, e.floorTop - 3, 4 * s, e.floorH + 40)
    ctx.fillRect(rc.x + rc.w - 1 * s, e.floorTop - 3, 4 * s, e.floorH + 40)
    ctx.restore()
    this.warning(o, rc, COLORS.danger)
  }
}
