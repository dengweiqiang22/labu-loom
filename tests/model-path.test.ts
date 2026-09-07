/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试避免为模型路径新增测试依赖 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { rebasePresetModels, resolveModelPath } from '../src/domain/model/path'

test('rebases stale preset paths while preserving their ids', () => {
  const models = rebasePresetModels([
    { id: 'standard-id', mode: 'standard', isPreset: true, path: 'D:\\removed-worktree\\standard' },
    { id: 'custom-id', mode: 'standard', isPreset: false, path: 'D:\\models\\custom' },
  ], 'D:\\current-worktree\\assets\\models')

  assert.deepEqual(
    models.find(model => model.mode === 'standard' && model.isPreset),
    {
      id: 'standard-id',
      mode: 'standard',
      isPreset: true,
      path: 'D:\\current-worktree\\assets\\models\\standard',
    },
  )
  assert.equal(models.find(model => model.id === 'custom-id')?.path, 'D:\\models\\custom')
})

test('resolves preset models against the current resource directory', () => {
  assert.equal(
    resolveModelPath(
      { id: 'standard-id', mode: 'standard', isPreset: true, path: 'D:\\stale\\standard' },
      'D:\\current\\models',
    ),
    'D:\\current\\models\\standard',
  )
})
