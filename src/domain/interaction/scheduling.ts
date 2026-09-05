import type { ActivityPhase } from '@/domain/activity'

export interface ProactiveInteractionContext {
  interactionsEnabled: boolean
  passThrough: boolean
  visible: boolean
  activityPhase: ActivityPhase
  interactionsOfferedToday: number
  interactionsDismissedToday: number
  maximumInteractionsPerDay: number
}

export interface RestReminderContext {
  restRemindersEnabled: boolean
  interactionsEnabled: boolean
  passThrough: boolean
  visible: boolean
  continuousActiveForMs?: number
  thresholdMs: number
  maximumInteractionsPerDay: number
  interactionsOfferedToday: number
  alreadyOfferedThisStreak: boolean
}

export function canOfferProactiveInteraction(context: ProactiveInteractionContext) {
  return context.interactionsEnabled
    && !context.passThrough
    && context.visible
    && context.activityPhase === 'idle'
    && context.maximumInteractionsPerDay > 0
    && context.interactionsOfferedToday < context.maximumInteractionsPerDay
}

export function canOfferRestReminder(context: RestReminderContext) {
  return context.restRemindersEnabled
    && context.interactionsEnabled
    && !context.passThrough
    && context.visible
    && context.maximumInteractionsPerDay > 0
    && context.interactionsOfferedToday < context.maximumInteractionsPerDay
    && !context.alreadyOfferedThisStreak
    && (context.continuousActiveForMs ?? 0) >= context.thresholdMs
}

export function getInteractionCooldownMultiplier(offered: number, dismissed: number) {
  if (offered < 2) return 1

  const ignoredRatio = dismissed / offered

  if (ignoredRatio >= 0.75) return 3
  if (ignoredRatio >= 0.5) return 2

  return 1
}
