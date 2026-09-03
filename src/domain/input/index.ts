export interface CursorPoint {
  x: number
  y: number
}

export type DeviceChangedEvent
  = | { kind: 'MousePress' | 'MouseRelease', value: string }
    | { kind: 'MouseMove', value: CursorPoint }
    | { kind: 'KeyboardPress' | 'KeyboardRelease', value: string }

export interface GamepadChangedEvent {
  kind: 'ButtonChanged' | 'AxisChanged'
  name: string
  value: number
}

export type InputEvent
  = | {
    source: 'keyboard'
    kind: 'button'
    control: string
    phase: 'pressed' | 'released'
    value: 0 | 1
  }
  | {
    source: 'mouse'
    kind: 'button'
    control: string
    phase: 'pressed' | 'released'
    value: 0 | 1
  }
  | {
    source: 'mouse'
    kind: 'pointer'
    position: CursorPoint
  }
  | {
    source: 'gamepad'
    kind: 'button' | 'axis'
    control: string
    phase: 'changed'
    value: number
  }

export function normalizeDeviceEvent(event: DeviceChangedEvent): InputEvent {
  switch (event.kind) {
    case 'KeyboardPress':
    case 'KeyboardRelease': {
      const pressed = event.kind === 'KeyboardPress'

      return {
        source: 'keyboard',
        kind: 'button',
        control: event.value,
        phase: pressed ? 'pressed' : 'released',
        value: pressed ? 1 : 0,
      }
    }
    case 'MousePress':
    case 'MouseRelease': {
      const pressed = event.kind === 'MousePress'

      return {
        source: 'mouse',
        kind: 'button',
        control: event.value,
        phase: pressed ? 'pressed' : 'released',
        value: pressed ? 1 : 0,
      }
    }
    case 'MouseMove':
      return {
        source: 'mouse',
        kind: 'pointer',
        position: event.value,
      }
  }
}
export function normalizeGamepadEvent(event: GamepadChangedEvent): InputEvent {
  return {
    source: 'gamepad',
    kind: event.kind === 'AxisChanged' ? 'axis' : 'button',
    control: event.name,
    phase: 'changed',
    value: event.value,
  }
}
