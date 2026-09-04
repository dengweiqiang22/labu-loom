<script setup lang="ts">
import { emit } from '@tauri-apps/api/event'
import { Button, Card, Empty, Flex, Popconfirm, Select, Tag } from 'antdv-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MemoryCategory, MemoryValue, StructuredMemory } from '@/domain/memory/schema'

import { LISTEN_KEY } from '@/constants'
import { MEMORY_VALUES_BY_KIND } from '@/domain/memory/schema'
import { useMemoryStore } from '@/stores/memory'

const memoryStore = useMemoryStore()
const { t } = useI18n()
const currentView = ref<'recollection' | 'management'>('recollection')
const categories: MemoryCategory[] = ['habit', 'preference', 'context', 'relationship']
const overview = computed(() => memoryStore.recollectionOverview)
const memoriesByCategory = computed(() => new Map(categories.map(category => [
  category,
  memoryStore.memories.filter(memory => memory.category === category),
])))

function valueOptions(memory: StructuredMemory) {
  return MEMORY_VALUES_BY_KIND[memory.kind].map(value => ({
    value,
    label: t(`pages.preference.memory.values.${value}`),
  }))
}

function updateValue(memory: StructuredMemory, value: MemoryValue) {
  memoryStore.updateMemoryValue(memory.id, value)
}

async function clearAllData() {
  memoryStore.clearAllData()
  await emit(LISTEN_KEY.CLEAR_MEMORY_DATA)
}
</script>

<template>
  <Flex
    gap="middle"
    vertical
  >
    <Card size="small">
      <Flex
        align="center"
        gap="middle"
        justify="space-between"
      >
        <div>
          <h2 class="m-0 text-5">
            {{ $t(`pages.preference.memory.views.${currentView}.title`) }}
          </h2>
          <p class="mb-0 color-text-tertiary">
            {{ $t(`pages.preference.memory.views.${currentView}.intro`) }}
          </p>
        </div>

        <Flex gap="small">
          <Button
            :type="currentView === 'recollection' ? 'primary' : 'default'"
            @click="currentView = 'recollection'"
          >
            {{ $t('pages.preference.memory.tabs.recollection') }}
          </Button>
          <Button
            :type="currentView === 'management' ? 'primary' : 'default'"
            @click="currentView = 'management'"
          >
            {{ $t('pages.preference.memory.tabs.management') }}
          </Button>
        </Flex>
      </Flex>
    </Card>

    <template v-if="currentView === 'recollection'">
      <Empty
        v-if="!overview.hasHistory"
        :description="$t('pages.preference.memory.recollection.empty')"
        :image="Empty.PRESENTED_IMAGE_SIMPLE"
      />

      <template v-else>
        <Card
          size="small"
          :title="$t('pages.preference.memory.recollection.footprintTitle')"
        >
          <p class="m-0 text-4">
            {{ $t('pages.preference.memory.recollection.recordedDays', {
              days: overview.totals.recordedDays,
            }) }}
          </p>
          <p
            v-if="overview.fromPeriod && overview.toPeriod"
            class="mb-0 mt-2 color-text-tertiary"
          >
            {{ $t('pages.preference.memory.recollection.recordedRange', {
              from: overview.fromPeriod,
              to: overview.toPeriod,
            }) }}
          </p>
        </Card>

        <Card
          size="small"
          :title="$t('pages.preference.memory.recollection.highlightsTitle')"
        >
          <Empty
            v-if="overview.highlights.length === 0"
            :description="$t('pages.preference.memory.recollection.highlightsEmpty')"
            :image="Empty.PRESENTED_IMAGE_SIMPLE"
          />

          <Flex
            v-else
            gap="small"
            vertical
          >
            <div
              v-for="memory in overview.highlights"
              :key="memory.id"
              class="b-1 b-solid p-3 b-border-sec rounded-lg"
            >
              <Flex
                align="center"
                gap="small"
                wrap="wrap"
              >
                <strong>{{ $t(`pages.preference.memory.kinds.${memory.kind}`) }}</strong>
                <Tag color="blue">
                  {{ $t(`pages.preference.memory.values.${memory.value}`) }}
                </Tag>
              </Flex>
              <div class="mt-1 text-3 color-text-tertiary">
                {{ $t('pages.preference.memory.sourceRange', {
                  from: memory.sourceFromDay,
                  to: memory.sourceToDay,
                }) }}
              </div>
            </div>
          </Flex>
        </Card>
      </template>
    </template>

    <template v-else>
      <Card
        v-for="category in categories"
        :key="category"
        size="small"
        :title="$t(`pages.preference.memory.categories.${category}`)"
      >
        <template #extra>
          <Popconfirm
            :description="$t('pages.preference.memory.hints.clearCategory')"
            :disabled="memoriesByCategory.get(category)?.length === 0"
            :title="$t('pages.preference.memory.buttons.clearCategory')"
            @confirm="memoryStore.clearMemoryCategory(category)"
          >
            <Button
              danger
              :disabled="memoriesByCategory.get(category)?.length === 0"
              size="small"
            >
              {{ $t('pages.preference.memory.buttons.clearCategory') }}
            </Button>
          </Popconfirm>
        </template>

        <Empty
          v-if="memoriesByCategory.get(category)?.length === 0"
          :description="$t('pages.preference.memory.empty')"
          :image="Empty.PRESENTED_IMAGE_SIMPLE"
        />

        <Flex
          v-else
          gap="small"
          vertical
        >
          <div
            v-for="memory in memoriesByCategory.get(category)"
            :key="memory.id"
            class="flex items-center justify-between gap-4 b-1 b-solid p-3 b-border-sec rounded-lg"
          >
            <div class="min-w-0 flex-1">
              <Flex
                align="center"
                gap="small"
                wrap="wrap"
              >
                <strong>{{ $t(`pages.preference.memory.kinds.${memory.kind}`) }}</strong>
                <Tag>{{ $t(`pages.preference.memory.sources.${memory.source}`) }}</Tag>
              </Flex>
              <div class="mt-1 text-3 color-text-tertiary">
                {{ $t('pages.preference.memory.sourceRange', {
                  from: memory.sourceFromDay,
                  to: memory.sourceToDay,
                }) }}
              </div>
            </div>

            <Select
              class="w-38"
              :options="valueOptions(memory)"
              :value="memory.value"
              @update:value="value => updateValue(memory, value)"
            />

            <Popconfirm
              :description="$t('pages.preference.memory.hints.forget')"
              :title="$t('pages.preference.memory.buttons.forget')"
              @confirm="memoryStore.forgetMemory(memory.id)"
            >
              <Button danger>
                {{ $t('pages.preference.memory.buttons.forget') }}
              </Button>
            </Popconfirm>
          </div>
        </Flex>
      </Card>

      <Card
        size="small"
        :title="$t('pages.preference.memory.localData')"
      >
        <Flex
          align="center"
          gap="middle"
          justify="space-between"
        >
          <span class="color-text-tertiary">
            {{ $t('pages.preference.memory.localDataSummary', {
              daily: memoryStore.dailySummaries.length,
              weekly: memoryStore.weeklySummaries.length,
              monthly: memoryStore.monthlyTrends.length,
            }) }}
          </span>

          <Popconfirm
            :description="$t('pages.preference.memory.hints.clearAll')"
            :title="$t('pages.preference.memory.buttons.clearAll')"
            @confirm="clearAllData"
          >
            <Button danger>
              {{ $t('pages.preference.memory.buttons.clearAll') }}
            </Button>
          </Popconfirm>
        </Flex>
      </Card>
    </template>
  </Flex>
</template>
