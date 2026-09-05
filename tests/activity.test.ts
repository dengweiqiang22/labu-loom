/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试避免为纯函数新增测试依赖 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { ActivityTracker } from '../src/domain/activity/index'

test('starts idle without exposing an event timestamp', () => {
  const tracker = new ActivityTracker(() => 100)

  assert.deepEqual(tracker.snapshot(), {
    phase: 'idle',
    inputIntensity: 0,
  })
})

test('records activity without retaining raw input details', () => {
  let now = 0
  const tracker = new ActivityTracker(() => now)
  const snapshot = tracker.record({
    source: 'keyboard',
    kind: 'button',
    control: 'KeyA',
    phase: 'pressed',
    value: 1,
  })

  assert.equal(snapshot.phase, 'active')
  assert.equal(snapshot.inactiveForMs, 0)
  assert.ok(snapshot.inputIntensity > 0)
  assert.equal(JSON.stringify(snapshot).includes('KeyA'), false)

  now += 1_000
  assert.ok(tracker.snapshot().inputIntensity < snapshot.inputIntensity)
})

test('bounds intensity while consuming high-frequency pointer activity', () => {
  const now = 0
  const tracker = new ActivityTracker(() => now)

  for (let index = 0; index < 1_000; index++) {
    tracker.record({
      source: 'mouse',
      kind: 'pointer',
      position: { x: index, y: index },
    })
  }

  const snapshot = tracker.snapshot()

  assert.equal(snapshot.phase, 'active')
  assert.ok(snapshot.inputIntensity <= 1)
  assert.deepEqual(Object.keys(snapshot).sort(), ['continuousActiveForMs', 'inactiveForMs', 'inputIntensity', 'phase'])
  assert.equal(snapshot.continuousActiveForMs, 0)
})

test('tracks continuous active duration only in memory until idle', () => {
  let now = 0
  const tracker = new ActivityTracker(() => now)

  tracker.record({
    source: 'keyboard',
    kind: 'button',
    control: 'KeyA',
    phase: 'pressed',
    value: 1,
  })

  now = 10_000
  tracker.record({
    source: 'keyboard',
    kind: 'button',
    control: 'KeyB',
    phase: 'pressed',
    value: 1,
  })

  assert.equal(tracker.snapshot().continuousActiveForMs, 10_000)

  now = 50_000
  assert.equal(tracker.snapshot().phase, 'idle')
  assert.equal(tracker.snapshot().continuousActiveForMs, undefined)
})

test('transitions from active through settling to idle', () => {
  let now = 0
  const tracker = new ActivityTracker(() => now)

  tracker.record({
    source: 'mouse',
    kind: 'button',
    control: 'Left',
    phase: 'pressed',
    value: 1,
  })

  now = 2_500
  assert.equal(tracker.snapshot().phase, 'settling')
  assert.ok((tracker.snapshot().continuousActiveForMs ?? 0) >= 2_500)

  now = 31_000
  assert.deepEqual(tracker.snapshot(), {
    phase: 'idle',
    inputIntensity: 0,
    inactiveForMs: 31_000,
  })
})

test('reset removes all transient activity state', () => {
  const tracker = new ActivityTracker(() => 0)

  tracker.record({
    source: 'gamepad',
    kind: 'axis',
    control: 'LeftStickX',
    phase: 'changed',
    value: 0.5,
  })

  assert.deepEqual(tracker.reset(), {
    phase: 'idle',
    inputIntensity: 0,
  })
})
