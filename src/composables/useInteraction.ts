import { readonly, ref } from 'vue'

import type { InteractionChoiceId, InteractionTemplateId } from '@/domain/interaction/templates'

import { getInteractionTemplate, isInteractionChoice } from '@/domain/interaction/templates'

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
}

const activeInteraction = ref<ActiveInteraction>()

export function useInteraction() {
  function openInteraction(templateId: InteractionTemplateId, source: InteractionSource = 'user') {
    if (activeInteraction.value) return

    return new Promise<InteractionResult>((resolve) => {
      activeInteraction.value = { templateId, source, resolve }
    })
  }

  function chooseInteraction(choiceId: string) {
    const active = activeInteraction.value

    if (!active) return

    const template = getInteractionTemplate(active.templateId)
    const choice = template.choices.find(item => item.id === choiceId)

    if (!choice || !isInteractionChoice(template, choiceId)) return

    activeInteraction.value = void 0
    active.resolve({
      templateId: active.templateId,
      source: active.source,
      outcome: choice.dismisses ? 'dismissed' : 'answered',
      choiceId: choice.id,
    })
  }

  function dismissInteraction(outcome: 'dismissed' | 'aborted' = 'dismissed') {
    const active = activeInteraction.value

    if (!active) return

    activeInteraction.value = void 0
    active.resolve({
      templateId: active.templateId,
      source: active.source,
      outcome,
    })
  }

  return {
    activeInteraction: readonly(activeInteraction),
    chooseInteraction,
    dismissInteraction,
    openInteraction,
  }
}
