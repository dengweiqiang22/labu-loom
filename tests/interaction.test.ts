/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试避免为纯互动定义新增测试依赖 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { getInteractionTemplate, isInteractionChoice, validateInteractionTemplate } from '../src/domain/interaction/templates'

test('built-in interaction has two to four unique choices and an explicit dismiss option', () => {
  const template = getInteractionTemplate('daily-check-in')

  assert.equal(validateInteractionTemplate(template), true)
  assert.equal(template.choices.length, 3)
  assert.equal(template.choices.filter(choice => choice.dismisses).length, 1)
})

test('only predefined choice identifiers are accepted', () => {
  const template = getInteractionTemplate('daily-check-in')

  assert.equal(isInteractionChoice(template, 'doing-well'), true)
  assert.equal(isInteractionChoice(template, 'arbitrary-free-text'), false)
})
