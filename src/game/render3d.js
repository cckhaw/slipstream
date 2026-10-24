// three.js renderer for the 3D worlds (voxel, obby, grid). It is loaded lazily (dynamic
// import from the engine) so 2D players never download three.js.
//
// The simulation stays 2D: this view maps engine state onto a chase-cam runner.
//   world X = forward (obstacles approach from the horizon), Y = up, Z = across the track.
import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Fog,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  NearestFilter,
  OctahedronGeometry,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  RepeatWrapping,
  Scene,
  Sprite,
  SpriteMaterial,
  SphereGeometry,
  WebGLRenderer,
} from 'three'
import { shade } from '../lib/colors.js'

const TRACK_W = 3.6
const CELL = 0.6
const SPAN = 140 // decor recycle length
const MAX_PARTICLES = 500

const rand = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

function canvasTex(size, draw, { nearest = false } = {}) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d'), size)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  if (nearest) t.magFilter = t.minFilter = NearestFilter
  return t
}

const THEMES = {
  voxel: {
    sky: '#8FD3FF',
    fog: [24, 95],
    lava: '#FF7A00',
    rail: '#8A8A8A',
    side: (c, n) => {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        c.fillStyle = pick(['#4FAE3F', '#58B947', '#44A236', '#5CC24B'])
        c.fillRect((x * n) / 8, (y * n) / 8, n / 8, n / 8)
      }
    },
    track: (c, n) => {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        c.fillStyle = pick(['#9B6B3A', '#8B5A2B', '#A67744', '#7E5026'])
        c.fillRect((x * n) / 8, (y * n) / 8, n / 8, n / 8)
      }
    },
  },
  obby: {
    sky: '#6EC8FF',
    fog: [30, 110],
    lava: '#FF3B6B',
    rail: '#FFC83D',
    side: (c, n) => {
      c.fillStyle = '#7BD34F'
      c.fillRect(0, 0, n, n)
      c.fillStyle = '#6AC244'
      c.fillRect(0, 0, n / 2, n / 2)
      c.fillRect(n / 2, n / 2, n / 2, n / 2)
    },
    track: (c, n) => {
      c.fillStyle = '#E8F1FF'
      c.fillRect(0, 0, n, n)
      c.fillStyle = '#C5D8F7'
      c.fillRect(0, 0, n / 2, n / 2)
      c.fillRect(n / 2, n / 2, n / 2, n / 2)
      c.fillStyle = 'rgba(0,0,0,0.12)'
      c.beginPath()
      c.arc(n / 4, n / 4, n * 0.09, 0, Math.PI * 2)
      c.arc((n * 3) / 4, (n * 3) / 4, n * 0.09, 0, Math.PI * 2)
      c.fill()
    },
  },
  grid: {
    sky: '#0B0618',
    fog: [22, 85],
    lava: '#FF2DD1',
    rail: '#B14CFF',
    side: (c, n) => {
      c.fillStyle = '#0B0618'
      c.fillRect(0, 0, n, n)
      c.strokeStyle = 'rgba(177,76,255,0.55)'
      c.lineWidth = 3
      c.strokeRect(0, 0, n, n)
    },
    track: (c, n) => {
      c.fillStyle = '#0D0A24'
      c.fillRect(0, 0, n, n)
      c.strokeStyle = 'rgba(0,245,212,0.7)'
      c.lineWidth = 3
      c.strokeRect(0, 0, n, n)
    },
  },
}

