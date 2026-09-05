import { PhysicalPosition } from '@tauri-apps/api/dpi'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { availableMonitors } from '@tauri-apps/api/window'

import type { Point } from '@/domain/behavior/movement'

import { useActivityState } from '@/composables/useActivityState'
import { useCompanionMode } from '@/composables/useCompanionMode'
import { setAutomaticWindowMovement } from '@/composables/useWindowState'
import { WINDOW_LABEL } from '@/constants'
import { planNearbyMovement } from '@/domain/behavior/movement'
import { findMonitorForPoint, getVisibleBounds } from '@/domain/window/bounds'
import { useAppStore } from '@/stores/app'
import { useCatStore } from '@/stores/cat'

type ScheduleTask = (name: string, run: (signal: AbortSignal) => Promise<void>) => string

const MOVEMENT_CHECK_MS = 30_000
const MOVEMENT_DURATION_MS = 800
const MOVEMENT_FRAME_MS = 50

function delay(duration: number) {
  return new Promise(resolve => setTimeout(resolve, duration))
}

export function useFiniteMovement(scheduleTask: ScheduleTask) {
  const appWindow = getCurrentWebviewWindow()
  const appStore = useAppStore()
  const catStore = useCatStore()
  const { activityState } = useActivityState()
  const { companionModePolicy } = useCompanionMode()
  let movementTimer: ReturnType<typeof setInterval> | undefined

  async function animateTo(target: Point, signal: AbortSignal) {
    const start = await appWindow.outerPosition()
    const startedAt = performance.now()

    setAutomaticWindowMovement(true)

    try {
      while (!signal.aborted) {
        const progress = Math.min(1, (performance.now() - startedAt) / MOVEMENT_DURATION_MS)
        const eased = 0.5 - Math.cos(progress * Math.PI) / 2

        await appWindow.setPosition(new PhysicalPosition(
          Math.round(start.x + (target.x - start.x) * eased),
          Math.round(start.y + (target.y - start.y) * eased),
        ))

        if (progress === 1) break

        await delay(MOVEMENT_FRAME_MS)
      }
    } finally {
      if (!signal.aborted) await delay(100)

      setAutomaticWindowMovement(false)
    }
  }

  async function requestMovement() {
    if (
      appWindow.label !== WINDOW_LABEL.MAIN
      || activityState.phase !== 'idle'
      || !companionModePolicy.value.allowProactiveMovement
      || catStore.window.lockPosition
      || !catStore.window.visible
    ) {
      return
    }

    const current = await appWindow.outerPosition()
    const windowSize = await appWindow.outerSize()
    const preferred = appStore.windowState[WINDOW_LABEL.MAIN]
    const anchor = {
      x: preferred?.x ?? current.x,
      y: preferred?.y ?? current.y,
    }
    const monitors = await availableMonitors()
    const monitor = findMonitorForPoint(monitors, anchor)
      ?? findMonitorForPoint(monitors, current)
      ?? monitors[0]

    if (!monitor) return

    const target = planNearbyMovement({
      anchor,
      bounds: getVisibleBounds(monitor),
      locked: catStore.window.lockPosition,
      mode: catStore.companion.mode,
      windowSize,
    })

    if (!target || (target.x === current.x && target.y === current.y)) return

    scheduleTask('window-movement', signal => animateTo(target, signal))
  }

  function startFiniteMovement() {
    if (movementTimer) return

    movementTimer = setInterval(() => void requestMovement(), MOVEMENT_CHECK_MS)
  }

  function stopFiniteMovement() {
    if (movementTimer) {
      clearInterval(movementTimer)
      movementTimer = void 0
    }

    setAutomaticWindowMovement(false)
  }

  return {
    startFiniteMovement,
    stopFiniteMovement,
  }
}
