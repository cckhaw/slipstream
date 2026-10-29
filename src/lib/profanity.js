// Name filter for the leaderboard: blocks profanity, slurs and sexual terms in player names.
//
// It runs in the browser when a name is entered and again on the server (api/leaderboard.js)
// so the shared board stays clean even if a client skips the check. Matching copes with the
// usual disguises (leetspeak such as "sh1t", "f.u.c.k" / "f u c k", stretched letters such
// as "fuuuck", accents) while avoiding the Scunthorpe problem: short or ambiguous words only
// match as a whole word, so "Assassin", "Essex" and "Peacock" are fine.
//
// The lists are stored ROT13-encoded only so that this file does not read as a wall of
// slurs. It is a best-effort filter, not a guarantee.

const rot13 = (s) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97))

// Matched anywhere inside a word (long or unmistakable terms).
const STRONG = rot13('shpx fuvg ovgpu phag nffubyr onfgneq juber fyhg avtt sntt ergneq chffl gjng cbea obyybpx qvyqb wvmm phzfubg oybjwbo unaqwbo uvgyre qhzonff wnpxnff evzwbo gvggl gvggvr znfgheong betnfz rwnphyng rerpgvba intvan cravf travgny ohttre genaal puvax tbbx zbgures').split(' ')
// Matched only as a whole word (short words that appear inside innocent names).
const WHOLE = new Set(rot13('nff nefr qvpx pbpx phz frk frkl encr encvfg anmv snt gvgf penc cvff nahf xxx ubr gneq cnxv jbc cevpx oryyraq pyvg jnax funt obare pbba fcvp xvxr qlxr').split(' '))

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b' }

const collapse = (s, max) => s.replace(/(.)\1+/g, (run, ch) => ch.repeat(Math.min(run.length, max)))
const hasDouble = (w) => /(.)\1/.test(w)

// Lower-case, strip accents, map leetspeak, then split into words. Runs of single letters
// ("f u c k") are glued back together.
function words(raw) {
  const base = String(raw ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[0-9]/g, (d) => LEET[d] ?? d)
  const parts = base.split(/[\s_.\-]+/).filter(Boolean)
  const out = []
  let run = ''
  for (const p of parts) {
    if (p.length === 1) run += p
    else {
      if (run) out.push(run)
      run = ''
      out.push(p)
    }
  }
  if (run) out.push(run)
  return out
}

export function isProfane(raw) {
  for (const word of words(raw)) {
    const letters = word.replace(/[^a-z]/g, '') // drop leftover digits and symbols
    if (!letters) continue
    const two = collapse(letters, 2)
    const one = collapse(letters, 1)
    if (WHOLE.has(two) || WHOLE.has(one)) return true
    for (const bad of STRONG) {
      if (two.includes(bad)) return true
      if (!hasDouble(bad) && one.includes(bad)) return true // "fuuuck"
    }
  }
  return false
}

export const isNameAllowed = (name) => !isProfane(name)
