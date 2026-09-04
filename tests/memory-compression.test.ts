/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试避免为纯压缩逻辑新增测试依赖 */
import assert from 'node:assert/strict'
import test from 'node:test'

import type { DailyActivitySummary, WeeklyActivitySummary } from '../src/domain/memory/schema'

import { compressMemoryAggregates, getWeekStart } from '../src/domain/memory/compression'

function daily(day: string, seconds = 10): DailyActivitySummary {
  return {
    day,
    keyboardActiveSeconds: seconds,
    mouseActiveSeconds: seconds * 2,
    idleSeconds: 5,
    activeSessionCount: 1,
    interactionsOffered: 1,
    interactionsAnswered: 1,
    interactionsDismissed: 0,
  }
}

test('uses Monday as the stable week boundary', () => {
  assert.equal(getWeekStart('2026-09-06'), '2026-08-31')
  assert.equal(getWeekStart('2026-09-07'), '2026-09-07')
})

test('compresses daily data older than thirty days and removes its source rows', () => {
  const result = compressMemoryAggregates({
    dailySummaries: [daily('2026-07-31'), daily('2026-08-01'), daily('2026-08-06')],
    weeklySummaries: [],
    monthlyTrends: [],
  }, '2026-09-04')

  assert.deepEqual(result.dailySummaries.map(item => item.day), ['2026-08-06'])
  assert.equal(result.weeklySummaries.length, 1)
  assert.equal(result.weeklySummaries[0].daysCovered, 2)
  assert.equal(result.weeklySummaries[0].keyboardActiveSeconds, 20)
})

test('compresses weekly data older than twelve calendar months into monthly trends', () => {
  const weekly: WeeklyActivitySummary = {
    weekStart: '2025-08-25',
    daysCovered: 4,
    keyboardActiveSeconds: 100,
    mouseActiveSeconds: 200,
    idleSeconds: 50,
    activeSessionCount: 8,
    interactionsOffered: 2,
    interactionsAnswered: 1,
    interactionsDismissed: 1,
  }
  const result = compressMemoryAggregates({
    dailySummaries: [],
    weeklySummaries: [weekly, { ...weekly, weekStart: '2025-10-06' }],
    monthlyTrends: [],
  }, '2026-09-04')

  assert.deepEqual(result.weeklySummaries.map(item => item.weekStart), ['2025-10-06'])
  assert.deepEqual(result.monthlyTrends, [{
    month: '2025-08',
    daysCovered: 4,
    keyboardActiveSeconds: 100,
    mouseActiveSeconds: 200,
    idleSeconds: 50,
    activeSessionCount: 8,
    interactionsOffered: 2,
    interactionsAnswered: 1,
    interactionsDismissed: 1,
  }])
})

test('is idempotent after fine-grained source rows have been removed', () => {
  const first = compressMemoryAggregates({
    dailySummaries: [daily('2026-07-01')],
    weeklySummaries: [],
    monthlyTrends: [],
  }, '2026-09-04')
  const second = compressMemoryAggregates(first, '2026-09-04')

  assert.deepEqual(second, first)
})
