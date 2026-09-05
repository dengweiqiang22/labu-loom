/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试避免为总结模型新增测试依赖 */
import assert from 'node:assert/strict'
import test from 'node:test'

import type { RecollectionOverview } from '../src/domain/memory/recollection'
import type { StructuredMemory } from '../src/domain/memory/schema'

import { createPetPerspectiveSummary } from '../src/domain/memory/summary'

function emptyOverview(): RecollectionOverview {
  return {
    hasHistory: false,
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
  }
}

function memory(id: string): StructuredMemory {
  return {
    id,
    category: 'context',
    kind: 'recent-energy-state',
    value: 'doing-well',
    source: 'explicit-choice',
    sourceFromDay: '2026-09-04',
    sourceToDay: '2026-09-04',
    createdDay: '2026-09-04',
    updatedDay: '2026-09-04',
  }
}

test('returns null when there is no history to summarize', () => {
  assert.equal(createPetPerspectiveSummary(emptyOverview()), null)
})

test('uses highlights-only template when only structured memories exist', () => {
  const overview: RecollectionOverview = {
    ...emptyOverview(),
    hasHistory: true,
    highlights: [memory('a'), memory('b')],
  }

  assert.deepEqual(createPetPerspectiveSummary(overview), {
    template: 'highlightsOnly',
    params: { count: 2 },
  })
})

test('prefers quiet-days template when records exist without activity', () => {
  const overview: RecollectionOverview = {
    ...emptyOverview(),
    hasHistory: true,
    totals: {
      ...emptyOverview().totals,
      recordedDays: 5,
      idleSeconds: 120,
    },
  }

  assert.deepEqual(createPetPerspectiveSummary(overview), {
    template: 'quietDays',
    params: { days: 5 },
  })
})

test('uses more-quiet-time when idle clearly outweighs activity', () => {
  const overview: RecollectionOverview = {
    ...emptyOverview(),
    hasHistory: true,
    totals: {
      ...emptyOverview().totals,
      recordedDays: 4,
      keyboardActiveSeconds: 10,
      mouseActiveSeconds: 10,
      idleSeconds: 100,
    },
  }

  assert.deepEqual(createPetPerspectiveSummary(overview), {
    template: 'moreQuietTime',
    params: { days: 4 },
  })
})

test('uses answered-moments when the user has responded to interactions', () => {
  const overview: RecollectionOverview = {
    ...emptyOverview(),
    hasHistory: true,
    totals: {
      ...emptyOverview().totals,
      recordedDays: 3,
      keyboardActiveSeconds: 80,
      mouseActiveSeconds: 40,
      idleSeconds: 20,
      interactionsAnswered: 2,
    },
  }

  assert.deepEqual(createPetPerspectiveSummary(overview), {
    template: 'answeredMoments',
    params: { days: 3, answered: 2 },
  })
})

test('uses accompanied-days for ordinary shared activity', () => {
  const overview: RecollectionOverview = {
    ...emptyOverview(),
    hasHistory: true,
    totals: {
      ...emptyOverview().totals,
      recordedDays: 6,
      keyboardActiveSeconds: 100,
      mouseActiveSeconds: 50,
    },
  }

  assert.deepEqual(createPetPerspectiveSummary(overview), {
    template: 'accompaniedDays',
    params: { days: 6 },
  })
})

test('falls back to recorded-days and stays stable for equal inputs', () => {
  const overview: RecollectionOverview = {
    ...emptyOverview(),
    hasHistory: true,
    totals: {
      ...emptyOverview().totals,
      recordedDays: 2,
    },
  }

  const first = createPetPerspectiveSummary(overview)
  const second = createPetPerspectiveSummary(overview)

  assert.deepEqual(first, {
    template: 'recordedDays',
    params: { days: 2 },
  })
  assert.deepEqual(first, second)
})
