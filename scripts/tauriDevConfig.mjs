import { createHash } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

export function isLinkedWorktree(root) {
  const gitPath = join(root, '.git')

  return existsSync(gitPath) && statSync(gitPath).isFile()
}

export function getWorktreeIdentifier(root) {
  const suffix = createHash('sha256')
    .update(root.toLocaleLowerCase('en-US'))
    .digest('hex')
    .slice(0, 10)

  return `com.labuloom.desktop.dev.${suffix}`
}

export function withIsolatedDevConfig(commandArgs, root, linked = isLinkedWorktree(root)) {
  if (commandArgs[0] !== 'dev' || !linked) return commandArgs

  const separatorIndex = commandArgs.indexOf('--')
  const optionEnd = separatorIndex === -1 ? commandArgs.length : separatorIndex
  const identifier = getWorktreeIdentifier(root)
  const config = JSON.stringify({ identifier })

  return {
    args: [
      ...commandArgs.slice(0, optionEnd),
      '--config',
      config,
      ...commandArgs.slice(optionEnd),
    ],
    identifier,
  }
}
