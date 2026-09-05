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
      restRemindersEnabled: false,
    },
    dailySummaries: [],
    weeklySummaries: [],
    monthlyTrends: [],
    memories: [],
    forgottenMemoryIds: [],
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
    restRemindersEnabled: false,
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
    id: 'habit-often-active-period',
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

test('migrates all prior schema shapes and rejects arbitrary memory identifiers', () => {
  const validMemory = {
    id: 'context-recent-energy-state',
    category: 'context',
    kind: 'recent-energy-state',
    value: 'doing-well',
    source: 'explicit-choice',
    sourceFromDay: '2026-09-01',
    sourceToDay: '2026-09-01',
    createdDay: '2026-09-01',
    updatedDay: '2026-09-01',
  }
  for (const schemaVersion of [1, 2, 3]) {
    const state = migrateMemoryState({ schemaVersion, settings: { interactionsEnabled: true } })

    assert.equal(state.schemaVersion, MEMORY_SCHEMA_VERSION)
  }

  const migrated = migrateMemoryState({
    schemaVersion: 3,
    settings: { interactionsEnabled: true },
    weeklySummaries: [{ weekStart: '2026-08-31', daysCovered: 2 }],
    monthlyTrends: [{ month: '2026-07', daysCovered: 7 }],
    memories: [validMemory, { ...validMemory, id: 'arbitrary user text' }],
    forgottenMemoryIds: ['context-recent-energy-state', 'arbitrary user text'],
  })

  assert.equal(migrated.schemaVersion, MEMORY_SCHEMA_VERSION)
  assert.equal(migrated.weeklySummaries.length, 1)
  assert.equal(migrated.monthlyTrends.length, 1)
  assert.deepEqual(migrated.memories, [validMemory])
  assert.deepEqual(migrated.forgottenMemoryIds, ['context-recent-energy-state'])
})
