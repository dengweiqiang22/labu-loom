import type { InputEvent } from '@/domain/input'

export type ActivityPhase = 'active' | 'settling' | 'idle'

export interface ActivitySnapshot {
  phase: ActivityPhase
  inputIntensity: number
  inactiveForMs?: number
  continuousActiveForMs?: number
}

type Clock = () => number

const ACTIVE_WINDOW_MS = 2_000
const IDLE_AFTER_MS = 30_000
const INTENSITY_HALF_LIFE_MS = 1_500
const ACTIVE_INTENSITY = 0.25
const MIN_INTENSITY = 0.01

function getInputImpulse(event: InputEvent) {
  if (event.kind === 'pointer') return 0.03

  if (event.kind === 'axis') {
    return 0.02 + Math.min(Math.abs(event.value), 1) * 0.04
  }

  return event.value > 0 ? 0.18 : 0.05
}

export class ActivityTracker {
  private inputIntensity = 0
  private lastActivityAt?: number
  private streakStartedAt?: number
  private lastUpdatedAt: number

  constructor(private readonly now: Clock = () => performance.now()) {
    this.lastUpdatedAt = now()
  }

  record(event: InputEvent) {
    const now = this.now()

    this.decay(now)
    this.inputIntensity += getInputImpulse(event) * (1 - this.inputIntensity)
    this.lastActivityAt = now

    return this.createSnapshot(now)
  }

  snapshot() {
    const now = this.now()

    this.decay(now)

    return this.createSnapshot(now)
  }

  reset() {
    this.inputIntensity = 0
    this.lastActivityAt = void 0
    this.streakStartedAt = void 0
    this.lastUpdatedAt = this.now()

    return this.createSnapshot(this.lastUpdatedAt)
  }

  private decay(now: number) {
    const elapsed = Math.max(0, now - this.lastUpdatedAt)

    this.inputIntensity *= 0.5 ** (elapsed / INTENSITY_HALF_LIFE_MS)
    this.inputIntensity = this.inputIntensity < MIN_INTENSITY ? 0 : this.inputIntensity
    this.lastUpdatedAt = now
  }

  private createSnapshot(now: number): ActivitySnapshot {
    if (this.lastActivityAt === void 0) {
      this.streakStartedAt = void 0

      return {
        phase: 'idle',
        inputIntensity: 0,
      }
    }

    const inactiveForMs = Math.max(0, now - this.lastActivityAt)
    const phase = inactiveForMs <= ACTIVE_WINDOW_MS || this.inputIntensity >= ACTIVE_INTENSITY
      ? 'active'
      : inactiveForMs < IDLE_AFTER_MS || this.inputIntensity > MIN_INTENSITY
        ? 'settling'
        : 'idle'

    if (phase === 'idle') {
      this.streakStartedAt = void 0

      return {
        phase,
        inputIntensity: Math.min(1, this.inputIntensity),
        inactiveForMs,
      }
    }

    this.streakStartedAt ??= this.lastActivityAt

    return {
      phase,
      inputIntensity: Math.min(1, this.inputIntensity),
      inactiveForMs,
      continuousActiveForMs: Math.max(0, now - this.streakStartedAt),
    }
  }
}
