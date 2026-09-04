/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试避免为纯展示模型新增测试依赖 */
import assert from 'node:assert/strict'
import test from 'node:test'

import type { DailyActivitySummary, StructuredMemory } from '../src/domain/memory/schema'

import { createRecollectionOverview } from '../src/domain/memory/recollection'

const daily: DailyActivitySummary = {
  day: '2026-09-04',
  keyboardActiveSeconds: 120,
  mouseActiveSeconds: 60,
  idleSeconds: 30,
  activeSessionCount: 2,
  interactionsOffered: 2,
  interactionsAnswered: 1,
  interactionsDismissed: 1,
}

function memory(id: string, updatedDay: string): StructuredMemory {
  return {
    id,
    category: 'context',
    kind: 'recent-energy-state',
    value: 'doing-well',
    source: 'explicit-choice',
    sourceFromDay: updatedDay,
    sourceToDay: updatedDay,
    createdDay: updatedDay,
    updatedDay,
  }
}

test('creates an empty and non-judgmental view when no history exists', () => {
  assert.deepEqual(createRecollectionOverview([], [], [], []), {
    hasHistory: false,
    fromPeriod: undefined,
    toPeriod: undefined,
    totals: {
      recordedDays: 0,
      keyboardActiveSeconds: 0,
      mouseActiveSeconds: 0,
      idleSeconds: 0,
      activeSessionCount: 0,
      interactionsOffered: 0,
      interactionsAnswered: 0,
      interactionsDismissed: 0,
    },
    highlights: [],
  })
})

test('combines non-overlapping aggregate tiers without changing source data', () => {
  const source = { ...daily }
  const overview = createRecollectionOverview(
    [source],
    [{ ...daily, weekStart: '2026-08-25', daysCovered: 3 }],
    [{ ...daily, month: '2026-07', daysCovered: 8 }],
    [],
  )

  assert.equal(overview.totals.recordedDays, 12)
  assert.equal(overview.totals.keyboardActiveSeconds, 360)
  assert.equal(overview.fromPeriod, '2026-07')
  assert.equal(overview.toPeriod, '2026-09-04')
  assert.deepEqual(source, daily)
})

test('keeps at most four recently updated structured memories as highlights', () => {
  const memories = [
    memory('context-1', '2026-09-01'),
    memory('context-2', '2026-09-05'),
    memory('context-3', '2026-09-03'),
    memory('context-4', '2026-09-04'),
    memory('context-5', '2026-09-02'),
  ]
  const overview = createRecollectionOverview([], [], [], memories)

  assert.equal(overview.hasHistory, true)
  assert.deepEqual(overview.highlights.map(item => item.id), [
    'context-2',
    'context-4',
    'context-3',
    'context-5',
  ])
  assert.deepEqual(memories.map(item => item.id), [
    'context-1',
    'context-2',
    'context-3',
    'context-4',
    'context-5',
  ])
})
