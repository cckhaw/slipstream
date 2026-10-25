import { useEffect, useState } from 'react'
import * as store from '../lib/storage.js'
import { CloseIcon } from './ui.jsx'

const SNOOZE_KEY = 'installTipUntil'
const SNOOZE_MS = 3 * 24 * 3600 * 1000

// Chrome / Android fire this once, possibly before React mounts: keep the event around.
let deferred = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e
  })
}

const standalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.matchMedia?.('(display-mode: fullscreen)').matches ||
  window.navigator.standalone === true

const isTouch = () => window.matchMedia?.('(pointer: coarse)').matches
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const ShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-[-3px]" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
)

// A quick reminder, on touch devices only, that the game can live on the home screen.
// Not shown when it is already running from a saved bookmark / installed app.
export default function InstallTip() {
  const [show, setShow] = useState(false)
  const [canInstall, setCanInstall] = useState(!!deferred)

  useEffect(() => {
    if (standalone() || !isTouch()) return undefined
    if (Number(store.read(SNOOZE_KEY, 0)) > Date.now()) return undefined
    const onPrompt = () => setCanInstall(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    const showT = setTimeout(() => setShow(true), 3000)
    const hideT = setTimeout(() => setShow(false), 12000)
    return () => {
      clearTimeout(showT)
      clearTimeout(hideT)
      window.removeEventListener('beforeinstallprompt', onPrompt)
    }
  }, [])

  if (!show) return null

  const close = () => {
    store.write(SNOOZE_KEY, Date.now() + SNOOZE_MS) // closed by hand: leave them alone for a few days
    setShow(false)
  }
  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice.catch(() => {})
    deferred = null
    setShow(false)
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(max(env(safe-area-inset-top),12px)+12px)] flex justify-center px-safe" role="status">
      <div className="chunk btn-dark animate-pop pointer-events-auto relative max-w-[340px] py-3 pl-4 pr-12 text-left font-display text-[15px] font-extrabold leading-snug">
        <div className="text-coin">Play faster from your home screen</div>
        <div className="mt-0.5 text-[14px] font-bold text-label-secondary">
          {canInstall ? (
            <button type="button" onClick={install} className="chunk btn-gold mt-1.5 min-h-[44px] px-4 text-[15px] font-black">
              Add to Home Screen
            </button>
          ) : isIOS() ? (
            <>Tap <ShareIcon /> Share, then <b className="text-label">Add to Home Screen</b>.</>
          ) : (
            <>Open the browser menu (⋮), then tap <b className="text-label">Add to Home screen</b>.</>
          )}
        </div>
        <button type="button" aria-label="Dismiss" onClick={close} className="chunk btn-dark absolute right-1.5 top-1.5 grid h-11 w-11 place-items-center !rounded-xl">
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
