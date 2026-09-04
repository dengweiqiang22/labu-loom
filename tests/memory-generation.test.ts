/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试避免为纯记忆生成新增测试依赖 */
import assert from 'node:assert/strict'
import test from 'node:test'

import type { DailyActivitySummary } from '../src/domain/memory/schema'

import { createChoiceMemory, deriveAggregateMemories, mergeStructuredMemories } from '../src/domain/memory/generation'

function summary(day: string, keyboard: number, mouse: number): DailyActivitySummary {
  return {
    day,
    keyboardActiveSeconds: keyboard,
    mouseActiveSeconds: mouse,
    idleSeconds: 0,
    activeSessionCount: 1,
    interactionsOffered: 2,
    interactionsAnswered: 0,
    interactionsDismissed: 2,
  }
}

test('turns an explicit choice into one replaceable structured context memory', () => {
  const first = createChoiceMemory('doing-well', '2026-09-03')!
  const updated = createChoiceMemory('taking-it-easy', '2026-09-04')!
  const merged = mergeStructuredMemories([first], [updated])

  assert.equal(merged.length, 1)
  assert.equal(merged[0].value, 'taking-it-easy')
  assert.equal(merged[0].createdDay, '2026-09-03')
  assert.equal(merged[0].updatedDay, '2026-09-04')
  assert.equal(createChoiceMemory('not-now', '2026-09-04'), undefined)
})

test('derives only predefined aggregate memories with day-level provenance', () => {
  const memories = deriveAggregateMemories([
    summary('2026-09-01', 200, 20),
    summary('2026-09-02', 180, 20),
    summary('2026-09-03', 160, 20),
  ], '2026-09-04', true)

  assert.deepEqual(memories.map(memory => [memory.category, memory.kind, memory.value]), [
    ['habit', 'usual-activity-balance', 'keyboard-led'],
    ['preference', 'preferred-interaction-frequency', 'less'],
    ['relationship', 'interaction-response-style', 'reserved'],
  ])
  assert.equal(memories.every(memory => memory.sourceFromDay === '2026-09-01'), true)
  assert.equal(memories.every(memory => memory.sourceToDay === '2026-09-03'), true)
})

test('does not create habit memory before opt-in or before three aggregate days', () => {
  const data = [summary('2026-09-01', 200, 20), summary('2026-09-02', 180, 20)]

  assert.equal(deriveAggregateMemories(data, '2026-09-04', true).some(item => item.category === 'habit'), false)
  assert.equal(deriveAggregateMemories([...data, summary('2026-09-03', 160, 20)], '2026-09-04', false).some(item => item.category === 'habit'), false)
})

test('keeps user edits and forgotten identifiers across automatic refreshes', () => {
  const generated = createChoiceMemory('doing-well', '2026-09-04')!
  const edited = { ...generated, value: 'taking-it-easy' as const, source: 'user-edited' as const }

  assert.deepEqual(mergeStructuredMemories([edited], [generated]), [edited])
  assert.deepEqual(mergeStructuredMemories([], [generated], false, new Set([generated.id])), [])
})
