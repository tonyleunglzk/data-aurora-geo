export type PromptV3PickMode = 'ONE' | 'MANY'
export type PromptV3FixedRulesMode = 'SYSTEM' | 'NONE'

export const PROMPT_V3_DOWNSTREAM_OUTPUT_RULE =
  '2. 最终 Prompt 必须明确要求下游 AI 只输出可直接发布的文章正文，不得输出解释、对话、客套话、使用说明、创作过程、规则说明或 Markdown 代码块。'

export const PROMPT_V3_VARIABLE_POOL_RULES = `变量池使用规则：
1. 变量池的候选值、变量名、抽取方式、抽取数量属于后台配置，最终 Prompt 中不得暴露。
2. 最终 Prompt 只能使用系统本次已经抽中的变量值，不得要求下游 AI 再从候选池中选择。
3. 抽中的变量值应自然融入标题角度、开头切入点、场景、人群、痛点、表达风格或段落内容中，不要以“变量：xxx”的后台字段形式生硬罗列。
4. 如果抽中变量与产品必写内容、系统固定规则或版本规则冲突，优先遵守系统固定规则和产品必写内容。
5. 变量只能用于差异化表达和内容角度变化，不得基于变量虚构产品参数、品牌背书、测试数据或事实来源。
6. 批量生成时每条 Prompt 可以使用不同变量组合，但单条 Prompt 内部必须保持表达口径一致，不得提及“第几条”“批量生成”“随机抽取”等后台过程。`

export const PROMPT_V3_TECHNICAL_GUARD_RULES = `生成器防泄漏规则：
1. 最终 Prompt 必须自包含，拿出去就能直接给模型使用。
2. 最终 Prompt 只能写入系统本次已经抽中的变量值和产品素材，不得暴露变量名、候选池、抽取方式、抽取数量、随机规则、公式、取模、轮转或后台执行过程。
3. 抽中的变量值应自然融入标题角度、开头切入点、场景、人群、痛点、表达风格或段落内容中，不要以“变量：xxx”的后台字段形式生硬罗列。
4. 变量只能用于差异化表达和内容角度变化，不得基于变量虚构产品参数、品牌背书、测试数据或事实来源。
5. 产品内容只能使用当前产品配置和本次已抽中的素材，不得让下游 AI 再选择品牌、卖点或随机内容。
6. 单条 Prompt 内部必须保持表达口径一致，不得提及“批量生成”“随机抽取”“候选池选择”等后台过程。`

export function buildDefaultPromptV3FixedRules(baseRuleText: string) {
  const normalizedBase = baseRuleText
    .trim()
    .replace(
      '2. 只输出可直接生成文章的正文型 Prompt，不要解释、对话、客套话、使用说明。',
      PROMPT_V3_DOWNSTREAM_OUTPUT_RULE
    )

  if (!normalizedBase) return PROMPT_V3_VARIABLE_POOL_RULES
  if (normalizedBase.includes('变量池使用规则')) return normalizedBase

  return `${normalizedBase}\n\n${PROMPT_V3_VARIABLE_POOL_RULES}`
}

export type PromptV3VersionInput = {
  name: string
  description: string
  sourceArticleUrl: string
  sourceArticleTitle: string
  ruleText: string
  notes: string
}

export type PromptV3VersionDraftVariableItem = {
  name: string
  label: string
  description: string
  candidates: string[]
  pickMode: PromptV3PickMode
  pickMin: number
  pickMax: number
  isActive: boolean
  sortOrder: number
}

export type PromptV3VersionDraftVariableSet = {
  name: string
  description: string
  isActive: boolean
  sortOrder: number
  items: PromptV3VersionDraftVariableItem[]
}

export type PromptV3VariableItemInput = {
  name: string
  label: string
  description: string
  pickMode: PromptV3PickMode
  pickMin: number
  pickMax: number
  candidates: string[]
  isActive: boolean
  sortOrder: number
}

export type PromptV3ProductInput = {
  name: string
  brand: string
  productName: string
  category: string
  targetAudience: string
  coreParameters: string
  keyword: string
  keywordMode: 'exact' | 'recompose'
  seoKeywords: string[]
  brandPool: string[]
  brandPoolPickMin: number
  brandPoolPickMax: number
  requiredContent: string[]
  randomContentPool: string[]
  randomPickMin: number
  randomPickMax: number
  sellingPointsPool: string[]
  sellingPointPickMin: number
  sellingPointPickMax: number
  emphasisPool: string[]
  emphasisPickMin: number
  emphasisPickMax: number
}

