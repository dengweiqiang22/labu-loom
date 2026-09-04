/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试避免为纯函数新增测试依赖 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { planNearbyMovement } from '../src/domain/behavior/movement.ts'

const baseOptions = {
  anchor: { x: 500, y: 300 },
  bounds: { x: 0, y: 0, width: 1_920, height: 1_080 },
  locked: false,
  mode: 'companion' as const,
  windowSize: { width: 300, height: 300 },
}

test('does not move in quiet mode or while position is locked', () => {
  assert.equal(planNearbyMovement({ ...baseOptions, mode: 'quiet' }), undefined)
  assert.equal(planNearbyMovement({ ...baseOptions, locked: true }), undefined)
})

test('keeps companion movement near the preferred position', () => {
  const target = planNearbyMovement({
    ...baseOptions,
    random: () => 0,
  })!

  assert.deepEqual(target, { x: 520, y: 300 })
})

test('active mode allows a wider but still bounded movement range', () => {
  const values = [0.25, 1]
  const target = planNearbyMovement({
    ...baseOptions,
    mode: 'active',
    random: () => values.shift()!,
  })!

  assert.deepEqual(target, { x: 500, y: 372 })
})

test('clamps the complete window inside its current monitor', () => {
  const target = planNearbyMovement({
    ...baseOptions,
    anchor: { x: 1_615, y: 775 },
    random: () => 0,
  })!

  assert.deepEqual(target, { x: 1_620, y: 775 })
})

test('handles a monitor smaller than the pet window', () => {
  const target = planNearbyMovement({
    ...baseOptions,
    anchor: { x: -1_280, y: 0 },
    bounds: { x: -1_280, y: 0, width: 200, height: 200 },
    windowSize: { width: 300, height: 300 },
    random: () => 0.5,
  })!

  assert.deepEqual(target, { x: -1_280, y: 0 })
})
