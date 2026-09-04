import type { CompanionMode } from '@/domain/behavior/mode'

export const MEMORY_SCHEMA_VERSION = 1
export const MAX_DAILY_SUMMARIES = 30

export interface MemorySettings {
  interactionsEnabled: boolean
  keyboardStatsEnabled: boolean
  mouseStatsEnabled: boolean
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

export type MemoryCategory = 'habit' | 'preference' | 'context' | 'relationship'
export type MemorySource = 'explicit-choice' | 'activity-aggregate'
export type MemoryKind = 'preferred-companion-mode' | 'preferred-interaction-frequency' | 'often-active-period'
export type MemoryValue = CompanionMode | 'less' | 'same' | 'more' | 'morning' | 'afternoon' | 'evening'

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
  memories: StructuredMemory[]
}

export const DEFAULT_MEMORY_SETTINGS: Readonly<MemorySettings> = Object.freeze({
  interactionsEnabled: true,
  keyboardStatsEnabled: false,
  mouseStatsEnabled: false,
})

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MEMORY_CATEGORIES = new Set<MemoryCategory>(['habit', 'preference', 'context', 'relationship'])
const MEMORY_KINDS = new Set<MemoryKind>(['preferred-companion-mode', 'preferred-interaction-frequency', 'often-active-period'])
const MEMORY_VALUES = new Set<MemoryValue>(['quiet', 'companion', 'active', 'less', 'same', 'more', 'morning', 'afternoon', 'evening'])
const MEMORY_SOURCES = new Set<MemorySource>(['explicit-choice', 'activity-aggregate'])

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

  return {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    settings: {
      interactionsEnabled: asBoolean(settings.interactionsEnabled, DEFAULT_MEMORY_SETTINGS.interactionsEnabled),
      keyboardStatsEnabled: asBoolean(settings.keyboardStatsEnabled, DEFAULT_MEMORY_SETTINGS.keyboardStatsEnabled),
      mouseStatsEnabled: asBoolean(settings.mouseStatsEnabled, DEFAULT_MEMORY_SETTINGS.mouseStatsEnabled),
    },
    dailySummaries,
    memories,
  }
}
