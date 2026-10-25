// localStorage can throw (private mode, blocked storage); the game must still run.
const PREFIX = 'slipstream.'

export function read(key, fallback = null) {
  try {
    const v = window.localStorage.getItem(PREFIX + key)
    return v === null ? fallback : v
  } catch {
    return fallback
  }
}

export function write(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, String(value))
  } catch {
    /* ignore */
  }
}

export const TUTORIAL_KEY = 'tutorialDone'
export const BEST_KEY = 'best'
export const MUTED_KEY = 'muted'
export const MUSIC_KEY = 'music'
