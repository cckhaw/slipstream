// Procedural background music: one original generative track per world, synthesised with
// the Web Audio API (no audio files). Each song is a 16-bar form (four 4-bar phrases: verse,
// lift, bridge in a different chord progression, outro lift) of 16th-note steps. A lookahead
// scheduler plays it; a shared layer adds a lead melody, drum fills, risers and crashes, and
// an intensity value (0..1, driven by the multiplier) opens the filter and brings in layers.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)

// Small seeded RNG so a world's melody is the same every time it loops.
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const MUSIC_LEVEL = 1.25

export class Music {
  constructor() {
    this.ctx = null
    this.timer = null
    this.song = null
    this.I = 0.2
    this.level = MUSIC_LEVEL
    this.ducked = false
  }

  init(ctx, dest) {
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = 0
    this.lp = ctx.createBiquadFilter()
    this.lp.type = 'lowpass'
    this.lp.frequency.value = 2400
    this.lp.Q.value = 0.6
    this.bus = ctx.createGain()
    this.bus.connect(this.lp)
    this.lp.connect(this.out)
    this.out.connect(dest)

    // Echo send for plucks and pings.
    this.echoIn = ctx.createGain()
    const delay = ctx.createDelay(1.5)
    delay.delayTime.value = 0.36
    const fb = ctx.createGain()
    fb.gain.value = 0.38
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 2200
    this.echoIn.connect(delay)
    delay.connect(tone)
    tone.connect(fb)
    fb.connect(delay)
    tone.connect(this.bus)

    const len = ctx.sampleRate
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  }

  // ---- voices ----------------------------------------------------------------

