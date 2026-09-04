import { watch } from 'vue'

import type { ActivityAggregationSettings, ActivitySource, DailyActivityDelta } from '@/domain/memory/activity'

import { DailyActivityAccumulator } from '@/domain/memory/activity'
import { getLocalDay } from '@/domain/memory/day'
import { useGeneralStore } from '@/stores/general'
import { useMemoryStore } from '@/stores/memory'

const SAMPLE_INTERVAL_MS = 1_000
const FLUSH_INTERVAL_MS = 5 * 60_000
const accumulator = new DailyActivityAccumulator(getLocalDay(), performance.now())

let settings: ActivityAggregationSettings = {
  keyboardEnabled: false,
  mouseEnabled: false,
}

export function recordInputActivity(source: ActivitySource) {
  if (
    (source === 'keyboard' && !settings.keyboardEnabled)
    || (source === 'mouse' && !settings.mouseEnabled)
  ) {
    return
  }

  accumulator.record(source, performance.now())
}

export function resetPendingActivity() {
  accumulator.reset(getLocalDay(), performance.now())
}

export function useDailyActivityAggregation() {
  const generalStore = useGeneralStore()
  const memoryStore = useMemoryStore()
  let sampleTimer: ReturnType<typeof setInterval> | undefined
  let flushTimer: ReturnType<typeof setInterval> | undefined

  function persist(delta?: DailyActivityDelta) {
    if (delta) memoryStore.addDailyActivity(delta)
  }

  function sample() {
    persist(accumulator.sample(getLocalDay(), performance.now(), settings))
  }

  function flush() {
    sample()
    persist(accumulator.drain())
  }

  watch([
    () => generalStore.app.inputListening,
    () => memoryStore.settings.keyboardStatsEnabled,
    () => memoryStore.settings.mouseStatsEnabled,
  ], ([inputListening, keyboardEnabled, mouseEnabled]) => {
    settings = {
      keyboardEnabled: inputListening && keyboardEnabled,
      mouseEnabled: inputListening && mouseEnabled,
    }
    accumulator.applySettings(settings)
  }, { immediate: true })

  function startDailyActivityAggregation() {
    if (sampleTimer || flushTimer) return

    resetPendingActivity()
    sampleTimer = setInterval(sample, SAMPLE_INTERVAL_MS)
    flushTimer = setInterval(flush, FLUSH_INTERVAL_MS)
  }

  function stopDailyActivityAggregation() {
    if (sampleTimer) clearInterval(sampleTimer)
    if (flushTimer) clearInterval(flushTimer)

    sampleTimer = void 0
    flushTimer = void 0
    flush()
    resetPendingActivity()
  }

  return {
    flushDailyActivity: flush,
    startDailyActivityAggregation,
    stopDailyActivityAggregation,
  }
}
