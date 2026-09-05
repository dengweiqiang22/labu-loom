import type { MotionInfo } from 'easy-live2d'

import { useActivityState } from '@/composables/useActivityState'
import { useCompanionMode } from '@/composables/useCompanionMode'
import { DEFAULT_WORK_HINT_THRESHOLD_MS, pickWorkHintMotion, shouldOfferWorkHint } from '@/domain/behavior/work-hint'
import { useModelStore } from '@/stores/model'

type ScheduleMotion = (motion: MotionInfo) => string

const WORK_HINT_CHECK_MS = 30_000

export function useWorkHint(scheduleProactiveMotion: ScheduleMotion) {
  const modelStore = useModelStore()
  const { activityState } = useActivityState()
  const { companionModePolicy } = useCompanionMode()
  let hintTimer: ReturnType<typeof setInterval> | undefined

  function requestWorkHint() {
    if (!shouldOfferWorkHint({
      continuousActiveForMs: activityState.continuousActiveForMs,
      allowProactiveBehavior: companionModePolicy.value.allowProactiveBehavior,
      thresholdMs: DEFAULT_WORK_HINT_THRESHOLD_MS,
    })) {
      return
    }

    const motion = pickWorkHintMotion(modelStore.currentMotions)

    if (!motion) return

    scheduleProactiveMotion(motion)
  }

  function startWorkHint() {
    if (hintTimer) return

    hintTimer = setInterval(requestWorkHint, WORK_HINT_CHECK_MS)
  }

  function stopWorkHint() {
    if (!hintTimer) return

    clearInterval(hintTimer)
    hintTimer = void 0
  }

  return {
    requestWorkHint,
    startWorkHint,
    stopWorkHint,
  }
}
