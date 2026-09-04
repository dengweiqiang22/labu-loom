import type {
  DailyActivitySummary,
  MonthlyActivityTrend,
  StructuredMemory,
  WeeklyActivitySummary,
} from './schema'

export interface RecollectionTotals {
  recordedDays: number
  keyboardActiveSeconds: number
  mouseActiveSeconds: number
  idleSeconds: number
  activeSessionCount: number
  interactionsOffered: number
  interactionsAnswered: number
  interactionsDismissed: number
}

export interface RecollectionOverview {
  hasHistory: boolean
  fromPeriod?: string
  toPeriod?: string
  totals: RecollectionTotals
  highlights: StructuredMemory[]
}

interface AggregateRow {
  period: string
  daysCovered: number
  keyboardActiveSeconds: number
  mouseActiveSeconds: number
  idleSeconds: number
  activeSessionCount: number
  interactionsOffered: number
  interactionsAnswered: number
  interactionsDismissed: number
}

const EMPTY_TOTALS: RecollectionTotals = {
  recordedDays: 0,
  keyboardActiveSeconds: 0,
  mouseActiveSeconds: 0,
  idleSeconds: 0,
  activeSessionCount: 0,
  interactionsOffered: 0,
  interactionsAnswered: 0,
  interactionsDismissed: 0,
}

function toDailyRow(summary: DailyActivitySummary): AggregateRow {
  return { ...summary, period: summary.day, daysCovered: 1 }
}

function toWeeklyRow(summary: WeeklyActivitySummary): AggregateRow {
  return { ...summary, period: summary.weekStart }
}

function toMonthlyRow(summary: MonthlyActivityTrend): AggregateRow {
  return { ...summary, period: summary.month }
}

export function createRecollectionOverview(
  dailySummaries: readonly DailyActivitySummary[],
  weeklySummaries: readonly WeeklyActivitySummary[],
  monthlyTrends: readonly MonthlyActivityTrend[],
  memories: readonly StructuredMemory[],
): RecollectionOverview {
  const rows = [
    ...dailySummaries.map(toDailyRow),
    ...weeklySummaries.map(toWeeklyRow),
    ...monthlyTrends.map(toMonthlyRow),
  ].sort((left, right) => left.period.localeCompare(right.period))
  const totals = rows.reduce<RecollectionTotals>((result, row) => ({
    recordedDays: result.recordedDays + row.daysCovered,
    keyboardActiveSeconds: result.keyboardActiveSeconds + row.keyboardActiveSeconds,
    mouseActiveSeconds: result.mouseActiveSeconds + row.mouseActiveSeconds,
    idleSeconds: result.idleSeconds + row.idleSeconds,
    activeSessionCount: result.activeSessionCount + row.activeSessionCount,
    interactionsOffered: result.interactionsOffered + row.interactionsOffered,
    interactionsAnswered: result.interactionsAnswered + row.interactionsAnswered,
    interactionsDismissed: result.interactionsDismissed + row.interactionsDismissed,
  }), { ...EMPTY_TOTALS })
  const highlights = [...memories]
    .sort((left, right) => (
      right.updatedDay.localeCompare(left.updatedDay)
      || left.id.localeCompare(right.id)
    ))
    .slice(0, 4)

  return {
    hasHistory: rows.length > 0 || highlights.length > 0,
    fromPeriod: rows.at(0)?.period,
    toPeriod: rows.at(-1)?.period,
    totals,
    highlights,
  }
}
