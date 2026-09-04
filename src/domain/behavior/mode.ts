export const COMPANION_MODES = ['quiet', 'companion', 'active'] as const

export type CompanionMode = typeof COMPANION_MODES[number]
export type MotionLevel = 'minimal' | 'normal' | 'expressive'

export interface CompanionModePolicy {
  allowProactiveBehavior: boolean
  allowProactiveMovement: boolean
  motionLevel: MotionLevel
  minimumActionIntervalMs?: number
  maximumActionsPerHour: number
  maximumInteractionsPerDay: number
}

export const DEFAULT_COMPANION_MODE: CompanionMode = 'companion'

const MINUTE_MS = 60_000

const POLICIES: Readonly<Record<CompanionMode, Readonly<CompanionModePolicy>>> = {
  quiet: Object.freeze({
    allowProactiveBehavior: false,
    allowProactiveMovement: false,
    motionLevel: 'minimal',
    maximumActionsPerHour: 0,
    maximumInteractionsPerDay: 0,
  }),
  companion: Object.freeze({
    allowProactiveBehavior: true,
    allowProactiveMovement: true,
    motionLevel: 'normal',
    minimumActionIntervalMs: 5 * MINUTE_MS,
    maximumActionsPerHour: 4,
    maximumInteractionsPerDay: 2,
  }),
  active: Object.freeze({
    allowProactiveBehavior: true,
    allowProactiveMovement: true,
    motionLevel: 'expressive',
    minimumActionIntervalMs: 2 * MINUTE_MS,
    maximumActionsPerHour: 12,
    maximumInteractionsPerDay: 6,
  }),
}

export function normalizeCompanionMode(value: unknown): CompanionMode {
  return COMPANION_MODES.includes(value as CompanionMode)
    ? value as CompanionMode
    : DEFAULT_COMPANION_MODE
}

export function getCompanionModePolicy(mode: CompanionMode) {
  return POLICIES[mode]
}
