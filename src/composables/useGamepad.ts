import type { LiteralUnion } from 'type-fest'

import { invoke } from '@tauri-apps/api/core'
import { computed, onUnmounted, reactive, watch } from 'vue'

import type { GamepadChangedEvent, InputListenerFailure } from '@/domain/input'

import { INVOKE_KEY, LISTEN_KEY } from '@/constants'
import { normalizeGamepadEvent } from '@/domain/input'
import { useModelStore } from '@/stores/model'
import live2d from '@/utils/live2d'

import { useModel } from './useModel'
import { useTauriListen } from './useTauriListen'

type GamepadEventName = LiteralUnion<'LeftStickX' | 'LeftStickY' | 'RightStickX' | 'RightStickY' | 'LeftThumb' | 'RightThumb', string>

interface StickState {
  x: number
  y: number
  moved: boolean
  pressed: boolean
}

interface Sticks {
  left: StickState
  right: StickState
}

const INITIAL_STICK_STATE: StickState = { x: 0, y: 0, moved: false, pressed: false }

export function useGamepad() {
  const modelStore = useModelStore()
  const { handlePress, handleRelease, handleAxisChange } = useModel()
  const sticks = reactive<Sticks>({
    left: { ...INITIAL_STICK_STATE },
    right: { ...INITIAL_STICK_STATE },
  })

  const stickActive = computed(() => ({
    left: sticks.left.moved || sticks.left.pressed,
    right: sticks.right.moved || sticks.right.pressed,
  }))

  const startListening = async () => {
    try {
      await invoke(INVOKE_KEY.START_GAMEPAD_LISTING)
    } catch (error) {
      console.error('Failed to start gamepad listener', error)
    }
  }

  const resetSticks = () => {
    Object.assign(sticks.left, INITIAL_STICK_STATE)
    Object.assign(sticks.right, INITIAL_STICK_STATE)
  }

  const stopListening = async () => {
    try {
      await invoke(INVOKE_KEY.STOP_GAMEPAD_LISTING)
    } catch (error) {
      console.error('Failed to stop gamepad listener', error)
    } finally {
      resetSticks()
    }
  }

  watch(() => modelStore.currentModel?.mode, (mode) => {
    void (mode === 'gamepad' ? startListening() : stopListening())
  }, { immediate: true })

  onUnmounted(() => {
    void stopListening()
  })

  watch(sticks.left, ({ x, y, moved, pressed }) => {
    sticks.left.moved = x !== 0 || y !== 0

    live2d.setParameterValue('CatParamStickShowLeftHand', moved || pressed)
  }, { deep: true })

  watch(sticks.right, ({ x, y, moved, pressed }) => {
    sticks.right.moved = x !== 0 || y !== 0

    live2d.setParameterValue('CatParamStickShowRightHand', moved || pressed)
  }, { deep: true })

  useTauriListen<GamepadChangedEvent>(LISTEN_KEY.GAMEPAD_CHANGED, ({ payload }) => {
    const event = normalizeGamepadEvent(payload)
    const name = event.control as GamepadEventName
    const { value } = event

    switch (name) {
      case 'LeftStickX':
        sticks.left.x = value

        return handleAxisChange('CatParamStickLX', value)
      case 'LeftStickY':
        sticks.left.y = value

        return handleAxisChange('CatParamStickLY', value)
      case 'RightStickX':
        sticks.right.x = value

        return handleAxisChange('CatParamStickRX', value)
      case 'RightStickY':
        sticks.right.y = value

        return handleAxisChange('CatParamStickRY', value)
      case 'LeftThumb':
        sticks.left.pressed = value !== 0

        return live2d.setParameterValue('CatParamStickLeftDown', value !== 0)
      case 'RightThumb':
        sticks.right.pressed = value !== 0

        return live2d.setParameterValue('CatParamStickRightDown', value !== 0)
      default:
        return value > 0 ? handlePress(name) : handleRelease(name)
    }
  })

  useTauriListen<InputListenerFailure>(LISTEN_KEY.INPUT_LISTENER_FAILED, ({ payload }) => {
    if (payload.source === 'gamepad') {
      console.error('Gamepad listener stopped unexpectedly', payload.message)
    }
  })

  return {
    stickActive,
  }
}
