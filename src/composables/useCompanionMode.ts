import { computed } from 'vue'

import { getCompanionModePolicy } from '@/domain/behavior/mode'
import { useCatStore } from '@/stores/cat'

export function useCompanionMode() {
  const catStore = useCatStore()
  const companionModePolicy = computed(() => getCompanionModePolicy(catStore.companion.mode))

  return {
    companionModePolicy,
  }
}
