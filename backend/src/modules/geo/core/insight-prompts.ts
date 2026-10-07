import type { GeoSerpResultStatus } from '@prisma/client'

export interface GeoInsightResultInput {
  rank: number
  title: string
  snippet: string
  fetchStatus: GeoSerpResultStatus
  fetchMessage: string
  contentLength: number
  paragraphCount: number
  titleLength: number
  patternTags: string[]
  headingOutline: string[]
  analysisSummary: {
    titlePattern: string
    leadPreview: string
    hasHeadings: boolean
    hasListStyle: boolean
  }
  articleText: string
}

export interface GeoInsightSummaryPayload {
  rawSummary: string
  titlePatterns: string[]
  leadPatterns: string[]
  sectionBlueprint: string[]
  keywordPlacement: string[]
  sellingPointOrder: string[]
  trustSignals: string[]
  endingPatterns: string[]
  antiPatterns: string[]
  rankingHypotheses: string[]
}

const JSON_OUTPUT_RULE = `请只输出一个合法 JSON 对象，不要使用 Markdown 代码块，不要添加解释文字。

JSON 结构必须严格包含以下字段，且所有字段都必须存在：
{
  "rawSummary": "string",
  "titlePatterns": ["string"],
  "leadPatterns": ["string"],
  "sectionBlueprint": ["string"],
  "keywordPlacement": ["string"],
  "sellingPointOrder": ["string"],
  "trustSignals": ["string"],
  "endingPatterns": ["string"],
  "antiPatterns": ["string"],
  "rankingHypotheses": ["string"]
}

要求：
- 每个数组输出 2-4 条高信息密度结论
- 只写结论，不写序号前缀
- rawSummary 用一段 120-180 字中文总结，说明这类内容为什么可能排前
- 所有 JSON 键名和字符串边界只能使用 ASCII 英文双引号 "
- 如果字符串值内部需要出现引号，必须写成转义形式 \\"
- 禁止使用中文引号“”或单引号来包裹 JSON 键名或字符串
- 禁止在任何字符串值里输出未转义的双引号
- 如果输入信息不足，也要尽力给出保守结论，不允许缺字段`

export function buildProjectAiSummarySystemPrompt() {
  return `你是 GEO 搜索内容研究员。

你的任务不是重写文章，而是根据一组已经解剖过的百家号结果，提炼“这些文章为什么可能排前”的结构性规律。

请特别关注：
- 标题如何制造搜索命中和点击意图
- 开头如何快速切入用户问题
- 正文如何分段推进、安排推荐顺序和信任建立
- 关键词如何分布
- 哪些表达方式可能提高收录与点击
- 哪些写法容易显得营销过重、可信度不足或结构松散

输出必须稳定、可复用，最终会沉淀进本地规则卡。

${JSON_OUTPUT_RULE}`
}

export function buildProjectAiSummaryUserMessage(input: {
  category: string
  keyword: string
  engine: string
  analyzedCount: number
  results: GeoInsightResultInput[]
}) {
  const serializedResults = input.results
    .map((item) => {
      return {
        rank: item.rank,
        title: item.title,
        snippet: item.snippet,
        fetchStatus: item.fetchStatus,
        fetchMessage: item.fetchMessage,
        contentLength: item.contentLength,
        paragraphCount: item.paragraphCount,
        titleLength: item.titleLength,
        patternTags: item.patternTags,
        headingOutline: item.headingOutline,
        analysisSummary: item.analysisSummary,
        articleText: item.articleText,
      }
    })

  return `请基于以下研究项目生成一份结构化 AI 总结。

研究品类：${input.category}
研究主题：${input.keyword}
数据来源：${input.engine}
可用文章数：${input.analyzedCount}

文章解剖结果：
${JSON.stringify(serializedResults, null, 2)}`
}

