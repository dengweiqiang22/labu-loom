import type { MotionInfo } from 'easy-live2d'

import { Priority } from 'easy-live2d'

import type { ScheduledBehavior } from '@/domain/behavior/scheduler'

import { useCompanionMode } from '@/composables/useCompanionMode'
import { BehaviorScheduler } from '@/domain/behavior/scheduler'
import live2d from '@/utils/live2d'

const scheduler = new BehaviorScheduler<MotionInfo>()
const SCHEDULER_TICK_MS = 1_000

let requestSequence = 0
let updateTimer: ReturnType<typeof setInterval> | undefined

export function useBehaviorScheduler() {
  const { companionModePolicy } = useCompanionMode()

  function play(behavior: ScheduledBehavior<MotionInfo>, force = false) {
    const started = live2d.startMotion(behavior.payload, {
      priority: force ? Priority.Force : Priority.Normal,
      onFinished: () => finish(behavior.id),
    })

    if (!started) {
      finish(behavior.id)
      return
    }

    void started.catch(() => finish(behavior.id))
  }

  function finish(id: string) {
    const { next } = scheduler.complete(id, companionModePolicy.value)

    if (next) play(next)
  }

  function scheduleUserMotion(motion: MotionInfo) {
    requestSequence += 1

    const result = scheduler.request({
      id: `user-motion-${requestSequence}`,
      payload: motion,
      priority: 'user',
      resumable: false,
    }, companionModePolicy.value)

    if (result.status === 'started') {
      play(result.started, result.interrupted !== void 0)
    }

    return result.status
  }

  function scheduleProactiveMotion(motion: MotionInfo, interaction = false) {
    requestSequence += 1

    const result = scheduler.request({
      id: `proactive-motion-${requestSequence}`,
      payload: motion,
      priority: 'ambient',
      proactive: true,
      frequency: interaction ? 'interaction' : 'action',
      resumable: true,
      cooldownKey: `${motion.group}:${motion.no}`,
      cooldownMs: companionModePolicy.value.minimumActionIntervalMs,
    }, companionModePolicy.value)

    if (result.status === 'started') play(result.started)

    return result.status
  }

  function startBehaviorScheduling() {
    if (updateTimer) return

    updateTimer = setInterval(() => {
      const next = scheduler.tick(companionModePolicy.value)

      if (next) play(next)
    }, SCHEDULER_TICK_MS)
  }

  function stopBehaviorScheduling() {
    if (updateTimer) {
      clearInterval(updateTimer)
      updateTimer = void 0
    }

    scheduler.clear()
  }

  function resetBehaviorScheduling() {
    scheduler.clear()
  }

  return {
    resetBehaviorScheduling,
    scheduleProactiveMotion,
    scheduleUserMotion,
    startBehaviorScheduling,
    stopBehaviorScheduling,
  }
}
