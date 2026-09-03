/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试避免为输入纯函数新增测试依赖 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeDeviceEvent, normalizeGamepadEvent } from '../src/domain/input/index'

test('normalizes keyboard press and release events', () => {
  assert.deepEqual(normalizeDeviceEvent({ kind: 'KeyboardPress', value: 'KeyA' }), {
    source: 'keyboard',
    kind: 'button',
    control: 'KeyA',
    phase: 'pressed',
    value: 1,
  })

  assert.deepEqual(normalizeDeviceEvent({ kind: 'KeyboardRelease', value: 'KeyA' }), {
    source: 'keyboard',
    kind: 'button',
    control: 'KeyA',
    phase: 'released',
    value: 0,
  })
})

test('normalizes mouse button and pointer events', () => {
  assert.deepEqual(normalizeDeviceEvent({ kind: 'MousePress', value: 'Left' }), {
    source: 'mouse',
    kind: 'button',
    control: 'Left',
    phase: 'pressed',
    value: 1,
  })

  assert.deepEqual(normalizeDeviceEvent({ kind: 'MouseMove', value: { x: 12, y: 34 } }), {
    source: 'mouse',
    kind: 'pointer',
    position: { x: 12, y: 34 },
  })
})

test('normalizes gamepad button and axis events', () => {
  assert.deepEqual(normalizeGamepadEvent({ kind: 'ButtonChanged', name: 'South', value: 1 }), {
    source: 'gamepad',
    kind: 'button',
    control: 'South',
    phase: 'changed',
    value: 1,
  })

  assert.deepEqual(normalizeGamepadEvent({ kind: 'AxisChanged', name: 'LeftStickX', value: 0.5 }), {
    source: 'gamepad',
    kind: 'axis',
    control: 'LeftStickX',
    phase: 'changed',
    value: 0.5,
  })
})