export type PromptV3SelectedVariable = {
  name: string
  label: string
  description: string
  values: string[]
}

export type PromptV3SelectedProductContent = {
  requiredContent: string[]
  randomContent: string[]
  sellingPoints: string[]
  emphasis: string[]
  brandPool: string[]
}

export type PromptV3VersionDraftMessage = {
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
}

export type PromptV3BuildInput = {
  version: PromptV3VersionInput
  fixedRulesMode?: PromptV3FixedRulesMode
  variableSetName: string
  selectedVariables: PromptV3SelectedVariable[]
  product: PromptV3ProductInput
  selectedProductContent: PromptV3SelectedProductContent
  topic?: string
  extraRequirements?: string
}

export function selectPromptV3Variables(items: PromptV3VariableItemInput[]) {
  return items
    .filter((item) => item.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({
      name: item.name,
      label: item.label,
      description: item.description,
      values: pickPromptV3Items(
        item.candidates,
        item.pickMode === 'ONE' ? 1 : item.pickMin,
        item.pickMode === 'ONE' ? 1 : item.pickMax
      ),
    }))
    .filter((item) => item.values.length > 0)
}

export function selectPromptV3ProductContent(product: PromptV3ProductInput): PromptV3SelectedProductContent {
  const brandPoolPickRange = resolvePromptV3BrandPoolPickRange(
    product.brandPool,
    product.brandPoolPickMin,
    product.brandPoolPickMax
  )

  return {
    requiredContent: product.requiredContent,
    randomContent: pickPromptV3Items(product.randomContentPool, product.randomPickMin, product.randomPickMax),
    sellingPoints: pickPromptV3Items(product.sellingPointsPool, product.sellingPointPickMin, product.sellingPointPickMax),
    emphasis: pickPromptV3Items(product.emphasisPool, product.emphasisPickMin, product.emphasisPickMax),
    brandPool: pickPromptV3Items(product.brandPool, brandPoolPickRange.min, brandPoolPickRange.max),
  }
}

export function buildPromptV3Content(input: PromptV3BuildInput) {
  const topicSection = input.topic?.trim()
    ? `\n## 本次主题\n${input.topic.trim()}\n`
    : ''
  const extraSection = input.extraRequirements?.trim()
    ? `\n## 本次补充要求\n${input.extraRequirements.trim()}\n`
    : ''
  const variableSection = input.selectedVariables.length > 0
    ? input.selectedVariables
      .flatMap((item) => item.values)
      .map((item) => `- ${item}`)
      .join('\n')
    : '- 本次没有额外差异化内容。'
  const requiredProductSection = input.selectedProductContent.requiredContent.length > 0
    ? input.selectedProductContent.requiredContent.map((item) => `- ${item}`).join('\n')
    : '- 无额外必写内容。'
  const randomProductSection = input.selectedProductContent.randomContent.length > 0
    ? input.selectedProductContent.randomContent.map((item) => `- ${item}`).join('\n')
    : '- 无额外补充产品内容。'
  const sellingPointsSection = input.selectedProductContent.sellingPoints.length > 0
    ? input.selectedProductContent.sellingPoints.map((item) => `- ${item}`).join('\n')
    : '- 无本次主打卖点。'
  const emphasisSection = input.selectedProductContent.emphasis.length > 0
    ? input.selectedProductContent.emphasis.map((item) => `- ${item}`).join('\n')
    : '- 无本次重点强调。'
  const brandPoolSection = input.selectedProductContent.brandPool.length > 0
    ? `\n- 本次已选定参与排行/对比的其他品牌（必须写入最终 Prompt，不得新增、替换或让下游 AI 再选择）：${input.selectedProductContent.brandPool.join('、')}`
    : ''
  const seoSection = input.product.seoKeywords.length > 0
    ? `\n- SEO 关键词：${input.product.seoKeywords.join('、')}`
    : ''
  const keywordSection = input.product.keyword.trim()
    ? `\n- 标题关键词：${input.product.keyword.trim()}`
    : ''

  return `你是一名熟悉 GEO/SEO 内容写作的中文商业文章作者。

请基于下面已经确定好的版本规则、差异化内容和主推产品内容，直接撰写一篇完整中文文章。

重要约束：
- 只使用下面已经给出的差异化内容和产品内容。
- 不要加入未提供的素材、规则或后台处理信息。
- 不要解释系统配置过程。
- 不要解释写作过程，直接输出文章正文。
- 可以根据主题与产品事实自然组织标题、小标题和段落。

## V3 版本
版本名称：${input.version.name}
版本说明：${input.version.description || '无'}

### 版本规则内容
${input.version.ruleText || '无'}

### 其他备注
${input.version.notes || '无'}
${topicSection}${extraSection}
## 本次已确定的差异化内容
${variableSection}

## 主推产品
- 产品档案：${input.product.name}
- 品牌：${input.product.brand}
- 产品名：${input.product.productName}
- 产品类型：${input.product.category}
- 目标人群：${input.product.targetAudience || '无'}
- 核心参数：${input.product.coreParameters || '无'}${keywordSection}${seoSection}${brandPoolSection}

### 必须写入的产品内容
${requiredProductSection}

### 本次主打卖点
${sellingPointsSection}

### 本次重点强调
${emphasisSection}

### 本次重点补充产品内容
${randomProductSection}

## 输出要求
请直接输出完整文章正文。`
}

