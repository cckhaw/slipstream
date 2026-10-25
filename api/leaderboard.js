// Global leaderboard: one board per world, shared by every player.
//
// Storage is a Redis-compatible REST database (Upstash Redis, added from the Vercel
// Marketplace; it injects KV_REST_API_URL / KV_REST_API_TOKEN or UPSTASH_REDIS_REST_*).
//   lb:<world>   sorted set: player id -> best score
//   lb:profiles  hash:       player id -> {"name","color"}
// Only real players are stored here; the client pads boards with labelled bots.
//
//   GET  /api/leaderboard?world=voxel&id=<playerId>   -> board (+ the caller's rank)
//   POST /api/leaderboard {world,id,name,color,score} -> records a best score, returns the board
//        (omit score to only update the player's name / colour)

const WORLDS = ['neon', 'quarry', 'ship', 'voxel', 'obby', 'grid']
const MAX_SCORE = 5_000_000
const TOP = 10

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

async function redis(commands) {
  const res = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  })
  if (!res.ok) throw new Error(`redis ${res.status}`)
  const out = await res.json()
  return out.map((r) => {
    if (r.error) throw new Error(r.error)
    return r.result
  })
}

const cleanName = (raw) =>
  String(raw ?? '')
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12)

const validId = (id) => typeof id === 'string' && /^[\w-]{8,64}$/.test(id)
const validColor = (c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)

async function board(world, id) {
  const key = `lb:${world}`
  const [flat, rank, score] = await redis([
    ['ZREVRANGE', key, 0, TOP - 1, 'WITHSCORES'],
    ['ZREVRANK', key, id || ''],
    ['ZSCORE', key, id || ''],
  ])
  const ids = []
  const scores = []
  for (let i = 0; i < flat.length; i += 2) {
    ids.push(flat[i])
    scores.push(Number(flat[i + 1]))
  }
  const want = id && !ids.includes(id) && score !== null ? [...ids, id] : ids
  const profiles = want.length ? (await redis([['HMGET', 'lb:profiles', ...want]]))[0] : []
  const parse = (raw) => {
    try {
      return JSON.parse(raw) ?? {}
    } catch {
      return {}
    }
  }
  const row = (pid, s, i) => {
    const p = parse(profiles[i])
    return { id: pid, name: p.name || 'Player', color: p.color || '#3D6BFF', score: s }
  }
  return {
    top: ids.map((pid, i) => row(pid, scores[i], i)),
    me: id && score !== null ? { ...row(id, Number(score), want.indexOf(id)), rank: rank + 1 } : null,
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'no-backend' })
  try {
    if (req.method === 'GET') {
      const { world, id } = req.query
      if (!WORLDS.includes(world)) return res.status(400).json({ error: 'bad-world' })
      return res.status(200).json(await board(world, validId(id) ? id : ''))
    }
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
      const name = cleanName(b.name)
      if (!WORLDS.includes(b.world) || !validId(b.id) || !name || !validColor(b.color)) {
        return res.status(400).json({ error: 'bad-request' })
      }
      const cmds = [['HSET', 'lb:profiles', b.id, JSON.stringify({ name, color: b.color })]]
      const score = Math.floor(Number(b.score))
      if (Number.isFinite(score) && score > 0) {
        if (score > MAX_SCORE) return res.status(400).json({ error: 'bad-score' })
        cmds.push(['ZADD', `lb:${b.world}`, 'GT', score, b.id]) // keeps the player's best only
      }
      await redis(cmds)
      return res.status(200).json(await board(b.world, b.id))
    }
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'method' })
  } catch {
    return res.status(502).json({ error: 'backend' })
  }
}
