export type ActivitySource = 'keyboard' | 'mouse'

export interface ActivityAggregationSettings {
  keyboardEnabled: boolean
  mouseEnabled: boolean
}

export interface DailyActivityDelta {
  day: string
  keyboardActiveSeconds: number
  mouseActiveSeconds: number
  idleSeconds: number
  activeSessionCount: number
}

const ACTIVE_WINDOW_MS = 2_000
const MAX_SAMPLE_INTERVAL_MS = 5_000

export class DailyActivityAccumulator {
  private currentDay: string
  private lastSampleAt: number
  private keyboardActiveUntil?: number
  private mouseActiveUntil?: number
  private keyboardActiveMs = 0
  private mouseActiveMs = 0
  private idleMs = 0
  private keyboardSessionCount = 0
  private mouseSessionCount = 0

  constructor(day: string, now = 0) {
    this.currentDay = day
    this.lastSampleAt = now
  }

  record(source: ActivitySource, now: number) {
    const wasActive = this.isActive(now)

    if (source === 'keyboard') this.keyboardActiveUntil = now + ACTIVE_WINDOW_MS
    if (source === 'mouse') this.mouseActiveUntil = now + ACTIVE_WINDOW_MS

    if (!wasActive && source === 'keyboard') this.keyboardSessionCount += 1
    if (!wasActive && source === 'mouse') this.mouseSessionCount += 1
  }

  sample(day: string, now: number, settings: ActivityAggregationSettings) {
    if (day !== this.currentDay) {
      const previous = this.drain(true)

      this.currentDay = day
      this.lastSampleAt = now
      this.keyboardActiveUntil = void 0
      this.mouseActiveUntil = void 0

      return previous
    }

    this.applySettings(settings)

    const elapsed = Math.min(MAX_SAMPLE_INTERVAL_MS, Math.max(0, now - this.lastSampleAt))
    const keyboardActive = settings.keyboardEnabled
      && this.keyboardActiveUntil !== void 0
      && now <= this.keyboardActiveUntil
    const mouseActive = settings.mouseEnabled
      && this.mouseActiveUntil !== void 0
      && now <= this.mouseActiveUntil

    if (keyboardActive) this.keyboardActiveMs += elapsed
    if (mouseActive) this.mouseActiveMs += elapsed
    if ((settings.keyboardEnabled || settings.mouseEnabled) && !keyboardActive && !mouseActive) {
      this.idleMs += elapsed
    }

    this.lastSampleAt = now
  }

  applySettings(settings: ActivityAggregationSettings) {
    if (!settings.keyboardEnabled) {
      this.keyboardActiveUntil = void 0
      this.keyboardActiveMs = 0
      this.keyboardSessionCount = 0
    }

    if (!settings.mouseEnabled) {
      this.mouseActiveUntil = void 0
      this.mouseActiveMs = 0
      this.mouseSessionCount = 0
    }

    if (!settings.keyboardEnabled && !settings.mouseEnabled) {
      this.idleMs = 0
      this.keyboardSessionCount = 0
      this.mouseSessionCount = 0
    }
  }

  drain(includePartialSeconds = false): DailyActivityDelta | undefined {
    const divisor = includePartialSeconds ? 1 : 1_000
    const keyboardActiveSeconds = includePartialSeconds
      ? Math.ceil(this.keyboardActiveMs / 1_000)
      : Math.floor(this.keyboardActiveMs / divisor)
    const mouseActiveSeconds = includePartialSeconds
      ? Math.ceil(this.mouseActiveMs / 1_000)
      : Math.floor(this.mouseActiveMs / divisor)
    const idleSeconds = includePartialSeconds
      ? Math.ceil(this.idleMs / 1_000)
      : Math.floor(this.idleMs / divisor)
    const delta = {
      day: this.currentDay,
      keyboardActiveSeconds,
      mouseActiveSeconds,
      idleSeconds,
      activeSessionCount: this.keyboardSessionCount + this.mouseSessionCount,
    }

    if (includePartialSeconds) {
      this.keyboardActiveMs = 0
      this.mouseActiveMs = 0
      this.idleMs = 0
    } else {
      this.keyboardActiveMs -= keyboardActiveSeconds * 1_000
      this.mouseActiveMs -= mouseActiveSeconds * 1_000
      this.idleMs -= idleSeconds * 1_000
    }

    this.keyboardSessionCount = 0
    this.mouseSessionCount = 0

    if (
      delta.keyboardActiveSeconds === 0
      && delta.mouseActiveSeconds === 0
      && delta.idleSeconds === 0
      && delta.activeSessionCount === 0
    ) {
      return
    }

    return delta
  }

  reset(day: string, now: number) {
    this.currentDay = day
    this.lastSampleAt = now
    this.keyboardActiveUntil = void 0
    this.mouseActiveUntil = void 0
    this.keyboardActiveMs = 0
    this.mouseActiveMs = 0
    this.idleMs = 0
    this.keyboardSessionCount = 0
    this.mouseSessionCount = 0
  }

  private isActive(now: number) {
    return (this.keyboardActiveUntil !== void 0 && now <= this.keyboardActiveUntil)
      || (this.mouseActiveUntil !== void 0 && now <= this.mouseActiveUntil)
  }
}
