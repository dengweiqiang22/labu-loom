import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { withIsolatedDevConfig } from './tauriDevConfig.mjs'

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const tauriCli = join(repositoryRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js')
const args = process.argv.slice(2)

const isolatedDevConfig = withIsolatedDevConfig(args, repositoryRoot)
const tauriArgs = Array.isArray(isolatedDevConfig) ? isolatedDevConfig : isolatedDevConfig.args

if (!Array.isArray(isolatedDevConfig)) {
  console.info(`[labu-loom] Linked worktree detected; using isolated development storage (${isolatedDevConfig.identifier}).`)
}

const result = spawnSync(process.execPath, [tauriCli, ...tauriArgs], {
  cwd: repositoryRoot,
  env: process.env,
  stdio: 'inherit',
})

if (result.error) throw result.error

process.exitCode = result.status ?? 1
