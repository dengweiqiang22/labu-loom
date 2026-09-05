/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试避免为错误文案新增测试依赖 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { getUserFacingErrorMessage } from '../src/utils/errorMessage'

test('keeps short human messages and replaces technical dumps', () => {
  assert.equal(getUserFacingErrorMessage('模型目录不存在', '操作失败'), '模型目录不存在')
  assert.equal(getUserFacingErrorMessage(new Error('boom'), '操作失败'), '操作失败')
  assert.equal(getUserFacingErrorMessage('Error: failed at C:\\temp\\x', '操作失败'), '操作失败')
})
