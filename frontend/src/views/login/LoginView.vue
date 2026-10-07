<template>
  <div class="login-shell">
    <section class="login-hero">
      <div class="hero-kicker">Data Aurora Admin</div>
      <h1 class="hero-title">像成熟后台那样稳定，又比传统后台更轻盈。</h1>
      <p class="hero-copy">
        这是一套面向真实业务扩展的通用管理系统前端，布局采用顶部横向导航，方便后续承载用户、内容、数据与配置等各类模块。
      </p>

      <div class="hero-points">
        <div class="hero-point">
          <strong>Top Navigation</strong>
          <span>顶部横向导航，适合平台型系统与多模块扩展。</span>
        </div>
        <div class="hero-point">
          <strong>Reusable Pages</strong>
          <span>控制台、列表页、设置页都采用可复用的后台模板。</span>
        </div>
        <div class="hero-point">
          <strong>Mock First</strong>
          <span>先搭稳页面与流程，再按模块逐步接入真实接口。</span>
        </div>
        <div class="hero-point">
          <strong>Ready to Scale</strong>
          <span>结构清楚，便于后续继续扩展业务模块与后端能力。</span>
        </div>
      </div>
    </section>

    <section class="login-panel">
      <div class="login-form-card">
        <h1>欢迎登录</h1>
        <p>请输入账号信息进入 Data Aurora Admin。</p>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          autocomplete="off"
          label-position="top"
          @submit.prevent
        >
          <el-form-item label="用户名" prop="username">
            <el-input
              v-model="form.username"
              autocomplete="off"
              name="data-aurora-login-account"
              placeholder="请输入用户名"
              size="large"
            />
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              autocomplete="new-password"
              name="data-aurora-login-password"
              placeholder="请输入密码"
              show-password
              size="large"
              type="password"
            />
          </el-form-item>

          <el-button :loading="loading" size="large" style="width: 100%" type="primary" @click="handleLogin">
            进入管理系统
          </el-button>
        </el-form>
      </div>
    </section>
  </div>
</template>

<script lang="ts" setup>
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { loginApi } from '@/api/auth'
import { useAppStore } from '@/stores/app'

interface LoginForm {
  username: string
  password: string
}

const appStore = useAppStore()
const router = useRouter()
const route = useRoute()
const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive<LoginForm>({
  username: '',
  password: '',
})

const rules: FormRules<LoginForm> = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const handleLogin = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true

  try {
    const session = await loginApi({
      username: form.username.trim(),
      password: form.password,
    })

    appStore.login(session.accessToken, session.user)
    ElMessage.success(`欢迎回来，${session.user.name}`)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await router.push(redirect)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '登录失败，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>
