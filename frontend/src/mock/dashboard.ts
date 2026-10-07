export const dashboardStats = [
  { label: '平台总用户', value: '18,420', footnote: '较上周 +12.4%', accent: '增长稳定' },
  { label: '启用账号数', value: '16,970', footnote: '账号可用率 92.1%', accent: '权限稳定' },
  { label: '本周登录次数', value: '1,289', footnote: '今日新增 148 次', accent: '活跃清晰' },
  { label: '系统配置项', value: '26', footnote: '待复核 5 项', accent: '待办可控' },
]

export const dashboardActivity = [
  { time: '09:30', title: '用户导入任务完成', detail: '新增 124 个账号，来源于春季活动名单。' },
  { time: '11:10', title: '角色权限策略更新', detail: '平台管理员与运营角色的菜单可见范围已同步。' },
  { time: '14:00', title: '界面设置已同步', detail: '系统名称与通知提醒状态已更新到顶部区域。' },
  { time: '16:20', title: '账号巡检完成', detail: '今日新增与停用账号已完成一次状态复核。' },
]

export const dashboardShortcuts = [
  '创建用户',
  '批量导入',
  '角色复核',
  '调整设置',
]

export const dashboardTrend = {
  days: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  users: [1620, 1780, 1910, 2160, 2380, 2510, 2730],
  logins: [86, 92, 101, 118, 126, 138, 146],
  tasks: [74, 79, 82, 88, 91, 95, 97],
}

export const dashboardSourceDistribution = [
  { value: 42, name: '演示' },
  { value: 34, name: '用户中心' },
  { value: 24, name: '系统设置' },
]

export const dashboardEfficiency = [
  { team: '平台运营组', score: 92 },
  { team: '内容编辑组', score: 84 },
  { team: '数据治理组', score: 88 },
  { team: '系统运维组', score: 95 },
  { team: '综合支持组', score: 79 },
]

export const dashboardProjects = [
  { name: '统一账号治理', owner: '平台组', progress: 86, status: '进行中' },
  { name: '管理员权限梳理', owner: '平台组', progress: 68, status: '评审中' },
  { name: '登录策略优化', owner: '安全组', progress: 93, status: '即将完成' },
  { name: '演示页体验迭代', owner: '设计组', progress: 51, status: '进行中' },
]

export const dashboardSignals = [
  { label: '系统健康度', value: '98.6%' },
  { label: '接口成功率', value: '99.2%' },
  { label: '任务处理时效', value: '2.4h' },
]