export class Renderer3D {
  constructor(engine, canvas) {
    this.e = engine
    this.canvas = canvas
    this.gl = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.gl.setClearColor(0x000000)
    this.scene = new Scene()
    this.camera = new PerspectiveCamera(64, 1, 0.1, 160)
    this.stage = null
    this.obs = new Map()
    this.obsGroup = new Group()
    this.mats = new Map()
    this.avatar = null
    this.avatarKey = ''
    this.flashApplied = 0
    this.cube = new BoxGeometry(1, 1, 1)

    // Particles.
    this.pPos = new Float32Array(MAX_PARTICLES * 3)
    this.pCol = new Float32Array(MAX_PARTICLES * 3)
    const pg = new BufferGeometry()
    pg.setAttribute('position', new BufferAttribute(this.pPos, 3))
    pg.setAttribute('color', new BufferAttribute(this.pCol, 3))
    this.points = new Points(
      pg,
      new PointsMaterial({ size: 0.08, vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false }),
    )
    this.points.frustumCulled = false
    this.colorCache = new Map()

    // Soft shadow under the avatar: the main depth cue for judging jumps.
    this.shadow = new Mesh(new CircleGeometry(0.4, 24), new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }))
    this.shadow.rotation.x = -Math.PI / 2
    this.shadow.position.y = 0.035
    this.glow = new PointLight(0xff2d55, 0, 6)
    this.glow.position.set(0, 0.6, 0)
  }

  resize(w, h, dpr) {
    this.gl.setPixelRatio(dpr)
    this.gl.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.fov = w / h < 0.8 ? 74 : 62
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.disposeStage()
    this.gl.dispose()
  }

  disposeStage() {
    if (!this.stage) return
    this.scene.remove(this.stage)
    this.stage.traverse((o) => {
      o.geometry?.dispose?.()
      const m = o.material
      if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { x.map?.dispose?.(); x.dispose?.() })
    })
    this.stage = null
  }

  color(c) {
    let v = this.colorCache.get(c)
    if (!v) {
      v = new Color(c)
      this.colorCache.set(c, v)
    }
    return v
  }

  mat(color, { basic = false, opacity = 1 } = {}) {
    const k = `${color}|${basic}|${opacity}`
    let m = this.mats.get(k)
    if (!m) {
      m = basic
        ? new MeshBasicMaterial({ color, transparent: opacity < 1, opacity })
        : new MeshLambertMaterial({ color })
      this.mats.set(k, m)
    }
    return m
  }

  // ---- world build ---------------------------------------------------------

  setWorld(world) {
    const T = THEMES[world.theme]
    this.world = world
    this.T = T
    this.theme = world.theme
    this.disposeStage()
    for (const g of this.obs.values()) this.obsGroup.remove(g)
    this.obs.clear()
    this.mats.clear()

    const stage = new Group()
    this.stage = stage
    this.scene.add(stage)
    stage.add(this.obsGroup, this.points, this.shadow, this.glow)
    this.scene.background = new Color(T.sky)
    this.scene.fog = new Fog(T.sky, T.fog[0], T.fog[1])

    // Lighting.
    if (world.theme === 'grid') {
      stage.add(new AmbientLight(0xffffff, 0.9))
    } else {
      stage.add(new HemisphereLight(0xffffff, world.theme === 'voxel' ? 0x6a8f4a : 0x9fb8ff, 1.15))
      const sun = new DirectionalLight(0xffffff, 1.2)
      sun.position.set(-6, 12, 5)
      stage.add(sun)
    }

    // Ground (sides + track), scrolling textures.
    const len = 200
    const sideTex = canvasTex(64, T.side, { nearest: world.theme !== 'grid' })
    sideTex.repeat.set(len / 2, 40 / 2)
    this.sideTex = sideTex
    const side = new Mesh(new PlaneGeometry(len, 80), new MeshBasicMaterial({ map: sideTex }))
    side.rotation.x = -Math.PI / 2
    side.position.set(len / 2 - 20, 0, 0)
    stage.add(side)

    const trackTex = canvasTex(64, T.track ?? T.side, { nearest: world.theme !== 'grid' })
    trackTex.repeat.set(len / 1, TRACK_W / 1)
    this.trackTex = trackTex
    const track = new Mesh(new PlaneGeometry(len, TRACK_W + 0.4), new MeshBasicMaterial({ map: trackTex }))
    track.rotation.x = -Math.PI / 2
    track.position.set(len / 2 - 20, 0.01, 0)
    stage.add(track)

    // The pink Slipstream lane with streaming chevrons.
    const laneTex = canvasTex(128, (c, n) => {
      const g = c.createLinearGradient(0, 0, 0, n)
      g.addColorStop(0, 'rgba(255,45,85,0.85)')
      g.addColorStop(0.5, 'rgba(255,45,85,0.55)')
      g.addColorStop(1, 'rgba(255,45,85,0.85)')
      c.fillStyle = g
      c.fillRect(0, 0, n, n)
      c.strokeStyle = 'rgba(255,255,255,0.9)'
      c.lineWidth = 12
      c.lineCap = c.lineJoin = 'round'
      c.beginPath()
      c.moveTo(38, 28)
      c.lineTo(88, 64)
      c.lineTo(38, 100)
      c.stroke()
    })
    laneTex.repeat.set(len / 1.6, 1)
    this.laneTex = laneTex
    this.laneMat = new MeshBasicMaterial({ map: laneTex, transparent: true, opacity: 0.8 })
    const lane = new Mesh(new PlaneGeometry(len, 1.7), this.laneMat)
    lane.rotation.x = -Math.PI / 2
    lane.position.set(len / 2 - 20, 0.02, 0)
    stage.add(lane)

    // Rails along the track.
    for (const z of [-TRACK_W / 2 - 0.25, TRACK_W / 2 + 0.25]) {
      const rail = new Mesh(new BoxGeometry(len, 0.4, 0.22), world.theme === 'grid' ? new MeshBasicMaterial({ color: T.rail }) : this.mat(T.rail))
      rail.position.set(len / 2 - 20, 0.2, z)
      stage.add(rail)
    }

    this.buildDecor(world.theme, stage)
    this.avatarKey = ''
  }

  buildDecor(theme, stage) {
    this.decor = []
    this.clouds = []
    const add = (obj, x, z, spin = 0) => {
      obj.position.x = x
      obj.position.z = z
      stage.add(obj)
      this.decor.push({ obj, spin })
    }
    const N = 70
    for (let i = 0; i < N; i++) {
      const x = -10 + (i / N) * SPAN + rand(-1, 1)
      const side = i % 2 === 0 ? -1 : 1
      const z = side * (3.6 + rand(0, 16))
      const g = new Group()
      if (theme === 'voxel') {
        const roll = Math.random()
        if (roll < 0.55) {
          const trunk = new Mesh(this.cube, this.mat('#6B4423'))
          trunk.scale.set(0.5, 1.6, 0.5)
          trunk.position.y = 0.8
          const leaves = new Mesh(this.cube, this.mat(pick(['#2E8B3A', '#3AA14A', '#27782F'])))
          leaves.scale.set(2, 1.8, 2)
          leaves.position.y = 2.5
          const top = new Mesh(this.cube, leaves.material)
          top.scale.set(1.2, 0.9, 1.2)
          top.position.y = 3.7
          g.add(trunk, leaves, top)
        } else if (roll < 0.8) {
          const h = rand(2, 6)
          const hill = new Mesh(this.cube, this.mat('#7A7A7A'))
          hill.scale.set(rand(2, 4), h, rand(2, 4))
          hill.position.y = h / 2
          const cap = new Mesh(this.cube, this.mat('#4FAE3F'))
          cap.scale.set(hill.scale.x + 0.05, 0.4, hill.scale.z + 0.05)
          cap.position.y = h
          g.add(hill, cap)
        } else {
          const tnt = new Mesh(this.cube, this.mat(pick(['#D63A2F', '#FFC83D', '#4DD2FF'])))
          tnt.scale.setScalar(0.8)
          tnt.position.y = 0.4
          g.add(tnt)
        }
      } else if (theme === 'obby') {
        const col = pick(['#FF4D4D', '#FFC83D', '#4DD2FF', '#B14CFF', '#FF8A1F', '#3DDC84'])
        const h = rand(1, 6)
        const b = new Mesh(this.cube, this.mat(col))
        b.scale.set(rand(1, 3), h, rand(1, 3))
        b.position.y = h / 2
        const top = new Mesh(this.cube, this.mat(shade(col, 0.35)))
        top.scale.set(b.scale.x + 0.02, 0.18, b.scale.z + 0.02)
        top.position.y = h
        g.add(b, top)
        if (i % 5 === 0) {
          b.position.y += rand(2, 5)
          top.position.y += b.position.y - h / 2
        }
      } else {
        const h = rand(2, 11)
        const col = pick([0x00f5d4, 0xff2dd1, 0xb14cff])
        const body = new Mesh(new BoxGeometry(0.7, h, 0.7), new MeshBasicMaterial({ color: 0x120a2c }))
        body.position.y = h / 2
        const edges = new LineSegments(new EdgesGeometry(body.geometry), new LineBasicMaterial({ color: col }))
        edges.position.copy(body.position)
        g.add(body, edges)
        if (i % 4 === 0) {
          const oct = new Mesh(new OctahedronGeometry(0.8), new MeshBasicMaterial({ color: col, wireframe: true }))
          oct.position.y = h + 1.6
          g.add(oct)
        }
      }
      add(g, x, z, theme === 'grid' ? 0 : 0)
    }

    if (theme === 'voxel' || theme === 'obby') {
      for (let i = 0; i < 16; i++) {
        const c = new Group()
        for (let k = 0; k < 3; k++) {
          const b = new Mesh(this.cube, new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, fog: false }))
          b.scale.set(rand(3, 6), 1.2, rand(2, 3.5))
          b.position.set(k * 2.5 - 2.5, k === 1 ? 0.6 : 0, rand(-1, 1))
          c.add(b)
        }
        c.position.set(rand(-10, SPAN - 10), rand(14, 22), rand(-30, 30))
        stage.add(c)
        this.clouds.push(c)
      }
      const sun = new Mesh(new PlaneGeometry(10, 10), new MeshBasicMaterial({ color: 0xfff3a0, fog: false }))
      sun.position.set(110, 36, -25)
      sun.rotation.y = -Math.PI / 2
      stage.add(sun)
    }
  }

  // ---- obstacles -----------------------------------------------------------

  buildObstacle(o) {
    const e = this.e
    const u = e.s * 40
    const T = this.T
    const g = new Group()
    const depth = Math.max(0.4, o.w / u)
    g.userData = { depth }

    if (o.type === 'pit') {
      const lava = new Mesh(new BoxGeometry(depth, 0.08, TRACK_W + 0.3), new MeshBasicMaterial({ color: T.lava }))
      lava.position.y = 0.05
      g.add(lava)
      for (const dx of [-depth / 2, depth / 2]) {
        for (const z of [-TRACK_W / 2 - 0.1, TRACK_W / 2 + 0.1]) {
          const p = new Mesh(this.cube, new MeshBasicMaterial({ color: T.lava }))
          p.scale.set(0.14, 1.1, 0.14)
          p.position.set(dx, 0.55, z)
          g.add(p)
        }
      }
      g.userData.lava = lava
      return g
    }

    const ceil = o.type === 'ceil'
    const bottom0 = (e.r * 2 + 24 * e.s) / u
    const hBase = ceil ? 9 - bottom0 : Math.max(0.5, (o.hu * e.s) / u)
    g.userData.hBase = hBase
    g.userData.bottom0 = bottom0

    if (this.theme === 'grid') {
      const col = ceil ? 0xff3b30 : 0xff9500
      const box = new Mesh(new BoxGeometry(depth, hBase, TRACK_W), new MeshBasicMaterial({ color: col, transparent: true, opacity: 0.32 }))
      box.position.y = ceil ? bottom0 + hBase / 2 : hBase / 2
      const edges = new LineSegments(new EdgesGeometry(box.geometry), new LineBasicMaterial({ color: col }))
      edges.position.copy(box.position)
      g.add(box, edges)
      return g
    }

    const rows = Math.max(1, Math.round(hBase / CELL))
    const ch = hBase / rows
    const cols = Math.round(TRACK_W / CELL)
    const cw = TRACK_W / cols
    const obbyPal = ['#FF4D4D', '#FFC83D', '#4DD2FF', '#7BD34F', '#B14CFF', '#FF8A1F']
    const stone = ['#7D7D7D', '#8E8E8E', '#6B6B6B']
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let col
        if (this.theme === 'voxel') {
          if (ceil) col = r === 0 ? '#2A1A3D' : pick(stone)
          else if (o.type === 'wide') col = pick(stone)
          else col = r % 2 === 0 ? '#D63A2F' : '#F5F0E6' // TNT stripes
        } else {
          col = ceil ? pick(['#FF4D4D', '#FF8A1F']) : pick(obbyPal)
        }
        const m = new Mesh(this.cube, this.mat(col))
        m.scale.set(depth, ch * 0.98, cw * 0.98)
        const y = ceil ? bottom0 + ch * (rows - 1 - r + 0.5) : ch * (r + 0.5)
        m.position.set(0, y, -TRACK_W / 2 + cw * (c + 0.5))
        g.add(m)
      }
    }
    return g
  }

  syncObstacles() {
    const e = this.e
    const u = e.s * 40
    const seen = new Set()
    for (const o of e.obstacles) {
      let g = this.obs.get(o)
      if (!g) {
        g = this.buildObstacle(o)
        this.obs.set(o, g)
        this.obsGroup.add(g)
      }
      seen.add(o)
      const rc = e.rectOf(o)
      const x = (rc.x + rc.w / 2 - e.orbX) / u
      g.visible = x > -8 && x < 90
      g.position.x = x
      if (o.type === 'floor' || o.type === 'wide') {
        g.scale.y = Math.max(0.05, rc.h / u / g.userData.hBase)
      } else if (o.type === 'ceil') {
        g.position.y = (e.floorTop - rc.h) / u - g.userData.bottom0
      } else {
        const l = g.userData.lava
        l.material.color.set(this.T.lava).multiplyScalar(0.8 + 0.2 * Math.sin(e.clock * 6 + o.seed))
      }
    }
    for (const [o, g] of this.obs) {
      if (!seen.has(o)) {
        this.obsGroup.remove(g)
        this.obs.delete(o)
      }
    }
  }

  // ---- avatar --------------------------------------------------------------

  buildAvatar() {
    const e = this.e
    const c = e.playerColor
    const kind = e.world.avatar
    if (this.avatar) this.scene.remove(this.avatar)
    const g = new Group()
    const R = 0.35
    if (kind === 'orb') {
      const m = new Mesh(new SphereGeometry(R, 32, 20), new MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.55, roughness: 0.3 }))
      const cv = document.createElement('canvas')
      cv.width = cv.height = 64
      const x = cv.getContext('2d')
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32)
      gr.addColorStop(0, 'rgba(255,255,255,0.9)')
      gr.addColorStop(0.3, 'rgba(0,245,212,0.35)')
      gr.addColorStop(1, 'rgba(0,245,212,0)')
      x.fillStyle = gr
      x.fillRect(0, 0, 64, 64)
      const halo = new Sprite(new SpriteMaterial({ map: new CanvasTexture(cv), color: c, blending: AdditiveBlending, depthWrite: false, transparent: true }))
      halo.scale.setScalar(2.6)
      g.add(m, halo)
    } else if (kind === 'cube') {
      const body = new Mesh(new BoxGeometry(0.7, 0.7, 0.7), new MeshLambertMaterial({ color: c }))
      const edges = new LineSegments(new EdgesGeometry(body.geometry), new LineBasicMaterial({ color: 0x05070c }))
      g.add(body, edges)
      for (const z of [-0.14, 0.14]) {
        const eye = new Mesh(this.cube, new MeshBasicMaterial({ color: 0xffffff }))
        eye.scale.set(0.02, 0.15, 0.13)
        eye.position.set(0.356, 0.1, z)
        const pupil = new Mesh(this.cube, new MeshBasicMaterial({ color: 0x05070c }))
        pupil.scale.set(0.02, 0.09, 0.07)
        pupil.position.set(0.364, 0.09, z + 0.025)
        g.add(eye, pupil)
      }
    } else {
      const body = new Mesh(new CapsuleGeometry(0.3, 0.35, 6, 16), new MeshLambertMaterial({ color: c }))
      const visor = new Mesh(new SphereGeometry(0.17, 16, 12), new MeshStandardMaterial({ color: '#9FE3FF', emissive: '#6CC4EE', emissiveIntensity: 0.5, roughness: 0.15 }))
      visor.scale.set(0.55, 0.85, 1.35)
      visor.position.set(0.24, 0.16, 0)
      const pack = new Mesh(new BoxGeometry(0.2, 0.38, 0.36), new MeshLambertMaterial({ color: shade(c, -0.25) }))
      pack.position.set(-0.3, -0.02, 0)
      g.add(body, visor, pack)
    }
    this.avatar = g
    this.scene.add(g)
    this.avatarKey = `${kind}|${c}`
  }

  // ---- frame ---------------------------------------------------------------

  draw() {
    const e = this.e
    if (!this.stage) return
    const u = e.s * 40

    if (this.avatarKey !== `${e.world.avatar}|${e.playerColor}`) this.buildAvatar()

    // Scroll ground and decor by the same distance the engine scrolled obstacles.
    const dist = (e.bgOffset - (this.lastBg ?? e.bgOffset)) / u
    this.lastBg = e.bgOffset
    this.trackTex.offset.x += dist / 1
    this.sideTex.offset.x += dist / 2
    this.laneTex.offset.x += dist / 1.6
    for (const d of this.decor) {
      d.obj.position.x -= dist
      if (d.obj.position.x < -12) d.obj.position.x += SPAN
    }
    for (const c of this.clouds) {
      c.position.x -= dist * 0.25
      if (c.position.x < -20) c.position.x += SPAN
    }

    this.syncObstacles()

    // Avatar.
    const R = 0.35
    const Y = (e.floorTop - e.y) / u
    const riding = e.grounded && e.holding
    const stretch = clamp(Math.abs(e.vy) / (900 * e.s), 0, 0.35)
    let sx = 1 - stretch * 0.45
    let sy = 1 + stretch
    if (riding) {
      sx = 1.2
      sy = 0.8
    }
    if (this.avatar) {
      this.avatar.visible = e.mode !== 'over'
      this.avatar.position.set(0, Y + R * (1 - sy), 0)
      this.avatar.scale.set(sx, sy, sx)
      const kind = e.world.avatar
      if (kind === 'cube') this.avatar.rotation.z = e.grounded ? 0 : -e.spin
      else if (kind === 'bean') this.avatar.rotation.z = clamp(-e.vy / (900 * e.s), -1, 1) * 0.4
    }
    const h = Math.max(0, Y - R)
    this.shadow.position.x = 0
    this.shadow.scale.setScalar(1 / (1 + h * 0.35))
    this.shadow.visible = e.mode !== 'over'
    this.glow.intensity = riding ? 6 : 0
    this.laneMat.opacity = 0.75 + 0.25 * e.charge

    this.drawParticles(u)

    // Camera: chase view with a little height follow and crash shake.
    const cam = this.camera
    let shx = 0
    let shy = 0
    if (e.shake > 0 && !e.reduceMotion) {
      shx = (Math.random() - 0.5) * e.shake * 0.5
      shy = (Math.random() - 0.5) * e.shake * 0.5
    }
    // High enough that the avatar never hides what is coming.
    cam.position.set(-7.0, 4.6 + (Y - R) * 0.3 + shy, 0.0 + shx)
    cam.lookAt(4.5, 0.3 + (Y - R) * 0.15, 0)

    // Speed feel: widen FOV with the multiplier.
    const base = cam.aspect < 0.8 ? 74 : 62
    const fov = base + clamp((e.mult - 1) / 9, 0, 1) * 8
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * 0.1
      cam.updateProjectionMatrix()
    }

    const flash = e.flash > 0.02 ? 1 + e.flash * 0.6 : 0
    if (flash !== this.flashApplied) {
      this.canvas.style.filter = flash ? `brightness(${flash})` : ''
      this.flashApplied = flash
    }

    this.gl.render(this.scene, cam)
  }

  drawParticles(u) {
    const e = this.e
    const ps = e.particles
    const n = Math.min(ps.length, MAX_PARTICLES)
    for (let i = 0; i < n; i++) {
      const p = ps[i]
      if (p.z === undefined) p.z = (Math.random() - 0.5) * 0.5
      const a = clamp(p.life / p.max, 0, 1)
      const col = this.color(p.color)
      this.pPos[i * 3] = (p.x - e.orbX) / u
      this.pPos[i * 3 + 1] = (e.floorTop - p.y) / u
      this.pPos[i * 3 + 2] = p.z
      const k = a * (p.g === 0 ? 0.55 : 1) // trail particles stay subtle so they never hide the avatar
      this.pCol[i * 3] = col.r * k
      this.pCol[i * 3 + 1] = col.g * k
      this.pCol[i * 3 + 2] = col.b * k
    }
    const g = this.points.geometry
    g.setDrawRange(0, n)
    g.attributes.position.needsUpdate = true
    g.attributes.color.needsUpdate = true
  }
}