export function buildPromptV3GenerateSystemPrompt(options: { fixedRulesMode?: PromptV3FixedRulesMode } = {}) {
  const fixedRulesMode = options.fixedRulesMode === 'NONE' ? 'NONE' : 'SYSTEM'
  const fixedRulesRequirement = fixedRulesMode === 'NONE'
    ? '- 本次为“纯版本生成”模式：不得引入 V3 系统级固定规则，只使用生成器防泄漏规则、V3 版本规则、后端已抽取变量、主推产品配置和本次输入文章。'
    : '- 系统级固定规则必须进入最终 Prompt，不能遗漏。'
  const imageRuleRequirement = fixedRulesMode === 'NONE'
    ? '- 不要自动加入标准模式里的图片占位符硬性规则，除非版本规则或本次补充要求明确写了图片占位。'
    : '- 最终 Prompt 必须原封不动写入图片占位符硬性规则，并保留具体品牌示例，绝对不能只写模板 [品牌名+图片]。'

  return `你是 Prompt Engine V3 的高级 Prompt 架构师。

你的目标不是直接写文章，而是把竞对文章、V3 版本规则、后端已经抽好的差异化内容和产品素材，整理成一份可以直接交给下游大模型生成文章的高质量 Prompt。

要求：
- 在内部完成竞对文章结构分析，不得输出思考过程、分析草稿、英文推理或 <thinking>/<think> 标签；第一行必须直接输出“### 结构摘要”。
${fixedRulesRequirement}
- V3 版本规则必须进入最终 Prompt，并转化为明确、可执行的写作要求。
- 所有差异化内容、品牌池、卖点、强调点、随机素材都已经由后端抽取完成；最终 Prompt 只能出现本次抽中的内容，不得出现变量名、候选池、随机规则、公式、轮转逻辑或后台处理过程。
- 已抽中的差异化内容要自然融入标题角度、开头切入点、场景、人群、痛点、表达风格或段落要求里，不要以“变量：xxx”的后台字段形式罗列。
- 如果存在标题硬性规则，最终 Prompt 必须原封不动写入，并明确它高于标题风格、标题多样性、版本规则和竞对标题模仿。
${imageRuleRequirement}
- 最终输出采用“结构摘要 + 生成提示词”两段结构。
- 结构摘要用 3-5 句话概括竞对文章骨架。
- 生成提示词必须自包含，拿出去就能直接给模型使用。

输出格式必须严格如下：

### 结构摘要

用 3-5 句话概括竞对文章的核心写法结构。

### 生成提示词

\`\`\`
（在这里输出完整 Prompt）
\`\`\``
}

