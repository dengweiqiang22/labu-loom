/* eslint-disable test/no-import-node-test -- 使用 Node 内置测试避免为纯调度器新增测试依赖 */
import assert from 'node:assert/strict'
import test from 'node:test'

import type { CompanionModePolicy } from '../src/domain/behavior/mode'

import { BehaviorScheduler } from '../src/domain/behavior/scheduler'

const policy: CompanionModePolicy = {
  allowProactiveBehavior: true,
  allowProactiveMovement: true,
  motionLevel: 'normal',
  minimumActionIntervalMs: 1_000,
  maximumActionsPerHour: 2,
  maximumInteractionsPerDay: 1,
}

function createClock(initial = 0) {
  let value = initial

  return {
    advance(milliseconds: number) {
      value += milliseconds
    },
    now: () => value,
  }
}

function request(id: string, priority: 'ambient' | 'user' | 'critical' = 'ambient') {
  return {
    id,
    payload: id,
    priority,
    resumable: priority === 'ambient',
  } as const
}

test('starts immediately and queues work with the same or lower priority', () => {
  const clock = createClock()
  const scheduler = new BehaviorScheduler<string>(clock.now)

  assert.equal(scheduler.request(request('first', 'user'), policy).status, 'started')
  assert.equal(scheduler.request(request('second'), policy).status, 'queued')
  assert.deepEqual(scheduler.snapshot().queued.map(item => item.id), ['second'])
})

test('interrupts a resumable behavior and resumes it after higher priority work', () => {
  const clock = createClock()
  const scheduler = new BehaviorScheduler<string>(clock.now)

  scheduler.request(request('ambient'), policy)
  const interrupted = scheduler.request(request('user', 'user'), policy)

  assert.equal(interrupted.status, 'started')
  assert.equal(interrupted.status === 'started' && interrupted.interrupted?.id, 'ambient')

  const completed = scheduler.complete('user', policy)

  assert.equal(completed.next?.id, 'ambient')
  assert.equal(completed.next?.resumed, true)
})

test('does not resume an interrupted behavior that opted out of recovery', () => {
  const scheduler = new BehaviorScheduler<string>(() => 0)

  scheduler.request(request('user', 'user'), policy)
  scheduler.request(request('critical', 'critical'), policy)

  assert.equal(scheduler.complete('critical', policy).next, undefined)
})

test('rejects duplicate requests and honors behavior-specific cooldowns', () => {
  const clock = createClock()
  const scheduler = new BehaviorScheduler<string>(clock.now)
  const cooled = {
    ...request('first', 'user'),
    cooldownKey: 'wave',
    cooldownMs: 1_000,
  }

  scheduler.request(cooled, policy)
  assert.deepEqual(scheduler.request(cooled, policy), { status: 'rejected', reason: 'duplicate' })
  scheduler.complete('first', policy)
  assert.deepEqual(
    scheduler.request({ ...cooled, id: 'second' }, policy),
    { status: 'rejected', reason: 'cooldown' },
  )

  clock.advance(1_000)
  assert.equal(scheduler.request({ ...cooled, id: 'third' }, policy).status, 'started')
})

test('applies mode cooldown and rolling hourly limits to proactive actions', () => {
  const clock = createClock()
  const scheduler = new BehaviorScheduler<string>(clock.now)
  const proactive = (id: string) => ({ ...request(id), proactive: true as const })

  assert.deepEqual(
    scheduler.request(proactive('too-early'), policy),
    { status: 'rejected', reason: 'cooldown' },
  )

  clock.advance(1_000)
  scheduler.request(proactive('first'), policy)
  scheduler.complete('first', policy)
  clock.advance(1_000)
  scheduler.request(proactive('second'), policy)
  scheduler.complete('second', policy)
  clock.advance(1_000)

  assert.deepEqual(
    scheduler.request(proactive('limited'), policy),
    { status: 'rejected', reason: 'hourly-limit' },
  )

  clock.advance(60 * 60 * 1_000)
  assert.equal(scheduler.request(proactive('after-window'), policy).status, 'started')
})

test('applies the daily cap to proactive interactions without persisting history', () => {
  const monotonic = createClock()
  const wall = createClock(new Date(2026, 8, 4, 9).getTime())
  const scheduler = new BehaviorScheduler<string>(monotonic.now, wall.now)

  monotonic.advance(1_000)
  scheduler.request({
    ...request('interaction'),
    proactive: true,
    frequency: 'interaction',
  }, policy)
  scheduler.complete('interaction', policy)
  monotonic.advance(1_000)

  assert.deepEqual(scheduler.request({
    ...request('limited'),
    proactive: true,
    frequency: 'interaction',
  }, policy), { status: 'rejected', reason: 'interaction-limit' })

  wall.advance(24 * 60 * 60 * 1_000)
  assert.equal(scheduler.request({
    ...request('tomorrow'),
    proactive: true,
    frequency: 'interaction',
  }, policy).status, 'started')
})

test('quiet mode rejects proactive work while retaining user-triggered behavior', () => {
  const clock = createClock()
  const scheduler = new BehaviorScheduler<string>(clock.now)
  const quietPolicy = {
    ...policy,
    allowProactiveBehavior: false,
    maximumActionsPerHour: 0,
    maximumInteractionsPerDay: 0,
  }

  clock.advance(1_000)
  assert.deepEqual(
    scheduler.request({ ...request('ambient'), proactive: true }, quietPolicy),
    { status: 'rejected', reason: 'proactive-disabled' },
  )
  assert.equal(scheduler.request(request('user', 'user'), quietPolicy).status, 'started')
})

test('clear removes active, queued, cooldown and frequency state', () => {
  const clock = createClock()
  const scheduler = new BehaviorScheduler<string>(clock.now)

  scheduler.request(request('first', 'user'), policy)
  scheduler.request(request('queued'), policy)
  scheduler.clear()

  assert.deepEqual(scheduler.snapshot(), { active: undefined, queued: [] })
})

test('keeps the waiting queue bounded when a resumable behavior is interrupted', () => {
  const scheduler = new BehaviorScheduler<string>(() => 0)

  scheduler.request(request('active'), policy)

  for (let index = 0; index < 16; index += 1) {
    scheduler.request(request(`queued-${index}`), policy)
  }

  scheduler.request(request('critical', 'critical'), policy)

  const snapshot = scheduler.snapshot()

  assert.equal(snapshot.queued.length, 16)
  assert.equal(snapshot.queued[0].id, 'active')
  assert.equal(snapshot.queued[0].resumed, true)
})
