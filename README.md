# Slipstream

A one-touch mobile arcade game for the browser: React + Vite + Tailwind, HTML5 Canvas (2D worlds), three.js (3D worlds) and Web Audio. The UI mixes Apple HIG basics (44pt+ touch targets, safe areas, system fonts, Reduce Motion) with a chunky, bevelled, heavily outlined game look. The mascot is an original character called Zip.

```bash
npm install
npm run dev      # http://localhost:5173 (also reachable from your phone on the LAN)
npm run build    # production bundle in dist/ (three.js is lazy-loaded for 3D worlds)
```

## How to play
- **Tap & hold** anywhere: the avatar is pulled onto the pink Slipstream lane, building speed and a multiplier (up to x10).
- **Release**: launch in an arc over floor obstacles. Launch height grows with your multiplier.
- **Hold in mid-air** to dive back down and slip under ceiling hazards.
- Near misses earn bonus points. First-time players get an interactive tutorial; "How to Play" replays it. Desktop: Space / Down works as hold.

## Worlds (each has its own leaderboard)
| World | Mode | Challenge |
| --- | --- | --- |
| Neon Conduit | 2D | The original: floor and ceiling lasers |
| Pixel Quarry | 2D | Lava pits, TNT stacks, block walls |
| Starship Drift | 2D | Low gravity, air-jet gusts, ceiling pipes |
| Voxel Valley | 3D | Heavy gravity, long walls, lava rivers; winding road (left / right / U-turns) |
| Obby Rush | 3D | Fast, pulsing bricks, frequent turns and U-turns |
| Neon Void | 3D | Everything at once, at high speed, the most U-turns |

3D worlds follow a curved road: `src/game/track3d.js` plans straights, left / right turns and U-turns (per-world mix in `worlds.js`), and the renderer bends the track, scenery, obstacles and camera along it. The jump gameplay is unchanged; a "turn ahead" cue appears in the HUD 30 units before each bend.

World rules live in `src/game/worlds.js` (gravity, launch, speed, obstacle mix, moving barriers, gusts). Adding a world is one entry there plus a theme in `render2d.js` / `render3d.js`.

## Music
Every world has its own original background track, generated in the browser with Web Audio (`src/game/music.js`, no audio files): synthwave for Neon Conduit, calm chiptune for Pixel Quarry, spacious ambient for Starship Drift, a warm plucked adventure theme for Voxel Valley, a bouncy lead for Obby Rush and a dark four-on-the-floor groove for Neon Void. Tracks get brighter and busier as your multiplier climbs, duck while paused and fade out on a crash. Music and sound effects have separate toggles (menu and pause screen).

## Profile and leaderboards
Players pick a name and colour once; the profile is stored in `localStorage` so returning players are recognised and never retype it. Each world keeps a Top 10 (plus your own rank if you fall outside it).

**Scores are stored on the device**, not on a server. Boards are padded with clearly labelled `BOT` rivals so the Top 10 is never empty. `src/lib/leaderboard.js` is the only module that reads or writes scores, so a network backend can replace it without touching the UI.

## Layout
| Path | Purpose |
| --- | --- |
| `src/game/engine.js` | Physics, spawning, collisions, world rules, tutorial gating, main loop |
| `src/game/render2d.js` | Canvas renderer: neon / quarry / ship themes, orb / cube / Zip avatars |
| `src/game/render3d.js` | three.js chase-cam renderer: voxel / obby / grid themes, curved track |
| `src/game/track3d.js` | Track planner and path sampler for 3D turns |
| `src/game/audio.js` | Synthesised sound effects (Web Audio) |
| `src/lib/` | Storage, leaderboard + profile, colours |
| `src/components/` | Chunky UI kit (`ui.jsx`), menus, world select, leaderboard, HUD, tutorial |
| `tailwind.config.js` | Palette plus `chunk`, `panel`, `slot`, `title-outline`, `title-pixel` and `glass` utilities |

Append `?debug` to the URL to expose the engine as `window.__slipstream` for testing.

## Deployment
`vercel.json` skips Vercel builds for every branch except `main`, so pull requests do not create preview deployments; merging to `main` creates the production build. (`ignoreCommand` exits 0 to skip a build and 1 to build.)
