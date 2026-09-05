import type { Event } from '@tauri-apps/api/event'

import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { availableMonitors } from '@tauri-apps/api/window'
import { useDebounceFn } from '@vueuse/core'
import { isNumber } from 'es-toolkit/compat'
import { onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'

import { WINDOW_LABEL } from '@/constants'
import {
  clampWindowPosition,
  findMonitorForPoint,
  getVisibleBounds,
  resolveRestoredWindowPosition,
} from '@/domain/window/bounds'
import { useAppStore } from '@/stores/app'
import { useCatStore } from '@/stores/cat'
import { getCursorMonitor, invalidateCursorMonitorCache } from '@/utils/monitor'

export type WindowState = Record<string, Partial<PhysicalPosition & PhysicalSize> | undefined>

const appWindow = getCurrentWebviewWindow()
const { label } = appWindow
let automaticMovement = false
export const currentWindowPosition = shallowRef<PhysicalPosition>()

export function setAutomaticWindowMovement(active: boolean) {
  automaticMovement = active
}

export function useWindowState() {
  const appStore = useAppStore()
  const catStore = useCatStore()
  const isRestored = ref(false)
  const unlistenFocus = ref<(() => void) | undefined>()

  onMounted(() => {
    appWindow.onMoved(onMoved)
    appWindow.onResized(onResized)
    appWindow.onScaleChanged(() => {
      invalidateCursorMonitorCache()
      void clampToMonitor()
    })

    void appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) void clampToMonitor()
    }).then((unlisten) => {
      unlistenFocus.value = unlisten
    })
  })

  onUnmounted(() => {
    unlistenFocus.value?.()
  })

  async function resolveClampMonitor() {
    const windowPos = await appWindow.outerPosition()
    const monitors = await availableMonitors()
    const matched = findMonitorForPoint(monitors, windowPos)

    if (matched) return matched

    return getCursorMonitor() ?? monitors[0] ?? null
  }

  const clampToMonitor = useDebounceFn(async () => {
    if (label !== WINDOW_LABEL.MAIN || !catStore.window.keepInScreen) return

    const monitor = await resolveClampMonitor()

    if (!monitor) return

    const windowSize = await appWindow.outerSize()
    const windowPos = await appWindow.outerPosition()
    const clamped = clampWindowPosition(
      windowPos,
      windowSize,
      getVisibleBounds(monitor),
    )

    if (clamped.x === windowPos.x && clamped.y === windowPos.y) return

    return appWindow.setPosition(new PhysicalPosition(clamped.x, clamped.y))
  }, 500)

  watch(() => catStore.window.keepInScreen, () => void clampToMonitor())

  const shouldPersistChange = async () => {
    const minimized = await appWindow.isMinimized()

    return !minimized
  }

  const onMoved = async (event: Event<PhysicalPosition>) => {
    if (!await shouldPersistChange()) return

    currentWindowPosition.value = event.payload

    if (automaticMovement) return

    appStore.windowState[label] ??= {}

    Object.assign(appStore.windowState[label], event.payload)

    void clampToMonitor()
  }

  const onResized = async (event: Event<PhysicalSize>) => {
    if (!await shouldPersistChange()) return

    appStore.windowState[label] ??= {}

    Object.assign(appStore.windowState[label], event.payload)

    void clampToMonitor()
  }

  const restoreState = async () => {
    const { x, y, width, height } = appStore.windowState[label] ?? {}
    const windowSize = width && height
      ? { width, height }
      : await appWindow.outerSize()

    if (isNumber(x) && isNumber(y)) {
      const monitors = await availableMonitors()
      const restored = resolveRestoredWindowPosition(
        { x, y },
        windowSize,
        monitors,
      )

      if (restored) {
        await appWindow.setPosition(new PhysicalPosition(restored.x, restored.y))
      }
    }

    currentWindowPosition.value = await appWindow.outerPosition()

    if (width && height) {
      await appWindow.setSize(new PhysicalSize(width, height))
    }

    isRestored.value = true

    void clampToMonitor()
  }

  return {
    isRestored,
    restoreState,
  }
}
