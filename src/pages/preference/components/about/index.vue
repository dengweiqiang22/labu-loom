<script setup lang="ts">
import { getTauriVersion } from '@tauri-apps/api/app'
import { appLogDir } from '@tauri-apps/api/path'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { openPath, openUrl } from '@tauri-apps/plugin-opener'
import { arch, platform, version } from '@tauri-apps/plugin-os'
import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import { Button, message, Modal } from 'antdv-next'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ProListItem from '@/components/pro-list-item/index.vue'
import ProList from '@/components/pro-list/index.vue'
import { GITHUB_LINK } from '@/constants'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const logDir = ref('')
const checkingUpdate = ref(false)
const { t } = useI18n()

onMounted(async () => {
  logDir.value = await appLogDir()
})

async function checkUpdate() {
  try {
    checkingUpdate.value = true

    const update = await check({ timeout: 5000 })

    if (!update) {
      message.success(t('components.updateApp.hints.alreadyLatest'))
      return
    }

    Modal.confirm({
      title: t('components.updateApp.title'),
      content: `v${update.currentVersion} → v${update.version}\n\n${update.body ?? ''}`,
      okText: t('components.updateApp.buttons.updateNow'),
      cancelText: t('components.updateApp.buttons.updateLater'),
      async onOk() {
        await update.downloadAndInstall()
        await relaunch()
      },
    })
  } catch (error) {
    console.error('Failed to check for updates', error)
    message.error(t('components.updateApp.hints.checkFailed'))
  } finally {
    checkingUpdate.value = false
  }
}

async function copyInfo() {
  const info = {
    appName: appStore.name,
    appVersion: appStore.version,
    tauriVersion: await getTauriVersion(),
    platform: platform(),
    platformArch: arch(),
    platformVersion: version(),
  }

  await writeText(JSON.stringify(info, null, 2))

  message.success(t('pages.preference.about.hints.copySuccess'))
}

function feedbackIssue() {
  openUrl(`${GITHUB_LINK}/issues/new/choose`)
}
</script>

<template>
  <ProList :title="$t('pages.preference.about.labels.aboutApp')">
    <ProListItem
      :description="`v${appStore.version}`"
      :title="appStore.name"
    >
      <Button
        :loading="checkingUpdate"
        type="primary"
        @click="checkUpdate"
      >
        {{ $t('pages.preference.about.buttons.checkUpdate') }}
      </Button>
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.about.hints.appInfo')"
      :title="$t('pages.preference.about.labels.appInfo')"
    >
      <Button @click="copyInfo">
        {{ $t('pages.preference.about.buttons.copy') }}
      </Button>
    </ProListItem>

    <ProListItem :title="$t('pages.preference.about.labels.openSource')">
      <Button
        danger
        @click="feedbackIssue"
      >
        {{ $t('pages.preference.about.buttons.feedbackIssues') }}
      </Button>

      <template #description>
        <a :href="GITHUB_LINK">
          {{ GITHUB_LINK }}
        </a>
      </template>
    </ProListItem>

    <ProListItem
      :description="logDir"
      :title="$t('pages.preference.about.labels.appLog')"
    >
      <Button @click="openPath(logDir)">
        {{ $t('pages.preference.about.buttons.viewLog') }}
      </Button>
    </ProListItem>
  </ProList>
</template>
