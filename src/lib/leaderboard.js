// Profile + per-world leaderboards.
//
// Storage is local to this device (localStorage). The rest of the app only uses the
// functions below, so a network backend can replace the read/write helpers later.
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

const BOT_NAMES = ['Beanie', 'Sparky', 'BlockBob', 'Zoomer', 'Pixel Pete', 'Vent Kid', 'Lava Larry', 'TNT Tim', 'Orbit', 'Nova', 'Glitch', 'Mochi']
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

export function getBoard(worldId) {
  return [...bots(worldId), ...readHumans(worldId)].sort(byScore)
}

// Top 10 plus the player's own row (with rank) when they fall outside it.
export function view(worldId, profile) {
  const board = getBoard(worldId)
  const top = board.slice(0, 10)
  const idx = profile ? board.findIndex((e) => e.id === profile.id) : -1
  return {
    top,
    me: idx >= 0 ? { entry: board[idx], rank: idx + 1 } : null,
    inTop: idx >= 0 && idx < 10,
  }
}

export function bestFor(worldId, profile) {
  if (!profile) return 0
  return readHumans(worldId).find((r) => r.id === profile.id)?.score ?? 0
}

export function submitScore(worldId, profile, score) {
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
  const v = view(worldId, profile)
  return { ...v, isNewBest, best: Math.max(prev, score), rank: v.me?.rank ?? null }
}
