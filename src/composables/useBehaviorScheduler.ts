import type { MotionInfo } from 'easy-live2d'

import { Priority } from 'easy-live2d'

import type { ScheduledBehavior } from '@/domain/behavior/scheduler'

import { useCompanionMode } from '@/composables/useCompanionMode'
import { BehaviorScheduler } from '@/domain/behavior/scheduler'
import live2d from '@/utils/live2d'

type BehaviorPayload
  = { kind: 'motion', motion: MotionInfo }
    | { kind: 'task', run: (signal: AbortSignal) => Promise<void> }

const scheduler = new BehaviorScheduler<BehaviorPayload>()
const SCHEDULER_TICK_MS = 1_000

let requestSequence = 0
let updateTimer: ReturnType<typeof setInterval> | undefined
const taskControllers = new Map<string, AbortController>()

export function useBehaviorScheduler() {
  const { companionModePolicy } = useCompanionMode()

  function play(behavior: ScheduledBehavior<BehaviorPayload>, interrupted?: ScheduledBehavior<BehaviorPayload>) {
    if (interrupted?.payload.kind === 'task') {
      taskControllers.get(interrupted.id)?.abort()
    }

    if (behavior.payload.kind === 'task') {
      const controller = new AbortController()

      taskControllers.set(behavior.id, controller)
      void behavior.payload.run(controller.signal)
        .catch(() => void 0)
        .finally(() => {
          taskControllers.delete(behavior.id)
          finish(behavior.id)
        })

      return
    }

    const started = live2d.startMotion(behavior.payload.motion, {
      priority: interrupted ? Priority.Force : Priority.Normal,
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
      payload: { kind: 'motion', motion },
      priority: 'user',
      resumable: false,
    }, companionModePolicy.value)

    if (result.status === 'started') {
      play(result.started, result.interrupted)
    }

    return result.status
  }

  function scheduleProactiveMotion(motion: MotionInfo, interaction = false) {
    requestSequence += 1

    const result = scheduler.request({
      id: `proactive-motion-${requestSequence}`,
      payload: { kind: 'motion', motion },
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

  function scheduleProactiveTask(name: string, run: (signal: AbortSignal) => Promise<void>) {
    const result = scheduler.request({
      id: `proactive-${name}`,
      payload: { kind: 'task', run },
      priority: 'ambient',
      proactive: true,
      frequency: 'action',
      resumable: false,
      cooldownKey: `task:${name}`,
      cooldownMs: companionModePolicy.value.minimumActionIntervalMs,
    }, companionModePolicy.value)

    if (result.status === 'started') play(result.started)

    return result.status
  }

  function scheduleProactiveInteraction(
    name: string,
    run: (signal: AbortSignal) => Promise<void>,
    cooldownMultiplier = 1,
  ) {
    const minimumInterval = companionModePolicy.value.minimumActionIntervalMs ?? 0
    const result = scheduler.request({
      id: `proactive-interaction-${name}`,
      payload: { kind: 'task', run },
      priority: 'ambient',
      proactive: true,
      frequency: 'interaction',
      resumable: false,
      cooldownKey: `interaction:${name}`,
      cooldownMs: minimumInterval * Math.max(1, cooldownMultiplier),
    }, companionModePolicy.value)

    if (result.status === 'started') play(result.started)

    return result.status
  }

  function cancelTasks() {
    for (const controller of taskControllers.values()) {
      controller.abort()
    }

    taskControllers.clear()
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

    cancelTasks()
    scheduler.clear()
  }

  function resetBehaviorScheduling() {
    cancelTasks()
    scheduler.clear()
  }

  return {
    resetBehaviorScheduling,
    scheduleProactiveMotion,
    scheduleProactiveInteraction,
    scheduleProactiveTask,
    scheduleUserMotion,
    startBehaviorScheduling,
    stopBehaviorScheduling,
  }
}
