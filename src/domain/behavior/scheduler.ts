import type { CompanionModePolicy } from './mode'

export type BehaviorPriority = 'ambient' | 'responsive' | 'user' | 'critical'
export type BehaviorFrequency = 'action' | 'interaction'
export type BehaviorRejectionReason
  = 'cooldown'
    | 'duplicate'
    | 'hourly-limit'
    | 'interaction-limit'
    | 'proactive-disabled'
    | 'queue-full'

export interface BehaviorRequest<T> {
  id: string
  payload: T
  priority: BehaviorPriority
  proactive?: boolean
  frequency?: BehaviorFrequency
  resumable?: boolean
  cooldownKey?: string
  cooldownMs?: number
}

export interface ScheduledBehavior<T> extends BehaviorRequest<T> {
  requestedAt: number
  resumed: boolean
}

export type ScheduleResult<T>
  = {
    status: 'started'
    started: ScheduledBehavior<T>
    interrupted?: ScheduledBehavior<T>
  }
  | {
    status: 'queued'
  }
  | {
    status: 'rejected'
    reason: BehaviorRejectionReason
  }

export interface CompletionResult<T> {
  completed?: ScheduledBehavior<T>
  next?: ScheduledBehavior<T>
}

type Clock = () => number

const HOUR_MS = 60 * 60 * 1_000
const MAX_QUEUE_SIZE = 16

const PRIORITY_VALUES: Readonly<Record<BehaviorPriority, number>> = {
  ambient: 0,
  responsive: 1,
  user: 2,
  critical: 3,
}

function getLocalDayKey(timestamp: number) {
  const date = new Date(timestamp)

  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export class BehaviorScheduler<T> {
  private active?: ScheduledBehavior<T>
  private readonly queue: ScheduledBehavior<T>[] = []
  private readonly cooldownStarts = new Map<string, number>()
  private readonly proactiveActionStarts: number[] = []
  private readonly proactiveInteractionStarts: number[] = []
  private lastProactiveStartAt: number

  constructor(
    private readonly now: Clock = () => performance.now(),
    private readonly wallNow: Clock = () => Date.now(),
  ) {
    this.lastProactiveStartAt = now()
  }

  request(request: BehaviorRequest<T>, policy: Readonly<CompanionModePolicy>): ScheduleResult<T> {
    const now = this.now()
    const behavior: ScheduledBehavior<T> = {
      ...request,
      requestedAt: now,
      resumed: false,
    }
    const rejection = this.getRejectionReason(behavior, policy, now)

    if (rejection) return { status: 'rejected', reason: rejection }

    if (!this.active) {
      this.activate(behavior, now)

      return { status: 'started', started: behavior }
    }

    if (PRIORITY_VALUES[behavior.priority] > PRIORITY_VALUES[this.active.priority]) {
      const interrupted = this.active

      if (interrupted.resumable) {
        this.enqueue({ ...interrupted, resumed: true })
      }

      this.activate(behavior, now)

      return { status: 'started', started: behavior, interrupted }
    }

    if (this.queue.length >= MAX_QUEUE_SIZE) {
      return { status: 'rejected', reason: 'queue-full' }
    }

    this.enqueue(behavior)

    return { status: 'queued' }
  }

  complete(id: string, policy: Readonly<CompanionModePolicy>): CompletionResult<T> {
    if (this.active?.id !== id) return {}

    const completed = this.active

    this.active = void 0

    return {
      completed,
      next: this.startNext(policy),
    }
  }

  tick(policy: Readonly<CompanionModePolicy>) {
    if (this.active) return

    return this.startNext(policy)
  }

  clear() {
    this.active = void 0
    this.queue.length = 0
    this.cooldownStarts.clear()
    this.proactiveActionStarts.length = 0
    this.proactiveInteractionStarts.length = 0
    this.lastProactiveStartAt = this.now()
  }

  snapshot() {
    return {
      active: this.active,
      queued: [...this.queue],
    }
  }

  private startNext(policy: Readonly<CompanionModePolicy>) {
    const now = this.now()

    for (const [index, behavior] of this.queue.entries()) {
      const rejection = behavior.resumed
        ? void 0
        : this.getRejectionReason(behavior, policy, now, true)

      if (rejection) continue

      this.queue.splice(index, 1)
      this.activate(behavior, now)

      return behavior
    }
  }

  private activate(behavior: ScheduledBehavior<T>, now: number) {
    this.active = behavior

    if (behavior.resumed) return

    if (behavior.cooldownKey) {
      this.cooldownStarts.set(behavior.cooldownKey, now)
    }

    if (!behavior.proactive) return

    this.lastProactiveStartAt = now
    this.proactiveActionStarts.push(now)

    if (behavior.frequency === 'interaction') {
      this.proactiveInteractionStarts.push(this.wallNow())
    }
  }

  private enqueue(behavior: ScheduledBehavior<T>) {
    this.queue.push(behavior)
    this.queue.sort((left, right) => {
      return PRIORITY_VALUES[right.priority] - PRIORITY_VALUES[left.priority]
        || Number(right.resumed) - Number(left.resumed)
        || left.requestedAt - right.requestedAt
    })

    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue.pop()
    }
  }

  private getRejectionReason(
    behavior: ScheduledBehavior<T>,
    policy: Readonly<CompanionModePolicy>,
    now: number,
    ignoreDuplicate = false,
  ): BehaviorRejectionReason | undefined {
    if (!ignoreDuplicate && this.has(behavior.id)) return 'duplicate'

    if (behavior.cooldownKey && behavior.cooldownMs) {
      const lastStartedAt = this.cooldownStarts.get(behavior.cooldownKey)

      if (lastStartedAt !== void 0 && now - lastStartedAt < behavior.cooldownMs) {
        return 'cooldown'
      }
    }

    if (!behavior.proactive) return

    if (!policy.allowProactiveBehavior) return 'proactive-disabled'

    if (
      policy.minimumActionIntervalMs !== void 0
      && now - this.lastProactiveStartAt < policy.minimumActionIntervalMs
    ) {
      return 'cooldown'
    }

    this.pruneStarts(this.proactiveActionStarts, now - HOUR_MS)

    if (this.proactiveActionStarts.length >= policy.maximumActionsPerHour) {
      return 'hourly-limit'
    }

    if (behavior.frequency !== 'interaction') return

    const today = getLocalDayKey(this.wallNow())
    const todayInteractions = this.proactiveInteractionStarts.filter((timestamp) => {
      return getLocalDayKey(timestamp) === today
    }).length

    if (todayInteractions >= policy.maximumInteractionsPerDay) {
      return 'interaction-limit'
    }
  }

  private has(id: string) {
    return this.active?.id === id || this.queue.some(behavior => behavior.id === id)
  }

  private pruneStarts(starts: number[], cutoff: number) {
    while (starts.length > 0 && starts[0] <= cutoff) {
      starts.shift()
    }
  }
}
