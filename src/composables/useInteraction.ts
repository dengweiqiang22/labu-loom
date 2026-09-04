import { readonly, ref } from 'vue'

import type { InteractionChoiceId, InteractionTemplateId } from '@/domain/interaction/templates'

import { getInteractionTemplate, isInteractionChoice } from '@/domain/interaction/templates'
import { useMemoryStore } from '@/stores/memory'

export type InteractionSource = 'user' | 'proactive'
export type InteractionOutcome = 'answered' | 'dismissed' | 'aborted'

export interface InteractionResult {
  templateId: InteractionTemplateId
  source: InteractionSource
  outcome: InteractionOutcome
  choiceId?: InteractionChoiceId
}

interface ActiveInteraction {
  templateId: InteractionTemplateId
  source: InteractionSource
  resolve: (result: InteractionResult) => void
  removeAbortListener?: () => void
  timeout?: ReturnType<typeof setTimeout>
}

const activeInteraction = ref<ActiveInteraction>()
const INTERACTION_TIMEOUT_MS = 20_000

export function useInteraction() {
  const memoryStore = useMemoryStore()

  function openInteraction(
    templateId: InteractionTemplateId,
    source: InteractionSource = 'user',
    signal?: AbortSignal,
  ) {
    if (activeInteraction.value) return

    return new Promise<InteractionResult>((resolve) => {
      const abort = () => dismissInteraction('aborted')

      activeInteraction.value = {
        templateId,
        source,
        resolve,
        removeAbortListener: signal
          ? () => signal.removeEventListener('abort', abort)
          : undefined,
        timeout: setTimeout(() => dismissInteraction('dismissed'), INTERACTION_TIMEOUT_MS),
      }

      if (source === 'proactive') memoryStore.recordProactiveInteraction('offered')

      if (signal) {
        if (signal.aborted) {
          abort()
        } else {
          signal.addEventListener('abort', abort, { once: true })
        }
      }
    })
  }

  function chooseInteraction(choiceId: string) {
    const active = activeInteraction.value

    if (!active) return

    const template = getInteractionTemplate(active.templateId)
    const choice = template.choices.find(item => item.id === choiceId)

    if (!choice || !isInteractionChoice(template, choiceId)) return

    const outcome = choice.dismisses ? 'dismissed' : 'answered'
    const result: InteractionResult = {
      templateId: active.templateId,
      source: active.source,
      outcome,
      choiceId: choice.id,
    }

    active.removeAbortListener?.()
    clearTimeout(active.timeout)
    activeInteraction.value = void 0

    if (active.source === 'proactive') {
      memoryStore.recordProactiveInteraction(outcome)
    }

    if (outcome === 'answered') memoryStore.recordInteractionChoice(choice.id)

    active.resolve(result)
  }

  function dismissInteraction(outcome: 'dismissed' | 'aborted' = 'dismissed') {
    const active = activeInteraction.value

    if (!active) return

    const result: InteractionResult = {
      templateId: active.templateId,
      source: active.source,
      outcome,
    }

    active.removeAbortListener?.()
    clearTimeout(active.timeout)
    activeInteraction.value = void 0

    if (active.source === 'proactive' && outcome === 'dismissed') {
      memoryStore.recordProactiveInteraction('dismissed')
    }

    active.resolve(result)
  }

  return {
    activeInteraction: readonly(activeInteraction),
    chooseInteraction,
    dismissInteraction,
    openInteraction,
  }
}
