export type InteractionTemplateId = 'daily-check-in' | 'rest-reminder'
export type InteractionChoiceId = 'doing-well' | 'taking-it-easy' | 'not-now'

export interface InteractionChoice {
  id: InteractionChoiceId
  labelKey: string
  dismisses: boolean
}

export interface InteractionTemplate {
  id: InteractionTemplateId
  promptKey: string
  choices: readonly InteractionChoice[]
}

const INTERACTION_TEMPLATES: Readonly<Record<InteractionTemplateId, InteractionTemplate>> = {
  'daily-check-in': {
    id: 'daily-check-in',
    promptKey: 'components.interactionBubble.prompts.dailyCheckIn',
    choices: [
      {
        id: 'doing-well',
        labelKey: 'components.interactionBubble.choices.doingWell',
        dismisses: false,
      },
      {
        id: 'taking-it-easy',
        labelKey: 'components.interactionBubble.choices.takingItEasy',
        dismisses: false,
      },
      {
        id: 'not-now',
        labelKey: 'components.interactionBubble.choices.notNow',
        dismisses: true,
      },
    ],
  },
  'rest-reminder': {
    id: 'rest-reminder',
    promptKey: 'components.interactionBubble.prompts.restReminder',
    choices: [
      {
        id: 'taking-it-easy',
        labelKey: 'components.interactionBubble.choices.takingItEasy',
        dismisses: false,
      },
      {
        id: 'doing-well',
        labelKey: 'components.interactionBubble.choices.doingWell',
        dismisses: false,
      },
      {
        id: 'not-now',
        labelKey: 'components.interactionBubble.choices.notNow',
        dismisses: true,
      },
    ],
  },
}

export function getInteractionTemplate(id: InteractionTemplateId) {
  return INTERACTION_TEMPLATES[id]
}

export function isInteractionChoice(template: InteractionTemplate, choiceId: string) {
  return template.choices.some(choice => choice.id === choiceId)
}

export function validateInteractionTemplate(template: InteractionTemplate) {
  const choiceIds = new Set(template.choices.map(choice => choice.id))

  return template.choices.length >= 2
    && template.choices.length <= 4
    && choiceIds.size === template.choices.length
    && template.choices.some(choice => choice.dismisses)
}
