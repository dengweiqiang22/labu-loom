import { find } from 'es-toolkit/compat'
import { nanoid } from 'nanoid'

import type { Model, ModelMode } from '@/stores/model'

export const PRESET_MODEL_MODES: ModelMode[] = ['gamepad', 'keyboard', 'standard']

function joinModelPath(modelsPath: string, mode: ModelMode) {
  const separator = modelsPath.includes('\\') ? '\\' : '/'

  return `${modelsPath.replace(/[\\/]+$/, '')}${separator}${mode}`
}

export function rebasePresetModels(models: Model[], modelsPath: string) {
  const customModels = models.filter(model => !model.isPreset)
  const presetModels = models.filter(model => model.isPreset)

  const nextPresetModels = PRESET_MODEL_MODES.map((mode) => {
    const matched = find(presetModels, { mode })

    return {
      id: matched?.id ?? nanoid(),
      mode,
      isPreset: true,
      path: joinModelPath(modelsPath, mode),
    } satisfies Model
  })

  return [...nextPresetModels, ...customModels]
}

export function resolveModelPath(model: Model, modelsPath: string) {
  return model.isPreset ? joinModelPath(modelsPath, model.mode) : model.path
}
