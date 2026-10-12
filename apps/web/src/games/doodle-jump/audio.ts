const BASE = '/games/doodle/audio/'

const FILES: Record<string, string> = {
  jump: 'jump.ogg',
  fall: 'pada.ogg',
  break: 'lomise.ogg',
  trampoline: 'trampoline.ogg',
  springshoes: 'springshoes.ogg',
  jetpack: 'jetpack1.ogg',
  propeller: 'propeller1.ogg',
  ufo: 'ufo.ogg',
  monsterCrash: 'monstercrash.ogg',
  shoot: 'pucanje.ogg',
  collect: 'collect.ogg',
  start: 'start.ogg',
}

class AudioBank {
  private pools = new Map<string, HTMLAudioElement[]>()
  enabled = true

  play(name: keyof typeof FILES | string, volume = 1): void {
    if (!this.enabled) return
    const file = FILES[name]
    if (!file) return
    let pool = this.pools.get(name)
    if (!pool) {
      pool = []
      for (let i = 0; i < 4; i++) {
        const el = new Audio(BASE + file)
        el.preload = 'auto'
        pool.push(el)
      }
      this.pools.set(name, pool)
    }
    const el = pool.find((p) => p.paused || p.ended) ?? pool[0]
    el.currentTime = 0
    el.volume = volume
    void el.play().catch(() => undefined)
  }
}

export const audio = new AudioBank()
