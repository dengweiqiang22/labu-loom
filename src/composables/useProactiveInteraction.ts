import { useActivityState } from '@/composables/useActivityState'
import { useCompanionMode } from '@/composables/useCompanionMode'
import { useInteraction } from '@/composables/useInteraction'
import { canOfferProactiveInteraction, getInteractionCooldownMultiplier } from '@/domain/interaction/scheduling'
import { useCatStore } from '@/stores/cat'
import { useMemoryStore } from '@/stores/memory'

type ScheduleInteraction = (
  name: string,
  run: (signal: AbortSignal) => Promise<void>,
  cooldownMultiplier?: number,
) => string

const INTERACTION_CHECK_MS = 60_000

export function useProactiveInteraction(scheduleInteraction: ScheduleInteraction) {
  const catStore = useCatStore()
  const memoryStore = useMemoryStore()
  const { activityState } = useActivityState()
  const { companionModePolicy } = useCompanionMode()
  const { activeInteraction, openInteraction } = useInteraction()
  let interactionTimer: ReturnType<typeof setInterval> | undefined

  function requestInteraction() {
    if (activeInteraction.value) return

    const summary = memoryStore.getDailySummary()
    const offered = summary?.interactionsOffered ?? 0
    const dismissed = summary?.interactionsDismissed ?? 0

    if (!canOfferProactiveInteraction({
      interactionsEnabled: memoryStore.settings.interactionsEnabled,
      passThrough: catStore.window.passThrough,
      visible: catStore.window.visible,
      activityPhase: activityState.phase,
      interactionsOfferedToday: offered,
      interactionsDismissedToday: dismissed,
      maximumInteractionsPerDay: companionModePolicy.value.maximumInteractionsPerDay,
    })) {
      return
    }

    scheduleInteraction(
      'daily-check-in',
      async (signal) => {
        await openInteraction('daily-check-in', 'proactive', signal)
      },
      getInteractionCooldownMultiplier(offered, dismissed),
    )
  }

  function startProactiveInteraction() {
    if (interactionTimer) return

    interactionTimer = setInterval(requestInteraction, INTERACTION_CHECK_MS)
  }

  function stopProactiveInteraction() {
    if (!interactionTimer) return

    clearInterval(interactionTimer)
    interactionTimer = void 0
  }

  return {
    requestInteraction,
    startProactiveInteraction,
    stopProactiveInteraction,
  }
}
