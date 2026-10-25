// Profile + per-world leaderboards.
//
// Real players' scores live on the server (api/leaderboard.js) so every player sees the
// same global board per world. This device also keeps its own scores in localStorage:
// they feed the "Best" numbers and are the fallback when the server is unreachable.
// Each board is padded with clearly-labelled rival bots so the Top 10 is never empty.
import * as store from './storage.js'
import { WORLDS } from '../game/worlds.js'

const PROFILE_KEY = 'profile'
const boardKey = (worldId) => `lb.${worldId}`

// ---- profile -----------------------------------------------------------------

export function sanitizeName(raw) {
  return String(raw ?? '')
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12)
}

export function loadProfile() {
  try {
    const p = JSON.parse(store.read(PROFILE_KEY, 'null'))
    if (p && p.id && sanitizeName(p.name)) return p
  } catch {
    /* ignore */
  }
  return null
}

const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`

// Create or update the profile. Renames propagate to existing leaderboard rows.
export function saveProfile({ name, color }, existing = null) {
  const profile = { id: existing?.id ?? uid(), name: sanitizeName(name), color }
  store.write(PROFILE_KEY, JSON.stringify(profile))
  push({ world: WORLDS[0].id, id: profile.id, name: profile.name, color: profile.color })
  for (const w of WORLDS) {
    const rows = readHumans(w.id)
    let changed = false
    for (const r of rows) {
      if (r.id === profile.id) {
        r.name = profile.name
        r.color = profile.color
        changed = true
      }
    }
    if (changed) writeHumans(w.id, rows)
  }
  return profile
}

// ---- boards ------------------------------------------------------------------

function readHumans(worldId) {
  try {
    const rows = JSON.parse(store.read(boardKey(worldId), '[]'))
    return Array.isArray(rows) ? rows.filter((r) => r && r.id && Number.isFinite(r.score)) : []
  } catch {
    return []
  }
}

const writeHumans = (worldId, rows) => store.write(boardKey(worldId), JSON.stringify(rows))

const BOT_NAMES = ['Biscuit', 'Sparky', 'BlockBob', 'Zoomer', 'Pixel Pete', 'Jet Kid', 'Lava Larry', 'TNT Tim', 'Orbit', 'Nova', 'Glitch', 'Mochi']
const BOT_COLORS = ['#E5383B', '#FF8A1F', '#FFD93D', '#6EE35A', '#1FA34A', '#3D6BFF', '#8B5CF6', '#FF5FBF', '#E6EDF7', '#00F5D4']
const BOT_TOP = { neon: 8000, quarry: 9000, ship: 7500, voxel: 11000, obby: 12000, grid: 14000 }

function bots(worldId) {
  const top = BOT_TOP[worldId] ?? 2500
  const offset = WORLDS.findIndex((w) => w.id === worldId) * 3
  return Array.from({ length: 10 }, (_, i) => ({
    id: `bot:${worldId}:${i}`,
    name: BOT_NAMES[(i + offset) % BOT_NAMES.length],
    color: BOT_COLORS[(i * 3 + offset) % BOT_COLORS.length],
    score: Math.round((top * (0.1 + 0.9 * Math.pow(1 - i / 10, 1.9))) / 10) * 10,
    ts: 0,
    bot: true,
  }))
}

const byScore = (a, b) => b.score - a.score || a.ts - b.ts

// ---- server ------------------------------------------------------------------

const API = '/api/leaderboard'

// Last board the server sent for each world: shown instantly while a fresh one loads.
const cache = new Map()

async function call(url, init) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

async function request(worldId, init, url = API) {
  const server = await call(url, init)
  if (server) cache.set(worldId, server)
  return server
}

const push = (body) =>
  request(body.world, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

const pull = (worldId, profile) =>
  request(worldId, undefined, `${API}?world=${encodeURIComponent(worldId)}${profile ? `&id=${encodeURIComponent(profile.id)}` : ''}`)

// Merge the server's real players (or this device's, offline) with the labelled bots.
function compose(worldId, profile, server) {
  const humans = server ? server.top.map((r) => ({ ...r, ts: 0 })) : readHumans(worldId)
  const board = [...bots(worldId), ...humans].sort(byScore)
  const top = board.slice(0, 10)
  let me = null
  if (profile) {
    const i = board.findIndex((e) => e.id === profile.id)
    if (i >= 0) me = { entry: board[i], rank: i + 1 }
    else if (server?.me) {
      const s = server.me.score
      me = {
        entry: { id: profile.id, name: profile.name, color: profile.color, score: s },
        rank: server.me.rank + bots(worldId).filter((b) => b.score > s).length,
      }
    }
  }
  return { top, me, inTop: !!me && top.some((e) => e.id === profile.id), online: !!server }
}

// The cached server board with this device's own best patched in, so a score you just
// set shows up at once (the real answer replaces it a moment later).
function patched(worldId, profile) {
  const srv = cache.get(worldId)
  if (!srv || !profile) return srv ?? null
  const mine = readHumans(worldId).find((r) => r.id === profile.id)
  if (!mine || mine.score <= (srv.me?.score ?? 0)) return srv
  const me = { id: profile.id, name: profile.name, color: profile.color, score: mine.score }
  const top = [...srv.top.filter((r) => r.id !== profile.id), me].sort((a, b) => b.score - a.score).slice(0, 10)
  const above = srv.top.filter((r) => r.id !== profile.id && r.score > mine.score).length
  return { top, me: { ...me, rank: above + 1 } }
}

// Instant board from what this device already knows (no network).
export function instantView(worldId, profile) {
  return compose(worldId, profile, patched(worldId, profile))
}

// Warm the connection and the cache ahead of time (fire and forget).
export const prefetch = (worldId, profile) => void pull(worldId, profile)

// Top 10 plus the player's own row (with rank) when they fall outside it.
export async function view(worldId, profile) {
  return compose(worldId, profile, await pull(worldId, profile))
}

export function bestFor(worldId, profile) {
  if (!profile) return 0
  return readHumans(worldId).find((r) => r.id === profile.id)?.score ?? 0
}

// Save a finished run on this device and return the board straight away.
export function recordScore(worldId, profile, score) {
  const rows = readHumans(worldId)
  const i = rows.findIndex((r) => r.id === profile.id)
  const prev = i >= 0 ? rows[i].score : 0
  const isNewBest = score > prev
  if (isNewBest) {
    const entry = { id: profile.id, name: profile.name, color: profile.color, score, ts: Date.now() }
    if (i >= 0) rows[i] = entry
    else rows.push(entry)
    writeHumans(worldId, rows)
  }
  const v = instantView(worldId, profile)
  return { ...v, isNewBest, best: Math.max(prev, score), rank: v.me?.rank ?? null }
}

// Upload this device's best for the world and return the real global board.
// Always sends the best we know (a run that failed to upload earlier is retried here).
export async function syncScore(worldId, profile) {
  const server = await push({ world: worldId, id: profile.id, name: profile.name, color: profile.color, score: bestFor(worldId, profile) })
  const v = compose(worldId, profile, server)
  return { ...v, rank: v.me?.rank ?? null }
}
