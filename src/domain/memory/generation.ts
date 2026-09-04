import type { InteractionChoiceId } from '@/domain/interaction/templates'
import type { DailyActivitySummary, StructuredMemory } from '@/domain/memory/schema'

function createMemory(
  id: string,
  category: StructuredMemory['category'],
  kind: StructuredMemory['kind'],
  value: StructuredMemory['value'],
  source: StructuredMemory['source'],
  sourceFromDay: string,
  sourceToDay: string,
  createdDay: string,
): StructuredMemory {
  return {
    id,
    category,
    kind,
    value,
    source,
    sourceFromDay,
    sourceToDay,
    createdDay,
    updatedDay: createdDay,
  }
}

export function createChoiceMemory(choiceId: InteractionChoiceId, day: string) {
  if (choiceId !== 'doing-well' && choiceId !== 'taking-it-easy') return

  return createMemory(
    'context-recent-energy-state',
    'context',
    'recent-energy-state',
    choiceId,
    'explicit-choice',
    day,
    day,
    day,
  )
}

export function deriveAggregateMemories(
  summaries: readonly DailyActivitySummary[],
  day: string,
  habitMemoryEnabled: boolean,
) {
  const recent = [...summaries].sort((left, right) => left.day.localeCompare(right.day)).slice(-14)

  if (recent.length === 0) return []

  const sourceFromDay = recent[0].day
  const sourceToDay = recent.at(-1)!.day
  const totals = recent.reduce((result, summary) => {
    result.keyboard += summary.keyboardActiveSeconds
    result.mouse += summary.mouseActiveSeconds
    result.offered += summary.interactionsOffered
    result.answered += summary.interactionsAnswered
    result.dismissed += summary.interactionsDismissed

    return result
  }, { keyboard: 0, mouse: 0, offered: 0, answered: 0, dismissed: 0 })
  const memories: StructuredMemory[] = []

  if (habitMemoryEnabled && recent.length >= 3 && totals.keyboard + totals.mouse > 0) {
    const value = totals.keyboard > totals.mouse * 1.5
      ? 'keyboard-led'
      : totals.mouse > totals.keyboard * 1.5
        ? 'mouse-led'
        : 'mixed-activity'

    memories.push(createMemory(
      'habit-usual-activity-balance',
      'habit',
      'usual-activity-balance',
      value,
      'activity-aggregate',
      sourceFromDay,
      sourceToDay,
      day,
    ))
  }

  if (totals.offered >= 4) {
    const dismissedRatio = totals.dismissed / totals.offered
    const answeredRatio = totals.answered / totals.offered
    const frequency = dismissedRatio >= 0.5 ? 'less' : answeredRatio >= 0.75 ? 'more' : 'same'

    memories.push(createMemory(
      'preference-interaction-frequency',
      'preference',
      'preferred-interaction-frequency',
      frequency,
      'activity-aggregate',
      sourceFromDay,
      sourceToDay,
      day,
    ))
  }

  if (totals.offered >= 5) {
    memories.push(createMemory(
      'relationship-interaction-style',
      'relationship',
      'interaction-response-style',
      totals.answered >= totals.dismissed ? 'responsive' : 'reserved',
      'activity-aggregate',
      sourceFromDay,
      sourceToDay,
      day,
    ))
  }

  return memories
}

export function mergeStructuredMemories(
  existing: readonly StructuredMemory[],
  generated: readonly StructuredMemory[],
  replaceAggregate = false,
  forgottenMemoryIds: ReadonlySet<string> = new Set(),
) {
  const editableGenerated = generated.filter(memory => !forgottenMemoryIds.has(memory.id))
  const userEditedIds = new Set(
    existing.filter(memory => memory.source === 'user-edited').map(memory => memory.id),
  )
  const generatedIds = new Set(
    editableGenerated.filter(memory => !userEditedIds.has(memory.id)).map(memory => memory.id),
  )
  const retained = existing.filter((memory) => {
    if (generatedIds.has(memory.id)) return false
    if (replaceAggregate && memory.source === 'activity-aggregate' && !userEditedIds.has(memory.id)) return false

    return true
  })
  const previousById = new Map(existing.map(memory => [memory.id, memory]))

  return [
    ...retained,
    ...editableGenerated.filter(memory => !userEditedIds.has(memory.id)).map((memory) => {
      const previous = previousById.get(memory.id)

      return previous ? { ...memory, createdDay: previous.createdDay } : memory
    }),
  ]
}
