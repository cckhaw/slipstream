# Slipstream

A one-touch mobile arcade game for the browser. React + Vite + HTML5 Canvas + Tailwind CSS + Web Audio, styled after Apple's Human Interface Guidelines (frosted glass, squircle corners, SF system font, safe-area aware, 44pt+ touch targets, Reduce Motion support).

```bash
npm install
npm run dev      # http://localhost:5173 (also reachable from your phone on the LAN)
npm run build    # production bundle in dist/
```

## How to play
- **Tap & hold** anywhere: the orb is pulled onto the pink Slipstream floor, building speed and a multiplier (up to ×10).
- **Release**: slingshot into an arc over gold floor lasers. Launch height grows with your multiplier.
- **Hold in mid-air** to dive back down and slip under red ceiling lasers.
- Near misses earn bonus points and charge. First-time players get an interactive 3-step tutorial (stored in `localStorage`); "How to Play" replays it. Desktop: Space / ↓ works as hold.

## Layout
| Path | Purpose |
| --- | --- |
| `src/game/engine.js` | Physics, spawning, collisions, tutorial gating, Canvas rendering |
| `src/game/audio.js` | Synthesised sound effects (Web Audio) |
| `src/components/` | Glass UI: HUD, menu, pause, game over, tutorial overlay |
| `tailwind.config.js` | Apple palette, `glass` / `glass-strong` / `glass-pill` utilities, animations |
