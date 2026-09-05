import type { RecollectionOverview } from './recollection'

export type PetPerspectiveSummaryTemplate
  = 'highlightsOnly'
    | 'quietDays'
    | 'moreQuietTime'
    | 'answeredMoments'
    | 'accompaniedDays'
    | 'recordedDays'

export interface PetPerspectiveSummary {
  template: PetPerspectiveSummaryTemplate
  params: Readonly<Record<string, number>>
}

export function createPetPerspectiveSummary(
  overview: RecollectionOverview,
): PetPerspectiveSummary | null {
  if (!overview.hasHistory) return null

  const { totals, highlights } = overview
  const days = totals.recordedDays
  const activeSeconds = totals.keyboardActiveSeconds + totals.mouseActiveSeconds

  if (days === 0 && highlights.length > 0) {
    return {
      template: 'highlightsOnly',
      params: { count: highlights.length },
    }
  }

  if (days > 0 && activeSeconds === 0 && totals.idleSeconds > 0) {
    return {
      template: 'quietDays',
      params: { days },
    }
  }

  if (days > 0 && totals.idleSeconds > activeSeconds * 2) {
    return {
      template: 'moreQuietTime',
      params: { days },
    }
  }

  if (days > 0 && totals.interactionsAnswered > 0) {
    return {
      template: 'answeredMoments',
      params: {
        days,
        answered: totals.interactionsAnswered,
      },
    }
  }

  if (days > 0 && activeSeconds > 0) {
    return {
      template: 'accompaniedDays',
      params: { days },
    }
  }

  if (days > 0) {
    return {
      template: 'recordedDays',
      params: { days },
    }
  }

  return {
    template: 'highlightsOnly',
    params: { count: Math.max(highlights.length, 1) },
  }
}
