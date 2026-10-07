import type { Component } from 'vue'
import {
  DataLine,
  Document,
  LocationInformation,
  MagicStick,
  Setting,
  User,
  VideoCamera,
} from '@element-plus/icons-vue'

export interface NavigationChildItem {
  key: string
  label: string
  path: string
  description: string
}

export interface NavigationItem {
  key: string
  label: string
  path: string
  icon: Component
  description: string
  children?: NavigationChildItem[]
}

export const navigationItems: NavigationItem[] = [
  {
    key: 'geo',
    label: 'GEO',
    path: '/geo',
    icon: LocationInformation,
    description: '管理 Prompt Engine、模型配置与后续 GEO 工具能力',
    children: [
      {
        key: 'geo-prompt-engine-v2',
        label: 'Prompt Engine（新版）',
        path: '/geo/prompt-engine',
        description: '按系统固定规则和所选版本，生成更自由的可复用 Prompt',
      },
      {
        key: 'geo-prompt-engine-legacy',
        label: 'Prompt Engine（旧版）',
        path: '/geo/prompt-engine-legacy',
        description: '保留原有百家号风格的固定引擎，适合已经验证有效的旧链路',
      },
      {
        key: 'geo-prompt-versions',
        label: '版本管理',
        path: '/geo/prompt-versions',
        description: '维护系统级固定规则与不同版本规则，并支持 AI 对话或 Markdown 导入建版',
      },
      {
        key: 'geo-prompt-batches',
        label: '批量历史',
        path: '/geo/prompt-batches',
        description: '查看旧版与新版 Prompt Engine 的后台批量任务、状态和下载结果',
      },
      {
        key: 'geo-publications',
        label: '发文反馈',
        path: '/geo/publications',
        description: '记录文章发布信息，关联提示词编号，并为后续数据抓取预留入口',
      },
      {
        key: 'geo-serp-research',
        label: 'SERP 研究',
        path: '/geo/serp-research',
        description: '研究百度前排百家号结果的写法结构与页面特征',
      },
      {
        key: 'geo-rule-cards',
        label: '规则库',
        path: '/geo/rule-cards',
        description: '按品类沉淀 AI 总结与可复用的本地规则卡',
      },
      {
        key: 'geo-anthropic-config',
        label: 'Anthropic 配置',
        path: '/geo/anthropic-config',
        description: '维护 API Key、Base URL 与模型配置',
      },
    ],
  },
  {
    key: 'geo-v3',
    label: 'GEO V3',
    path: '/geo-v3',
    icon: MagicStick,
    description: '独立维护 V3 版本、版本变量池、主推产品和 Prompt 生成快照',
    children: [
      {
        key: 'geo-v3-generate',
        label: 'Prompt 生成',
        path: '/geo-v3/generate',
        description: '选择版本和主推产品，自动使用版本绑定变量池，支持单条与批量生成 Prompt',
      },
      {
        key: 'geo-v3-generate-lite',
        label: '纯版本生成',
        path: '/geo-v3/generate-lite',
        description: '不叠加 V3 系统级固定规则，只用版本规则、变量池和产品素材生成 Prompt',
      },
      {
        key: 'geo-v3-versions',
        label: '版本管理',
        path: '/geo-v3/versions',
        description: '维护文章结构规则，以及当前版本绑定的变量池',
      },
      {
        key: 'geo-v3-products',
        label: '主推产品',
        path: '/geo-v3/products',
        description: '维护必写产品内容和随机内容池',
      },
      {
        key: 'geo-v3-runs',
        label: '生成记录',
        path: '/geo-v3/runs',
        description: '查看生成快照、Prompt 明细和 ZIP 下载',
      },
      {
        key: 'geo-v3-changelog',
        label: '迭代记录',
        path: '/geo-v3/changelog',
        description: '单独查看和维护 GEO V3 相关交付记录',
      },
    ],
  },
  {
    key: 'video',
    label: '视频',
    path: '/video-materials',
    icon: VideoCamera,
    description: '管理原始视频、拆分镜头素材和视频生成任务',
    children: [
      {
        key: 'video-materials',
        label: '素材库',
        path: '/video-materials',
        description: '导入长视频，自动拆分镜头并按产品业务分类',
      },
      {
        key: 'video-generation',
        label: '视频生成',
        path: '/video-generation',
        description: '使用 Seedance 创建单条、批量或分镜视频',
      },
    ],
  },
  {
    key: 'dashboard',
    label: '演示',
    path: '/dashboard',
    icon: DataLine,
    description: '查看演示页的总览、趋势与展示内容',
  },
  {
    key: 'changelog',
    label: '迭代记录',
    path: '/changelog',
    icon: Document,
    description: '集中查看每一轮功能交付的新增、修改与删除记录',
  },
  {
    key: 'users',
    label: '用户中心',
    path: '/users',
    icon: User,
    description: '维护账号、角色与使用状态',
  },
  {
    key: 'settings',
    label: '系统设置',
    path: '/settings',
    icon: Setting,
    description: '调整系统名称与通知提醒等基础配置',
  },
]
