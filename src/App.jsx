import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Engine } from './game/engine.js'
import { AudioEngine } from './game/audio.js'
import { getWorld } from './game/worlds.js'
import * as store from './lib/storage.js'
import * as lb from './lib/leaderboard.js'
import Hud from './components/Hud.jsx'
import Menu from './components/Menu.jsx'
import PauseMenu from './components/PauseMenu.jsx'
import GameOver from './components/GameOver.jsx'
import Tutorial from './components/Tutorial.jsx'
import ProfileSetup from './components/ProfileSetup.jsx'
import WorldSelect from './components/WorldSelect.jsx'
import Leaderboard from './components/Leaderboard.jsx'
import { Panel, Tag, TurnArrow } from './components/ui.jsx'

const EMPTY_HUD = { score: 0, mult: 1, charge: 0, progress: 0 }
const LAST_WORLD_KEY = 'lastWorld'

export default function App() {
  const canvas2dRef = useRef(null)
  const canvas3dRef = useRef(null)
  const mulRef = useRef(null)
  const fxRef = useRef(null)
  const engineRef = useRef(null)
  const pointers = useRef(new Set())
  const handlers = useRef({})
  const timers = useRef({})

  const [muted, setMuted] = useState(() => store.read(store.MUTED_KEY) === '1')
  const [musicOn, setMusicOn] = useState(() => store.read(store.MUSIC_KEY) !== '0')
  const audio = useMemo(() => new AudioEngine(muted, musicOn), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Returning players are recognised from localStorage and never re-type their name.
  const [profile, setProfile] = useState(() => lb.loadProfile())
  const [screen, setScreen] = useState(() => (lb.loadProfile() ? 'menu' : 'profile'))
  const [hud, setHud] = useState(EMPTY_HUD)
  const [tutStep, setTutStep] = useState(0)
  const [metrics, setMetrics] = useState({ floorTop: 600, floorH: 96, s: 1 })
  const [worldId, setWorldId] = useState(() => getWorld(store.read(LAST_WORLD_KEY, 'neon')).id)
  const [lbWorld, setLbWorld] = useState(worldId)
  const [best, setBest] = useState(0)
  const [result, setResult] = useState({ score: 0, isNewBest: false, rank: null })
  const [go, setGo] = useState(false)
  const [popup, setPopup] = useState(null)
  const [toast, setToast] = useState(null)
  const [turn, setTurn] = useState(null)

  const screenRef = useRef(screen)
  screenRef.current = screen
  const profileRef = useRef(profile)
  profileRef.current = profile
  const worldRef = useRef(worldId)
  worldRef.current = worldId

  const flash = useCallback((setter, value, ms, key) => {
    clearTimeout(timers.current[key])
    setter(value)
    timers.current[key] = setTimeout(() => setter(null), ms)
  }, [])

  // Engine -> React bridge (a ref so the engine never holds stale closures).
  handlers.current = {
    hud: (d) =>
      setHud((p) =>
        p.score === d.score && p.mult === d.mult && p.charge === d.charge && p.progress === d.progress ? p : d,
      ),
    'tutorial-step': (step) => setTutStep(step),
    'tutorial-complete': () => {
      store.write(store.TUTORIAL_KEY, '1')
      setScreen('playing')
      setGo(true)
      clearTimeout(timers.current.go)
      timers.current.go = setTimeout(() => setGo(false), 1100)
    },
    popup: ({ text }) => flash(setPopup, text, 900, 'popup'),
    turn: ({ kind, dir }) => flash(setTurn, { kind, dir, id: Date.now() }, 2400, 'turn'),
    gameover: async ({ score }) => {
      const w = getWorld(worldRef.current)
      const p = profileRef.current
      setResult({ score, isNewBest: false, rank: null })
      setScreen('over')
      const r = p && score > 0 ? await lb.submitScore(w.id, p, score) : { isNewBest: false, rank: null, best: lb.bestFor(w.id, p) }
      setBest(r.best ?? 0)
      setResult({ score, isNewBest: r.isNewBest, rank: r.rank })
    },
  }

  // ---- navigation ----------------------------------------------------------

  const toMenu = useCallback(async () => {
    const eng = engineRef.current
    await eng?.setWorld('neon') // calm 2D backdrop behind menus
    eng?.toIdle()
    setHud(EMPTY_HUD)
    setScreen('menu')
  }, [])

  const startTutorial = useCallback(async () => {
    const eng = engineRef.current
    await eng.setWorld('neon')
    setWorldId('neon')
    eng.startTutorial()
    setHud(EMPTY_HUD)
    setTutStep(0)
    setScreen('tutorial')
  }, [])

  const startRun = useCallback(
    async (id = worldRef.current) => {
      const eng = engineRef.current
      const w = getWorld(id)
      setWorldId(w.id)
      store.write(LAST_WORLD_KEY, w.id)
      if (w.kind === '3d') setScreen('loading')
      try {
        await eng.setWorld(w.id)
      } catch (err) {
        console.error('3D unavailable', err)
        flash(setToast, "3D worlds aren't supported on this device.", 3200, 'toast')
        await eng.setWorld('neon')
        setScreen('worlds')
        return
      }
      eng.playerColor = profileRef.current?.color ?? eng.playerColor
      eng.startRun()
      setHud(EMPTY_HUD)
      setBest(lb.bestFor(w.id, profileRef.current))
      setScreen('playing')
    },
    [flash],
  )

  const skipTutorial = useCallback(() => {
    store.write(store.TUTORIAL_KEY, '1')
    startRun('neon')
  }, [startRun])

  const afterProfile = useCallback(
    (p, wasNew) => {
      setProfile(p)
      profileRef.current = p
      if (engineRef.current) engineRef.current.playerColor = p.color
      if (wasNew && store.read(store.TUTORIAL_KEY) !== '1') startTutorial()
      else setScreen('menu')
    },
    [startTutorial],
  )

  const pause = useCallback(() => {
    if (screenRef.current !== 'playing') return
    pointers.current.clear()
    engineRef.current?.setPaused(true)
    setScreen('paused')
  }, [])

  const resume = useCallback(() => {
    engineRef.current?.setPaused(false)
    setScreen('playing')
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      audio.setMuted(!m)
      store.write(store.MUTED_KEY, !m ? '1' : '0')
      return !m
    })
  }, [audio])

  const toggleMusic = useCallback(() => {
    setMusicOn((on) => {
      audio.setMusicOn(!on)
      store.write(store.MUSIC_KEY, !on ? '1' : '0')
      return !on
    })
  }, [audio])

  // ---- engine lifecycle ----------------------------------------------------

  useEffect(() => {
    const engine = new Engine(
      { c2d: canvas2dRef.current, c3d: canvas3dRef.current, mul: mulRef.current, fx: fxRef.current },
      { audio, onEvent: (name, data) => handlers.current[name]?.(data), onResize: setMetrics },
    )
    engineRef.current = engine
    if (new URLSearchParams(window.location.search).has('debug')) window.__slipstream = engine // test hook
    if (profileRef.current) engine.playerColor = profileRef.current.color
    // Returning players: say hello. Players who never finished the tutorial get it now.
    if (profileRef.current) {
      if (store.read(store.TUTORIAL_KEY) !== '1') startTutorial()
      else flash(setToast, `Welcome back, ${profileRef.current.name}!`, 2600, 'toast')
    }
    return () => engine.destroy()
  }, [audio, startTutorial, flash])

  // Auto-pause when the tab/app is backgrounded.
  useEffect(() => {
    const onHide = () => {
      audio.suspend(document.hidden)
      if (document.hidden) pause()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('blur', pause)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('blur', pause)
    }
  }, [pause, audio])

  // Keyboard (desktop testing): hold Space / Down.
  useEffect(() => {
    const isHold = (e) => e.code === 'Space' || e.code === 'ArrowDown'
    const skip = (e) => e.target.closest?.('button, input, textarea')
    const down = (e) => {
      if (!isHold(e) || e.repeat || skip(e)) return
      e.preventDefault()
      audio.unlock()
      engineRef.current?.setHold(true)
    }
    const up = (e) => {
      if (isHold(e)) engineRef.current?.setHold(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [audio])

  // Touch / pointer: press anywhere to hold, lift to release.
  const onPointerDown = (e) => {
    audio.unlock()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointers.current.add(e.pointerId)
    engineRef.current?.setHold(true)
  }
  const onPointerEnd = (e) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) engineRef.current?.setHold(false)
  }

  const world = getWorld(worldId)
  const inRun = ['playing', 'paused', 'over', 'tutorial'].includes(screen)

  return (
    <div
      className="touch-none-all fixed inset-0 overflow-hidden bg-obsidian font-sans text-label"
      onPointerDownCapture={() => audio.unlock()}
      onClickCapture={(e) => e.target.closest?.('button') && audio.ui()}
    >
      <div className="absolute inset-0">
        <canvas ref={canvas2dRef} className="absolute inset-0 block h-full w-full" aria-label="Slipstream game field" />
        <canvas ref={canvas3dRef} className="absolute inset-0 hidden h-full w-full" aria-label="Slipstream 3D game field" />
        {/* Weather: a multiply layer tints the scene, a transparent canvas draws rain, clouds, stars... */}
        <div ref={mulRef} className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-1000" style={{ mixBlendMode: 'multiply' }} aria-hidden="true" />
        <canvas ref={fxRef} className="pointer-events-none absolute inset-0 block h-full w-full" aria-hidden="true" />
      </div>

      {/* Full-screen input surface */}
      <div
        className="touch-none-all absolute inset-0"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onContextMenu={(e) => e.preventDefault()}
      />

      {inRun && (
        <Hud
          hud={hud}
          best={best}
          worldName={screen === 'tutorial' ? null : world.name}
          showPause={screen === 'playing'}
          onPause={pause}
        />
      )}

      {screen === 'profile' && (
        <ProfileSetup
          initial={profile}
          onSave={(vals) => afterProfile(lb.saveProfile(vals, profile), !profile)}
          onCancel={() => setScreen('menu')}
        />
      )}
      {screen === 'menu' && profile && (
        <Menu
          profile={profile}
          muted={muted}
          musicOn={musicOn}
          onPlay={() => setScreen('worlds')}
          onLeaderboard={() => {
            setLbWorld(worldId)
            setScreen('leaderboard')
          }}
          onTutorial={startTutorial}
          onEditProfile={() => setScreen('profile')}
          onToggleMute={toggleMute}
          onToggleMusic={toggleMusic}
        />
      )}
      {screen === 'worlds' && (
        <WorldSelect
          profile={profile}
          onPlay={startRun}
          onBoard={(id) => {
            setLbWorld(id)
            setScreen('leaderboard')
          }}
          onBack={() => setScreen('menu')}
        />
      )}
      {screen === 'leaderboard' && (
        <Leaderboard worldId={lbWorld} profile={profile} onSelectWorld={setLbWorld} onBack={() => setScreen('menu')} />
      )}
      {screen === 'tutorial' && (
        <Tutorial
          step={tutStep}
          metrics={metrics}
          progress={hud.progress}
          onNext={() => engineRef.current?.tutorialNext()}
          onSkip={skipTutorial}
        />
      )}
      {screen === 'loading' && (
        <div className="absolute inset-0 grid animate-fade-in place-items-center bg-[#070A14]/80 backdrop-blur-md" role="status">
          <Panel className="flex items-center gap-3 px-5 py-4">
            <span className="h-6 w-6 animate-spin rounded-full border-[4px] border-white/20 border-t-orb" aria-hidden="true" />
            <span className="font-display text-[18px] font-black">Loading {world.name}…</span>
          </Panel>
        </div>
      )}
      {screen === 'paused' && <PauseMenu muted={muted} musicOn={musicOn} onResume={resume} onQuit={toMenu} onToggleMute={toggleMute} onToggleMusic={toggleMusic} />}
      {screen === 'over' && (
        <GameOver
          world={world}
          result={result}
          profile={profile}
          onRetry={() => startRun(worldId)}
          onWorlds={async () => {
            await engineRef.current?.setWorld('neon')
            engineRef.current?.toIdle()
            setScreen('worlds')
          }}
          onMenu={toMenu}
        />
      )}

      {turn && screen === 'playing' && (
        <div
          key={turn.id}
          className={`pointer-events-none absolute inset-y-0 flex w-[40%] items-center text-white ${turn.dir < 0 ? 'left-0 justify-start pl-2' : 'right-0 justify-end pr-2'}`}
          aria-hidden="true"
        >
          <TurnArrow dir={turn.kind === 'uturn' ? 'uturn' : turn.dir < 0 ? 'left' : 'right'} size={230} className="animate-pulse opacity-50 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]" />
        </div>
      )}
      {popup && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(max(env(safe-area-inset-top),12px)+112px)] flex justify-center">
          <Tag className="animate-pop border-[3px] bg-coin px-3 py-1.5 text-[13px] text-[#3A2300]">{popup}</Tag>
        </div>
      )}
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),12px)+16px)] flex justify-center px-safe" role="status">
          <div className="chunk btn-dark animate-rise px-4 py-2.5 text-center font-display text-[16px] font-extrabold">{toast}</div>
        </div>
      )}
      {go && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="title-outline animate-go-out text-[72px]" style={{ color: '#00F5D4' }}>GO!</div>
        </div>
      )}
    </div>
  )
}
