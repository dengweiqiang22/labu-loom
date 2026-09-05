import { useActivityState } from '@/composables/useActivityState'
import { useCompanionMode } from '@/composables/useCompanionMode'
import { useInteraction } from '@/composables/useInteraction'
import { DEFAULT_WORK_HINT_THRESHOLD_MS } from '@/domain/behavior/work-hint'
import { canOfferRestReminder, getInteractionCooldownMultiplier } from '@/domain/interaction/scheduling'
import { useCatStore } from '@/stores/cat'
import { useMemoryStore } from '@/stores/memory'

type ScheduleInteraction = (
  name: string,
  run: (signal: AbortSignal) => Promise<void>,
  cooldownMultiplier?: number,
) => string

const REST_REMINDER_CHECK_MS = 60_000

export function useRestReminder(scheduleInteraction: ScheduleInteraction) {
  const catStore = useCatStore()
  const memoryStore = useMemoryStore()
  const { activityState } = useActivityState()
  const { companionModePolicy } = useCompanionMode()
  const { activeInteraction, openInteraction } = useInteraction()
  let reminderTimer: ReturnType<typeof setInterval> | undefined
  let offeredThisStreak = false
  let lastContinuousActiveForMs = 0

  function syncStreakGate() {
    const continuous = activityState.continuousActiveForMs ?? 0

    if (continuous === 0 && lastContinuousActiveForMs > 0) {
      offeredThisStreak = false
    }

    lastContinuousActiveForMs = continuous
  }

  function requestRestReminder() {
    if (activeInteraction.value) return

    syncStreakGate()

    const summary = memoryStore.getDailySummary()
    const offered = summary?.interactionsOffered ?? 0
    const dismissed = summary?.interactionsDismissed ?? 0

    if (!canOfferRestReminder({
      restRemindersEnabled: memoryStore.settings.restRemindersEnabled,
      interactionsEnabled: memoryStore.settings.interactionsEnabled,
      passThrough: catStore.window.passThrough,
      visible: catStore.window.visible,
      continuousActiveForMs: activityState.continuousActiveForMs,
      thresholdMs: DEFAULT_WORK_HINT_THRESHOLD_MS,
      maximumInteractionsPerDay: companionModePolicy.value.maximumInteractionsPerDay,
      interactionsOfferedToday: offered,
      alreadyOfferedThisStreak: offeredThisStreak,
    })) {
      return
    }

    offeredThisStreak = true
    scheduleInteraction(
      'rest-reminder',
      async (signal) => {
        await openInteraction('rest-reminder', 'proactive', signal)
      },
      getInteractionCooldownMultiplier(offered, dismissed),
    )
  }

  function startRestReminder() {
    if (reminderTimer) return

    reminderTimer = setInterval(requestRestReminder, REST_REMINDER_CHECK_MS)
  }

  function stopRestReminder() {
    if (!reminderTimer) return

    clearInterval(reminderTimer)
    reminderTimer = void 0
    offeredThisStreak = false
    lastContinuousActiveForMs = 0
  }

  return {
    requestRestReminder,
    startRestReminder,
    stopRestReminder,
  }
}
