import { invoke } from '@tauri-apps/api/core'
import { PhysicalPosition } from '@tauri-apps/api/dpi'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { isNil } from 'es-toolkit'
import { Ticker } from 'pixi.js'
import { onMounted, onUnmounted, ref, watch } from 'vue'

import type { CursorPoint, DeviceChangedEvent, InputListenerFailure } from '@/domain/input'

import { currentWindowPosition } from '@/composables/useWindowState'
import { normalizeDeviceEvent } from '@/domain/input'
import { useAppStore } from '@/stores/app'
import { useCatStore } from '@/stores/cat'
import { useGeneralStore } from '@/stores/general'
import { useModelStore } from '@/stores/model'
import { inBetween } from '@/utils/is'
import { isMac, isWindows } from '@/utils/platform'

import { INVOKE_KEY, LISTEN_KEY, WINDOW_LABEL } from '../constants'
import { useActivityState } from './useActivityState'
import { recordInputActivity } from './useDailyActivityAggregation'
import { useModel } from './useModel'
import { useTauriListen } from './useTauriListen'

const DAMPING_DECAY = 0.75
const appWindow = getCurrentWebviewWindow()

export function useDevice() {
  const modelStore = useModelStore()
  const releaseTimers = new Map<string, NodeJS.Timeout>()
  const appStore = useAppStore()
  const catStore = useCatStore()
  const generalStore = useGeneralStore()
  const latestCursorPoint = ref<CursorPoint>()
  const smoothedCursorPoint = ref<CursorPoint>()
  const scaleFactor = ref(1)
  const { recordActivity, resetActivity } = useActivityState()
  const { handlePress, handleRelease, handleMouseChange, handleMouseMove } = useModel()

  const tickerCallback = (ticker: Ticker) => {
    const destination = latestCursorPoint.value

    if (!destination) return

    const current = smoothedCursorPoint.value ?? destination

    const alpha = 1 - DAMPING_DECAY ** (ticker.deltaMS / (1000 / 60))

    const interpolated = {
      x: current.x + (destination.x - current.x) * alpha,
      y: current.y + (destination.y - current.y) * alpha,
    }

    if (Math.hypot(destination.x - interpolated.x, destination.y - interpolated.y) < 0.5) {
      smoothedCursorPoint.value = { ...destination }

      latestCursorPoint.value = void 0
    } else {
      smoothedCursorPoint.value = interpolated
    }

    void handleCursorMove(smoothedCursorPoint.value)
  }

  onMounted(async () => {
    scaleFactor.value = isMac ? await appWindow.scaleFactor() : 1

    appWindow.onScaleChanged(({ payload }) => {
      if (!isMac) return

      scaleFactor.value = payload.scaleFactor
    })
  })

  onUnmounted(() => {
    Ticker.shared.remove(tickerCallback)
  })

  watch(() => catStore.model.ignoreMouse, (value) => {
    if (value) {
      return Ticker.shared.remove(tickerCallback)
    }

    return Ticker.shared.add(tickerCallback)
  }, { immediate: true })

  const startListening = async () => {
    try {
      await invoke(INVOKE_KEY.START_DEVICE_LISTENING)
    } catch (error) {
      console.error('Failed to start device listener', error)
    }
  }

  watch(() => generalStore.app.inputListening, (enabled) => {
    void invoke(INVOKE_KEY.SET_DEVICE_LISTENING_ENABLED, { enabled }).catch((error) => {
      console.error('Failed to change device listener state', error)
    })

    if (enabled) return

    for (const timer of releaseTimers.values()) {
      clearTimeout(timer)
    }

    releaseTimers.clear()
    resetActivity()
    latestCursorPoint.value = void 0
    smoothedCursorPoint.value = void 0

    for (const key of Object.keys(modelStore.pressedKeys)) {
      handleRelease(key)
    }
  }, { immediate: true })

  const getSupportedKey = (key: string) => {
    let nextKey = key

    const unsupportedKey = !modelStore.supportKeys[nextKey]

    if (key.startsWith('F') && unsupportedKey) {
      nextKey = key.replace(/F(\d+)/, 'Fn')
    }

    for (const item of ['Meta', 'Shift', 'Alt', 'Control']) {
      if (key.startsWith(item) && unsupportedKey) {
        const regex = new RegExp(`^(${item}).*`)
        nextKey = key.replace(regex, '$1')
      }
    }

    return nextKey
  }

  const onHideOnHover = (() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let wasInWindow = false

    return (x: number, y: number) => {
      const { width, height } = appStore.windowState[WINDOW_LABEL.MAIN] ?? {}
      const { x: winX, y: winY } = currentWindowPosition.value ?? {}

      if (isNil(winX) || isNil(winY) || isNil(width) || isNil(height)) return

      const isInWindow = inBetween(x, winX, winX + width)
        && inBetween(y, winY, winY + height)

      if (isInWindow === wasInWindow) return

      if (timer) {
        clearTimeout(timer)

        timer = void 0
      }

      if (isInWindow) {
        timer = setTimeout(() => {
          document.body.style.setProperty('opacity', '0')

          appWindow.setIgnoreCursorEvents(true)
        }, catStore.window.hideOnHoverDelay * 1000)
      } else {
        document.body.style.setProperty('opacity', 'unset')

        appWindow.setIgnoreCursorEvents(catStore.window.passThrough)
      }

      wasInWindow = isInWindow
    }
  })()

  const handleCursorMove = async (cursorPoint: CursorPoint) => {
    const x = cursorPoint.x * scaleFactor.value
    const y = cursorPoint.y * scaleFactor.value

    handleMouseMove(new PhysicalPosition(x, y))

    if (!catStore.window.hideOnHover) return

    onHideOnHover(x, y)
  }

  const handleAutoRelease = (key: string, delay = 100) => {
    handlePress(key)

    if (releaseTimers.has(key)) {
      clearTimeout(releaseTimers.get(key))
    }

    const timer = setTimeout(() => {
      handleRelease(key)

      releaseTimers.delete(key)
    }, delay)

    releaseTimers.set(key, timer)
  }

  useTauriListen<DeviceChangedEvent>(LISTEN_KEY.DEVICE_CHANGED, ({ payload }) => {
    const event = normalizeDeviceEvent(payload)

    recordActivity(event)

    if (event.source === 'keyboard' || event.source === 'mouse') {
      recordInputActivity(event.source)
    }

    if (event.source === 'keyboard') {
      const nextValue = getSupportedKey(event.control)

      if (!nextValue) return

      if (nextValue === 'CapsLock') {
        return handleAutoRelease(nextValue)
      }

      if (event.phase === 'pressed') {
        if (isWindows) {
          const delay = catStore.model.autoReleaseDelay * 1000

          return handleAutoRelease(nextValue, delay)
        }

        return handlePress(nextValue)
      }

      return handleRelease(nextValue)
    }

    switch (event.kind) {
      case 'button':
        return handleMouseChange(event.control, event.phase === 'pressed')
      case 'pointer':
        return latestCursorPoint.value = event.position
    }
  })

  useTauriListen<InputListenerFailure>(LISTEN_KEY.INPUT_LISTENER_FAILED, ({ payload }) => {
    if (payload.source !== 'device') return

    console.error('Device listener stopped unexpectedly', payload.message)
  })

  return {
    startListening,
  }
}
