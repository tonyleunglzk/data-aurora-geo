import type { ProductInfo } from './types'

export const DEFAULT_PROMPT_ENGINE_V2_FIXED_RULES = `1. 不允许任何链接、来源标注、参考资料、跳转引导文案。
2. 只输出可直接生成文章的正文型 Prompt，不要解释、对话、客套话、使用说明。
3. 核心 SEO 词要自然进入标题、开头段落、结尾总结段；次级 SEO 词自然分布，禁止堆砌。
4. 输出内容必须围绕当前产品信息和输入文章展开，不允许偏题或漂移。
5. 可以引用数据和参数增强说服力，但不要附出处说明或“据某平台/某媒体”之类表达。
6. Prompt 必须自包含，拿出去就能直接给模型使用。
7. 编号规则必须清晰、稳定、可延续，不能为了花样频繁切换格式。
8. 同一层级的编号格式必须全文统一，不能混用 1、 / 1. / 品牌 1： / TOP1 / No.1 等不同形式。
9. 一个条目只能保留一套编号，禁止双重编号。
10. 禁止使用无法覆盖完整列表的特殊编号形式，例如 🥇🥈🥉。
11. 生成结果在输出前要自查编号一致性，发现格式混搭时必须先修正。
12. 文章开头第一段正文之后，插入:[主图+图片]。
13. 每个品牌介绍开头必须插入一行品牌图片占位符，格式为“左方括号 + 当前条目的真实品牌名 + +图片 + 右方括号”；禁止原样输出 [品牌名+图片]、[真实品牌名+图片]、[某品牌+图片]。Prompt 中必须提供至少 2 个具体示例，例如 [海尔+图片]、[美的+图片]。`

export function buildPromptEngineV2SystemPrompt() {
  return `你是一个 GEO Prompt 架构师。

你的目标不是复制旧版 Prompt Engine 的固定模板，而是：
1. 分析用户提供的竞对文章或竞对正文
2. 结合系统级固定规则、所选版本规则与产品信息
3. 生成一个可直接交给任意大模型使用的高质量 Prompt

要求：
- 允许吸收竞对文章的结构优点，但不要机械复刻
- 系统级固定规则必须被纳入最终 Prompt，不能遗漏
- 版本规则必须被纳入最终 Prompt，并体现为明确的写作要求
- 如果固定规则与版本规则存在张力，优先遵守系统级固定规则
- 如果用户提供了标题硬性规则，最终 Prompt 必须把标题硬性规则放在高优先级位置，不能只把标题关键词当作普通产品信息
- 所有随机、轮转、候选池选择、模块组合、编号自查等内部执行逻辑，只能在生成 Prompt 之前完成；最终 Prompt 只能保留已经选定的写作结果和自然语言要求，绝对不要出现变量名、公式、取模、随机值计算、模块编号或规则执行过程
- 最终输出仍然采用“结构摘要 + 生成提示词”两段结构
- 结构摘要用于解释竞对文章骨架
- 生成提示词必须能被直接复制使用

输出格式必须严格如下：

### 结构摘要

用 3-5 句话概括竞对文章的核心写法结构。

### 生成提示词

\`\`\`
（在这里输出完整 Prompt）
\`\`\``
}

export function buildPromptEngineV2UserMessage(input: {
  article: string
  product: ProductInfo
  fixedRules: string
  version: {
    name: string
    description: string
    ruleText: string
  }
  variationIndex?: number
}) {
  const { article, product, fixedRules, version, variationIndex } = input
  const selectedSellingPoints = product.sellingPointsRange
    ? pickItems(product.sellingPoints, product.sellingPointsRange, variationIndex)
    : product.sellingPoints
  const selectedEmphasis = product.emphasisRange
    ? pickItems(product.emphasis, product.emphasisRange, variationIndex)
    : product.emphasis
  const selectedBrandPool = product.brandPoolCount
    ? pickItems(product.brandPool, product.brandPoolCount, variationIndex)
    : product.brandPool
  const keywordSection = product.keyword.trim()
    ? `\n- 标题关键词：${product.keyword.trim()}`
    : ''

  const seoSection = product.seoKeywords.length > 0
    ? `\n- SEO 关键词：${product.seoKeywords.join('、')}`
    : ''

  const brandPoolSection = selectedBrandPool.length > 0
    ? `\n- 本次参与排行的其他品牌：${selectedBrandPool.join('、')}`
    : ''

  const sellingPointsSection = selectedSellingPoints.length > 0
    ? `\n- 主打卖点：${selectedSellingPoints.join('；')}`
    : ''

  const emphasisSection = selectedEmphasis.length > 0
    ? `\n- 强调点：${selectedEmphasis.join('；')}`
    : ''
  const titleRuleSection = buildPromptEngineV2TitleRule(product)
  const imagePlaceholderRuleSection = buildPromptEngineV2ImagePlaceholderRule(product, selectedBrandPool)

  return `## 竞对文章

${article}

---

## 产品信息

- 品牌名称：${product.brand}
- 产品名称：${product.name}
- 产品类型：${product.type}
- 产品数据：${product.specs}
- 目标人群：${product.targetAudience}${keywordSection}${seoSection}${brandPoolSection}${sellingPointsSection}${emphasisSection}
${titleRuleSection}

---

## 系统级固定规则（必须始终生效）

${fixedRules}

---

## 图片占位符硬性规则（必须写入最终 Prompt）

${imagePlaceholderRuleSection}

---

## 当前选中的版本

- 版本名称：${version.name}
- 版本说明：${version.description || '无'}

### 版本规则

${version.ruleText}

---

请先分析竞对文章的结构优势，再生成一份“可直接给模型使用”的 Prompt。

要求：
- 系统级固定规则必须以明确、可执行的方式进入最终 Prompt
- 版本规则必须进入最终 Prompt，并体现为具体写法要求
- 如果存在「标题硬性规则」，最终 Prompt 必须原封不动写入该规则，并明确它高于标题风格、标题多样性、版本规则和竞对标题模仿
- 最终 Prompt 必须原封不动写入「图片占位符硬性规则」，并保留其中的具体品牌示例，绝对不能只写模板 \`[品牌名+图片]\`
- 如果版本规则或固定规则中包含随机、轮转、取模、模块选择、候选池选择等内部算法，最终 Prompt 只能写已经确定的自然语言写作要求，不得写算法、变量、公式、模块编号或计算过程
- 允许保留竞对文章的优点，但不要把旧版 Prompt Engine 的固定模板重新写回来
- 最终 Prompt 必须围绕当前产品信息生成，不得忽略产品卖点和 SEO 词`
}

