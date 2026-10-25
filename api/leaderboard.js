// Global leaderboard: one board per world, shared by every player.
//
// Storage is Neon Postgres (free plan, added from the Vercel Marketplace; it injects
// DATABASE_URL). Only real players are stored; the client pads boards with labelled bots.
//   players(id, name, color)          one row per player
//   scores(world, id, score, at)      the player's best score per world
//
//   GET  /api/leaderboard?world=voxel&id=<playerId>   -> board (+ the caller's rank)
//   POST /api/leaderboard {world,id,name,color,score} -> records a best score, returns the board
//        (omit score to only update the player's name / colour)

import { neon } from '@neondatabase/serverless'

const WORLDS = ['neon', 'quarry', 'ship', 'voxel', 'obby', 'grid']
const MAX_SCORE = 5_000_000
const TOP = 10

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL
const sql = DB_URL ? neon(DB_URL) : null
let ready = null

const setup = () =>
  (ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS players (id text PRIMARY KEY, name text NOT NULL, color text NOT NULL)`
    await sql`CREATE TABLE IF NOT EXISTS scores (
      world text NOT NULL, id text NOT NULL, score integer NOT NULL, at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (world, id))`
    await sql`CREATE INDEX IF NOT EXISTS scores_rank ON scores (world, score DESC, at)`
  })().catch((e) => {
    ready = null
    throw e
  }))

// Every request is ONE round trip to the database (a transaction of statements). The tables
// are only created if the first attempt finds them missing, so the normal path has no setup.
async function run(statements) {
  try {
    return await sql.transaction(statements())
  } catch (e) {
    if (e?.code !== '42P01') throw e
    await setup()
    return sql.transaction(statements())
  }
}

const cleanName = (raw) =>
  String(raw ?? '')
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12)

const validId = (id) => typeof id === 'string' && /^[\w-]{8,64}$/.test(id)
const validColor = (c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)

const topQuery = (world) =>
  sql`SELECT s.id, p.name, p.color, s.score FROM scores s JOIN players p ON p.id = s.id
      WHERE s.world = ${world} ORDER BY s.score DESC, s.at ASC LIMIT ${TOP}`

const meQuery = (world, id) =>
  sql`SELECT s.id, p.name, p.color, s.score,
        (SELECT count(*)::int FROM scores o WHERE o.world = ${world} AND o.score > s.score) + 1 AS rank
      FROM scores s JOIN players p ON p.id = s.id WHERE s.world = ${world} AND s.id = ${id}`

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (!sql) return res.status(503).json({ error: 'no-backend' })
  try {
    if (req.method === 'GET') {
      const { world, id } = req.query
      if (!WORLDS.includes(world)) return res.status(400).json({ error: 'bad-world' })
      const [top, me] = await run(() => [topQuery(world), meQuery(world, validId(id) ? id : '')])
      return res.status(200).json({ top, me: me[0] ?? null })
    }
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
      const name = cleanName(b.name)
      if (!WORLDS.includes(b.world) || !validId(b.id) || !name || !validColor(b.color)) {
        return res.status(400).json({ error: 'bad-request' })
      }
      const score = Math.floor(Number(b.score))
      if (Number.isFinite(score) && score > MAX_SCORE) return res.status(400).json({ error: 'bad-score' })
      const write = Number.isFinite(score) && score > 0
      const out = await run(() => [
        sql`INSERT INTO players (id, name, color) VALUES (${b.id}, ${name}, ${b.color})
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color`,
        // Keeps the player's best only.
        write
          ? sql`INSERT INTO scores (world, id, score) VALUES (${b.world}, ${b.id}, ${score})
                ON CONFLICT (world, id) DO UPDATE SET score = EXCLUDED.score, at = now()
                WHERE EXCLUDED.score > scores.score`
          : sql`SELECT 1`,
        topQuery(b.world),
        meQuery(b.world, b.id),
      ])
      return res.status(200).json({ top: out[2], me: out[3][0] ?? null })
    }
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'method' })
  } catch {
    return res.status(502).json({ error: 'backend' })
  }
}
