<template>
  <div class="empty-state">
    <el-result icon="warning" sub-title="你访问的页面不存在，或者它还没有被加入当前项目版本。" title="404 页面未找到">
      <template #extra>
        <el-button type="primary" @click="router.push('/dashboard')">返回控制台</el-button>
      </template>
    </el-result>
  </div>
</template>

<script lang="ts" setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>
