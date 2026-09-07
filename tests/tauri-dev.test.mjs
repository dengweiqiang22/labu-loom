/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试验证开发启动脚本，无需额外测试运行时 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { getWorktreeIdentifier, withIsolatedDevConfig } from '../scripts/tauriDevConfig.mjs'

test('keeps the primary worktree on the standard application identifier', () => {
  const args = ['dev', '--release']

  assert.equal(withIsolatedDevConfig(args, 'D:\\workspace\\labu-loom', false), args)
})

test('adds a stable isolated identifier before application arguments', () => {
  const root = 'D:\\workspace\\labu-loom-worktree'
  const result = withIsolatedDevConfig(['dev', '--release', '--', '--example'], root, true)

  assert.deepEqual(result, {
    args: [
      'dev',
      '--release',
      '--config',
      JSON.stringify({ identifier: getWorktreeIdentifier(root) }),
      '--',
      '--example',
    ],
    identifier: getWorktreeIdentifier(root),
  })
})

test('does not alter non-development commands', () => {
  const args = ['build']

  assert.equal(withIsolatedDevConfig(args, 'D:\\workspace\\labu-loom-worktree', true), args)
})
