/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试避免为窗口边界新增测试依赖 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clampWindowPosition,
  findMonitorForPoint,
  getVisibleBounds,
  resolveRestoredWindowPosition,
} from '../src/domain/window/bounds'

const primary = {
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 },
}

const secondary = {
  position: { x: -1280, y: 0 },
  size: { width: 1280, height: 800 },
}

test('prefers the work area when clamping into a monitor', () => {
  assert.deepEqual(getVisibleBounds(primary), primary.workArea)
  assert.deepEqual(
    clampWindowPosition({ x: 1800, y: 1000 }, { width: 300, height: 300 }, getVisibleBounds(primary)),
    { x: 1620, y: 740 },
  )
})

test('finds monitors that use negative coordinates', () => {
  assert.equal(findMonitorForPoint([primary, secondary], { x: -100, y: 10 }), secondary)
  assert.equal(findMonitorForPoint([primary, secondary], { x: 100, y: 10 }), primary)
})

test('restores onto a visible monitor when the saved display is gone', () => {
  assert.deepEqual(
    resolveRestoredWindowPosition(
      { x: 4000, y: 2000 },
      { width: 300, height: 300 },
      [primary],
    ),
    { x: 810, y: 370 },
  )
})

test('clamps a saved position that still lands on an existing monitor', () => {
  assert.deepEqual(
    resolveRestoredWindowPosition(
      { x: 1800, y: 900 },
      { width: 300, height: 300 },
      [primary, secondary],
    ),
    { x: 1620, y: 740 },
  )
})