function parsePickRange(range: string) {
  const [minStr, maxStr] = range.split('-')
  const min = Number.parseInt(minStr, 10)
  const max = maxStr ? Number.parseInt(maxStr, 10) : min
  const safeMin = Number.isFinite(min) ? min : 0

  return {
    min: safeMin,
    max: Number.isFinite(max) ? max : safeMin,
  }
}

function randomPick(items: string[], range: string) {
  const { min, max } = parsePickRange(range)
  const count = Math.min(
    items.length,
    Math.floor(Math.random() * (max - min + 1)) + min
  )
  const shuffled = [...items].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

function rotatedPick(items: string[], range: string, variationIndex: number) {
  if (items.length === 0) return []

  const { min, max } = parsePickRange(range)
  const safeMin = Math.max(1, Math.min(min || items.length, items.length))
  const safeMax = Math.max(safeMin, Math.min(max || safeMin, items.length))
  const offset = Math.max(variationIndex - 1, 0)
  const count = safeMin + (offset % (safeMax - safeMin + 1))
  const start = offset % items.length
  const picked = Array.from({ length: count }, (_, index) => items[(start + index) % items.length])

  return variationIndex % 2 === 0 ? picked.reverse() : picked
}

function pickItems(items: string[], range: string, variationIndex?: number) {
  if (!range || items.length === 0) return items
  return variationIndex ? rotatedPick(items, range, variationIndex) : randomPick(items, range)
}

function buildPromptEngineV2TitleRule(product: ProductInfo) {
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

function buildPromptEngineV2ImagePlaceholderRule(product: ProductInfo, selectedBrandPool: string[]) {
  const exampleBrands = getPromptEngineV2ExampleBrands(product, selectedBrandPool)
  const examples = exampleBrands.map((brand) => `[${brand}+图片]`).join('、')
  const firstBrand = exampleBrands[0]
  const secondBrand = exampleBrands[1]

  return `⚠️ 图片占位符规则（最高优先级）：
- 文章开头第一段正文之后，必须单独插入一行：[主图+图片]。
- 每个品牌介绍的开头，必须在品牌标题下方、正文内容之前，单独插入一行品牌图片占位符，格式为“左方括号 + 当前条目的真实品牌名 + +图片 + 右方括号”。
- “当前真实品牌名”必须替换成该条目正在介绍的具体品牌名称，禁止原样输出 [品牌名+图片]、[真实品牌名+图片]、[某品牌+图片]、[当前真实品牌名+图片]。
- Prompt 中必须写出具体示例，至少包含：${examples}。

正确示例：
### 1、${firstBrand}
[${firstBrand}+图片]
推荐理由：……

### 2、${secondBrand}
[${secondBrand}+图片]
推荐理由：……

错误示例：
### 1、品牌名
[品牌名+图片]`
}

function getPromptEngineV2ExampleBrands(product: ProductInfo, selectedBrandPool: string[]) {
  const brands = [product.brand, ...selectedBrandPool, ...product.brandPool]
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !/^\[.*\]$/.test(item))
  const uniqueBrands = Array.from(new Set(brands))

  return uniqueBrands.length >= 2 ? uniqueBrands.slice(0, 3) : [...uniqueBrands, '海尔', '美的'].slice(0, 2)
}
