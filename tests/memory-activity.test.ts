/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试避免为纯活动聚合新增测试依赖 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { DailyActivityAccumulator } from '../src/domain/memory/activity'

const enabled = { keyboardEnabled: true, mouseEnabled: true }

test('aggregates only coarse source durations and active sessions', () => {
  const accumulator = new DailyActivityAccumulator('2026-09-04', 0)

  accumulator.record('keyboard', 0)
  accumulator.sample('2026-09-04', 1_000, enabled)
  accumulator.record('mouse', 1_000)
  accumulator.sample('2026-09-04', 2_000, enabled)

  assert.deepEqual(accumulator.drain(), {
    day: '2026-09-04',
    keyboardActiveSeconds: 2,
    mouseActiveSeconds: 1,
    idleSeconds: 0,
    activeSessionCount: 1,
  })
})

test('drops pending source data as soon as that source is disabled', () => {
  const accumulator = new DailyActivityAccumulator('2026-09-04', 0)

  accumulator.record('keyboard', 0)
  accumulator.sample('2026-09-04', 1_000, enabled)
  accumulator.applySettings({ keyboardEnabled: false, mouseEnabled: true })

  assert.equal(accumulator.drain(), undefined)
})

test('does not accumulate while both statistics are disabled', () => {
  const accumulator = new DailyActivityAccumulator('2026-09-04', 0)

  accumulator.record('keyboard', 0)
  accumulator.sample('2026-09-04', 1_000, { keyboardEnabled: false, mouseEnabled: false })

  assert.equal(accumulator.drain(), undefined)
})

test('flushes the previous natural day without carrying transient activity forward', () => {
  const accumulator = new DailyActivityAccumulator('2026-09-04', 0)

  accumulator.record('mouse', 0)
  accumulator.sample('2026-09-04', 1_500, enabled)

  assert.deepEqual(accumulator.sample('2026-09-05', 2_000, enabled), {
    day: '2026-09-04',
    keyboardActiveSeconds: 0,
    mouseActiveSeconds: 2,
    idleSeconds: 0,
    activeSessionCount: 1,
  })
  assert.equal(accumulator.drain(), undefined)
})
