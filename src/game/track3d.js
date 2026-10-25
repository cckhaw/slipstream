// Curved-track geometry for the 3D worlds.
//
// The simulation is a straight 1D run; the 3D view bends it. A TrackPlan describes the
// course (straights, left / right 90 degree turns, U-turns) as curvature along the
// distance travelled. A Path samples that plan around the avatar, in the avatar's frame:
// the avatar sits at the origin heading +X, and heading theta > 0 turns toward +Z
// (screen right).

const TAU = Math.PI * 2
const rand = (a, b) => a + Math.random() * (b - a)

export const S_MIN = -14
export const S_MAX = 132
export const STEP = 0.5
export const N = Math.round((S_MAX - S_MIN) / STEP) + 1
const IZ = Math.round(-S_MIN / STEP)

const TURN_LEN = { left: 32, right: 32, uturn: 48 }

export class TrackPlan {
  // cfg: { first, straight: [min, max], weights: { left, right, uturn } }
  constructor(cfg) {
    this.cfg = cfg
    this.segs = []
    this.end = 0
    this.add('straight', cfg.first ?? 60, 0)
  }

  add(kind, len, angle) {
    this.segs.push({ kind, a: this.end, b: this.end + len, len, angle, announced: false })
    this.end += len
  }

  ensure(upTo) {
    const { straight, weights } = this.cfg
    while (this.end < upTo) {
      const last = this.segs[this.segs.length - 1]
      if (last.kind === 'straight') {
        const roll = Math.random() * (weights.left + weights.right + weights.uturn)
        const dir = Math.random() < 0.5 ? -1 : 1
        if (roll < weights.left) this.add('left', TURN_LEN.left, -Math.PI / 2)
        else if (roll < weights.left + weights.right) this.add('right', TURN_LEN.right, Math.PI / 2)
        else this.add('uturn', TURN_LEN.uturn, dir * Math.PI)
      } else {
        // Breathing room after a turn (longer after a U-turn).
        this.add('straight', rand(straight[0], straight[1]) + (last.kind === 'uturn' ? 15 : 0), 0)
      }
    }
  }

  // Curvature (radians per unit) at absolute distance S: a smooth bump per turn.
  curv(S) {
    for (const g of this.segs) {
      if (S >= g.a && S < g.b) {
        if (g.kind === 'straight') return 0
        const t = (S - g.a) / g.len
        return (g.angle / g.len) * (1 - Math.cos(TAU * t))
      }
    }
    return 0
  }

  trim(S) {
    while (this.segs.length > 3 && this.segs[0].b < S - 40) this.segs.shift()
  }

  // First turn that starts within `ahead` units and has not been announced yet.
  nextTurn(S, ahead) {
    for (const g of this.segs) {
      if (g.kind !== 'straight' && !g.announced && g.a - S < ahead && g.b > S) {
        g.announced = true
        return g
      }
    }
    return null
  }
}

export class Path {
  constructor() {
    this.px = new Float32Array(N)
    this.pz = new Float32Array(N)
    this.th = new Float32Array(N)
    this.out = { x: 0, z: 0, th: 0 }
  }

  // Sample the plan around distance travelled S.
  update(plan, S) {
    plan.ensure(S + S_MAX + 20)
    plan.trim(S)
    const { px, pz, th } = this
    px[IZ] = 0
    pz[IZ] = 0
    th[IZ] = 0
    for (let i = IZ + 1; i < N; i++) {
      const s = S_MIN + i * STEP
      th[i] = th[i - 1] + plan.curv(S + s - STEP / 2) * STEP
      const mid = (th[i - 1] + th[i]) / 2
      px[i] = px[i - 1] + Math.cos(mid) * STEP
      pz[i] = pz[i - 1] + Math.sin(mid) * STEP
    }
    for (let i = IZ - 1; i >= 0; i--) {
      const s = S_MIN + i * STEP
      th[i] = th[i + 1] - plan.curv(S + s + STEP / 2) * STEP
      const mid = (th[i + 1] + th[i]) / 2
      px[i] = px[i + 1] - Math.cos(mid) * STEP
      pz[i] = pz[i + 1] - Math.sin(mid) * STEP
    }
  }

  // Position and heading at distance s from the avatar (interpolated).
  at(s) {
    const f = Math.min(N - 1.001, Math.max(0, (s - S_MIN) / STEP))
    const i = Math.floor(f)
    const t = f - i
    const o = this.out
    o.x = this.px[i] + (this.px[i + 1] - this.px[i]) * t
    o.z = this.pz[i] + (this.pz[i + 1] - this.pz[i]) * t
    o.th = this.th[i] + (this.th[i + 1] - this.th[i]) * t
    return o
  }
}