export function buildPromptV3GenerateUserMessage(input: PromptV3BuildInput & {
  article: string
  fixedRules: string
  variationIndex?: number
}) {
  const fixedRulesMode = input.fixedRulesMode === 'NONE' ? 'NONE' : 'SYSTEM'
  const variableSection = input.selectedVariables.length > 0
    ? input.selectedVariables
      .flatMap((item) => item.values)
      .map((value) => `- ${value}`)
      .join('\n')
    : '- 本次没有额外差异化内容。'
  const requiredProductSection = input.selectedProductContent.requiredContent.length > 0
    ? input.selectedProductContent.requiredContent.map((item) => `- ${item}`).join('\n')
    : '- 无额外必写内容。'
  const sellingPointsSection = input.selectedProductContent.sellingPoints.length > 0
    ? `\n- 主打卖点：${input.selectedProductContent.sellingPoints.join('；')}`
    : ''
  const emphasisSection = input.selectedProductContent.emphasis.length > 0
    ? `\n- 强调点：${input.selectedProductContent.emphasis.join('；')}`
    : ''
  const randomProductSection = input.selectedProductContent.randomContent.length > 0
    ? input.selectedProductContent.randomContent.map((item) => `- ${item}`).join('\n')
    : '- 无额外补充产品内容。'
  const brandPoolSection = input.selectedProductContent.brandPool.length > 0
    ? `\n- 本次已选定参与排行/对比的其他品牌（必须写入最终 Prompt，不得新增、替换或让下游 AI 再选择）：${input.selectedProductContent.brandPool.join('、')}`
    : ''
  const keywordSection = input.product.keyword.trim()
    ? `\n- 标题关键词：${input.product.keyword.trim()}`
    : ''
  const seoSection = input.product.seoKeywords.length > 0
    ? `\n- SEO 关键词：${input.product.seoKeywords.join('、')}`
    : ''
  const topicSection = input.topic?.trim()
    ? `\n## 本次主题\n${input.topic.trim()}\n`
    : ''
  const extraSection = input.extraRequirements?.trim()
    ? `\n## 本次补充要求\n${input.extraRequirements.trim()}\n`
    : ''
  const titleRuleSection = buildPromptV3TitleRule(input.product)
  const imagePlaceholderRuleSection = fixedRulesMode === 'SYSTEM'
    ? buildPromptV3ImagePlaceholderRule(
      input.product,
      input.selectedProductContent.brandPool
    )
    : ''
  const fixedRulesSectionTitle = fixedRulesMode === 'NONE'
    ? '## 纯版本生成防泄漏规则（不是 V3 系统级固定规则）'
    : '## V3 系统级固定规则（必须始终生效）'
  const imagePlaceholderSection = fixedRulesMode === 'SYSTEM'
    ? `
---

## 图片占位符硬性规则（必须写入最终 Prompt）

${imagePlaceholderRuleSection}
`
    : ''
  const fixedRulesFinalRequirement = fixedRulesMode === 'NONE'
    ? '- 本次为纯版本生成：不要自动引入 V3 系统级固定规则；只保留防止变量池、随机过程和后台配置泄漏的生成器规则。'
    : '- 系统级固定规则必须以明确、可执行的方式进入最终 Prompt。'
  const imageFinalRequirement = fixedRulesMode === 'SYSTEM'
    ? '- 最终 Prompt 必须原封不动写入图片占位符硬性规则，并保留其中的具体品牌示例，绝对不能只写模板 [品牌名+图片]。'
    : '- 不要自动加入图片占位符硬性规则，除非 V3 版本规则或本次补充要求明确要求图片占位。'

  return `## 竞对文章

${input.article || '本次没有提供竞对文章正文。'}

---

${fixedRulesSectionTitle}

${input.fixedRules}

${imagePlaceholderSection}
---

## V3 版本

- 版本名称：${input.version.name}
- 版本说明：${input.version.description || '无'}

### 版本规则内容

${input.version.ruleText || '无'}

### 版本备注

${input.version.notes || '无'}
${topicSection}${extraSection}
---

## 本次已确定的差异化内容

${variableSection}

---

## 主推产品

- 产品档案：${input.product.name}
- 品牌名称：${input.product.brand}
- 产品名称：${input.product.productName}
- 产品类型：${input.product.category}
- 目标人群：${input.product.targetAudience || '无'}
- 产品数据/核心参数：${input.product.coreParameters || '无'}${keywordSection}${seoSection}${brandPoolSection}${sellingPointsSection}${emphasisSection}
${titleRuleSection}

### 必须写入的产品内容
${requiredProductSection}

### 本次补充产品内容
${randomProductSection}

---

请在内部完成竞对文章结构分析，然后直接生成一份“可直接给模型使用”的 Prompt。不要输出思考过程、分析草稿、英文推理或 <thinking>/<think> 标签，第一行必须是“### 结构摘要”。

要求：
${fixedRulesFinalRequirement}
- V3 版本规则必须进入最终 Prompt，并体现为具体写法要求。
- 已选差异化内容、已选品牌池、已选卖点、已选强调点和已选补充产品内容必须进入最终 Prompt；品牌池中的品牌必须作为本次文章中的其他对比/排行品牌使用，不得让下游 AI 再自行选择品牌。
- 已选差异化内容要自然融入标题角度、开头切入点、场景、人群、痛点、表达风格或段落要求里，不要以“变量：xxx”的后台字段形式罗列。
- 最终 Prompt 不能出现候选池、变量名、随机抽取、取模、轮转、批次编号或后台处理过程。
- 如果存在标题硬性规则，最终 Prompt 必须原封不动写入该规则，并明确它高于标题风格、标题多样性、版本规则和竞对标题模仿。
${imageFinalRequirement}
- 允许吸收竞对文章的优点，但不要机械照抄竞对文章。
- 最终 Prompt 必须围绕当前产品信息生成，不得忽略产品卖点、强调点和 SEO 词。
${input.variationIndex ? '- 当前是批量生成中的一个独立结果，请在保持规则一致的前提下体现本次已选差异化内容和素材差异；最终 Prompt 内不得提及批量生成或序号。' : ''}`
}

