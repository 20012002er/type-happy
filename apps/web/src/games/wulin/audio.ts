/** WebAudio 程序合成音效(零外部素材) */
class WulinAudio {
  enabled = true
  private ctx: AudioContext | null = null
  private master: GainNode | null = null

  private ensure(): AudioContext | null {
    if (!this.enabled) return null
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.32
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number): void {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, ctx.currentTime)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), ctx.currentTime + dur)
    g.gain.setValueAtTime(vol, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    o.connect(g).connect(this.master)
    o.start()
    o.stop(ctx.currentTime + dur + 0.02)
  }

  private noise(dur: number, vol: number, hp = 400): void {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const len = Math.floor(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = hp
    const g = ctx.createGain()
    g.gain.value = vol
    src.connect(f).connect(g).connect(this.master)
    src.start()
  }

  hit(): void {
    this.noise(0.09, 0.5, 900)
    this.tone(180, 0.08, 'triangle', 0.3, 90)
  }

  slash(): void {
    this.noise(0.12, 0.35, 2200)
    this.tone(900, 0.1, 'sawtooth', 0.12, 300)
  }

  skill(): void {
    this.tone(520, 0.18, 'sine', 0.3, 780)
    this.tone(780, 0.22, 'sine', 0.22, 1040)
    this.noise(0.15, 0.3, 1400)
  }

  miss(): void {
    this.tone(420, 0.07, 'sine', 0.14, 620)
  }

  win(): void {
    const notes = [523, 659, 784, 1046]
    notes.forEach((f, i) => window.setTimeout(() => this.tone(f, 0.22, 'triangle', 0.3), i * 110))
  }

  lose(): void {
    this.tone(220, 0.4, 'sawtooth', 0.2, 80)
  }

  levelup(): void {
    this.tone(660, 0.14, 'sine', 0.26)
    window.setTimeout(() => this.tone(880, 0.16, 'sine', 0.26), 100)
    window.setTimeout(() => this.tone(1320, 0.24, 'sine', 0.24), 200)
  }

  coin(): void {
    this.tone(1200, 0.07, 'square', 0.12, 1600)
    window.setTimeout(() => this.tone(1600, 0.09, 'square', 0.1), 60)
  }

  click(): void {
    this.tone(700, 0.04, 'sine', 0.12)
  }

  page(): void {
    this.noise(0.06, 0.18, 3000)
  }
}

export const audio = new WulinAudio()
