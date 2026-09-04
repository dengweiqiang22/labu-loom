import type { CompanionMode } from '@/domain/behavior/mode'

export const MEMORY_SCHEMA_VERSION = 4
export const MAX_DAILY_SUMMARIES = 30
export const MAX_WEEKLY_SUMMARIES = 53

export interface MemorySettings {
  interactionsEnabled: boolean
  keyboardStatsEnabled: boolean
  mouseStatsEnabled: boolean
  habitMemoryEnabled: boolean
}

export interface DailyActivitySummary {
  day: string
  keyboardActiveSeconds: number
  mouseActiveSeconds: number
  idleSeconds: number
  activeSessionCount: number
  interactionsOffered: number
  interactionsAnswered: number
  interactionsDismissed: number
}

export interface WeeklyActivitySummary {
  weekStart: string
  daysCovered: number
  keyboardActiveSeconds: number
  mouseActiveSeconds: number
  idleSeconds: number
  activeSessionCount: number
  interactionsOffered: number
  interactionsAnswered: number
  interactionsDismissed: number
}

export interface MonthlyActivityTrend {
  month: string
  daysCovered: number
  keyboardActiveSeconds: number
  mouseActiveSeconds: number
  idleSeconds: number
  activeSessionCount: number
  interactionsOffered: number
  interactionsAnswered: number
  interactionsDismissed: number
}

export type MemoryCategory = 'habit' | 'preference' | 'context' | 'relationship'
export type MemorySource = 'explicit-choice' | 'activity-aggregate' | 'user-edited'
export type MemoryKind
  = 'preferred-companion-mode'
    | 'preferred-interaction-frequency'
    | 'often-active-period'
    | 'recent-energy-state'
    | 'usual-activity-balance'
    | 'interaction-response-style'
export type MemoryValue
  = CompanionMode
    | 'less'
    | 'same'
    | 'more'
    | 'morning'
    | 'afternoon'
    | 'evening'
    | 'doing-well'
    | 'taking-it-easy'
    | 'keyboard-led'
    | 'mouse-led'
    | 'mixed-activity'
    | 'responsive'
    | 'reserved'

export interface StructuredMemory {
  id: string
  category: MemoryCategory
  kind: MemoryKind
  value: MemoryValue
  source: MemorySource
  sourceFromDay: string
  sourceToDay: string
  createdDay: string
  updatedDay: string
}

export interface MemoryState {
  schemaVersion: number
  settings: MemorySettings
  dailySummaries: DailyActivitySummary[]
  weeklySummaries: WeeklyActivitySummary[]
  monthlyTrends: MonthlyActivityTrend[]
  memories: StructuredMemory[]
  forgottenMemoryIds: string[]
}

export const DEFAULT_MEMORY_SETTINGS: Readonly<MemorySettings> = Object.freeze({
  interactionsEnabled: true,
  keyboardStatsEnabled: false,
  mouseStatsEnabled: false,
  habitMemoryEnabled: false,
})

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/
const MEMORY_CATEGORIES = new Set<MemoryCategory>(['habit', 'preference', 'context', 'relationship'])
const MEMORY_KINDS = new Set<MemoryKind>([
  'preferred-companion-mode',
  'preferred-interaction-frequency',
  'often-active-period',
  'recent-energy-state',
  'usual-activity-balance',
  'interaction-response-style',
])
const MEMORY_VALUES = new Set<MemoryValue>([
  'quiet',
  'companion',
  'active',
  'less',
  'same',
  'more',
  'morning',
  'afternoon',
  'evening',
  'doing-well',
  'taking-it-easy',
  'keyboard-led',
  'mouse-led',
  'mixed-activity',
  'responsive',
  'reserved',
])
const MEMORY_SOURCES = new Set<MemorySource>(['explicit-choice', 'activity-aggregate', 'user-edited'])

export const MEMORY_VALUES_BY_KIND: Readonly<Record<MemoryKind, readonly MemoryValue[]>> = {
  'preferred-companion-mode': ['quiet', 'companion', 'active'],
  'preferred-interaction-frequency': ['less', 'same', 'more'],
  'often-active-period': ['morning', 'afternoon', 'evening'],
  'recent-energy-state': ['doing-well', 'taking-it-easy'],
  'usual-activity-balance': ['keyboard-led', 'mouse-led', 'mixed-activity'],
  'interaction-response-style': ['responsive', 'reserved'],
}

export function isMemoryValueAllowed(kind: MemoryKind, value: unknown): value is MemoryValue {
  return typeof value === 'string' && MEMORY_VALUES_BY_KIND[kind].includes(value as MemoryValue)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function asCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0
}

