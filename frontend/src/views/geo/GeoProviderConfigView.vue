<template>
  <section class="grid-two settings-grid--compact">
    <article v-loading="loading" class="surface-card section-card reveal-up" style="--delay: 0.1s">
      <div class="geo-provider-head">
        <div>
          <h3>Provider 信息</h3>
          <p>API Key 和 Base URL 都只在服务端保存。前端只显示是否已配置和脱敏后的提示信息，不会完整回显。</p>
        </div>
        <el-tag :type="status.hasApiKey ? 'success' : 'warning'" effect="light" round>
          {{ status.hasApiKey ? '已配置' : '未配置' }}
        </el-tag>
      </div>

      <div class="geo-provider-actions">
        <el-button :loading="loading" @click="loadConfig">重新读取</el-button>
        <el-button :loading="saving" type="primary" @click="saveConfig">保存配置</el-button>
      </div>

      <el-form label-position="top">
        <el-form-item label="API Key">
          <el-input
            v-model="form.apiKey"
            placeholder="输入新的 API Key。若当前已配置，留空表示保持不变。"
            show-password
            type="password"
          />
          <div class="geo-provider-note">
            当前状态：
            <template v-if="status.hasApiKey">已配置 {{ status.apiKeyHint }}</template>
            <template v-else>尚未配置 API Key</template>
          </div>
        </el-form-item>

        <el-form-item label="Base URL">
          <el-input
            v-model="form.baseUrl"
            placeholder="输入新的 Base URL。若当前已配置，留空表示保持不变。"
          />
          <div class="geo-provider-note">
            当前状态：
            <template v-if="status.hasBaseUrl">已配置 {{ status.baseUrlHint }}</template>
            <template v-else>尚未配置 Base URL，将默认走官方地址</template>
          </div>
        </el-form-item>

        <el-form-item label="Model">
          <el-input v-model="form.model" placeholder="如：claude-opus-4-6-20250219" />
        </el-form-item>

        <el-form-item>
          <el-alert
            :closable="false"
            :title="status.hasApiKey ? '保存后 Prompt Engine 会直接读取这里的配置。' : '完成保存后，Prompt Engine 才能真正发起生成。'"
            show-icon
            :type="status.hasApiKey ? 'success' : 'warning'"
          />
        </el-form-item>
      </el-form>
    </article>
  </section>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getGeoProviderConfig, updateGeoProviderConfig } from '@/api/geo'
import type { GeoProviderConfigView } from '@/types/geo'

const loading = ref(false)
const saving = ref(false)
const form = reactive({
  apiKey: '',
  baseUrl: '',
  model: 'claude-opus-4-6-20250219',
})
const status = reactive<GeoProviderConfigView>({
  model: 'claude-opus-4-6-20250219',
  hasApiKey: false,
  hasBaseUrl: false,
  apiKeyHint: '',
  baseUrlHint: '',
})

const applyConfig = (config: GeoProviderConfigView) => {
  status.model = config.model
  status.hasApiKey = config.hasApiKey
  status.hasBaseUrl = config.hasBaseUrl
  status.apiKeyHint = config.apiKeyHint
  status.baseUrlHint = config.baseUrlHint
  form.baseUrl = ''
  form.model = config.model
  form.apiKey = ''
}

const loadConfig = async () => {
  loading.value = true

  try {
    const config = await getGeoProviderConfig()
    applyConfig(config)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'Anthropic 配置读取失败')
  } finally {
    loading.value = false
  }
}

const saveConfig = async () => {
  saving.value = true

  try {
    const config = await updateGeoProviderConfig({
      ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      ...(form.baseUrl.trim() ? { baseUrl: form.baseUrl.trim() } : {}),
      model: form.model.trim() || 'claude-opus-4-6-20250219',
    })

    applyConfig(config)
    ElMessage.success('Anthropic 配置已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'Anthropic 配置保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.geo-provider-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.geo-provider-head h3 {
  margin: 0;
  font-size: 18px;
  color: #4f3c41;
}

.geo-provider-head p {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: #7d696e;
}

.geo-provider-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
}

.geo-provider-note {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.75;
  color: #8b767b;
}
</style>
