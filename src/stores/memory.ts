import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type { DailyActivityDelta } from '@/domain/memory/activity'
import type { DailyActivitySummary, MemorySettings, StructuredMemory } from '@/domain/memory/schema'

import { getLocalDay } from '@/domain/memory/day'
import { DEFAULT_MEMORY_SETTINGS, MAX_DAILY_SUMMARIES, MEMORY_SCHEMA_VERSION, migrateMemoryState } from '@/domain/memory/schema'

export const useMemoryStore = defineStore('memory', () => {
  const schemaVersion = ref(MEMORY_SCHEMA_VERSION)
  const settings = reactive<MemorySettings>({ ...DEFAULT_MEMORY_SETTINGS })
  const dailySummaries = ref<DailyActivitySummary[]>([])
  const memories = ref<StructuredMemory[]>([])

  function init() {
    const migrated = migrateMemoryState({
      schemaVersion: schemaVersion.value,
      settings,
      dailySummaries: dailySummaries.value,
      memories: memories.value,
    })

    schemaVersion.value = migrated.schemaVersion
    Object.assign(settings, migrated.settings)
    dailySummaries.value = migrated.dailySummaries
    memories.value = migrated.memories
  }

  function clearAllData() {
    dailySummaries.value = []
    memories.value = []
  }

  function getDailySummary(day = getLocalDay()) {
    return dailySummaries.value.find(summary => summary.day === day)
  }

  function getOrCreateDailySummary(day = getLocalDay()) {
    const existing = getDailySummary(day)

    if (existing) return existing

    const summary: DailyActivitySummary = {
      day,
      keyboardActiveSeconds: 0,
      mouseActiveSeconds: 0,
      idleSeconds: 0,
      activeSessionCount: 0,
      interactionsOffered: 0,
      interactionsAnswered: 0,
      interactionsDismissed: 0,
    }

    dailySummaries.value = [...dailySummaries.value, summary]
      .sort((left, right) => left.day.localeCompare(right.day))
      .slice(-MAX_DAILY_SUMMARIES)

    return getDailySummary(day)!
  }

  function addDailyActivity(delta: DailyActivityDelta) {
    const summary = getOrCreateDailySummary(delta.day)

    summary.keyboardActiveSeconds += delta.keyboardActiveSeconds
    summary.mouseActiveSeconds += delta.mouseActiveSeconds
    summary.idleSeconds += delta.idleSeconds
    summary.activeSessionCount += delta.activeSessionCount
  }

  function recordProactiveInteraction(kind: 'offered' | 'answered' | 'dismissed', day = getLocalDay()) {
    const summary = getOrCreateDailySummary(day)

    if (kind === 'offered') summary.interactionsOffered += 1
    if (kind === 'answered') summary.interactionsAnswered += 1
    if (kind === 'dismissed') summary.interactionsDismissed += 1
  }

  return {
    schemaVersion,
    settings,
    dailySummaries,
    memories,
    init,
    clearAllData,
    addDailyActivity,
    getDailySummary,
    getOrCreateDailySummary,
    recordProactiveInteraction,
  }
})