  tone(note, t, dur, { type = 'sine', vol = 0.1, a = 0.006, rel = 0.06, decay = false, cutoff = 0, echo = 0, detune = 0 } = {}) {
    const c = this.ctx
    const o = c.createOscillator()
    o.type = type
    o.frequency.value = mtof(note)
    if (detune) o.detune.value = detune
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(vol, t + a)
    if (decay) {
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    } else {
      g.gain.setValueAtTime(vol, t + Math.max(a, dur))
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel)
    }
    let node = o
    if (cutoff) {
      const f = c.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = cutoff
      o.connect(f)
      node = f
    }
    node.connect(g)
    g.connect(this.bus)
    if (echo) {
      const send = c.createGain()
      send.gain.value = echo
      g.connect(send)
      send.connect(this.echoIn)
    }
    o.start(t)
    o.stop(t + dur + rel + 0.05)
  }

  pad(notes, t, dur, { vol = 0.03, type = 'triangle', cutoff = 900 } = {}) {
    for (const n of notes) {
      this.tone(n, t, dur, { type, vol, a: Math.min(0.5, dur * 0.3), rel: 0.9, cutoff, detune: -6 })
      this.tone(n, t, dur, { type, vol: vol * 0.7, a: Math.min(0.5, dur * 0.3), rel: 0.9, cutoff, detune: 7 })
    }
  }

  kick(t, vol = 0.8) {
    const c = this.ctx
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12)
    const g = c.createGain()
    g.gain.setValueAtTime(vol * 0.9, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26)
    o.connect(g)
    g.connect(this.bus)
    o.start(t)
    o.stop(t + 0.3)
  }

  noiseHit(t, dur, vol, { type = 'highpass', freq = 7000, q = 0.7 } = {}) {
    const c = this.ctx
    const s = c.createBufferSource()
    s.buffer = this.noise
    const f = c.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = c.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    s.connect(f)
    f.connect(g)
    g.connect(this.bus)
    s.start(t, Math.random() * 0.5)
    s.stop(t + dur + 0.02)
  }

  hat(t, vol = 0.04, open = false) {
    this.noiseHit(t, open ? 0.16 : 0.04, vol)
  }

  clap(t, vol = 0.08) {
    for (const dt of [0, 0.012, 0.026]) this.noiseHit(t + dt, 0.09, vol * 0.7, { type: 'bandpass', freq: 1700, q: 0.9 })
  }

  brush(t, vol = 0.05) {
    this.noiseHit(t, 0.14, vol, { type: 'bandpass', freq: 3200, q: 0.6 })
  }

  // ---- transport -------------------------------------------------------------

  playStep(n, t) {
    const bar = Math.floor(n / 16) % 4
    const ph = Math.floor(n / 64) % 4
    this.song.step(bar, n % 16, t, this.I, n, ph)
    this.layer(bar, n % 16, t, ph, n)
  }

  // Parts shared by every song: lead melody, fills, risers and crashes.
  layer(bar, s, t, ph, n) {
    const song = this.song
    const I = this.I
    const beat = 60 / song.bpm
    const lead = song.lead
    if (lead && (ph >= 1 || I > 0.35)) {
      const note = lead.pattern[ph][bar][s]
      if (note !== null) {
        const ch = song.prog(ph).chords[bar]
        // Strong beats land on chord tones, the rest walk the scale.
        const midi = s % 8 === 0 ? ch[note % ch.length] + lead.up : lead.scale[note % lead.scale.length]
        const o = { type: lead.type, vol: lead.vol * (0.8 + 0.4 * I), cutoff: lead.cutoff, decay: true, echo: lead.echo }
        this.tone(midi, t, lead.dur * beat, o)
        if (I > 0.65) this.tone(midi + 12, t, lead.dur * beat, { ...o, vol: o.vol * 0.35, detune: 8 })
      }
    }
    if (n > 0 && bar === 0 && s === 0) this.noiseHit(t, 1.1, 0.07 + 0.04 * I, { type: 'highpass', freq: 5200, q: 0.5 }) // crash into the next phrase
    if (bar === 3 && s >= 12 && song.fill !== false) {
      const k = s - 12
      this.noiseHit(t, 0.08, 0.04 + 0.025 * k, { type: 'bandpass', freq: 1500 + k * 600, q: 0.9 }) // snare roll
      if (s === 14 || s === 15) this.kick(t, 0.5)
    }
    if (bar === 3 && s === 0 && ph % 2 === 1) this.riser(t, beat * 4)
  }

  // Filtered-noise sweep that builds into the next phrase.
  riser(t, dur) {
    const c = this.ctx
    const src = c.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const f = c.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 2.5
    f.frequency.setValueAtTime(300, t)
    f.frequency.exponentialRampToValueAtTime(7000, t + dur)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.09, t + dur)
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05)
    src.connect(f)
    f.connect(g)
    g.connect(this.bus)
    src.start(t)
    src.stop(t + dur + 0.1)
  }

  start(id) {
    if (!this.ctx || !SONGS[id]) return
    this.stop(0)
    const c = this.ctx
    this.ducked = false // a fresh start is never paused
    this.id = id
    this.song = SONGS[id](this)
    this.bus.gain.value = this.song.gain ?? 1
    this.n = 0
    this.next = c.currentTime + 0.12
    const now = c.currentTime
    this.out.gain.cancelScheduledValues(now)
    this.out.gain.setValueAtTime(0, now)
    this.out.gain.linearRampToValueAtTime(this.ducked ? this.level * 0.35 : this.level, now + 0.9)
    this.timer = setInterval(() => this.tick(), 80)
  }

  tick() {
    const c = this.ctx
    if (this.next < c.currentTime - 0.4) this.next = c.currentTime + 0.05 // we fell behind (tab throttled): skip ahead
    while (this.next < c.currentTime + 0.35) {
      this.playStep(this.n, this.next)
      this.next += 60 / this.song.bpm / 4
      this.n++
    }
  }

  stop(fade = 0.8) {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
    const now = this.ctx.currentTime
    this.out.gain.cancelScheduledValues(now)
    if (fade <= 0) this.out.gain.setValueAtTime(0, now)
    else this.out.gain.setTargetAtTime(0, now, fade / 3)
  }

  setIntensity(x) {
    this.I = Math.min(1, Math.max(0, x))
    if (this.timer) this.lp.frequency.setTargetAtTime(900 + this.I * 5500, this.ctx.currentTime, 0.4)
  }

  duck(v) {
    this.ducked = v
    if (this.timer) this.out.gain.setTargetAtTime(v ? this.level * 0.35 : this.level, this.ctx.currentTime, 0.12)
  }
}

// ---- songs -------------------------------------------------------------------
// Each returns { bpm, prog(ph), lead?, step(bar, s, t, I, n, ph) }. `I` is the intensity
// (0..1); `ph` is the phrase (0..3) of the 16-bar form: phrases 0-1 use progression A,
// phrases 2-3 the bridge progression B.

