import { reactive, readonly } from 'vue'

import type { ActivitySnapshot } from '@/domain/activity'
import type { InputEvent } from '@/domain/input'

import { ActivityTracker } from '@/domain/activity'

const UPDATE_INTERVAL_MS = 250
const tracker = new ActivityTracker()
const state = reactive<ActivitySnapshot>(tracker.snapshot())

let updateTimer: ReturnType<typeof setInterval> | undefined

function updateState(snapshot: ActivitySnapshot) {
  state.phase = snapshot.phase
  state.inputIntensity = snapshot.inputIntensity
  state.inactiveForMs = snapshot.inactiveForMs
}

function recordActivity(event: InputEvent) {
  updateState(tracker.record(event))
}

function resetActivity() {
  updateState(tracker.reset())
}

function startActivityTracking() {
  if (updateTimer) return

  updateState(tracker.snapshot())
  updateTimer = setInterval(() => updateState(tracker.snapshot()), UPDATE_INTERVAL_MS)
}

function stopActivityTracking() {
  if (updateTimer) {
    clearInterval(updateTimer)
    updateTimer = void 0
  }

  resetActivity()
}

export function useActivityState() {
  return {
    activityState: readonly(state),
    recordActivity,
    resetActivity,
    startActivityTracking,
    stopActivityTracking,
  }
}
