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

const MEMORY_ROOT_KEYS = new Set([
  'schemaVersion',
  'settings',
  'dailySummaries',
  'weeklySummaries',
  'monthlyTrends',
  'memories',
  'forgottenMemoryIds',
])
const MEMORY_SETTING_KEYS = new Set([
  'interactionsEnabled',
  'keyboardStatsEnabled',
  'mouseStatsEnabled',
  'habitMemoryEnabled',
  'restRemindersEnabled',
])
const DAILY_KEYS = new Set([
  'day',
  'keyboardActiveSeconds',
  'mouseActiveSeconds',
  'idleSeconds',
  'activeSessionCount',
  'interactionsOffered',
  'interactionsAnswered',
  'interactionsDismissed',
])
const WEEKLY_KEYS = new Set(['weekStart', 'daysCovered', ...DAILY_KEYS].filter(key => key !== 'day'))
const MONTHLY_KEYS = new Set(['month', 'daysCovered', ...DAILY_KEYS].filter(key => key !== 'day'))
const MEMORY_KEYS = new Set([
  'id',
  'category',
  'kind',
  'value',
  'source',
  'sourceFromDay',
  'sourceToDay',
  'createdDay',
  'updatedDay',
])
const MEMORY_IDS = new Set([
  'preference-companion-mode',
  'preference-interaction-frequency',
  'habit-often-active-period',
  'context-recent-energy-state',
  'habit-usual-activity-balance',
  'relationship-interaction-style',
])

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

function checkAllowedKeys(
  file: string,
  label: string,
  value: unknown,
  allowed: ReadonlySet<string>,
  findings: Finding[],
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return

  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) findings.push({ file, rule: `unexpected ${label} key: ${key}` })
  }
}

function checkMemoryStore(file: string, value: unknown, findings: Finding[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    findings.push({ file, rule: 'invalid memory store root' })
    return
  }

  const state = value as Record<string, unknown>

  checkAllowedKeys(file, 'memory root', state, MEMORY_ROOT_KEYS, findings)
  checkAllowedKeys(file, 'memory setting', state.settings, MEMORY_SETTING_KEYS, findings)

  for (const summary of Array.isArray(state.dailySummaries) ? state.dailySummaries : []) {
    checkAllowedKeys(file, 'daily summary', summary, DAILY_KEYS, findings)
  }

  for (const summary of Array.isArray(state.weeklySummaries) ? state.weeklySummaries : []) {
    checkAllowedKeys(file, 'weekly summary', summary, WEEKLY_KEYS, findings)
  }

  for (const trend of Array.isArray(state.monthlyTrends) ? state.monthlyTrends : []) {
    checkAllowedKeys(file, 'monthly trend', trend, MONTHLY_KEYS, findings)
  }

  for (const memory of Array.isArray(state.memories) ? state.memories : []) {
    checkAllowedKeys(file, 'structured memory', memory, MEMORY_KEYS, findings)

    if (
      memory
      && typeof memory === 'object'
      && !Array.isArray(memory)
      && !MEMORY_IDS.has((memory as Record<string, unknown>).id as string)
    ) {
      findings.push({ file, rule: 'unknown structured memory id' })
    }
  }

  for (const id of Array.isArray(state.forgottenMemoryIds) ? state.forgottenMemoryIds : []) {
    if (typeof id !== 'string' || !MEMORY_IDS.has(id)) {
      findings.push({ file, rule: 'unknown forgotten memory id' })
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

    const parsed = JSON.parse(content)

    collectForbiddenKeys(parsed, forbiddenKeys)
    checkContent(file, content, findings)

    if (entry.name.startsWith('memory.')) checkMemoryStore(entry.name, parsed, findings)

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
