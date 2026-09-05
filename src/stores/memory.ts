import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'

import type { InteractionChoiceId } from '@/domain/interaction/templates'
import type { DailyActivityDelta } from '@/domain/memory/activity'
import type { DailyActivitySummary, MemoryCategory, MemorySettings, MemoryValue, MonthlyActivityTrend, StructuredMemory, WeeklyActivitySummary } from '@/domain/memory/schema'

import { compressMemoryAggregates } from '@/domain/memory/compression'
import { getLocalDay } from '@/domain/memory/day'
import { createChoiceMemory, deriveAggregateMemories, mergeStructuredMemories } from '@/domain/memory/generation'
import { createRecollectionOverview } from '@/domain/memory/recollection'
import { DEFAULT_MEMORY_SETTINGS, isMemoryValueAllowed, MAX_DAILY_SUMMARIES, MEMORY_SCHEMA_VERSION, migrateMemoryState } from '@/domain/memory/schema'
import { createPetPerspectiveSummary } from '@/domain/memory/summary'

export const useMemoryStore = defineStore('memory', () => {
  const schemaVersion = ref(MEMORY_SCHEMA_VERSION)
  const settings = reactive<MemorySettings>({ ...DEFAULT_MEMORY_SETTINGS })
  const dailySummaries = ref<DailyActivitySummary[]>([])
  const weeklySummaries = ref<WeeklyActivitySummary[]>([])
  const monthlyTrends = ref<MonthlyActivityTrend[]>([])
  const memories = ref<StructuredMemory[]>([])
  const forgottenMemoryIds = ref<string[]>([])
  const recollectionOverview = computed(() => createRecollectionOverview(
    dailySummaries.value,
    weeklySummaries.value,
    monthlyTrends.value,
    memories.value,
  ))
  const petPerspectiveSummary = computed(() => createPetPerspectiveSummary(recollectionOverview.value))

  function init() {
    const migrated = migrateMemoryState({
      schemaVersion: schemaVersion.value,
      settings,
      dailySummaries: dailySummaries.value,
      weeklySummaries: weeklySummaries.value,
      monthlyTrends: monthlyTrends.value,
      memories: memories.value,
      forgottenMemoryIds: forgottenMemoryIds.value,
    })

    schemaVersion.value = migrated.schemaVersion
    Object.assign(settings, migrated.settings)
    dailySummaries.value = migrated.dailySummaries
    weeklySummaries.value = migrated.weeklySummaries
    monthlyTrends.value = migrated.monthlyTrends
    memories.value = migrated.memories
    forgottenMemoryIds.value = migrated.forgottenMemoryIds
    compressAggregates()
    refreshDerivedMemories()
  }

  function clearAllData() {
    dailySummaries.value = []
    weeklySummaries.value = []
    monthlyTrends.value = []
    memories.value = []
    forgottenMemoryIds.value = []
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

    forgottenMemoryIds.value = forgottenMemoryIds.value.filter(id => id !== memory.id)
    memories.value = mergeStructuredMemories(memories.value, [memory])
  }

  function refreshDerivedMemories(day = getLocalDay()) {
    const generated = deriveAggregateMemories(
      dailySummaries.value,
      day,
      settings.habitMemoryEnabled,
    )

    memories.value = mergeStructuredMemories(
      memories.value,
      generated,
      true,
      new Set(forgottenMemoryIds.value),
    )
  }

  function updateMemoryValue(id: string, value: MemoryValue, day = getLocalDay()) {
    const memory = memories.value.find(item => item.id === id)

    if (!memory || !isMemoryValueAllowed(memory.kind, value)) return false

    memory.value = value
    memory.source = 'user-edited'
    memory.updatedDay = day

    return true
  }

  function forgetMemory(id: string) {
    if (!memories.value.some(memory => memory.id === id)) return

    memories.value = memories.value.filter(memory => memory.id !== id)
    forgottenMemoryIds.value = [...new Set([...forgottenMemoryIds.value, id])]
  }

  function clearMemoryCategory(category: MemoryCategory) {
    const removedIds = memories.value
      .filter(memory => memory.category === category)
      .map(memory => memory.id)

    memories.value = memories.value.filter(memory => memory.category !== category)
    forgottenMemoryIds.value = [...new Set([...forgottenMemoryIds.value, ...removedIds])]
  }

  return {
    schemaVersion,
    settings,
    dailySummaries,
    weeklySummaries,
    monthlyTrends,
    memories,
    forgottenMemoryIds,
    recollectionOverview,
    petPerspectiveSummary,
    init,
    clearAllData,
    addDailyActivity,
    compressAggregates,
    getDailySummary,
    getOrCreateDailySummary,
    clearMemoryCategory,
    forgetMemory,
    recordInteractionChoice,
    recordProactiveInteraction,
    refreshDerivedMemories,
    updateMemoryValue,
  }
})
