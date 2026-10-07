<template>
  <PageHeader
    description="这一页只保留当前真正会影响界面的设置，并且支持持久保存到后端。"
    eyebrow="Configuration"
    title="系统设置"
  >
    <template #actions>
      <el-button :loading="saving" @click="resetSettings">恢复默认</el-button>
      <el-button :loading="saving" type="primary" @click="saveSettings">保存设置</el-button>
    </template>
  </PageHeader>

  <section class="grid-two settings-grid--compact">
    <article v-loading="loading" class="surface-card section-card reveal-up" style="--delay: 0.1s">
      <div class="settings-section-head">
        <div>
          <h3>基础显示</h3>
          <p>系统名称和通知提醒会在保存后同步到顶部界面，刷新页面后也会保留。</p>
        </div>
      </div>
      <el-form label-position="top">
        <el-form-item label="系统名称">
          <el-input v-model="form.systemName" />
        </el-form-item>
        <el-form-item label="通知提醒">
          <el-switch v-model="form.notificationsEnabled" />
          <div class="settings-inline-note">关闭后，顶部右侧的通知红点会隐藏。</div>
        </el-form-item>
        <el-form-item>
          <el-alert
            :closable="false"
            show-icon
            title="编辑后点击“保存设置”才会写入后端并长期保留。"
            type="info"
          />
        </el-form-item>
      </el-form>
    </article>
  </section>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getSettings, updateSettings } from '@/api/settings'
import PageHeader from '@/components/PageHeader.vue'
import { useAppStore } from '@/stores/app'
import type { AppSettings } from '@/types/settings'

const appStore = useAppStore()
const loading = ref(false)
const saving = ref(false)
const form = reactive<AppSettings>({
  systemName: '',
  notificationsEnabled: true,
})

const defaults: AppSettings = {
  systemName: 'Data Aurora Admin',
  notificationsEnabled: true,
}

const syncForm = (settings: AppSettings) => {
  form.systemName = settings.systemName
  form.notificationsEnabled = settings.notificationsEnabled
}

const loadSettings = async () => {
  loading.value = true

  try {
    const settings = await getSettings()
    appStore.applySettings(settings)
    syncForm(settings)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '系统设置加载失败')
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  saving.value = true

  try {
    const savedSettings = await updateSettings({
      systemName: form.systemName.trim(),
      notificationsEnabled: form.notificationsEnabled,
    })

    appStore.applySettings(savedSettings)
    syncForm(savedSettings)
    ElMessage.success('系统设置已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '系统设置保存失败')
  } finally {
    saving.value = false
  }
}

const resetSettings = async () => {
  saving.value = true

  try {
    const savedSettings = await updateSettings(defaults)
    appStore.applySettings(savedSettings)
    syncForm(savedSettings)
    ElMessage.success('已恢复默认设置')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '恢复默认失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  syncForm({
    systemName: appStore.systemName,
    notificationsEnabled: appStore.notificationsEnabled,
  })

  loadSettings()
})
</script>
