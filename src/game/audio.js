// Procedural sound design with the Web Audio API - no audio assets required.
// The context is created lazily on the first user gesture (mobile autoplay rules).

import { Music } from './music.js'

export class AudioEngine {
  constructor(muted = false, musicOn = true) {
    this.ctx = null
    this.muted = muted
    this.musicOn = musicOn
    this.music = new Music()
    this.wantMusic = null // world whose track should be playing
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.6
      const comp = this.ctx.createDynamicsCompressor()
      this.master.connect(comp)
      comp.connect(this.ctx.destination)
      this.noise = this.makeNoise()
      this.buildRide()
      this.music.init(this.ctx, this.master)
      if (this.wantMusic && this.musicOn) this.music.start(this.wantMusic)
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
  }

  // ---- background music (one generated track per world) ----

  playMusic(worldId) {
    this.wantMusic = worldId
    if (this.ctx && this.musicOn) this.music.start(worldId)
  }

  stopMusic(fade = 0.8) {
    this.wantMusic = null
    if (this.ctx) this.music.stop(fade)
  }

  setMusicOn(on) {
    this.musicOn = on
    if (!this.ctx) return
    if (on && this.wantMusic) this.music.start(this.wantMusic)
    else this.music.stop(0.3)
  }

  setMusicIntensity(x) {
    if (this.ctx) this.music.setIntensity(x)
  }

  duckMusic(v) {
    if (this.ctx) this.music.duck(v)
  }

  // Suspend all audio while the page is hidden.
  suspend(v) {
    if (!this.ctx) return
    if (v) this.ctx.suspend()
    else this.ctx.resume()
  }

  setMuted(m) {
    this.muted = m
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.03)
  }

  makeNoise() {
    const len = this.ctx.sampleRate
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  // Continuous hum while riding the Slipstream floor; pitch follows speed.
  buildRide() {
    const c = this.ctx
    this.rideGain = c.createGain()
    this.rideGain.gain.value = 0
    this.rideFilter = c.createBiquadFilter()
    this.rideFilter.type = 'lowpass'
    this.rideFilter.frequency.value = 400
    this.rideOsc1 = c.createOscillator()
    this.rideOsc1.type = 'sawtooth'
    this.rideOsc2 = c.createOscillator()
    this.rideOsc2.type = 'triangle'
    this.rideOsc1.frequency.value = 60
    this.rideOsc2.frequency.value = 90
    this.rideOsc1.connect(this.rideFilter)
    this.rideOsc2.connect(this.rideFilter)
    this.rideFilter.connect(this.rideGain)
    this.rideGain.connect(this.master)
    this.rideOsc1.start()
    this.rideOsc2.start()
  }

  // Rain hiss and wind howl, each following its 0..1 amount. Called every frame (cheap).
  ambience(rain, wind) {
    if (!this.ctx) return
    if (!this.rainGain) {
      const c = this.ctx
      const make = (type, freq, q) => {
        const src = c.createBufferSource()
        src.buffer = this.noise
        src.loop = true
        const f = c.createBiquadFilter()
        f.type = type
        f.frequency.value = freq
        f.Q.value = q
        const g = c.createGain()
        g.gain.value = 0
        src.connect(f)
        f.connect(g)
        g.connect(this.master)
        src.start()
        return { g, f }
      }
      const r = make('bandpass', 6000, 0.5)
      this.rainGain = r.g
      const w = make('bandpass', 420, 1.4)
      this.windGain = w.g
      this.windFilter = w.f
    }
    const t = this.ctx.currentTime
    this.rainGain.gain.setTargetAtTime(rain * 0.16, t, 0.3)
    this.windGain.gain.setTargetAtTime(wind * 0.22, t, 0.3)
    this.windFilter.frequency.setTargetAtTime(380 + 260 * Math.sin(t * 0.6) + wind * 200, t, 0.2) // slow gusting
  }

  thunder() {
    if (!this.ctx) return
    const delay = 0.15 + Math.random() * 0.7
    this.burst(1.6, { vol: 0.5, from: 220, to: 50, type: 'lowpass', q: 0.7, delay })
  }

  ride(active, speed01) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const k = Math.min(1, Math.max(0, speed01))
    this.rideGain.gain.setTargetAtTime(active ? 0.09 : 0, t, 0.08)
    const f = 55 + k * 95
    this.rideOsc1.frequency.setTargetAtTime(f, t, 0.1)
    this.rideOsc2.frequency.setTargetAtTime(f * 1.5, t, 0.1)
    this.rideFilter.frequency.setTargetAtTime(280 + k * 1500, t, 0.1)
  }

  tone(freq, dur, { type = 'sine', vol = 0.25, slideTo = null, delay = 0 } = {}) {
    if (!this.ctx) return
    const c = this.ctx
    const t = c.currentTime + delay
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(this.master)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  burst(dur, { vol = 0.4, from = 800, to = 200, type = 'bandpass', q = 1, delay = 0 } = {}) {
    if (!this.ctx) return
    const c = this.ctx
    const t = c.currentTime + delay
    const src = c.createBufferSource()
    src.buffer = this.noise
    const f = c.createBiquadFilter()
    f.type = type
    f.Q.value = q
    f.frequency.setValueAtTime(from, t)
    f.frequency.exponentialRampToValueAtTime(to, t + dur)
    const g = c.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f)
    f.connect(g)
    g.connect(this.master)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  launch(mult = 1) {
    this.burst(0.38, { vol: 0.35, from: 500, to: 3200, q: 2 })
    this.tone(220, 0.3, { type: 'sine', vol: 0.2, slideTo: 520 + mult * 40 })
  }

  land(intensity = 1) {
    this.tone(150, 0.14, { type: 'sine', vol: 0.25 * intensity, slideTo: 55 })
    this.burst(0.08, { vol: 0.12 * intensity, from: 1800, to: 400, type: 'lowpass' })
  }

  tick(level) {
    const f = 392 * Math.pow(2, Math.min(level, 10) / 12)
    this.tone(f, 0.16, { type: 'triangle', vol: 0.22 })
    this.tone(f * 1.5, 0.2, { type: 'sine', vol: 0.1, delay: 0.05 })
  }

  nearMiss() {
    this.tone(880, 0.09, { vol: 0.16 })
    this.tone(1320, 0.14, { vol: 0.16, delay: 0.07 })
  }

  crash() {
    this.burst(0.8, { vol: 0.7, from: 2400, to: 80, type: 'lowpass' })
    this.tone(180, 0.55, { type: 'sawtooth', vol: 0.25, slideTo: 35 })
  }

  ui() {
    this.tone(660, 0.06, { vol: 0.12 })
  }

  chime() {
    ;[523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, 0.28, { vol: 0.18, delay: i * 0.08 }))
  }
}
