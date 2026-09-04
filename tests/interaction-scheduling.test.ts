/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试避免为纯互动策略新增测试依赖 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { canOfferProactiveInteraction, getInteractionCooldownMultiplier } from '../src/domain/interaction/scheduling'

const context = {
  interactionsEnabled: true,
  passThrough: false,
  visible: true,
  activityPhase: 'idle' as const,
  interactionsOfferedToday: 0,
  interactionsDismissedToday: 0,
  maximumInteractionsPerDay: 2,
}

test('offers only while idle, visible, interactive and below the persisted daily cap', () => {
  assert.equal(canOfferProactiveInteraction(context), true)
  assert.equal(canOfferProactiveInteraction({ ...context, interactionsEnabled: false }), false)
  assert.equal(canOfferProactiveInteraction({ ...context, passThrough: true }), false)
  assert.equal(canOfferProactiveInteraction({ ...context, visible: false }), false)
  assert.equal(canOfferProactiveInteraction({ ...context, activityPhase: 'active' }), false)
  assert.equal(canOfferProactiveInteraction({ ...context, interactionsOfferedToday: 2 }), false)
  assert.equal(canOfferProactiveInteraction({ ...context, maximumInteractionsPerDay: 0 }), false)
})

test('backs off after repeated dismissals without treating one dismissal as a preference', () => {
  assert.equal(getInteractionCooldownMultiplier(1, 1), 1)
  assert.equal(getInteractionCooldownMultiplier(4, 2), 2)
  assert.equal(getInteractionCooldownMultiplier(4, 3), 3)
})
