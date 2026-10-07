export type PromptEngineVersionDraftMessage = {
  role: 'user' | 'assistant'
  content: string
}

export function buildVersionDraftChatSystemPrompt() {
  return `你是一个 GEO Prompt Engine 版本策划助手。

你的任务不是直接写成品文章，而是帮助用户打磨“版本规则”。

请围绕这些方向和用户讨论：
- 这类文章适合什么目标与定位
- 标题、开头、主体结构、结尾该怎么组织
- 编号/排序应该怎么约束
- 图片占位、品牌呈现、语言风格、禁用项分别怎么定

要求：
- 回复要像产品策划和内容架构顾问，不要离题
- 可以提出建议，也可以直接帮用户沉淀规则文本
- 不要输出 JSON
- 不要替用户直接创建版本
- 如果用户给了文章或 URL，要优先结合文章特征讨论“这个版本该怎么写”`
}

export function buildVersionDraftChatUserMessage(input: {
  articleText: string
  notes: string
  messages: PromptEngineVersionDraftMessage[]
}) {
  const history = input.messages
    .map((item) => `${item.role === 'user' ? '用户' : '助手'}：${item.content}`)
    .join('\n\n')

  return `## 文章参考材料

${input.articleText || '用户这次没有提供文章正文。'}

---

## 补充要求

${input.notes || '无'}

---

## 当前对话

${history}

请继续基于以上上下文与用户对话，帮助他收敛出一个可复用的 Prompt Engine 版本规则。`
}

export function buildVersionDraftApplySystemPrompt() {
  return `你是一个 GEO Prompt Engine 版本整理助手。

请把用户与助手围绕“版本怎么写”的讨论，整理成一个可保存的版本草稿。

输出必须是严格 JSON，对象中必须包含：
- suggestedName
- suggestedDescription
- suggestedRuleText

要求：
- suggestedName 要像后台里的版本名，简洁明确
- suggestedDescription 用 1-2 句话概括版本用途
- suggestedRuleText 要整理成清晰、可直接保存的版本规则正文
- 不要把系统级固定规则重复抄进去
- 如果整理到品牌图片占位符规则，必须要求使用真实品牌名举例，例如 [海尔+图片]、[美的+图片]；禁止只写 [品牌名+图片] 这类模板
- JSON 键名和字符串边界只能使用 ASCII 英文双引号 "
- 如果字符串内容里需要出现引号，必须转义成 \"
- 禁止使用中文引号、单引号包裹 JSON 键名或字符串
- 不要输出 Markdown 代码块
- 不要输出解释文字`
}

export function buildVersionDraftApplyUserMessage(input: {
  articleText: string
  notes: string
  messages: PromptEngineVersionDraftMessage[]
}) {
  const history = input.messages
    .map((item) => `${item.role === 'user' ? '用户' : '助手'}：${item.content}`)
    .join('\n\n')

  return `## 文章参考材料

${input.articleText || '用户没有提供文章正文。'}

---

## 补充要求

${input.notes || '无'}

---

## 对话记录

${history}

请把以上讨论整理成一个可保存的版本草稿。`
}

export function buildVersionDraftRepairSystemPrompt() {
  return `你是一个 JSON 结构化修复助手。

你的任务是把一段围绕 Prompt Engine 版本草稿的原始输出，修复成一个严格合法的 JSON 对象。

输出必须满足：
- 只能输出一个 JSON 对象
- 不要输出 Markdown 代码块
- 不要输出解释文字
- JSON 键名和字符串边界只能使用 ASCII 英文双引号 "
- 如果字符串内容里需要出现引号，必须转义成 \"
- 禁止使用中文引号、单引号包裹 JSON 键名或字符串

JSON 对象必须包含：
- suggestedName
- suggestedDescription
- suggestedRuleText`
}

export function buildVersionDraftRepairUserMessage(input: { rawContent: string }) {
  return `请把下面这段原始内容修复成严格合法的 JSON 对象：

${input.rawContent}`
}
