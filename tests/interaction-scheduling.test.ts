/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试避免为纯互动策略新增测试依赖 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { canOfferProactiveInteraction, canOfferRestReminder, getInteractionCooldownMultiplier, nextRestReminderStreakGate, shouldConsumeRestReminderSlot } from '../src/domain/interaction/scheduling'

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

test('offers rest reminders only when enabled and once per continuous streak', () => {
  const restContext = {
    restRemindersEnabled: true,
    interactionsEnabled: true,
    passThrough: false,
    visible: true,
    continuousActiveForMs: 25 * 60_000,
    thresholdMs: 25 * 60_000,
    maximumInteractionsPerDay: 2,
    interactionsOfferedToday: 0,
    alreadyOfferedThisStreak: false,
  }

  assert.equal(canOfferRestReminder(restContext), true)
  assert.equal(canOfferRestReminder({ ...restContext, restRemindersEnabled: false }), false)
  assert.equal(canOfferRestReminder({ ...restContext, continuousActiveForMs: 1_000 }), false)
  assert.equal(canOfferRestReminder({ ...restContext, alreadyOfferedThisStreak: true }), false)
  assert.equal(canOfferRestReminder({ ...restContext, maximumInteractionsPerDay: 0 }), false)
})

test('only consumes the rest-reminder streak slot when scheduling starts or queues', () => {
  assert.equal(shouldConsumeRestReminderSlot('started'), true)
  assert.equal(shouldConsumeRestReminderSlot('queued'), true)
  assert.equal(shouldConsumeRestReminderSlot('rejected'), false)
})

test('clears the rest-reminder streak gate when continuous activity resets or drops', () => {
  assert.deepEqual(nextRestReminderStreakGate({
    continuousActiveForMs: 0,
    lastContinuousActiveForMs: 40_000,
    offeredThisStreak: true,
  }), {
    offeredThisStreak: false,
    lastContinuousActiveForMs: 0,
  })

  assert.deepEqual(nextRestReminderStreakGate({
    continuousActiveForMs: 5_000,
    lastContinuousActiveForMs: 40_000,
    offeredThisStreak: true,
  }), {
    offeredThisStreak: false,
    lastContinuousActiveForMs: 5_000,
  })

  assert.deepEqual(nextRestReminderStreakGate({
    continuousActiveForMs: 45_000,
    lastContinuousActiveForMs: 40_000,
    offeredThisStreak: true,
  }), {
    offeredThisStreak: true,
    lastContinuousActiveForMs: 45_000,
  })
})