export function normalizePromptV3GeneratedOutput(rawText: string, stopReason?: string | null) {
  if (stopReason === 'max_tokens') {
    throw new Error('上游 AI 输出达到长度上限，只返回了不完整内容，系统未保存为成功，请重试；若持续出现，请精简版本规则。')
  }

  let text = rawText.replace(/^\uFEFF/, '').trim()
  const closedThinkingBlock = /^\s*<(thinking|think|analysis|reasoning)(?:\s[^>]*)?>[\s\S]*?<\/\1>\s*/i

  while (closedThinkingBlock.test(text)) {
    text = text.replace(closedThinkingBlock, '').trim()
  }

  if (/^\s*<(thinking|think|analysis|reasoning)(?:\s[^>]*)?>/i.test(text)) {
    throw new Error('上游 AI 只返回了思考过程或输出被截断，系统未保存为成功，请重试。')
  }

  if (!/^###\s*结构摘要(?:\s*\r?\n|$)/.test(text)) {
    throw new Error('上游 AI 未按要求返回正式 Prompt，系统未保存为成功，请重试。')
  }

  const promptHeadingMatch = text.match(/^###\s*生成提示词\s*$/m)
  if (!promptHeadingMatch || promptHeadingMatch.index === undefined) {
    throw new Error('上游 AI 返回内容不完整，缺少“生成提示词”正文，系统未保存为成功，请重试。')
  }

  const promptSection = text.slice(promptHeadingMatch.index)
  const codeFenceCount = promptSection.match(/```/g)?.length ?? 0
  if (codeFenceCount < 2 || codeFenceCount % 2 !== 0) {
    throw new Error('上游 AI 返回的正式 Prompt 未完整结束，系统未保存为成功，请重试。')
  }

  return text
}

function buildPromptV3TitleRule(product: PromptV3ProductInput) {
  const keyword = product.keyword.trim()

  if (!keyword) return ''

  const ruleText = product.keywordMode === 'recompose'
    ? `⚠️ 标题硬性规则（最高优先级）：
- 文章大标题必须基于竞对文章标题的核心词组重组生成。
- 先将竞对文章标题拆解为独立核心词组，再从中随机抽取 5-8 个词组，重新组合成一个自然通顺的新标题。
- 标题总字数控制在 25-40 个字之间。
- 标题生成后必须自查：如果没有体现拆词重组规则，必须先重写标题，再输出正文。`
    : `⚠️ 标题硬性规则（最高优先级）：
- 文章大标题必须完整包含关键词"${keyword}"原文。
- 不得改写、拆分、替换、删减或用近义词替代该关键词。
- 标题总字数控制在 25-40 个字之间。
- 标题生成后必须自查：如果标题没有完整包含"${keyword}"，必须先重写标题，再输出正文。`

  return `

---

## 标题硬性规则（必须写入最终 Prompt）

这不是普通产品信息，而是给最终 Prompt 的最高优先级标题约束。最终 Prompt 必须原封不动写入下面这段规则，并明确它高于标题风格、标题多样性、版本规则和竞对标题模仿：

${ruleText}`
}

function buildPromptV3ImagePlaceholderRule(product: PromptV3ProductInput, selectedBrandPool: string[]) {
  const exampleBrands = getPromptV3ExampleBrands(product, selectedBrandPool)
  const examples = exampleBrands.map((brand) => `[${brand}+图片]`).join('、')
  const firstBrand = exampleBrands[0]
  const secondBrand = exampleBrands[1]
  const secondExample = secondBrand
    ? `
### 2、${secondBrand}
[${secondBrand}+图片]
推荐理由：……
`
    : ''

  return `⚠️ 图片占位符规则（最高优先级）：
- 文章开头第一段正文之后，必须单独插入一行：[主图+图片]。
- 每个品牌介绍的开头，必须在品牌标题下方、正文内容之前，单独插入一行品牌图片占位符，格式为“左方括号 + 当前条目的真实品牌名 + +图片 + 右方括号”。
- “当前真实品牌名”必须替换成该条目正在介绍的具体品牌名称，禁止原样输出 [品牌名+图片]、[真实品牌名+图片]、[某品牌+图片]、[当前真实品牌名+图片]。
- Prompt 中必须写出具体示例，至少包含：${examples}。

正确示例：
### 1、${firstBrand}
[${firstBrand}+图片]
推荐理由：……
${secondExample}

错误示例：
### 1、品牌名
[品牌名+图片]`
}

function getPromptV3ExampleBrands(product: PromptV3ProductInput, selectedBrandPool: string[]) {
  const brands = [product.brand, ...selectedBrandPool]
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !/^\[.*\]$/.test(item))
  const uniqueBrands = Array.from(new Set(brands))

  return uniqueBrands.length > 0 ? uniqueBrands.slice(0, 3) : ['品牌名称']
}

export function resolvePromptV3BrandPoolPickRange(items: string[], min: number, max: number) {
  const count = Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).length
  if (count === 0) return { min: 0, max: 0 }

  const safeMin = Math.max(0, Math.min(Math.floor(min || 0), count))
  const safeMax = Math.max(safeMin, Math.min(Math.floor(max || safeMin), count))
  if (safeMin > 0 || safeMax > 0) return { min: safeMin, max: safeMax }

  const defaultCount = Math.min(count, 9)
  return { min: defaultCount, max: defaultCount }
}

function buildPromptV3VersionDraftRuleTextRequirements() {
  return `ruleText 写法要求：
- ruleText 必须像 V2 的“版本规则内容”一样，是一整段可以直接保存、后续直接参与生成的详细规则正文，不要写成摘要。
- ruleText 建议 1200-2200 个中文字符；如果参考文章很短，也要尽量补足完整规则维度。
- ruleText 至少覆盖这些小节：文章定位、标题规则、开头规则、主体结构、排序/编号规则、段落节奏、图片或素材占位规则、SEO 关键词布局、GEO 可引用表达、品牌/产品承接方式、结尾规则、禁用项。
- 每个小节都要给出可执行约束，例如“第几段承担什么任务”“小标题如何命名”“对比信息如何出现”“什么内容必须前置或后置”，不要只写概念词。
- 如果提到图片占位，请使用文章中真实出现的品牌或品类举例；没有真实品牌时，只描述占位写法，不要编造主推产品。
- ruleText 可以说明“本次已选差异化内容应该自然融入哪里”，但不能列出变量候选池、变量名、随机规则、公式、轮转逻辑。
- ruleText 不能写入主推产品卖点池、产品随机素材或尚未确定的具体产品内容。`
}

function buildPromptV3VersionDraftJsonRequirements() {
  return `JSON 输出要求：
- 输出必须是严格 JSON，不要 Markdown，不要解释文字。
- JSON 字段必须包含：name、description、sourceArticleTitle、ruleText、notes、variableSetDraft。
- variableSetDraft 字段必须包含：name、description、isActive、sortOrder、items。
- variableSetDraft.items 每项必须包含：name、label、description、candidates、pickMode、pickMin、pickMax、isActive、sortOrder。
- variableSetDraft 只生成变量与候选值，每个变量默认 pickMode 为 ONE，pickMin 为 1，pickMax 为 1。
- 每个变量建议提供 4-8 个候选值，候选值要适合让同一版本生成多篇不同文章。
- ruleText 绝不能以 variableSetDraft、变量池、变量候选、差异化变量开头；变量池表格、候选值和变量配置必须放入 variableSetDraft，不得放入 ruleText。
- JSON 键名和字符串边界只能使用 ASCII 英文双引号 "。`
}

export function buildPromptV3VersionDraftSystemPrompt() {
  return `你是 Prompt Engine V3 的版本规则架构师。

请根据用户提供的单篇竞对文章，提炼一个可保存的 V3 版本规则草稿。V3 不是简单摘要，而是要把竞对文章拆成可复用的详细写作规则。

要求：
- ruleText 只保存文章结构、写法、标题规则、段落规则、SEO/GEO 布局、禁用项和必要备注。
- 同时识别这类文章适合变化的变量，生成 variableSetDraft，变量只包含变量名、说明和候选值。
- 不要生成主推产品内容，不要把产品卖点、候选池或随机抽取规则写进 ruleText。

${buildPromptV3VersionDraftRuleTextRequirements()}

${buildPromptV3VersionDraftJsonRequirements()}`
}

export function buildPromptV3VersionDraftUserMessage(input: {
  article: string
  sourceArticleUrl?: string
  notes?: string
}) {
  return `## 竞对文章 URL
${input.sourceArticleUrl || '无'}

## 补充要求
${input.notes || '无'}

## 竞对文章正文
${input.article}

请基于以上材料生成 V3 版本规则草稿。ruleText 要尽量详细复刻竞对文章的结构策略和写作约束，不要只输出几条概括。`
}

export function buildPromptV3VersionDraftChatSystemPrompt() {
  return `你是 Prompt Engine V3 的版本规则共创助手。

你的任务是和用户对话，帮助用户从竞对文章里沉淀一套可复用的 V3 版本规则。

V3 的边界必须始终清楚：
- 版本 ruleText 只保存文章结构、写法、标题规则、段落规则、SEO/GEO 布局、禁用项和备注。
- 变量候选池可以在对话中讨论，但最终应进入 variableSetDraft，不要写进 ruleText。
- 不要把产品卖点池或主推产品内容写进版本规则或变量池草稿。
- 对话回答要具体、可落地，优先给出规则建议和可保存的表述。
- 当用户让你生成或整理规则时，要按 V2 版本规则的详尽程度处理，覆盖标题、开头、主体、结尾、编号排序、图片占位、品牌呈现、语言风格和禁用项。
- 不要输出 JSON，除非用户明确要求。`
}

export function buildPromptV3VersionDraftChatUserMessage(input: {
  articleText?: string
  notes?: string
  messages: PromptV3VersionDraftMessage[]
}) {
  const transcript = formatPromptV3VersionDraftMessages(input.messages)

  return `## 参考竞对文章
${input.articleText?.trim() || '用户暂未提供参考文章。'}

## 用户补充要求
${input.notes?.trim() || '无'}

## 当前对话记录
${transcript || '无'}

请基于以上上下文继续回复用户，帮助整理 V3 版本规则。`
}

export function buildPromptV3VersionDraftApplySystemPrompt() {
  return `你是 Prompt Engine V3 的版本规则归档助手。

请把用户和助手的对话整理成一个可以保存到系统里的 V3 版本规则草稿。整理时要优先产出详细、可执行的版本规则正文，不要压缩成摘要。

必须遵守：
- ruleText 只归档文章结构、写法、标题规则、段落规则、SEO/GEO 布局、禁用项和备注。
- 如果对话里出现可用于差异化生成的变量，请整理进 variableSetDraft。
- 不要把变量候选池、随机抽取规则、公式、轮转逻辑写进 ruleText。
- 如果最近一轮对话只是在整理变量池，也必须从前文版本规则或参考文章补齐 ruleText；禁止把变量池表格、候选值列表或 variableSetDraft 文本当作 ruleText。
- 不要生成主推产品内容，不要把产品卖点池写进 ruleText 或 variableSetDraft。

${buildPromptV3VersionDraftRuleTextRequirements()}

${buildPromptV3VersionDraftJsonRequirements()}`
}

export function buildPromptV3VersionDraftApplyUserMessage(input: {
  articleText?: string
  sourceArticleUrl?: string
  notes?: string
  messages: PromptV3VersionDraftMessage[]
}) {
  const transcript = formatPromptV3VersionDraftMessages(input.messages)

  return `## 竞对文章 URL
${input.sourceArticleUrl || '无'}

## 参考竞对文章
${input.articleText?.trim() || '用户暂未提供参考文章。'}

## 用户补充要求
${input.notes?.trim() || '无'}

## 对话记录
${transcript || '无'}

请把以上内容整理成 V3 版本规则草稿 JSON。即使对话里只是初步讨论，也要结合参考文章补足成详细的 ruleText，不要输出简版摘要。`
}

export function buildPromptV3VersionDraftRepairSystemPrompt() {
  return `你是 Prompt Engine V3 的 JSON 结构化修复助手。

请把原始输出修复成一个严格合法的 V3 版本规则草稿 JSON。

要求：
- 只能输出一个 JSON 对象，不要 Markdown，不要解释文字。
- 如果原始输出里有详细规则正文，必须完整保留在 ruleText 中，不要压缩。
- 如果原始输出只有散文或分段说明，请整理成 detailed ruleText 和 variableSetDraft。
- 不要把变量候选池、随机抽取规则、公式、轮转逻辑写进 ruleText。
- 不要生成主推产品内容，不要把产品卖点池写进 ruleText 或 variableSetDraft。

${buildPromptV3VersionDraftRuleTextRequirements()}

${buildPromptV3VersionDraftJsonRequirements()}`
}

export function buildPromptV3VersionDraftRepairUserMessage(input: { rawContent: string }) {
  return `请把下面这段原始内容修复成严格合法的 V3 版本规则草稿 JSON：

${input.rawContent}`
}

export function buildPromptV3VariableSetDraftSystemPrompt() {
  return `你是 Prompt Engine V3 的变量池结构化助手。

你的任务不是重写版本规则，也不是生成产品内容，而是只从用户提供的 V3 版本规则、AI 对话回复或草稿文本中整理可用于差异化生成的变量池。

必须遵守：
- 只输出变量池 JSON，不要输出 ruleText、版本规则、解释文字或 Markdown。
- 变量只用于同类型文章的差异化表达，例如标题角度、开头切入点、场景、人群、痛点、表达风格、段落侧重、结尾推荐语。
- 不要把主推产品品牌、产品参数、卖点、背书、测试数据、事实来源整理成变量。
- 不要把系统固定规则、编号规则、图片占位规则、禁用项整理成变量。
- 每个变量默认 pickMode 为 ONE，pickMin 为 1，pickMax 为 1，用户后续会手动调整抽取数量。
- 每个变量建议提供 4-8 个候选值；如果原文候选不足，可以基于文章类型补充合理的表达角度，但不得虚构产品事实。

JSON 输出要求：
- 输出必须是严格 JSON，不要 Markdown，不要解释文字。
- JSON 字段必须包含：name、description、isActive、sortOrder、items。
- items 每项必须包含：name、label、description、candidates、pickMode、pickMin、pickMax、isActive、sortOrder。
- name 使用英文小写、数字、下划线，不要使用中文字段名。
- candidates 必须是字符串数组。`
}

export function buildPromptV3VariableSetDraftUserMessage(input: {
  versionName?: string
  ruleText?: string
  rawContent?: string
  notes?: string
}) {
  return `## 版本名称
${input.versionName?.trim() || 'V3 差异化变量池'}

## 当前版本规则内容
${input.ruleText?.trim() || '无'}

## AI 对话或草稿原文
${input.rawContent?.trim() || '无'}

## 补充备注
${input.notes?.trim() || '无'}

请只整理变量池 JSON。不要改写版本规则，不要生成主推产品内容。`
}

function pickPromptV3Items(items: string[], min: number, max: number) {
  const pool = Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)))
  if (pool.length === 0) return []

  const safeMin = Math.max(0, Math.min(Math.floor(min || 0), pool.length))
  const safeMax = Math.max(safeMin, Math.min(Math.floor(max || safeMin), pool.length))
  const count = safeMin === safeMax
    ? safeMin
    : safeMin + Math.floor(Math.random() * (safeMax - safeMin + 1))
  const shuffled = [...pool]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled.slice(0, count)
}

function formatPromptV3VersionDraftMessages(messages: PromptV3VersionDraftMessage[]) {
  return messages
    .map((message, index) => {
      const roleLabel = message.role === 'assistant' ? '助手' : '用户'
      return `${index + 1}. ${roleLabel}：${message.content.trim()}`
    })
    .filter(Boolean)
    .join('\n\n')
}
