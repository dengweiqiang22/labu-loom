/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试避免为纯策略新增测试依赖 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'

import {
  DEFAULT_COMPANION_MODE,
  getCompanionModePolicy,
  normalizeCompanionMode,
} from '../src/domain/behavior/mode'
import { useCatStore } from '../src/stores/cat'

test('uses companion mode as the safe default', () => {
  assert.equal(DEFAULT_COMPANION_MODE, 'companion')
  assert.equal(normalizeCompanionMode(undefined), 'companion')
  assert.equal(normalizeCompanionMode('unknown'), 'companion')
})

test('normalizes every supported companion mode', () => {
  assert.equal(normalizeCompanionMode('quiet'), 'quiet')
  assert.equal(normalizeCompanionMode('companion'), 'companion')
  assert.equal(normalizeCompanionMode('active'), 'active')
})

test('quiet mode disables proactive behavior and movement', () => {
  assert.deepEqual(getCompanionModePolicy('quiet'), {
    allowProactiveBehavior: false,
    allowProactiveMovement: false,
    motionLevel: 'minimal',
    maximumActionsPerHour: 0,
    maximumInteractionsPerDay: 0,
  })
})

test('active mode remains capped while allowing more activity than companion mode', () => {
  const companion = getCompanionModePolicy('companion')
  const active = getCompanionModePolicy('active')

  assert.equal(companion.allowProactiveBehavior, true)
  assert.equal(active.allowProactiveMovement, true)
  assert.ok(active.maximumActionsPerHour > companion.maximumActionsPerHour)
  assert.ok(active.maximumInteractionsPerDay > companion.maximumInteractionsPerDay)
  assert.ok(active.minimumActionIntervalMs! < companion.minimumActionIntervalMs!)
  assert.equal(Object.isFrozen(active), true)
})

test('cat settings keep a valid choice and recover invalid persisted values', () => {
  setActivePinia(createPinia())

  const catStore = useCatStore()

  assert.equal(catStore.companion.mode, 'companion')

  catStore.companion.mode = 'active'
  catStore.init()
  assert.equal(catStore.companion.mode, 'active')

  Object.assign(catStore.companion, { mode: 'invalid' })
  catStore.init()
  assert.equal(catStore.companion.mode, 'companion')
})
