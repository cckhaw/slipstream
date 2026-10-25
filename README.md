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

## Worlds (each has its own global leaderboard)
| World | Mode | Challenge |
| --- | --- | --- |
| Neon Conduit | 2D | The original: floor and ceiling lasers |
| Pixel Quarry | 2D | Lava pits, TNT stacks, block walls |
| Starship Drift | 2D | Low gravity, air-jet gusts, ceiling pipes |
| Voxel Valley | 3D | Heavy gravity, long walls, lava rivers; winding road (left / right / U-turns) |
| Obby Rush | 3D | Fast, pulsing bricks, frequent turns and U-turns |
| Neon Void | 3D | Everything at once, at high speed, the most U-turns |

3D worlds follow a curved road: `src/game/track3d.js` plans straights, left / right turns and U-turns (per-world mix in `worlds.js`), and the renderer bends the track, scenery, obstacles and camera along it. The jump gameplay is unchanged; a large translucent arrow appears on the side of the screen the road turns toward, 30 units before each bend.

World rules live in `src/game/worlds.js` (gravity, launch, speed, obstacle mix, moving barriers, gusts). Adding a world is one entry there plus a theme in `render2d.js` / `render3d.js`.

## Music
Every world has its own original background track, generated in the browser with Web Audio (`src/game/music.js`, no audio files): synthwave for Neon Conduit, calm chiptune for Pixel Quarry, spacious ambient for Starship Drift, a warm plucked adventure theme for Voxel Valley, a bouncy lead for Obby Rush and a dark four-on-the-floor groove for Neon Void. Each track is a 16-bar form (verse, lift, a bridge in a new chord progression, outro) with a lead melody, drum fills, risers and crashes, and gets brighter and busier as your multiplier climbs, duck while paused and fade out on a crash. Music and sound effects have separate toggles (menu and pause screen).

## Share and challenge a run
Game Over is an iOS-style glass sheet (`src/components/GameOverModal.tsx`) showing Final Score, Max Multiplier, the run's **Seed ID**, an emoji scorecard of the run and a one-tap **Challenge a friend** button. The scorecard maps telemetry in order: `⚡` slipstream (built another multiplier level on the lane), `✨` near miss, `🟩` clean pass, `💥` crash; long runs are squeezed into at most 24 cells (a near miss beats a slipstream beats a clean pass in each stretch). The share text is

```
⚡ SLIPSTREAM RUN
Score: 3,120 | Max: 4.7x
⚡🟩🟩✨🟩⚡🟩
🟩🟩✨⚡🟩💥
Can you beat my line? Play here: https://<host>/?seed=V7K3F9
```
Sharing uses `navigator.share()` where it exists (phones), otherwise the clipboard (with a legacy fallback) and a 2.5 s "Copied to Clipboard!" state (`src/lib/share.ts`).

**Seeds**: every run has a six-character seed. The first letter is the world (N Neon Conduit, Q Pixel Quarry, S Starship Drift, V Voxel Valley, O Obby Rush, G Neon Void), the rest is random. The same seed gives the same obstacle order (each spawn has its own seeded random stream) and the same turns on the 3D track. Opening `/?seed=V7K3F9` shows a "Challenge from a friend" card on the menu that starts that world with that seed. The seed fixes the course, not your pace: obstacle sizes still adapt to your multiplier, and the danger level is driven by your score. `src/lib/seed.js` has the generator, parser and PRNG.

The project now also has a `tsconfig.json` (`npm run typecheck`); the rest of the code is still JavaScript, and Vite compiles the `.ts` / `.tsx` files without extra setup.

## World list and home-screen reminder
The world list opens on a **2D Worlds | 3D Worlds** switch at the top (side by side, remembered next time, defaulting to the kind of the world you last played), so the 3D worlds are one tap away on a phone instead of below the fold. On touch devices that were not launched from a saved bookmark / installed app, the menu shows a short, dismissible "Add to Home Screen" reminder with the right steps for iOS (Share > Add to Home Screen) or Android (menu > Add to Home screen, or an Install button when the browser offers one). It disappears after 12 seconds; closing it by hand hides it for 3 days. It never shows in standalone mode or on desktop (`src/components/InstallTip.jsx`).

## Phones and 2D worlds
A phone shows far less road ahead than a desktop, so on narrow 2D screens (under 560px wide) the world runs at 72-100% speed (`vScale` in `engine.js`, scaled by screen width), the avatar sits nearer the left edge and obstacles spawn at least a second of travel off-screen. Every obstacle, including pits and the advanced kinds, shows a "!" marker at the right edge at the height it will arrive at; it swells and blinks faster as the obstacle closes in, and reads "!!" for rushers. Score is scaled back up by the same factor, so leaderboards stay fair across devices. 3D worlds are unaffected.

