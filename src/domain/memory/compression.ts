import type { DailyActivitySummary, MonthlyActivityTrend, WeeklyActivitySummary } from './schema'

export interface MemoryAggregates {
  dailySummaries: DailyActivitySummary[]
  weeklySummaries: WeeklyActivitySummary[]
  monthlyTrends: MonthlyActivityTrend[]
}

const DAY_MS = 24 * 60 * 60 * 1_000

function parseDay(day: string) {
  return new Date(`${day}T00:00:00Z`)
}

function formatDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function getWeekStart(day: string) {
  const date = parseDay(day)
  const daysFromMonday = (date.getUTCDay() + 6) % 7

  date.setUTCDate(date.getUTCDate() - daysFromMonday)

  return formatDay(date)
}

export function getMonth(day: string) {
  return day.slice(0, 7)
}

function createWeekly(weekStart: string): WeeklyActivitySummary {
  return {
    weekStart,
    daysCovered: 0,
    keyboardActiveSeconds: 0,
    mouseActiveSeconds: 0,
    idleSeconds: 0,
    activeSessionCount: 0,
    interactionsOffered: 0,
    interactionsAnswered: 0,
    interactionsDismissed: 0,
  }
}

function createMonthly(month: string): MonthlyActivityTrend {
  return {
    month,
    daysCovered: 0,
    keyboardActiveSeconds: 0,
    mouseActiveSeconds: 0,
    idleSeconds: 0,
    activeSessionCount: 0,
    interactionsOffered: 0,
    interactionsAnswered: 0,
    interactionsDismissed: 0,
  }
}

function addAggregate(
  target: WeeklyActivitySummary | MonthlyActivityTrend,
  source: DailyActivitySummary | WeeklyActivitySummary,
  daysCovered: number,
) {
  target.daysCovered += daysCovered
  target.keyboardActiveSeconds += source.keyboardActiveSeconds
  target.mouseActiveSeconds += source.mouseActiveSeconds
  target.idleSeconds += source.idleSeconds
  target.activeSessionCount += source.activeSessionCount
  target.interactionsOffered += source.interactionsOffered
  target.interactionsAnswered += source.interactionsAnswered
  target.interactionsDismissed += source.interactionsDismissed
}

function getDailyCutoff(referenceDay: string) {
  const cutoff = parseDay(referenceDay)

  cutoff.setUTCDate(cutoff.getUTCDate() - 29)

  return formatDay(cutoff)
}

function getWeeklyCutoffMonth(referenceDay: string) {
  const reference = parseDay(referenceDay)

  reference.setUTCMonth(reference.getUTCMonth() - 11, 1)

  return reference.toISOString().slice(0, 7)
}

export function compressMemoryAggregates(
  aggregates: MemoryAggregates,
  referenceDay: string,
): MemoryAggregates {
  const dailyCutoff = getDailyCutoff(referenceDay)
  const weeklyCutoffMonth = getWeeklyCutoffMonth(referenceDay)
  const weeklyByStart = new Map(
    aggregates.weeklySummaries.map(summary => [summary.weekStart, { ...summary }]),
  )
  const retainedDaily: DailyActivitySummary[] = []

  for (const summary of aggregates.dailySummaries) {
    if (summary.day >= dailyCutoff) {
      retainedDaily.push({ ...summary })
      continue
    }

    const weekStart = getWeekStart(summary.day)
    const weekly = weeklyByStart.get(weekStart) ?? createWeekly(weekStart)

    addAggregate(weekly, summary, 1)
    weeklyByStart.set(weekStart, weekly)
  }

  const monthlyByMonth = new Map(
    aggregates.monthlyTrends.map(trend => [trend.month, { ...trend }]),
  )
  const retainedWeekly: WeeklyActivitySummary[] = []

  for (const weekly of weeklyByStart.values()) {
    const month = getMonth(weekly.weekStart)

    if (month >= weeklyCutoffMonth) {
      retainedWeekly.push(weekly)
      continue
    }

    const monthly = monthlyByMonth.get(month) ?? createMonthly(month)

    addAggregate(monthly, weekly, weekly.daysCovered)
    monthlyByMonth.set(month, monthly)
  }

  return {
    dailySummaries: retainedDaily.sort((left, right) => left.day.localeCompare(right.day)),
    weeklySummaries: retainedWeekly.sort((left, right) => left.weekStart.localeCompare(right.weekStart)),
    monthlyTrends: [...monthlyByMonth.values()].sort((left, right) => left.month.localeCompare(right.month)),
  }
}

export function dayDistance(fromDay: string, toDay: string) {
  return Math.round((parseDay(toDay).getTime() - parseDay(fromDay).getTime()) / DAY_MS)
}
