export const WORLD_W = 320
export const WORLD_H = 480

export const GRAVITY = 1800
export const JUMP_V = 620
export const SPRING_V = 1080
export const TRAMPOLINE_V = 1250
export const MAX_VX = 430
export const ACCEL_X = 2600
export const DAMP_X = 6

export const DOODLER_W = 58
export const DOODLER_H = 72
export const PLATFORM_W = 114
export const PLATFORM_H = 30

export const SCORE_PER_PX = 0.1

export const JETPACK_TIME = 3.2
export const PROPELLER_TIME = 4.0

export type PlatformKind = 'static' | 'moving' | 'vanish' | 'breakable'
export type MonsterKind = 'walker' | 'flyer' | 'oneeye' | 'chomp'
export type PowerupKind = 'jetpack' | 'propeller' | 'springshoes' | 'shield'
export type DeathCause = 'miss' | 'monster' | 'ufo' | 'blackhole'

export interface GameEvent {
  type:
    | 'kill'
    | 'bounce-monster'
    | 'avoid-monster'
    | 'hit-missing'
    | 'bounce-platform'
    | 'jump-spring'
    | 'break-platform'
    | 'ufo-abducted'
    | 'ufo-bounced'
    | 'use-powerup'
    | 'use-bonus'
    | 'propeller-kill'
  monster?: MonsterKind
  platform?: PlatformKind
  powerup?: PowerupKind | 'trampoline' | 'spring'
  cause?: DeathCause
  moving?: boolean
}