export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function normalizeDailySummary(value: unknown): DailyActivitySummary | undefined {
  const input = asRecord(value)

  if (!isDay(input.day)) return

  return {
    day: input.day,
    keyboardActiveSeconds: asCount(input.keyboardActiveSeconds),
    mouseActiveSeconds: asCount(input.mouseActiveSeconds),
    idleSeconds: asCount(input.idleSeconds),
    activeSessionCount: asCount(input.activeSessionCount),
    interactionsOffered: asCount(input.interactionsOffered),
    interactionsAnswered: asCount(input.interactionsAnswered),
    interactionsDismissed: asCount(input.interactionsDismissed),
  }
}

function normalizeAggregateCounts(input: Record<string, unknown>) {
  return {
    daysCovered: asCount(input.daysCovered),
    keyboardActiveSeconds: asCount(input.keyboardActiveSeconds),
    mouseActiveSeconds: asCount(input.mouseActiveSeconds),
    idleSeconds: asCount(input.idleSeconds),
    activeSessionCount: asCount(input.activeSessionCount),
    interactionsOffered: asCount(input.interactionsOffered),
    interactionsAnswered: asCount(input.interactionsAnswered),
    interactionsDismissed: asCount(input.interactionsDismissed),
  }
}

function normalizeWeeklySummary(value: unknown): WeeklyActivitySummary | undefined {
  const input = asRecord(value)

  if (!isDay(input.weekStart)) return

  return {
    weekStart: input.weekStart,
    ...normalizeAggregateCounts(input),
  }
}

function normalizeMonthlyTrend(value: unknown): MonthlyActivityTrend | undefined {
  const input = asRecord(value)

  if (typeof input.month !== 'string' || !MONTH_PATTERN.test(input.month)) return

  return {
    month: input.month,
    ...normalizeAggregateCounts(input),
  }
}

function normalizeMemory(value: unknown): StructuredMemory | undefined {
  const input = asRecord(value)

  if (
    typeof input.id !== 'string'
    || !MEMORY_CATEGORIES.has(input.category as MemoryCategory)
    || !MEMORY_KINDS.has(input.kind as MemoryKind)
    || !MEMORY_VALUES.has(input.value as MemoryValue)
    || !MEMORY_SOURCES.has(input.source as MemorySource)
    || !isDay(input.sourceFromDay)
    || !isDay(input.sourceToDay)
    || !isDay(input.createdDay)
    || !isDay(input.updatedDay)
  ) {
    return
  }

  return {
    id: input.id,
    category: input.category as MemoryCategory,
    kind: input.kind as MemoryKind,
    value: input.value as MemoryValue,
    source: input.source as MemorySource,
    sourceFromDay: input.sourceFromDay,
    sourceToDay: input.sourceToDay,
    createdDay: input.createdDay,
    updatedDay: input.updatedDay,
  }
}

export function migrateMemoryState(value: unknown): MemoryState {
  const input = asRecord(value)
  const settings = asRecord(input.settings)
  const dailySummaries = Array.isArray(input.dailySummaries)
    ? input.dailySummaries
        .map(normalizeDailySummary)
        .filter(summary => summary !== void 0)
        .sort((left, right) => left.day.localeCompare(right.day))
        .slice(-MAX_DAILY_SUMMARIES)
    : []
  const memories = Array.isArray(input.memories)
    ? input.memories.map(normalizeMemory).filter(memory => memory !== void 0)
    : []
  const forgottenMemoryIds = Array.isArray(input.forgottenMemoryIds)
    ? [...new Set(input.forgottenMemoryIds.filter(id => typeof id === 'string'))]
    : []
  const weeklySummaries = Array.isArray(input.weeklySummaries)
    ? input.weeklySummaries
        .map(normalizeWeeklySummary)
        .filter(summary => summary !== void 0)
        .sort((left, right) => left.weekStart.localeCompare(right.weekStart))
        .slice(-MAX_WEEKLY_SUMMARIES)
    : []
  const monthlyTrends = Array.isArray(input.monthlyTrends)
    ? input.monthlyTrends
        .map(normalizeMonthlyTrend)
        .filter(trend => trend !== void 0)
        .sort((left, right) => left.month.localeCompare(right.month))
    : []

  return {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    settings: {
      interactionsEnabled: asBoolean(settings.interactionsEnabled, DEFAULT_MEMORY_SETTINGS.interactionsEnabled),
      keyboardStatsEnabled: asBoolean(settings.keyboardStatsEnabled, DEFAULT_MEMORY_SETTINGS.keyboardStatsEnabled),
      mouseStatsEnabled: asBoolean(settings.mouseStatsEnabled, DEFAULT_MEMORY_SETTINGS.mouseStatsEnabled),
      habitMemoryEnabled: asBoolean(settings.habitMemoryEnabled, DEFAULT_MEMORY_SETTINGS.habitMemoryEnabled),
    },
    dailySummaries,
    weeklySummaries,
    monthlyTrends,
    memories,
    forgottenMemoryIds,
  }
}
