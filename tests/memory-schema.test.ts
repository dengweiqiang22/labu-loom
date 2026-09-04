/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试避免为纯函数新增测试依赖 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { MAX_DAILY_SUMMARIES, MEMORY_SCHEMA_VERSION, migrateMemoryState } from '../src/domain/memory/schema.ts'

test('uses privacy-first defaults for a new memory store', () => {
  assert.deepEqual(migrateMemoryState(undefined), {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    settings: {
      interactionsEnabled: true,
      keyboardStatsEnabled: false,
      mouseStatsEnabled: false,
      habitMemoryEnabled: false,
    },
    dailySummaries: [],
    weeklySummaries: [],
    monthlyTrends: [],
    memories: [],
  })
})

test('normalizes counts and drops unknown or raw fields', () => {
  const state = migrateMemoryState({
    schemaVersion: 0,
    settings: {
      interactionsEnabled: false,
      keyboardStatsEnabled: true,
      rawKey: 'KeyA',
    },
    dailySummaries: [{
      day: '2026-09-04',
      keyboardActiveSeconds: 12.9,
      mouseActiveSeconds: -5,
      keys: ['KeyA'],
    }],
  })

  assert.deepEqual(state.settings, {
    interactionsEnabled: false,
    keyboardStatsEnabled: true,
    mouseStatsEnabled: false,
    habitMemoryEnabled: false,
  })
  assert.deepEqual(state.dailySummaries[0], {
    day: '2026-09-04',
    keyboardActiveSeconds: 12,
    mouseActiveSeconds: 0,
    idleSeconds: 0,
    activeSessionCount: 0,
    interactionsOffered: 0,
    interactionsAnswered: 0,
    interactionsDismissed: 0,
  })
  assert.equal(JSON.stringify(state).includes('KeyA'), false)
})

test('keeps only the latest thirty valid daily summaries', () => {
  const dailySummaries = Array.from({ length: 35 }, (_, index) => ({
    day: new Date(Date.UTC(2026, 6, 28 + index)).toISOString().slice(0, 10),
  }))
  const state = migrateMemoryState({ dailySummaries })

  assert.equal(state.dailySummaries.length, MAX_DAILY_SUMMARIES)
  assert.equal(state.dailySummaries[0].day, '2026-08-02')
  assert.equal(state.dailySummaries.at(-1)?.day, '2026-08-31')
})

test('accepts only structured memories with day-level provenance', () => {
  const validMemory = {
    id: 'habit-afternoon',
    category: 'habit',
    kind: 'often-active-period',
    value: 'afternoon',
    source: 'activity-aggregate',
    sourceFromDay: '2026-08-20',
    sourceToDay: '2026-09-03',
    createdDay: '2026-09-04',
    updatedDay: '2026-09-04',
  }
  const state = migrateMemoryState({
    memories: [validMemory, { ...validMemory, id: 'invalid', value: 'free text' }],
  })

  assert.deepEqual(state.memories, [validMemory])
})
