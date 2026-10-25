// Viral share helpers: the emoji scorecard (a count per achievement), the share text and the
// 1-tap share (native share sheet first, clipboard second).

export type RunEvent = 'slipstream' | 'near_miss' | 'safe' | 'crash'

export const EMOJI: Record<RunEvent, string> = {
  slipstream: '⚡',
  near_miss: '✨',
  safe: '🟩',
  crash: '💥',
}

// The achievements shown on the scorecard. A crash always ends the run, so it is not one.
export const ACHIEVEMENTS = ['slipstream', 'near_miss', 'safe'] as const
export type Achievement = (typeof ACHIEVEMENTS)[number]

export const LABEL: Record<Achievement, string> = {
  slipstream: 'Slipstreams',
  near_miss: 'Near misses',
  safe: 'Clean passes',
}

export function countEvents(events: readonly RunEvent[]): Record<Achievement, number> {
  const counts: Record<Achievement, number> = { slipstream: 0, near_miss: 0, safe: 0 }
  for (const e of events) if (e !== 'crash') counts[e]++
  return counts
}

// "⚡ x3  ✨ x2  🟩 x8": only the achievements that happened.
export function buildSummary(events: readonly RunEvent[]): string {
  const counts = countEvents(events)
  return ACHIEVEMENTS.filter((k) => counts[k] > 0)
    .map((k) => `${EMOJI[k]} x${counts[k]}`)
    .join('  ')
}

interface RunInfo {
  score: number
  maxMult: number
  events: readonly RunEvent[]
  seed: string
  host?: string
}

// The pieces of a share: the text without its link, the challenge link, and both together.
export function buildSharePayload(opts: RunInfo): { title: string; text: string; url: string; full: string } {
  const host = opts.host ?? (typeof window !== 'undefined' ? window.location.host : 'slipstream.khaw.cc')
  const summary = buildSummary(opts.events)
  const lines = [
    '⚡ SLIPSTREAM RUN',
    `Score: ${opts.score.toLocaleString('en-US')} | Max: ${opts.maxMult.toFixed(1)}x`,
    ...(summary ? [summary] : []),
  ]
  const url = `https://${host}/?seed=${opts.seed}`
  const ask = `Can you beat my line? Play here: ${url}`
  return { title: 'Slipstream: beat my line', text: [...lines, 'Can you beat my line?'].join('\n'), url, full: [...lines, ask].join('\n') }
}

export const buildShareText = (opts: RunInfo): string => buildSharePayload(opts).full

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
// The link goes in `url` (not just the text) so the share sheet and chat apps show the
// site's icon and a link preview instead of a generic text file; the clipboard gets it all
// in one block.
export async function shareRun(p: { title: string; text: string; url: string; full: string }): Promise<ShareResult> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: p.title, text: p.text, url: p.url })
      return 'shared'
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled'
      // Share failed for another reason: fall back to copying.
    }
  }
  return (await copyText(p.full)) ? 'copied' : 'failed'
}
