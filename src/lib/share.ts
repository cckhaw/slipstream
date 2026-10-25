// Viral share helpers: the Wordle-style emoji scorecard, the share text and the 1-tap
// share (native share sheet first, clipboard second).

export type RunEvent = 'slipstream' | 'near_miss' | 'safe' | 'crash'

export const EMOJI: Record<RunEvent, string> = {
  slipstream: '⚡',
  near_miss: '✨',
  safe: '🟩',
  crash: '💥',
}

export const LEGEND: ReadonlyArray<[RunEvent, string]> = [
  ['slipstream', 'Slipstream'],
  ['near_miss', 'Near miss'],
  ['safe', 'Clean'],
  ['crash', 'Crash'],
]

const MAX_GLYPHS = 24 // keeps the card compact however long the run was
const PER_ROW = 12

// Turn the run telemetry into a compact emoji matrix, in the order things happened. Long
// runs are squeezed into MAX_GLYPHS cells: each cell shows the best thing that happened in
// its stretch of the run (a near miss beats a slipstream, which beats a clean pass). The
// crash, if any, always closes the card.
export function buildMatrix(events: readonly RunEvent[], perRow = PER_ROW): string[] {
  const crashed = events[events.length - 1] === 'crash'
  const body = crashed ? events.slice(0, -1) : events.slice()
  const room = MAX_GLYPHS - (crashed ? 1 : 0)
  let cells: RunEvent[] = body
  if (body.length > room) {
    const size = Math.ceil(body.length / room)
    cells = []
    for (let i = 0; i < body.length; i += size) {
      const chunk = body.slice(i, i + size)
      cells.push(chunk.includes('near_miss') ? 'near_miss' : chunk.includes('slipstream') ? 'slipstream' : 'safe')
    }
  }
  if (crashed) cells.push('crash')
  const glyphs = cells.map((e) => EMOJI[e])
  // Even rows (13 cells make 7 + 6, not 12 + 1).
  const width = Math.ceil(glyphs.length / Math.max(1, Math.ceil(glyphs.length / perRow)))
  const rows: string[] = []
  for (let i = 0; i < glyphs.length; i += width) rows.push(glyphs.slice(i, i + width).join(''))
  return rows
}

export function buildShareText(opts: { score: number; maxMult: number; events: readonly RunEvent[]; seed: string; host?: string }): string {
  const host = opts.host ?? (typeof window !== 'undefined' ? window.location.host : 'slipstream.khaw.cc')
  const matrix = buildMatrix(opts.events).join('\n')
  return `⚡ SLIPSTREAM RUN\nScore: ${opts.score.toLocaleString('en-US')} | Max: ${opts.maxMult.toFixed(1)}x\n${matrix}\nCan you beat my line? Play here: https://${host}/?seed=${opts.seed}`
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed'

// Clipboard write that also works where the async API is missing or blocked.
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

// Native share sheet first (phones), then the clipboard. Closing the sheet is not an error.
export async function shareText(text: string): Promise<ShareResult> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled'
      // Share failed for another reason: fall back to copying.
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed'
}
