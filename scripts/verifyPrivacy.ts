import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { env } from 'node:process'

const FORBIDDEN_STORE_KEYS = new Set([
  'activitystate',
  'inputintensity',
  'latestcursorpoint',
  'pressedkeys',
  'smoothedcursorpoint',
])

const FORBIDDEN_CONTENT_PATTERNS = [
  /KeyboardPress/,
  /KeyboardRelease/,
  /MouseMove/,
  /device-changed/,
  /gamepad-changed/,
]

interface Finding {
  file: string
  rule: string
}

function collectForbiddenKeys(value: unknown, found: Set<string>) {
  if (!value || typeof value !== 'object') return

  if (Array.isArray(value)) {
    for (const item of value) collectForbiddenKeys(item, found)

    return
  }

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_STORE_KEYS.has(key.toLowerCase())) found.add(key)

    collectForbiddenKeys(child, found)
  }
}

function checkContent(file: string, content: string, findings: Finding[]) {
  for (const pattern of FORBIDDEN_CONTENT_PATTERNS) {
    if (pattern.test(content)) {
      findings.push({ file: basename(file), rule: pattern.source })
    }
  }
}

const roamingRoot = env.APPDATA
const localRoot = env.LOCALAPPDATA

if (!roamingRoot || !localRoot) {
  throw new Error('APPDATA and LOCALAPPDATA are required for the Windows privacy verification')
}

const storeRoot = join(roamingRoot, 'com.labuloom.desktop', 'tauri-plugin-pinia')
const logRoot = join(localRoot, 'com.labuloom.desktop', 'logs')
const findings: Finding[] = []
let checkedLogs = 0
let checkedStores = 0

if (existsSync(storeRoot)) {
  for (const entry of readdirSync(storeRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue

    const file = join(storeRoot, entry.name)
    const content = readFileSync(file, 'utf8')
    const forbiddenKeys = new Set<string>()

    collectForbiddenKeys(JSON.parse(content), forbiddenKeys)
    checkContent(file, content, findings)

    for (const key of forbiddenKeys) {
      findings.push({ file: entry.name, rule: `persisted key: ${key}` })
    }

    checkedStores += 1
  }
}

if (existsSync(logRoot)) {
  for (const entry of readdirSync(logRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.log')) continue

    const file = join(logRoot, entry.name)

    checkContent(file, readFileSync(file, 'utf8'), findings)
    checkedLogs += 1
  }
}

if (checkedStores === 0 || checkedLogs === 0) {
  throw new Error(`Privacy verification needs runtime evidence: ${checkedStores} store files and ${checkedLogs} log files found`)
}

if (findings.length > 0) {
  const summary = findings.map(finding => `${finding.file}: ${finding.rule}`).join('\n')

  throw new Error(`Privacy verification failed:\n${summary}`)
}

console.log(`Privacy verification passed: ${checkedStores} store files and ${checkedLogs} log files checked`)
