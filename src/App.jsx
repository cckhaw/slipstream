import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Engine } from './game/engine.js'
import { AudioEngine } from './game/audio.js'
import * as store from './lib/storage.js'
import Hud from './components/Hud.jsx'
import Menu from './components/Menu.jsx'
import PauseMenu from './components/PauseMenu.jsx'
import GameOver from './components/GameOver.jsx'
import Tutorial from './components/Tutorial.jsx'

const EMPTY_HUD = { score: 0, mult: 1, charge: 0, progress: 0 }

export default function App() {
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const pointers = useRef(new Set())
  const handlers = useRef({})

  const [muted, setMuted] = useState(() => store.read(store.MUTED_KEY) === '1')
  const audio = useMemo(() => new AudioEngine(muted), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [screen, setScreen] = useState('menu') // menu | tutorial | playing | paused | over
  const [hud, setHud] = useState(EMPTY_HUD)
  const [tutStep, setTutStep] = useState(0)
  const [metrics, setMetrics] = useState({ floorTop: 600, floorH: 96, s: 1 })
  const [best, setBest] = useState(() => Number(store.read(store.BEST_KEY, 0)))
  const [result, setResult] = useState({ score: 0, isNewBest: false })
  const [go, setGo] = useState(false)

  const screenRef = useRef(screen)
  screenRef.current = screen

  // Engine -> React bridge. Kept in a ref so the engine never holds stale closures.
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
      setTimeout(() => setGo(false), 1100)
    },
    gameover: ({ score }) => {
      const prev = Number(store.read(store.BEST_KEY, 0))
      const isNewBest = score > prev
      if (isNewBest) {
        store.write(store.BEST_KEY, score)
        setBest(score)
      }
      setResult({ score, isNewBest })
      setScreen('over')
    },
  }

  const startTutorial = useCallback(() => {
    engineRef.current?.startTutorial()
    setHud(EMPTY_HUD)
    setTutStep(0)
    setScreen('tutorial')
  }, [])

  const startRun = useCallback(() => {
    engineRef.current?.startRun()
    setHud(EMPTY_HUD)
    setScreen('playing')
  }, [])

  const toMenu = useCallback(() => {
    engineRef.current?.toIdle()
    setHud(EMPTY_HUD)
    setScreen('menu')
  }, [])

  const skipTutorial = useCallback(() => {
    store.write(store.TUTORIAL_KEY, '1')
    startRun()
  }, [startRun])

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

  // Engine lifecycle.
  useEffect(() => {
    const engine = new Engine(canvasRef.current, {
      audio,
      onEvent: (name, data) => handlers.current[name]?.(data),
      onResize: setMetrics,
    })
    engineRef.current = engine
    if (store.read(store.TUTORIAL_KEY) !== '1') startTutorial() // first-time players
    return () => engine.destroy()
  }, [audio, startTutorial])

  // Auto-pause when the tab/app is backgrounded.
  useEffect(() => {
    const onHide = () => document.hidden && pause()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('blur', pause)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('blur', pause)
    }
  }, [pause])

  // Keyboard (desktop testing): hold Space / Down.
  useEffect(() => {
    const isHold = (e) => e.code === 'Space' || e.code === 'ArrowDown'
    const down = (e) => {
      if (!isHold(e) || e.repeat || e.target.closest?.('button')) return
      e.preventDefault()
      audio.unlock()
      engineRef.current?.setHold(true)
    }
    const up = (e) => {
      if (!isHold(e)) return
      engineRef.current?.setHold(false)
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

  const inRun = screen === 'playing' || screen === 'paused' || screen === 'over' || screen === 'tutorial'

  return (
    <div className="fixed inset-0 overflow-hidden bg-obsidian font-sans text-label touch-none-all" onPointerDownCapture={() => audio.unlock()}>
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-label="Slipstream game field" />

      {/* Full-screen input surface */}
      <div
        className="absolute inset-0 touch-none-all"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onContextMenu={(e) => e.preventDefault()}
      />

      {inRun && <Hud hud={hud} best={best} showPause={screen === 'playing'} onPause={pause} />}

      {screen === 'menu' && (
        <Menu best={best} muted={muted} onPlay={startRun} onTutorial={startTutorial} onToggleMute={toggleMute} />
      )}
      {screen === 'tutorial' && (
        <Tutorial
          step={tutStep}
          metrics={metrics}
          progress={hud.progress}
          onNext={() => {
            audio.ui()
            engineRef.current?.tutorialNext()
          }}
          onSkip={skipTutorial}
        />
      )}
      {screen === 'paused' && <PauseMenu muted={muted} onResume={resume} onQuit={toMenu} onToggleMute={toggleMute} />}
      {screen === 'over' && (
        <GameOver score={result.score} best={best} isNewBest={result.isNewBest} onRetry={startRun} onMenu={toMenu} />
      )}
      {go && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="animate-go-out text-[64px] font-extrabold tracking-tight text-orb drop-shadow-[0_0_24px_rgba(0,245,212,0.6)]">GO</div>
        </div>
      )}
    </div>
  )
}
