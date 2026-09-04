import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type { DailyActivitySummary, MemorySettings, StructuredMemory } from '@/domain/memory/schema'

import { DEFAULT_MEMORY_SETTINGS, MEMORY_SCHEMA_VERSION, migrateMemoryState } from '@/domain/memory/schema'

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

  return {
    schemaVersion,
    settings,
    dailySummaries,
    memories,
    init,
    clearAllData,
  }
})
