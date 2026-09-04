/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试和 Pinia 验证记忆控制 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'

import type { StructuredMemory } from '../src/domain/memory/schema'

import { useMemoryStore } from '../src/stores/memory'

function memory(overrides: Partial<StructuredMemory> = {}): StructuredMemory {
  return {
    id: 'preference-interaction-frequency',
    category: 'preference',
    kind: 'preferred-interaction-frequency',
    value: 'same',
    source: 'activity-aggregate',
    sourceFromDay: '2026-09-01',
    sourceToDay: '2026-09-04',
    createdDay: '2026-09-04',
    updatedDay: '2026-09-04',
    ...overrides,
  }
}

function createStore() {
  setActivePinia(createPinia())

  return useMemoryStore()
}

test('allows only values defined for the memory kind and protects user edits', () => {
  const store = createStore()

  store.memories = [memory()]
  assert.equal(store.updateMemoryValue('preference-interaction-frequency', 'more', '2026-09-05'), true)
  assert.equal(store.updateMemoryValue('preference-interaction-frequency', 'morning', '2026-09-05'), false)
  assert.equal(store.memories[0].value, 'more')
  assert.equal(store.memories[0].source, 'user-edited')
})

test('forgetting and category clearing suppress immediate regeneration from old aggregates', () => {
  const store = createStore()
  const preference = memory()
  const relationship = memory({
    id: 'relationship-interaction-style',
    category: 'relationship',
    kind: 'interaction-response-style',
    value: 'responsive',
  })

  store.memories = [preference, relationship]
  store.forgetMemory(preference.id)
  store.clearMemoryCategory('relationship')

  assert.deepEqual(store.memories, [])
  assert.deepEqual(store.forgottenMemoryIds.sort(), [preference.id, relationship.id].sort())
})

test('clearing all local data removes every aggregate, memory, and suppression marker', () => {
  const store = createStore()

  store.dailySummaries = [{
    day: '2026-09-04',
    keyboardActiveSeconds: 1,
    mouseActiveSeconds: 0,
    idleSeconds: 0,
    activeSessionCount: 1,
    interactionsOffered: 0,
    interactionsAnswered: 0,
    interactionsDismissed: 0,
  }]
  store.memories = [memory()]
  store.forgottenMemoryIds = ['old-memory']
  store.clearAllData()

  assert.deepEqual(store.dailySummaries, [])
  assert.deepEqual(store.weeklySummaries, [])
  assert.deepEqual(store.monthlyTrends, [])
  assert.deepEqual(store.memories, [])
  assert.deepEqual(store.forgottenMemoryIds, [])
})
