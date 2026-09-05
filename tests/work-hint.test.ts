/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试避免为工作暗示新增测试依赖 */
import type { MotionInfo } from 'easy-live2d'

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_WORK_HINT_THRESHOLD_MS,
  pickWorkHintMotion,
  shouldOfferWorkHint,
} from '../src/domain/behavior/work-hint'

test('does not offer a work hint while quiet or below the continuous threshold', () => {
  assert.equal(shouldOfferWorkHint({
    continuousActiveForMs: DEFAULT_WORK_HINT_THRESHOLD_MS,
    allowProactiveBehavior: false,
    thresholdMs: DEFAULT_WORK_HINT_THRESHOLD_MS,
  }), false)

  assert.equal(shouldOfferWorkHint({
    continuousActiveForMs: DEFAULT_WORK_HINT_THRESHOLD_MS - 1,
    allowProactiveBehavior: true,
    thresholdMs: DEFAULT_WORK_HINT_THRESHOLD_MS,
  }), false)

  assert.equal(shouldOfferWorkHint({
    continuousActiveForMs: undefined,
    allowProactiveBehavior: true,
    thresholdMs: DEFAULT_WORK_HINT_THRESHOLD_MS,
  }), false)
})

test('offers a work hint after continuous activity reaches the threshold', () => {
  assert.equal(shouldOfferWorkHint({
    continuousActiveForMs: DEFAULT_WORK_HINT_THRESHOLD_MS,
    allowProactiveBehavior: true,
    thresholdMs: DEFAULT_WORK_HINT_THRESHOLD_MS,
  }), true)
})

test('picks a gentle rest-like motion and degrades when none exists', () => {
  const yawn: MotionInfo = { group: 'Idle', no: 1, name: 'Yawn' } as MotionInfo
  const tap: MotionInfo = { group: 'Tap', no: 0, name: 'TapBody' } as MotionInfo

  assert.equal(pickWorkHintMotion([['Idle', [tap, yawn]]]), yawn)
  assert.equal(pickWorkHintMotion([['Tap', [tap]]]), undefined)
  assert.equal(pickWorkHintMotion([]), undefined)
})