export function buildProjectAiSummaryRetryUserMessage(input: {
  category: string
  keyword: string
  engine: string
  analyzedCount: number
  results: GeoInsightResultInput[]
}) {
  const serializedResults = input.results.map((item) => {
    return {
      rank: item.rank,
      title: item.title,
      contentLength: item.contentLength,
      paragraphCount: item.paragraphCount,
      patternTags: item.patternTags,
      headingOutline: item.headingOutline.slice(0, 4),
      analysisSummary: item.analysisSummary,
      articleText: item.articleText,
    }
  })

  return `请基于以下研究项目信息生成一份结构化 AI 总结。

要求：
- 优先保证输出完整、字段齐全、结论可落库
- 保留高价值判断，不要为了展开而牺牲结构稳定性

研究品类：${input.category}
研究主题：${input.keyword}
数据来源：${input.engine}
可用文章数：${input.analyzedCount}

文章解剖结果：
${JSON.stringify(serializedResults, null, 2)}`
}

export function buildRuleCardSystemPrompt() {
  return `你是 GEO 规则沉淀专家。

你的任务是把同一品类的一批 AI 总结，进一步归纳成“稳定、可复用、能指导后续生成”的本地规则卡。

规则卡要强调：
- 什么写法值得继承
- 什么顺序值得固定
- 什么信号要优先出现
- 什么坑要明确避免

输出目标是“策略卡”，不是自然语言长文章。

${JSON_OUTPUT_RULE}`
}

export function buildRuleCardUserMessage(input: {
  category: string
  summaryCount: number
  fromDate?: string
  toDate?: string
  summaries: GeoInsightSummaryPayload[]
}) {
  return `请把以下同一品类的 GEO AI 总结归纳成一张规则卡。

品类：${input.category}
总结数量：${input.summaryCount}
时间范围：${input.fromDate ?? '不限'} ~ ${input.toDate ?? '不限'}

历史 AI 总结：
${JSON.stringify(input.summaries, null, 2)}`
}

export function buildRuleCardRetryUserMessage(input: {
  category: string
  summaryCount: number
  fromDate?: string
  toDate?: string
  summaries: GeoInsightSummaryPayload[]
}) {
  const serializedSummaries = input.summaries.map((item) => ({
    rawSummary: item.rawSummary,
    titlePatterns: item.titlePatterns.slice(0, 3),
    leadPatterns: item.leadPatterns.slice(0, 3),
    sectionBlueprint: item.sectionBlueprint.slice(0, 3),
    keywordPlacement: item.keywordPlacement.slice(0, 3),
    sellingPointOrder: item.sellingPointOrder.slice(0, 3),
    trustSignals: item.trustSignals.slice(0, 3),
    endingPatterns: item.endingPatterns.slice(0, 3),
    antiPatterns: item.antiPatterns.slice(0, 3),
    rankingHypotheses: item.rankingHypotheses.slice(0, 3),
  }))

  return `请把以下同一品类的 GEO AI 总结归纳成一张规则卡。

要求：
- 优先保证结构稳定、字段完整
- 结论宁可精炼，也不要输出不完整 JSON

品类：${input.category}
总结数量：${input.summaryCount}
时间范围：${input.fromDate ?? '不限'} ~ ${input.toDate ?? '不限'}

压缩后的历史 AI 总结：
${JSON.stringify(serializedSummaries, null, 2)}`
}

export function buildInsightRepairSystemPrompt() {
  return `你是一个只负责结构化整理的 JSON 修复助手。

你会收到一段由上游模型生成、但格式可能损坏或不完整的内容。
你的任务不是重新分析，而是在尽量保留原意的前提下，将其整理成一个合法 JSON 对象。

${JSON_OUTPUT_RULE}`
}

export function buildInsightRepairUserMessage(input: { rawContent: string }) {
  return `请把下面这段内容整理成一个合法 JSON 对象。

要求：
- 尽量保留原始结论，不要凭空扩展
- 如果个别字段信息不足，可以给出保守、简洁的补全
- 只输出 JSON，不要解释

原始内容：
${input.rawContent}`
}
