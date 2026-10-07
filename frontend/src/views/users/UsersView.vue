<template>
  <PageHeader
    description="展示用户、角色与账号状态的统一管理视图，保留成熟后台常见的筛选栏、表格与弹窗交互。"
    eyebrow="Management"
    title="用户中心"
  >
    <template #actions>
      <el-button plain @click="handleImport">批量导入</el-button>
      <el-button type="primary" @click="openCreateDialog">新增用户</el-button>
    </template>
  </PageHeader>

  <section class="surface-card section-card reveal-up" style="--delay: 0.1s">
    <div class="toolbar-row management-toolbar">
      <div class="toolbar-fields">
        <el-input v-model="filters.keyword" clearable placeholder="搜索用户名/姓名" style="width: 240px" />
        <el-select v-model="filters.role" placeholder="角色筛选" style="width: 160px">
          <el-option label="全部角色" value="" />
          <el-option v-for="role in roleOptions" :key="role" :label="role" :value="role" />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态筛选" style="width: 160px">
          <el-option label="全部状态" value="" />
          <el-option label="启用" value="启用" />
          <el-option label="停用" value="停用" />
        </el-select>
      </div>
      <div class="toolbar-actions">
        <el-button @click="resetFilters">重置</el-button>
        <el-button type="primary" @click="page = 1">查询</el-button>
      </div>
    </div>

    <el-table v-loading="tableLoading" :data="pagedUsers" style="width: 100%">
      <el-table-column label="ID" prop="id" width="100" />
      <el-table-column label="姓名" prop="name" />
      <el-table-column label="用户名" prop="username" />
      <el-table-column label="角色" prop="role" />
      <el-table-column label="手机号" prop="phone" />
      <el-table-column label="状态">
        <template #default="{ row }">
          <span :class="['table-tag', row.status === '启用' ? 'tag-success' : 'tag-warning']">{{ row.status }}</span>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" prop="createdAt" />
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
          <el-button link @click="toggleStatus(row)">{{ row.status === '启用' ? '停用' : '启用' }}</el-button>
          <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="table-footer">
      <div class="table-summary">共 {{ filteredUsers.length }} 条用户数据，当前展示第 {{ page }} 页</div>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[4, 6, 8]"
        background
        layout="total, sizes, prev, pager, next"
        :total="filteredUsers.length"
      />
    </div>
  </section>

  <el-dialog v-model="dialogVisible" :title="editingUser ? '编辑用户' : '新增用户'" width="520px">
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <div class="dialog-form-grid">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" />
        </el-form-item>
      </div>
      <div class="dialog-form-grid">
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 100%">
            <el-option v-for="role in roleOptions" :key="role" :label="role" :value="role" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="启用" value="启用" />
            <el-option label="停用" value="停用" />
          </el-select>
        </el-form-item>
      </div>
      <el-form-item label="手机号" prop="phone">
        <el-input v-model="form.phone" />
      </el-form-item>
      <el-form-item :label="editingUser ? '登录密码（选填）' : '登录密码' " prop="password">
        <el-input
          v-model="form.password"
          :placeholder="editingUser ? '不填写则保持原密码' : '不填写则默认使用 123456'"
          show-password
          type="password"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button :loading="submitLoading" type="primary" @click="submitForm">保存</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import type { FormInstance, FormRules } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createUser, deleteUser, getUsers, updateUser } from '@/api/users'
import PageHeader from '@/components/PageHeader.vue'
import type { UserForm, UserItem } from '@/types/user'

const roleOptions = ['平台管理员', '内容编辑', '运营专员', '数据分析师']
const userList = ref<UserItem[]>([])
const filters = reactive({
  keyword: '',
  role: '',
  status: '',
})
const page = ref(1)
const pageSize = ref(4)
const dialogVisible = ref(false)
const editingUser = ref<UserItem | null>(null)
const formRef = ref<FormInstance>()
const tableLoading = ref(false)
const submitLoading = ref(false)
const form = reactive<UserForm>({
  name: '',
  username: '',
  role: '内容编辑',
  phone: '',
  status: '启用',
  password: '',
})

const validatePassword = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback()
    return
  }

  if (value.trim().length < 6) {
    callback(new Error('密码至少 6 位'))
    return
  }

  callback()
}

const rules: FormRules<UserForm> = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
  phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
  password: [{ validator: validatePassword, trigger: 'blur' }],
}

const filteredUsers = computed(() => {
  return userList.value.filter((item) => {
    const matchKeyword =
      !filters.keyword ||
      item.name.includes(filters.keyword.trim()) ||
      item.username.includes(filters.keyword.trim())
    const matchRole = !filters.role || item.role === filters.role
    const matchStatus = !filters.status || item.status === filters.status
    return matchKeyword && matchRole && matchStatus
  })
})

const pagedUsers = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredUsers.value.slice(start, start + pageSize.value)
})

watch([filteredUsers, pageSize], () => {
  const maxPage = Math.max(1, Math.ceil(filteredUsers.value.length / pageSize.value))
  if (page.value > maxPage) page.value = maxPage
})

const resetFilters = () => {
  filters.keyword = ''
  filters.role = ''
  filters.status = ''
  page.value = 1
}

const resetForm = () => {
  form.name = ''
  form.username = ''
  form.role = '内容编辑'
  form.phone = ''
  form.status = '启用'
  form.password = ''
}

const openCreateDialog = () => {
  editingUser.value = null
  resetForm()
  dialogVisible.value = true
}

const openEditDialog = (row: UserItem) => {
  editingUser.value = row
  Object.assign(form, row, { password: '' })
  dialogVisible.value = true
}

const loadUsers = async () => {
  tableLoading.value = true

  try {
    userList.value = await getUsers()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '用户数据加载失败')
  } finally {
    tableLoading.value = false
  }
}

const submitForm = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitLoading.value = true

  try {
    const payload = {
      name: form.name.trim(),
      username: form.username.trim(),
      role: form.role,
      phone: form.phone.trim(),
      status: form.status,
      ...(form.password?.trim() ? { password: form.password.trim() } : {}),
    }

    if (editingUser.value) {
      await updateUser(editingUser.value.id, payload)
      ElMessage.success('用户信息已更新')
    } else {
      await createUser(payload)
      ElMessage.success('用户已创建，默认密码为 123456 或你填写的密码')
    }

    dialogVisible.value = false
    page.value = 1
    await loadUsers()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败，请稍后重试')
  } finally {
    submitLoading.value = false
  }
}

const handleDelete = async (row: UserItem) => {
  try {
    await ElMessageBox.confirm(`确认删除用户“${row.name}”吗？`, '删除确认', {
      type: 'warning',
    })

    await deleteUser(row.id)
    await loadUsers()
    ElMessage.success('用户已删除')
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      ElMessage.info('已取消删除')
      return
    }

    ElMessage.error(error instanceof Error ? error.message : '删除失败，请稍后重试')
  }
}

const toggleStatus = async (row: UserItem) => {
  const nextStatus = row.status === '启用' ? '停用' : '启用'

  try {
    const updatedUser = await updateUser(row.id, {
      status: nextStatus,
    })
    Object.assign(row, updatedUser)
    ElMessage.success(`用户已${updatedUser.status === '启用' ? '启用' : '停用'}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '状态更新失败')
  }
}

const handleImport = () => {
  ElMessage.success('演示环境下已模拟导入 12 条用户数据')
}

onMounted(() => {
  loadUsers()
})
</script>
