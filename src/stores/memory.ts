import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type { InteractionChoiceId } from '@/domain/interaction/templates'
import type { DailyActivityDelta } from '@/domain/memory/activity'
import type { DailyActivitySummary, MemorySettings, MonthlyActivityTrend, StructuredMemory, WeeklyActivitySummary } from '@/domain/memory/schema'

import { compressMemoryAggregates } from '@/domain/memory/compression'
import { getLocalDay } from '@/domain/memory/day'
import { createChoiceMemory, deriveAggregateMemories, mergeStructuredMemories } from '@/domain/memory/generation'
import { DEFAULT_MEMORY_SETTINGS, MAX_DAILY_SUMMARIES, MEMORY_SCHEMA_VERSION, migrateMemoryState } from '@/domain/memory/schema'

export const useMemoryStore = defineStore('memory', () => {
  const schemaVersion = ref(MEMORY_SCHEMA_VERSION)
  const settings = reactive<MemorySettings>({ ...DEFAULT_MEMORY_SETTINGS })
  const dailySummaries = ref<DailyActivitySummary[]>([])
  const weeklySummaries = ref<WeeklyActivitySummary[]>([])
  const monthlyTrends = ref<MonthlyActivityTrend[]>([])
  const memories = ref<StructuredMemory[]>([])

  function init() {
    const migrated = migrateMemoryState({
      schemaVersion: schemaVersion.value,
      settings,
      dailySummaries: dailySummaries.value,
      weeklySummaries: weeklySummaries.value,
      monthlyTrends: monthlyTrends.value,
      memories: memories.value,
    })

    schemaVersion.value = migrated.schemaVersion
    Object.assign(settings, migrated.settings)
    dailySummaries.value = migrated.dailySummaries
    weeklySummaries.value = migrated.weeklySummaries
    monthlyTrends.value = migrated.monthlyTrends
    memories.value = migrated.memories
    compressAggregates()
    refreshDerivedMemories()
  }

  function clearAllData() {
    dailySummaries.value = []
    weeklySummaries.value = []
    monthlyTrends.value = []
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

    compressAggregates(day)
    dailySummaries.value = dailySummaries.value.slice(-MAX_DAILY_SUMMARIES)

    return getDailySummary(day)!
  }

  function compressAggregates(referenceDay = getLocalDay()) {
    const compressed = compressMemoryAggregates({
      dailySummaries: dailySummaries.value,
      weeklySummaries: weeklySummaries.value,
      monthlyTrends: monthlyTrends.value,
    }, referenceDay)

    dailySummaries.value = compressed.dailySummaries
    weeklySummaries.value = compressed.weeklySummaries
    monthlyTrends.value = compressed.monthlyTrends
  }

  function addDailyActivity(delta: DailyActivityDelta) {
    const summary = getOrCreateDailySummary(delta.day)

    summary.keyboardActiveSeconds += delta.keyboardActiveSeconds
    summary.mouseActiveSeconds += delta.mouseActiveSeconds
    summary.idleSeconds += delta.idleSeconds
    summary.activeSessionCount += delta.activeSessionCount
    refreshDerivedMemories(delta.day)
  }

  function recordProactiveInteraction(kind: 'offered' | 'answered' | 'dismissed', day = getLocalDay()) {
    const summary = getOrCreateDailySummary(day)

    if (kind === 'offered') summary.interactionsOffered += 1
    if (kind === 'answered') summary.interactionsAnswered += 1
    if (kind === 'dismissed') summary.interactionsDismissed += 1

    refreshDerivedMemories(day)
  }

  function recordInteractionChoice(choiceId: InteractionChoiceId, day = getLocalDay()) {
    const memory = createChoiceMemory(choiceId, day)

    if (!memory) return

    memories.value = mergeStructuredMemories(memories.value, [memory])
  }

  function refreshDerivedMemories(day = getLocalDay()) {
    const generated = deriveAggregateMemories(
      dailySummaries.value,
      day,
      settings.habitMemoryEnabled,
    )

    memories.value = mergeStructuredMemories(memories.value, generated, true)
  }

  return {
    schemaVersion,
    settings,
    dailySummaries,
    weeklySummaries,
    monthlyTrends,
    memories,
    init,
    clearAllData,
    addDailyActivity,
    compressAggregates,
    getDailySummary,
    getOrCreateDailySummary,
    recordInteractionChoice,
    recordProactiveInteraction,
    refreshDerivedMemories,
  }
})
