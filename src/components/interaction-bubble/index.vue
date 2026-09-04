<script setup lang="ts">
import { computed } from 'vue'

import { useInteraction } from '@/composables/useInteraction'
import { getInteractionTemplate } from '@/domain/interaction/templates'

const { activeInteraction, chooseInteraction, dismissInteraction } = useInteraction()
const template = computed(() => activeInteraction.value
  ? getInteractionTemplate(activeInteraction.value.templateId)
  : undefined)
</script>

<template>
  <section
    v-if="template"
    :aria-label="$t('components.interactionBubble.ariaLabel')"
    class="interaction-bubble"
    role="dialog"
    @click.stop
    @contextmenu.stop.prevent
    @mousedown.stop
    @mousemove.stop
  >
    <button
      :aria-label="$t('components.interactionBubble.close')"
      class="interaction-close"
      type="button"
      @click="dismissInteraction()"
    >
      ×
    </button>
    <p>{{ $t(template.promptKey) }}</p>
    <div class="interaction-choices">
      <button
        v-for="choice in template.choices"
        :key="choice.id"
        type="button"
        @click="chooseInteraction(choice.id)"
      >
        {{ $t(choice.labelKey) }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.interaction-bubble {
  position: absolute;
  inset: 8px;
  z-index: 30;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  color: #262626;
  background: rgb(255 255 255 / 94%);
  border: 1px solid rgb(0 0 0 / 10%);
  border-radius: 14px;
  box-shadow: 0 6px 20px rgb(0 0 0 / 18%);
}

.interaction-bubble p {
  margin: 0;
  padding-right: 20px;
  font-size: clamp(12px, 5vw, 16px);
  font-weight: 600;
  line-height: 1.4;
}

.interaction-close {
  position: absolute;
  top: 6px;
  right: 8px;
  padding: 2px 6px;
  font-size: 16px;
  color: #666;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.interaction-choices {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.interaction-choices button {
  flex: 1 1 auto;
  min-width: 72px;
  padding: 6px 9px;
  font-size: clamp(10px, 4vw, 13px);
  color: #333;
  background: #fff;
  border: 1px solid rgb(0 0 0 / 14%);
  border-radius: 999px;
  cursor: pointer;
}

.interaction-choices button:hover {
  background: #f3f7ff;
  border-color: #86aefb;
}
</style>
