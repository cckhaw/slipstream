// three.js renderer for the 3D worlds (voxel, obby, grid). It is loaded lazily (dynamic
// import from the engine) so 2D players never download three.js.
//
// The simulation stays 2D: this view maps engine state onto a chase-cam runner.
//   world X = forward (obstacles approach from the horizon), Y = up, Z = across the track.
import {
  AdditiveBlending,
  AmbientLight,
  Box3,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  ConeGeometry,
  CircleGeometry,
  CylinderGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
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
import { rngFromSeed } from '../lib/seed.js'
import { N as PATH_N, Path, S_MIN, STEP, TrackPlan } from './track3d.js'

const TRACK_W = 3.6
const CELL = 0.6
const CEIL_TOP = 6.5 // visual top of ceiling blocks (collision still spans the full height)
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
    this.path = new Path()
    this.plan = null
    this.lastS = null
    this.pose = { phi: 0, tx: 0, tz: 0, sky: 0 }

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

    // The track is a ribbon that follows the curved path (rebuilt every frame); the
    // surrounding ground is one big plane whose pose follows the world as it turns.
    this.plan = new TrackPlan({ first: 60, ...(world.track ?? { straight: [30, 60], weights: { left: 1, right: 1, uturn: 1 } }) })
    this.lastS = null
    this.pose = { phi: 0, tx: 0, tz: 0, sky: 0 }

    this.groundFrame = new Group()
    this.skyFrame = new Group()
    stage.add(this.groundFrame, this.skyFrame)

    const sideTex = canvasTex(64, T.side, { nearest: world.theme !== 'grid' })
    sideTex.repeat.set(300, 300) // 600 units wide, one tile = 2 units
    const side = new Mesh(new PlaneGeometry(600, 600), new MeshBasicMaterial({ map: sideTex }))
    side.rotation.x = -Math.PI / 2
    this.groundFrame.add(side)

    const ribbonMat = (map, extra = {}) => new MeshBasicMaterial({ map, side: DoubleSide, polygonOffset: true, ...extra })
    const nearest = world.theme !== 'grid'
    this.trackMesh = this.makeRibbon(ribbonMat(canvasTex(64, T.track ?? T.side, { nearest }), { polygonOffsetFactor: -1, polygonOffsetUnits: -1 }))
    stage.add(this.trackMesh)

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
    this.laneMat = ribbonMat(laneTex, { transparent: true, opacity: 0.8, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    this.laneMesh = this.makeRibbon(this.laneMat)
    stage.add(this.laneMesh)

    // Rails: top + inner and outer walls on each side.
    const railTop = new MeshBasicMaterial({ color: T.rail, side: DoubleSide })
    const railWall = new MeshBasicMaterial({ color: shade(T.rail, -0.25), side: DoubleSide })
    this.rails = []
    for (const sd of [-1, 1]) {
      const a0 = sd * (TRACK_W / 2 + 0.25)
      const a1 = sd * (TRACK_W / 2 + 0.47)
      for (const [lat0, y0, lat1, y1, m] of [
        [a0, 0.4, a1, 0.4, railTop],
        [a0, 0, a0, 0.4, railWall],
        [a1, 0.4, a1, 0, railWall],
      ]) {
        const mesh = this.makeRibbon(m)
        mesh.userData = { lat0, y0, lat1, y1 }
        stage.add(mesh)
        this.rails.push(mesh)
      }
    }

    this.buildDecor(world.theme, stage)
    this.avatarKey = ''
  }

  buildDecor(theme, stage) {
    this.decor = []
    this.clouds = []
    // Decor is pinned to the track: distance along it (S0) plus a lateral offset.
    const add = (obj, off, lat) => {
      // Footprint radius and height, so placement can keep the whole object off the road.
      const box = new Box3().setFromObject(obj)
      const r = Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z) / 2
      // Push it out so even its inner edge clears the rails.
      lat = Math.sign(lat) * (Math.abs(lat) + r + 0.8)
      stage.add(obj)
      this.decor.push({ obj, off, lat, r, h: box.max.y, S0: null, vis: 1 })
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
      add(g, x, z)
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
        const ang = rand(0, Math.PI * 2)
        const rad = rand(50, 150)
        c.position.set(Math.cos(ang) * rad, rand(14, 22), Math.sin(ang) * rad)
        this.skyFrame.add(c)
        this.clouds.push(c)
      }
      const sun = new Mesh(new PlaneGeometry(10, 10), new MeshBasicMaterial({ color: 0xfff3a0, fog: false }))
      sun.position.set(110, 36, -25)
      sun.rotation.y = -Math.PI / 2
      this.skyFrame.add(sun)
    }
  }

  // ---- curved track --------------------------------------------------------

  makeRibbon(material) {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(PATH_N * 6), 3))
    geo.setAttribute('uv', new BufferAttribute(new Float32Array(PATH_N * 4), 2))
    const idx = []
    for (let i = 0; i < PATH_N - 1; i++) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    geo.setIndex(idx)
    const mesh = new Mesh(geo, material)
    mesh.frustumCulled = false
    return mesh
  }

  // Lay a strip along the path: lateral offsets lat0 / lat1 at heights y0 / y1.
  fillRibbon(mesh, lat0, y0, lat1, y1, uOffset, tile, vMul) {
    const { px, pz, th } = this.path
    const pos = mesh.geometry.attributes.position.array
    const uv = mesh.geometry.attributes.uv.array
    for (let i = 0; i < PATH_N; i++) {
      const nx = -Math.sin(th[i])
      const nz = Math.cos(th[i])
      const o = i * 6
      pos[o] = px[i] + nx * lat0
      pos[o + 1] = y0
      pos[o + 2] = pz[i] + nz * lat0
      pos[o + 3] = px[i] + nx * lat1
      pos[o + 4] = y1
      pos[o + 5] = pz[i] + nz * lat1
      const u = (uOffset + S_MIN + i * STEP) / tile
      const k = i * 4
      uv[k] = u
      uv[k + 1] = 0
      uv[k + 2] = u
      uv[k + 3] = vMul
    }
    mesh.geometry.attributes.position.needsUpdate = true
    mesh.geometry.attributes.uv.needsUpdate = true
  }

  fillRibbons(S) {
    const m = S % 64 // 64 is a whole number of both tile lengths, so the wrap is seamless
    const half = (TRACK_W + 0.4) / 2
    this.fillRibbon(this.trackMesh, -half, 0.01, half, 0.01, m, 1, TRACK_W + 0.4)
    this.fillRibbon(this.laneMesh, -0.85, 0.02, 0.85, 0.02, m, 1.6, 1)
    for (const r of this.rails) {
      const { lat0, y0, lat1, y1 } = r.userData
      this.fillRibbon(r, lat0, y0, lat1, y1, m, 1, 1)
    }
  }

  // Ground and sky are fixed in the world, so as the track bends under the avatar they
  // slide back and rotate the opposite way.
  updateWorldFrames(S, dS) {
    const P = this.pose
    const dth = this.plan.curv(S) * dS
    const c = Math.cos(-dth)
    const sn = Math.sin(-dth)
    let x = P.tx - dS
    let z = P.tz
    ;[x, z] = [x * c - z * sn, x * sn + z * c]
    P.phi -= dth
    P.sky -= dth
    // The ground texture repeats every 2 units along its own axes: wrap so it never drifts away.
    const cp = Math.cos(P.phi)
    const sp = Math.sin(P.phi)
    let ax = x * cp + z * sp
    let az = -x * sp + z * cp
    ax -= 2 * Math.round(ax / 2)
    az -= 2 * Math.round(az / 2)
    P.tx = ax * cp - az * sp
    P.tz = ax * sp + az * cp
    this.groundFrame.position.set(P.tx, 0, P.tz)
    this.groundFrame.rotation.y = -P.phi
    this.skyFrame.rotation.y = -P.sky
    for (const cl of this.clouds) {
      cl.position.x -= dS * 0.2
      if (cl.position.x < -160) cl.position.x += 320
    }
  }

  placeDecor(S) {
    const { px, pz } = this.path
    const edge = TRACK_W / 2 + 0.6
    // Chase camera and the points of the road ahead it needs to see.
    const cam = this.path.at(-6.5)
    const cx = cam.x
    const cz = cam.z
    if (!this.sightPts) this.sightPts = new Float32Array(32)
    const sp = this.sightPts
    let nSight = 0
    for (let s = 2; s <= 56; s += 6) {
      const q = this.path.at(s)
      sp[nSight++] = q.x
      sp[nSight++] = q.z
    }
    for (const d of this.decor) {
      if (d.S0 === null) {
        d.S0 = S + d.off + 10
        d.vis = null
      }
      let s = d.S0 - S
      if (s < -12) {
        d.S0 += SPAN
        s += SPAN
        d.vis = null
      }
      if (s >= 128) {
        d.obj.visible = false
        continue
      }
      const pt = this.path.at(s)
      const x = pt.x - Math.sin(pt.th) * d.lat
      const z = pt.z + Math.cos(pt.th) * d.lat

      // Never on the road: scenery that lands near any part of the track (inside of a
      // bend, the other leg of a U-turn) is hidden at once. Scenery in the line of sight
      // of the chase camera shrinks away instead, and grows back when it is clear.
      let ok = true
      let onRoad = false
      const clear = (edge + d.r) * (edge + d.r)
      for (let i = 0; i < PATH_N; i++) {
        const dx = px[i] - x
        const dz = pz[i] - z
        if (dx * dx + dz * dz < clear) {
          ok = false
          onRoad = true
          break
        }
      }
      if (ok && d.h > 1) {
        const rr = d.r + 0.8
        for (let k = 0; k < nSight && ok; k += 2) {
          // Distance from the decor to the camera -> road point segment.
          const ex = sp[k] - cx
          const ez = sp[k + 1] - cz
          const t = clamp(((x - cx) * ex + (z - cz) * ez) / (ex * ex + ez * ez), 0, 1)
          const ox = cx + ex * t - x
          const oz = cz + ez * t - z
          // Only counts if it is taller than the sightline at that point.
          if (ox * ox + oz * oz < rr * rr && d.h > 4.6 * (1 - t) * 0.7) ok = false
        }
      }

      const target = ok ? 1 : 0
      d.vis = d.vis === null || onRoad ? target : d.vis + (target - d.vis) * 0.2
      d.obj.visible = d.vis > 0.03
      if (!d.obj.visible) continue
      d.obj.scale.setScalar(d.vis)
      d.obj.position.set(x, 0, z)
      d.obj.rotation.y = -pt.th
    }
  }

  // Tell the UI about the next turn a moment before it arrives.
  announceTurns(S) {
    const t = this.plan.nextTurn(S, 30)
    if (t) this.e.emit('turn', { kind: t.kind, dir: Math.sign(t.angle) })
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

    if (o.type === 'float' || o.type === 'gate') {
      // Slabs repositioned every frame from the engine's rectangles.
      g.userData.parts = []
      const col = { voxel: '#7A3FD1', obby: '#E83E8C', grid: '#B14CFF' }[this.theme] ?? '#7A3FD1'
      for (let i = 0; i < (o.type === 'gate' ? 2 : 1); i++) {
        // Slabs that reach the sky stay see-through, like ceiling blocks, so they never hide the road.
        const m = new Mesh(this.cube, new MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false }))
        m.add(new LineSegments(new EdgesGeometry(this.cube), new LineBasicMaterial({ color: 0xffe9a8 })))
        g.add(m)
        g.userData.parts.push(m)
      }
      return g
    }

    const ceil = o.type === 'ceil'
    const bottom0 = (e.r * 2 + 24 * e.s) / u
    const hBase = ceil ? CEIL_TOP - bottom0 : Math.max(0.5, (o.hu * e.s) / u)
    g.userData.hBase = hBase
    g.userData.bottom0 = bottom0

    if (o.rush) {
      // Orange streak trailing behind (toward the horizon) so a fast mover reads as fast.
      const trail = new Mesh(new BoxGeometry(5, 0.18, TRACK_W * 0.7), new MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.55 }))
      trail.position.set(depth / 2 + 2.5, Math.min(hBase, 1.2) / 2, 0)
      g.add(trail)
    }

    if (this.theme === 'grid') {
      if (ceil) {
        // Hanging blocks stay see-through so they never hide what is coming.
        const box = new Mesh(new BoxGeometry(depth, hBase, TRACK_W), new MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.32, depthWrite: false }))
        g.userData.fade = [{ mat: box.material, base: 0.32, min: 0.12 }]
        box.position.y = bottom0 + hBase / 2
        const edges = new LineSegments(new EdgesGeometry(box.geometry), new LineBasicMaterial({ color: 0xff3b30 }))
        edges.position.copy(box.position)
        g.add(box, edges)
      } else {
        // Ground obstacles are solid: a glowing orange block with a bright outline.
        const box = new Mesh(
          new BoxGeometry(depth, hBase, TRACK_W),
          new MeshLambertMaterial({ color: '#8A4A00', emissive: '#FF9500', emissiveIntensity: 0.6 }),
        )
        box.position.y = hBase / 2
        const edges = new LineSegments(new EdgesGeometry(box.geometry), new LineBasicMaterial({ color: 0xffd9a0 }))
        edges.position.copy(box.position)
        g.add(box, edges)
      }
      return g
    }

    const rows = Math.max(1, Math.round(hBase / CELL))
    const ch = hBase / rows
    const cols = Math.round(TRACK_W / CELL)
    const cw = TRACK_W / cols
    const obbyPal = ['#FF4D4D', '#FFC83D', '#4DD2FF', '#7BD34F', '#B14CFF', '#FF8A1F']
    const stone = ['#7D7D7D', '#8E8E8E', '#6B6B6B']

    // Ceiling blocks are see-through (and fade further as they pass the camera and the
    // avatar) so they never hide the obstacles coming up behind them. The bottom row stays
    // mostly solid so the hazard edge is easy to read.
    const fadeMats = new Map()
    const fadeMat = (col, edge) => {
      const key = `${col}|${edge}`
      let m = fadeMats.get(key)
      if (!m) {
        const base = edge ? 0.95 : 0.4
        m = new MeshLambertMaterial({ color: col, transparent: true, opacity: base, depthWrite: false })
        fadeMats.set(key, m)
        g.userData.fade.push({ mat: m, base, min: edge ? 0.6 : 0.3 })
      }
      return m
    }
    if (ceil) {
      g.userData.fade = []
      const outline = new LineSegments(
        new EdgesGeometry(new BoxGeometry(depth, hBase, TRACK_W)),
        new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }),
      )
      outline.position.y = bottom0 + hBase / 2
      g.add(outline)
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const edge = ceil && r === rows - 1 // r = 0 is the top row of a ceiling block
        let col
        if (this.theme === 'voxel') {
          if (ceil) col = edge ? '#3A2552' : pick(stone)
          else if (o.type === 'wide') col = pick(stone)
          else col = r % 2 === 0 ? '#D63A2F' : '#F5F0E6' // TNT stripes
        } else {
          col = ceil ? (edge ? '#FF3B30' : pick(['#FF8A1F', '#FFC83D'])) : pick(obbyPal)
        }
        const m = new Mesh(this.cube, ceil ? fadeMat(col, edge) : this.mat(col))
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
      const so = (rc.x + rc.w / 2 - e.orbX) / u
      g.visible = so > -8 && so < 125
      const pt = this.path.at(so)
      g.position.x = pt.x
      g.position.z = pt.z
      g.rotation.y = -pt.th
      if (g.userData.parts) {
        e.rectsOf(o).forEach((r, i) => {
          const m = g.userData.parts[i]
          m.visible = r.h > 1
          const top = Math.min((e.floorTop - r.y) / u, CEIL_TOP)
          const bottom = (e.floorTop - (r.y + r.h)) / u
          m.scale.set(g.userData.depth, Math.max(0.01, top - bottom), TRACK_W)
          m.position.y = (top + bottom) / 2
          const sky = r.y < 1
          m.material.opacity = sky ? 0.5 * clamp((so + 6) / 18, 0.3, 1) : 0.92
        })
      } else if (o.type === 'floor' || o.type === 'wide') {
        g.scale.y = Math.max(0.05, rc.h / u / g.userData.hBase)
      } else if (o.type === 'ceil') {
        g.position.y = (e.floorTop - rc.h) / u - g.userData.bottom0
        // Fade out as it approaches the camera (s = -6.5) and passes over the avatar.
        const fade = clamp((so + 6) / 18, 0, 1)
        for (const f of g.userData.fade) f.mat.opacity = f.base * (f.min + (1 - f.min) * fade)
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
      // Zip: round body, swoosh tail, glowing antenna, big eyes.
      const body = new Mesh(new SphereGeometry(R, 28, 20), new MeshLambertMaterial({ color: c }))
      const tail = new Mesh(new ConeGeometry(0.22, 0.6, 14), new MeshLambertMaterial({ color: shade(c, -0.3) }))
      tail.rotation.z = Math.PI / 2
      tail.position.set(-0.52, 0, 0)
      const stalk = new Mesh(new CylinderGeometry(0.02, 0.02, 0.3, 8), new MeshBasicMaterial({ color: 0x05070c }))
      stalk.position.set(0.08, 0.46, 0)
      stalk.rotation.z = -0.35
      const tip = new Mesh(new SphereGeometry(0.075, 12, 10), new MeshBasicMaterial({ color: '#FFE27A' }))
      tip.position.set(0.15, 0.62, 0)
      g.add(body, tail, stalk, tip)
      for (const z of [-0.13, 0.13]) {
        const eye = new Mesh(new SphereGeometry(0.1, 14, 10), new MeshBasicMaterial({ color: 0xffffff }))
        eye.scale.set(0.5, 1.15, 0.9)
        eye.position.set(0.31, 0.08, z)
        const pupil = new Mesh(new SphereGeometry(0.055, 10, 8), new MeshBasicMaterial({ color: 0x05070c }))
        pupil.position.set(0.355, 0.07, z + 0.02)
        g.add(eye, pupil)
      }
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

    // Distance travelled along the track (the engine resets bgOffset on a new run).
    const S = e.bgOffset / u
    if (this.lastS === null || S < this.lastS - 1e-6) {
      this.plan = new TrackPlan({ first: 60, rng: e.seed ? rngFromSeed(e.seed, 'track') : undefined, ...(this.world.track ?? { straight: [30, 60], weights: { left: 1, right: 1, uturn: 1 } }) })
      this.pose = { phi: 0, tx: 0, tz: 0, sky: 0 }
      for (const d of this.decor) d.S0 = null
      this.lastS = S
    }
    const dS = S - this.lastS
    this.lastS = S
    this.path.update(this.plan, S)
    this.updateWorldFrames(S, dS)
    this.announceTurns(S)
    this.fillRibbons(S)
    this.placeDecor(S)

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
      else if (kind === 'blob') this.avatar.rotation.z = clamp(-e.vy / (900 * e.s), -1, 1) * 0.4
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
    // The chase camera rides the track behind the avatar and looks into the bend.
    const back = this.path.at(-6.5)
    const cx = back.x - Math.sin(back.th) * shx
    const cz = back.z + Math.cos(back.th) * shx
    const ahead = this.path.at(3) // aim a little ahead so tight bends keep the avatar in frame
    cam.position.set(cx, 4.6 + (Y - R) * 0.3 + shy, cz)
    cam.lookAt(ahead.x, 0.3 + (Y - R) * 0.15, ahead.z)

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
      const pt = this.path.at((p.x - e.orbX) / u)
      this.pPos[i * 3] = pt.x - Math.sin(pt.th) * p.z
      this.pPos[i * 3 + 1] = (e.floorTop - p.y) / u
      this.pPos[i * 3 + 2] = pt.z + Math.cos(pt.th) * p.z
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