// Seeded lead-melody patterns for the four phrases: a theme (A), the same theme with a new
// ending (A'), a contrasting bridge (B), then the theme again with the bridge's ending.
// Entries are scale / chord-tone indices, or null for a rest.
function makeLead(seed, dens, scaleLen, spec) {
  const r = rng(seed)
  const phrase = () =>
    Array.from({ length: 4 }, () => {
      let at = Math.floor(r() * scaleLen)
      return Array.from({ length: 16 }, (_, s) => {
        const on = s % 2 === 0 ? r() < dens : r() < dens * 0.3
        if (!on) return null
        at = Math.max(0, Math.min(scaleLen * 2 - 1, at + Math.floor(r() * 5) - 2))
        return at
      })
    })
  const A = phrase()
  const B = phrase()
  const A2 = [A[0], A[1], A[2], B[3]]
  return { ...spec, pattern: [A, A2, B, A2] }
}

const SONGS = {
  // Neon Conduit: driving synthwave in A minor.
  neon(m) {
    const bpm = 118
    const P = [
      { roots: [45, 41, 48, 43], chords: [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]] }, // Am F C G
      { roots: [41, 43, 45, 40], chords: [[53, 57, 60], [55, 59, 62], [57, 60, 64], [56, 59, 64]] }, // F G Am E
    ]
    const arp = [0, 1, 2, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1]
    return {
      bpm,
      prog: (ph) => P[ph >> 1],
      lead: makeLead(3, 0.55, 8, { scale: [69, 71, 72, 74, 76, 77, 79, 81], up: 12, type: 'sawtooth', vol: 0.05, cutoff: 3000, echo: 0.3, dur: 0.36 }),
      step(bar, s, t, I, n, ph) {
        const { roots, chords } = P[ph >> 1]
        const ch = chords[bar]
        const notes = [...ch, ch[0] + 12]
        if (s % 4 === 0) m.kick(t, 0.9)
        if (s % 4 === 2) m.hat(t, 0.06, true)
        else if (I > 0.25 && s % 2 === 0) m.hat(t, 0.035)
        if ((I > 0.3 || ph >= 2) && (s === 4 || s === 12)) m.clap(t, 0.09)
        if (s % 2 === 0) m.tone(s === 6 || s === 14 ? roots[bar] + 12 : roots[bar], t, 0.17, { type: 'sawtooth', vol: 0.13, cutoff: 700, decay: true })
        m.tone(notes[arp[s]] + 12, t, 0.14, { type: 'sawtooth', vol: 0.03 + 0.03 * I, cutoff: 2200, decay: true, echo: 0.25 })
        if (s === 0) m.pad(ch, t, (60 / bpm) * 4, { type: 'sawtooth', vol: 0.026, cutoff: 700 })
      },
    }
  },

  // Pixel Quarry: calm chiptune-style pentatonic in C major.
  quarry(m) {
    const bpm = 92
    const P = [
      { roots: [48, 45, 41, 43], chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]] }, // C Am F G
      { roots: [41, 43, 40, 45], chords: [[53, 57, 60], [55, 59, 62], [52, 55, 59], [57, 60, 64]] }, // F G Em Am
    ]
    return {
      bpm,
      gain: 1.3,
      prog: (ph) => P[ph >> 1],
      lead: makeLead(7, 0.6, 8, { scale: [72, 74, 76, 79, 81, 84, 86, 88], up: 12, type: 'square', vol: 0.045, cutoff: 3200, echo: 0.25, dur: 0.5 }),
      step(bar, s, t, I, n, ph) {
        const { roots, chords } = P[ph >> 1]
        if (s === 0) m.tone(roots[bar], t, 0.6, { type: 'triangle', vol: 0.17, decay: true })
        if (s === 8) m.tone(roots[bar] + 7, t, 0.5, { type: 'triangle', vol: 0.13, decay: true })
        if (s % 2 === 0) m.tone(chords[bar][(s >> 1) % 3] + 12, t, 0.2, { type: 'square', vol: 0.02 + 0.015 * I, cutoff: 2400, decay: true }) // chiptune arp
        if (s === 0) m.pad(chords[bar], t, (60 / bpm) * 4, { vol: 0.024 })
        if ((I > 0.3 || ph >= 2) && s % 4 === 0) m.hat(t, 0.03)
        if ((I > 0.55 || ph >= 2) && (s === 0 || s === 8)) m.kick(t, 0.6)
        if (ph >= 2 && (s === 4 || s === 12)) m.brush(t, 0.06)
      },
    }
  },

  // Starship Drift: slow, spacious D dorian with sparse echoing pings.
  ship(m) {
    const bpm = 76
    const P = [
      { roots: [38, 34, 36, 33], chords: [[50, 57, 60, 64], [46, 53, 57, 62], [48, 55, 59, 64], [45, 52, 57, 60]] }, // Dm Bb C Am
      { roots: [43, 38, 34, 36], chords: [[55, 58, 62, 65], [50, 53, 57, 62], [46, 53, 57, 62], [48, 55, 59, 64]] }, // Gm Dm Bb C
    ]
    return {
      bpm,
      gain: 0.95,
      fill: false,
      prog: (ph) => P[ph >> 1],
      lead: makeLead(21, 0.22, 8, { scale: [74, 77, 79, 81, 84, 86, 88, 91], up: 12, type: 'sine', vol: 0.07, cutoff: 0, echo: 0.8, dur: 1.6 }),
      step(bar, s, t, I, n, ph) {
        const { roots, chords } = P[ph >> 1]
        const beat = (60 / bpm) * 4
        if (s === 0) {
          m.pad(chords[bar], t, beat, { vol: 0.05, type: 'sine', cutoff: 1400 })
          m.tone(roots[bar], t, beat, { type: 'sine', vol: 0.2, a: 0.3, rel: 0.6 })
        }
        if (s % 4 === 0) m.tone(chords[bar][(s >> 2) % 4] + 12, t, 0.9, { type: 'sine', vol: 0.035, decay: true, echo: 0.6 }) // slow arpeggio shimmer
        if ((I > 0.2 || ph >= 2) && s === 0 && bar % 2 === 0) m.kick(t, 0.45)
        if (I > 0.5 && s % 2 === 0) m.tone(chords[bar][(s / 2) % 4] + 12, t, 0.3, { type: 'triangle', vol: 0.03, decay: true, echo: 0.4 })
        if (ph >= 2 && s === 8) m.brush(t, 0.04)
      },
    }
  },

  // Voxel Valley: warm, adventurous G major with plucked arpeggios.
  voxel(m) {
    const bpm = 108
    const P = [
      { roots: [43, 38, 40, 36], chords: [[55, 59, 62], [50, 54, 57], [52, 55, 59], [48, 52, 55]] }, // G D Em C
      { roots: [36, 43, 38, 40], chords: [[48, 52, 55], [55, 59, 62], [50, 54, 57], [52, 55, 59]] }, // C G D Em
    ]
    const pat = [0, 1, 2, 1, 0, 1, 2, 1]
    return {
      bpm,
      gain: 1.1,
      prog: (ph) => P[ph >> 1],
      lead: makeLead(11, 0.5, 8, { scale: [67, 69, 71, 74, 76, 79, 81, 83], up: 12, type: 'triangle', vol: 0.085, cutoff: 3500, echo: 0.3, dur: 0.5 }),
      step(bar, s, t, I, n, ph) {
        const { roots, chords } = P[ph >> 1]
        const ch = chords[bar]
        if (s % 2 === 0) m.tone(ch[pat[s / 2]] + 12, t, 0.34, { type: 'triangle', vol: 0.07 + 0.03 * I, decay: true, echo: 0.18 })
        if (s % 4 === 0) m.tone(roots[bar], t, 0.32, { type: 'triangle', vol: 0.17, decay: true })
        if (s === 0 || s === 8) m.kick(t, 0.65)
        if ((I > 0.15 || ph >= 2) && (s === 4 || s === 12)) m.brush(t, 0.06)
        if ((I > 0.5 || ph >= 1) && s % 2 === 0) m.hat(t, 0.025)
        if (s === 0) m.pad(ch, t, (60 / bpm) * 4, { vol: 0.03 })
      },
    }
  },

  // Obby Rush: fast, bouncy square-lead in C major.
  obby(m) {
    const bpm = 140
    const P = [
      { roots: [48, 43, 45, 41], shift: [0, 0, 0, 0] }, // C G Am F
      { roots: [41, 43, 45, 41], shift: [5, 7, 9, 0] }, // F G Am F: the same riff, moved up
    ]
    const motif = [
      [72, null, 76, null, 79, null, 76, null, 72, null, 76, 79, 81, null, 79, null],
      [71, null, 74, null, 79, null, 74, null, 71, null, 74, 79, 83, null, 79, null],
      [69, null, 72, null, 76, null, 72, null, 69, null, 72, 76, 81, null, 76, null],
      [72, null, 77, null, 81, null, 77, null, 72, null, 77, 81, 84, null, 81, null],
    ]
    const funk = new Set([0, 3, 6, 8, 11, 14])
    const chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]
    return {
      bpm,
      gain: 1.05,
      prog: () => ({ chords }),
      step(bar, s, t, I, n, ph) {
        const { roots, shift } = P[ph >> 1]
        const lead = motif[bar][s]
        if (lead) m.tone(lead + shift[bar], t, 0.13, { type: 'square', vol: 0.045 + 0.025 * I, cutoff: 3500, decay: true })
        if (lead && ph === 3 && I > 0.3) m.tone(lead + shift[bar] + 12, t, 0.1, { type: 'square', vol: 0.02, cutoff: 3500, decay: true, detune: 6 }) // octave double in the last phrase
        if (funk.has(s)) m.tone(s === 6 ? roots[bar] + 12 : roots[bar], t, 0.12, { type: 'sawtooth', vol: 0.14, cutoff: 900, decay: true })
        if (s % 4 === 0) m.kick(t, 0.9)
        if (s === 4 || s === 12) m.clap(t, 0.1)
        if (s % 2 === 0) m.hat(t, 0.04, s % 4 === 2)
        if (ph >= 2 && s % 4 === 3) m.tone(chords[bar][1] + 12 + shift[bar], t, 0.08, { type: 'square', vol: 0.018, cutoff: 2800, decay: true }) // off-beat stab
      },
    }
  },

  // Neon Void: dark, relentless four-on-the-floor in F# minor.
  grid(m) {
    const bpm = 128
    const P = [
      { roots: [42, 38, 45, 40], chords: [[54, 57, 61], [50, 54, 57], [57, 61, 64], [52, 56, 59]] }, // F#m D A E
      { roots: [38, 40, 42, 37], chords: [[50, 54, 57], [52, 56, 59], [54, 57, 61], [49, 52, 56]] }, // D E F#m C#
    ]
    const arp = [0, 2, 1, 2, 0, 1, 2, 1, 0, 2, 1, 2, 2, 1, 0, 1]
    return {
      bpm,
      gain: 0.95,
      prog: (ph) => P[ph >> 1],
      lead: makeLead(5, 0.5, 8, { scale: [66, 68, 69, 71, 73, 74, 76, 78], up: 12, type: 'sawtooth', vol: 0.045, cutoff: 3000, echo: 0.35, dur: 0.3 }),
      step(bar, s, t, I, n, ph) {
        const { roots, chords } = P[ph >> 1]
        const ch = chords[bar]
        if (s % 4 === 0) m.kick(t, 1)
        if ((I > 0.15 || ph >= 2) && (s === 4 || s === 12)) m.clap(t, 0.09)
        if (s % 4 === 2) m.hat(t, 0.055, true)
        else if (I > 0.2 || ph >= 1) m.hat(t, 0.025)
        if (s % 4 !== 0) m.tone(roots[bar], t, 0.1, { type: 'sawtooth', vol: s % 4 === 2 ? 0.12 : 0.07, cutoff: 600 + 800 * I, decay: true })
        m.tone(ch[arp[s]] + 12, t, 0.11, { type: 'sawtooth', vol: 0.025 + 0.03 * I, cutoff: 2600, decay: true, echo: 0.3 })
        if (s === 0) m.pad(ch, t, (60 / bpm) * 4, { type: 'sawtooth', vol: 0.024, cutoff: 800 })
      },
    }
  },
}

export const SONG_IDS = Object.keys(SONGS)

// Render a few seconds of a song offline (used by tests and tooling, not by the game).
export async function renderSong(id, seconds, intensity = 0.5, sampleRate = 44100) {
  const ctx = new OfflineAudioContext(1, Math.floor(sampleRate * seconds), sampleRate)
  const m = new Music()
  m.init(ctx, ctx.destination)
  m.out.gain.value = MUSIC_LEVEL
  m.I = intensity
  m.lp.frequency.value = 900 + intensity * 5500
  m.song = SONGS[id](m)
  m.bus.gain.value = m.song.gain ?? 1
  const stepDur = 60 / m.song.bpm / 4
  for (let n = 0, t = 0.02; t < seconds; n++, t += stepDur) m.playStep(n, t)
  return ctx.startRendering()
}
