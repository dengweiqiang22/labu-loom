import type { Event } from '@tauri-apps/api/event'

import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { availableMonitors } from '@tauri-apps/api/window'
import { useDebounceFn } from '@vueuse/core'
import { isNumber } from 'es-toolkit/compat'
import { onMounted, ref, shallowRef, watch } from 'vue'

import { WINDOW_LABEL } from '@/constants'
import { useAppStore } from '@/stores/app'
import { useCatStore } from '@/stores/cat'
import { getCursorMonitor } from '@/utils/monitor'

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

  onMounted(() => {
    appWindow.onMoved(onMoved)

    appWindow.onResized(onResized)

    appWindow.onScaleChanged(clampToMonitor)
  })

  const clampToMonitor = useDebounceFn(async () => {
    if (label !== WINDOW_LABEL.MAIN || !catStore.window.keepInScreen) return

    const monitor = await getCursorMonitor()

    if (!monitor) return

    const { position: monitorPos, size: monitorSize } = monitor
    const windowSize = await appWindow.outerSize()
    const windowPos = await appWindow.outerPosition()

    const minX = monitorPos.x
    const maxX = monitorPos.x + monitorSize.width - windowSize.width
    const minY = monitorPos.y
    const maxY = monitorPos.y + monitorSize.height - windowSize.height

    const clampedX = Math.max(minX, Math.min(windowPos.x, maxX))
    const clampedY = Math.max(minY, Math.min(windowPos.y, maxY))

    if (clampedX === windowPos.x && clampedY === windowPos.y) return

    return appWindow.setPosition(new PhysicalPosition(clampedX, clampedY))
  }, 500)

  watch(() => catStore.window.keepInScreen, clampToMonitor)

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

    clampToMonitor()
  }

  const onResized = async (event: Event<PhysicalSize>) => {
    if (!await shouldPersistChange()) return

    appStore.windowState[label] ??= {}

    Object.assign(appStore.windowState[label], event.payload)

    clampToMonitor()
  }

  const restoreState = async () => {
    const { x, y, width, height } = appStore.windowState[label] ?? {}

    if (isNumber(x) && isNumber(y)) {
      const monitors = await availableMonitors()

      const monitor = monitors.find((monitor) => {
        const { position, size } = monitor

        const inBoundsX = x >= position.x && x <= position.x + size.width
        const inBoundsY = y >= position.y && y <= position.y + size.height

        return inBoundsX && inBoundsY
      })

      if (monitor) {
        await appWindow.setPosition(new PhysicalPosition(x, y))
      }
    }

    currentWindowPosition.value = await appWindow.outerPosition()

    if (width && height) {
      await appWindow.setSize(new PhysicalSize(width, height))
    }

    isRestored.value = true

    clampToMonitor()
  }

  return {
    isRestored,
    restoreState,
  }
}