## Danger levels (advanced obstacles)
Every 10,000 points unlocks a new danger level: a banner announces it, the world runs about 2.5% faster per level and obstacles come a little closer together. Each level adds new kinds, mixed in with the normal ones (22% of spawns at level 1, up to 60%):
| Score | Level | New obstacles |
| --- | --- | --- |
| 10,000 | 1 | **Rushers**: floor blocks that close in 45-70% faster than the world scrolls (orange streaks). **Floaters**: mid-air slabs, duck under them on the ground or leap over |
| 20,000 | 2 | **Blink lasers**: floor lasers that retract and rise on a timer (a dashed outline shows their full height). **Hurdles**: three blocks in a row, spaced for a jump rhythm |
| 30,000 | 3 | **Moving gates**: thin walls whose gap slides up and down; go through low on the ground or time a jump through the high gap |
| 40,000 | 4 | **Pit combos**: a lava pit with a wall right after it: land, then jump again |
| 50,000+ | 5+ | No new kinds, just more of everything, faster |

Rules live in `src/game/engine.js` (`TIER_NEW`, `spawnAdvanced`, `rectsOf`); floaters and gates are drawn by `obsAdv` (2D) and the `parts` slabs (3D).

## Weather and time of day
As your score climbs the sky changes, in every 2D and 3D world: day, sunset, night (stars and a moon), cloudy, rain, thunderstorm with lightning, wind, fog and snow. Each world has its own cycle and themed names (Acid rain in Neon Conduit, Meteor shower and Ion storm in Starship Drift, Pixel rain in Neon Void...). The first change comes at 800 points, then at 2,000, 3,600, 5,600, 8,000 and 11,000, and every 3,000 after that; the order shifts on later laps. The sky eases over about four seconds, with no pop-up. Rain, wind and thunder have synthesised sound. Weather is visual and audio only: it never changes physics or obstacles. Reduce Motion turns off lightning flashes.

`src/game/weather.js` holds the thresholds, per-world cycles and drawing: a CSS `multiply` layer tints the scene and a transparent canvas on top draws the particles, so it works the same over the canvas and three.js renderers.

## Profile and leaderboards
Players pick a name and colour once; the profile is stored in `localStorage` so returning players are recognised and never retype it. There is **one global Top 10 per world**, shared by every player, plus your own rank if you fall outside it. Boards are padded with clearly labelled `BOT` rivals; only real players' scores are published.

Scores live in Neon Postgres (free plan, from the Vercel Marketplace) behind `api/leaderboard.js`, a Vercel serverless function: a `players` table and a `scores` table holding each player's best score per world; the tables are created on first use. The Neon integration injects `DATABASE_URL` into the Vercel project. The database is in Singapore, so `vercel.json` pins the functions to `sin1` (next to it); every request is a single database round trip. Without it the API returns 503 and the game falls back to a device-local board. `src/lib/leaderboard.js` is the only client module that touches scores. Note that scores are reported by the client, so this is a casual board, not cheat-proof.

## Layout
| Path | Purpose |
| --- | --- |
| `src/game/engine.js` | Physics, spawning, collisions, world rules, tutorial gating, main loop |
| `src/game/render2d.js` | Canvas renderer: neon / quarry / ship themes, orb / cube / Zip avatars |
| `src/game/render3d.js` | three.js chase-cam renderer: voxel / obby / grid themes, curved track |
| `src/game/track3d.js` | Track planner and path sampler for 3D turns |
| `src/game/weather.js` | Weather / time-of-day director and overlay drawing (all worlds) |
| `src/game/audio.js` | Synthesised sound effects (Web Audio) |
| `api/leaderboard.js` | Global leaderboard endpoint (Neon Postgres-backed serverless function) |
| `src/lib/` | Storage, leaderboard + profile, colours, seeds (`seed.js`), share text (`share.ts`) |
| `src/components/` | Chunky UI kit (`ui.jsx`), menus, world select, leaderboard, HUD, tutorial |
| `tailwind.config.js` | Palette plus `chunk`, `panel`, `slot`, `title-outline`, `title-pixel` and `glass` utilities |

Append `?debug` to the URL to expose the engine as `window.__slipstream` for testing.

## Deployment
`vercel.json` skips Vercel builds for every branch except `main`, so pull requests do not create preview deployments; merging to `main` creates the production build. (`ignoreCommand` exits 0 to skip a build and 1 to build.)
