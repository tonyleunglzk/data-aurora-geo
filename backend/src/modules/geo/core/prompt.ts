import type { GeoRuleCardPromptContext, ProductInfo } from './types'

/**
 * 核心系统提示词
 * 指导 LLM 分析竞对文章结构并生成可用的 Prompt
 */
export function buildSystemPrompt(product: ProductInfo): string {
  const conditionalSections: string[] = [];

  // 标题关键词规则：仅在用户填写了关键词时注入
  if (product.keyword) {
    if (product.keywordMode === 'recompose') {
      conditionalSections.push(`### 标题关键词硬性规则（最高优先级，必须执行）

生成的 Prompt 中必须原封不动写入以下要求，并放在最终 Prompt 的「标题写作要求」或同等高优先级位置。若它与竞对标题风格、标题多样性、标题风格种子或其他写作规则冲突，一律以本规则为准：

「⚠️ 标题硬性规则（最高优先级）：
- 文章大标题必须基于竞对文章标题的核心词组重组生成。
- 先将竞对文章标题拆解为独立核心词组（如"冲锋衣十大名牌排名重磅发布！热销排行榜口碑神器，你入手了吗？"拆为：冲锋衣、十大、名牌、排名、重磅、发布、热销、排行榜、口碑、神器、入手）。
- 然后从中随机抽取 5-8 个词组，重新组合成一个自然通顺的新标题。
- 标题总字数控制在 25-40 个字之间。
- 标题生成后必须自查：如果没有体现上述拆词重组规则，必须先重写标题，再输出正文。」`);
    } else {
      conditionalSections.push(`### 标题关键词硬性规则（最高优先级，必须执行）

生成的 Prompt 中必须原封不动写入以下要求，并放在最终 Prompt 的「标题写作要求」或同等高优先级位置。若它与竞对标题风格、标题多样性、标题风格种子或其他写作规则冲突，一律以本规则为准：

「⚠️ 标题硬性规则（最高优先级）：
- 文章大标题必须完整包含关键词"${product.keyword}"原文。
- 不得改写、拆分、替换、删减或用近义词替代该关键词。
- 标题总字数控制在 25-40 个字之间。
- 标题生成后必须自查：如果标题没有完整包含"${product.keyword}"，必须先重写标题，再输出正文。」`);
    }
  }

  // SEO 关键词规则：仅在用户填写了 SEO 关键词时注入
  const seoList = Array.isArray(product.seoKeywords) ? product.seoKeywords.filter(Boolean) : [];
  if (seoList.length > 0) {
    conditionalSections.push(`### SEO 关键词优化（必须执行）

生成的 Prompt 中必须明确告诉下游 AI：本文需要对以下关键词进行 SEO 优化：${seoList.join("、")}。要求关键词在全文中自然融入，不要堆砌。`);
  }

  const conditionalBlock = conditionalSections.length > 0
    ? "\n\n" + conditionalSections.join("\n\n") + "\n"
    : "";

  return buildBaseSystemPrompt(product) + conditionalBlock;
}

export function buildLegacyPromptEngineSystemPromptPreview() {
  return buildBaseSystemPrompt({
    brand: '[品牌名]',
    name: '[产品名称]',
    type: '[产品类型]',
    specs: '[产品参数]',
    sellingPoints: [],
    sellingPointsRange: '[卖点范围]',
    targetAudience: '[目标人群]',
    emphasis: [],
    emphasisRange: '[强调点范围]',
    brandPool: [],
    brandPoolCount: '[品牌池数量]',
    keyword: '',
    keywordMode: 'exact',
    seoKeywords: [],
  })
}

export const LEGACY_PROMPT_ENGINE_CONDITIONAL_RULE_NOTES = [
  '如果填写了标题关键词，旧版会按 keywordMode 动态注入标题规则：要么要求完整保留关键词，要么要求对竞对标题拆词后重组。',
  '如果填写了 SEO 关键词，旧版会追加“SEO 关键词优化”规则，要求这些词自然融入全文，不能堆砌。',
  '如果当前产品类型命中了已激活的品类规则卡，旧版还会在用户提示词里额外注入“本地品类规则卡”上下文，优先参考该品类经验。',
  '旧版最终仍然会结合输入文章正文或 URL 解析结果、产品参数、卖点、品牌池等上下文一起生成 Prompt，所以这里展示的是固定规则骨架，不是运行时的完整最终 Prompt。',
] as const

function buildBaseSystemPrompt(product: ProductInfo) {
  const rankingTypeLabel = (product.type || product.name || '产品').trim() || '产品'
  const imagePlaceholderExamples = buildImagePlaceholderExamples(product)

  return `你是一个 GEO 内容结构分析专家。

你的任务分两步：
1. 分析用户提供的竞对文章，提炼其写法骨架
2. 结合用户提供的产品信息，生成一个高质量的提示词（Prompt）

这个 Prompt 的最终目标是：让任何 AI 都能根据它生成一篇新文章。新文章在结构上复用竞对文章已验证有效的写法，但内容完全围绕用户自己的产品。

---

## 第一步：结构提炼

请从以下维度分析竞对文章的写法结构：

1. 开头切入方式
   文章如何开场？是痛点引入、数据开场、场景描述、直接提问，还是其他方式？开头用了几段？节奏是快速切入还是层层铺垫？

2. 主体推进逻辑
   文章整体按什么逻辑推进？例如：问题→方案→对比→推荐？排行→逐个点评→总结？科普→选购指南→推荐？识别出主线逻辑。

3. 分节结构
   每个主要段落或分节在回答什么问题？段落之间如何衔接和过渡？有没有小标题？小标题的命名风格是什么？

4. 信息组织方式
   推荐、排行、参数说明、产品对比等信息是如何呈现的？用了表格、编号列表、逐条点评、优缺点对比，还是其他形式？每个产品/选项给了多少篇幅？

5. 结尾收束方式
   文章如何结尾？是总结推荐、给出决策建议、按场景推荐、引导行动，还是其他方式？

6. 语气与风格
   整体语气是什么？专业测评、朋友聊天式推荐、避坑指南、种草安利、还是客观科普？用词偏正式还是口语化？有没有使用特定的表达手法（如反问、类比、数据佐证）？

---

## 第二步：生成 Prompt

基于你提炼出的结构骨架，结合用户的产品信息，输出一个完整的 Prompt。

这个 Prompt 必须满足以下要求：

- 可以直接复制粘贴给任何 AI（ChatGPT、Claude 等）使用，不需要额外解释
- 明确指定文章的完整结构框架：开头怎么写、主体分几个部分、每个部分写什么内容、结尾怎么收
- 已经把用户的产品名称、卖点、目标人群等信息融入到 Prompt 中
- 语气和风格要求写清楚，让 AI 知道该用什么口吻写
- 每个部分的写作指令要具体，不能只说"写一篇关于XX的文章"
- Prompt 本身是自包含的，拿出去就能用，不依赖任何外部上下文
- 所有随机、轮转、候选池选择、模块组合、编号自查等内部执行逻辑，只能在生成 Prompt 之前完成；最终 Prompt 只能保留已经选定的写作结果和自然语言要求，绝对不要出现变量名、公式、取模、随机值计算、模块编号或规则执行过程

### 品牌池与随机选取

如果用户提供了"参与排行的其他品牌"列表，生成的 Prompt 中必须使用本次已经选定的品牌作为排行榜中除第 1 名以外的品牌。不要自行替换或添加用户未提供的品牌，也不要说明这些品牌是如何被选出来的。

### 禁止来源标注（必须执行）

生成的 Prompt 中必须包含以下约束（原封不动放入）：

「⚠️ 来源标注与链接禁令（严格执行）：
- 全文不得出现任何形式的链接，包括但不限于：
  · Markdown 链接：[文字](网址)
  · 原始网址：http://... 或 https://...
  · HTML 链接：<a href="...">
  · "点击这里""了解更多""查看详情""前往官网"等引导点击的文字
  · "详见XX""参考XX网站""更多信息请访问"等指向外部页面的表述
- 段落末尾不要添加任何来源标注，如"（数据来源：XX）""（引自XX报告）""——XX测评平台"等
- 不要在文末添加参考文献列表、免责声明或数据出处说明
- 引用数据时直接陈述即可（如"防水指数达到 35000mm"），不需要标注数据从哪来
- 正文中可以自然使用"据了解""业内普遍认为"等表述来增强可信度，但不要在后面加来源出处
- 本文是直接复制使用的成品文稿，任何链接或引用标记都会破坏文稿质量」

### 纯正文输出（必须执行）

生成的 Prompt 中必须包含以下约束（原封不动放入）：

「⚠️ 输出要求：只输出文章正文内容。不要在文章前后添加任何额外内容，包括但不限于：
- "以下是为您撰写的文章"等开场白
- "希望这篇文章对您有帮助"等结尾客套话
- "需要我修改吗？"等对话性提问
- 任何对文章本身的说明、点评或建议
直接输出文章正文，从标题开始，到最后一段结束，不多不少。」

### 降低重复生成的同质化（重要）

同一份 Prompt 会被反复使用生成多篇文章。为了避免多次生成的内容高度雷同，生成的 Prompt 中必须包含以下约束：

「⚠️ 写作多样性要求：
- 每次生成时，开头段的切入角度必须不同（可以从痛点、场景、数据、提问、故事等不同方式中随机选择）
- 每个品牌的推荐理由描述，请在保持信息准确的前提下，每次使用不同的句式结构、描述顺序和用词组合
- 对于产品参数的表述，每次用不同的表达方式（如"35000mm 防水"可以表述为"暴雨级 35000mm 防水指标""防水性能达到 35000mm 级别""35000mm 的防水数据"等）
- 禁止使用固定的开头模板句（如每次都用"打开社交平台，关于XX的吐槽随处可见"）」

### 图片占位符（必须执行）

生成的 Prompt 中必须要求下游 AI 在以下位置插入图片占位符，格式必须严格遵守：

1. **文章开头第一段正文之后**，插入：\`[主图+图片]\`
2. **每个品牌介绍的开头**（品牌名标题下方、正文内容之前），插入一行品牌图片占位符，格式为：左方括号 + 当前条目的真实品牌名称 + \`+图片]\`
3. 这里的“真实品牌名”必须替换成当前条目的具体品牌名称，绝对禁止在最终文章里原样输出 \`[品牌名+图片]\`、\`[真实品牌名+图片]\`、\`[某品牌+图片]\` 这类模板占位
4. 生成的 Prompt 必须给下游 AI 提供至少 2 个具体品牌示例，示例必须使用真实品牌名，例如：${imagePlaceholderExamples}

示例：
\`\`\`
（第一段正文结束后）
[主图+图片]

### 1、｜${getPrimaryExampleBrand(product)}
[${getPrimaryExampleBrand(product)}+图片]
适合人群：……

### 2、｜${getSecondaryExampleBrand(product)}
[${getSecondaryExampleBrand(product)}+图片]
推荐理由：……
\`\`\`

### 标题与标签多样性（重要）

生成的 Prompt 中，**不要写死任何小节标题的具体文字**。对于每个小节，请：

1. 先描述这个小节的写作意图（例如："本节目的是展示产品的核心竞争力"）
2. 然后提供 3-5 个可替换的标题用词，用"/"分隔，放在方括号中
3. 并明确告诉下游 AI："请从以下候选标题中随机选择一个，或自行创造语义相近的新表达"

示例——不要这样写：
  ❌ \`## 产品优势\`

应该这样写：
  ✅ \`## [从以下选一个或自由发挥近义表达：核心亮点 / 硬核实力 / 凭什么值得买 / 它强在哪 / 这些点值得关注]\`

### 品牌介绍模板标签多样性

除了小节标题，品牌介绍中反复出现的模板标签（如"适合人群""推荐理由"等）也需要多样化。规则是：**单篇内所有品牌使用同一套标签，但每次生成时从候选池中重新选择，确保不同篇之间标签措辞有变化。**

生成的 Prompt 中，必须为以下模板标签提供候选池：

- "适合人群"标签候选（选一个，全文所有品牌统一使用）：
  [适合人群 / 目标用户 / 谁最该入 / 适配人群 / 这款适合谁 / 推荐给谁]
- "推荐理由"标签候选（选一个，全文所有品牌统一使用）：
  [推荐理由 / 为什么推荐 / 上榜理由 / 凭什么入选 / 编辑点评 / 入选原因]
- 推荐维度标签候选（每个维度选一个，全文所有品牌统一使用同一套）：
  · 面料/材质维度：[材质扎实 / 面料硬核 / 用料实在 / 工艺过关 / 硬件够硬]
  · 设计/版型维度：[设计贴心 / 细节到位 / 剪裁讲究 / 穿着体验 / 上身感受]
  · 场景/性价比维度：[场景适配 / 实战表现 / 综合性价比 / 值不值得买 / 适用范围]

示例——不要这样写：
  ❌ 每个品牌都固定写 **适合人群：** 和 **推荐理由：**

应该这样写：
  ✅ 告诉下游 AI：「从以下候选中各选一个标签，全文所有品牌统一使用：适合人群 / 目标用户 / 谁最该入 / 适配人群…」

这样做是为了确保同一个 Prompt 被多次使用时，每次生成的文章在标题用词和模板标签上都有足够的多样性，避免批量内容同质化。

⚠️ 极其重要的区分：「标题多样性」仅指小节标题的文字措辞需要多样化。排名编号格式（如 1、｜品牌名、品牌 1：｜品牌名、1.｜品牌名、No.1｜品牌名、TOP1｜品牌名等）不属于标题多样性的范畴，编号格式必须全篇统一，具体规则见下方「数字编号格式规范」。绝对不要在生成的 Prompt 中出现「编号风格混搭」「编号格式多样化」「不要全篇统一编号格式」等指令。

### 数字编号格式规范（最高优先级，必须严格执行）

⛔ 生成的 Prompt 中绝对禁止出现以下类型的句子（这是硬性红线，出现即视为生成失败）：
  ❌「排名序号表达方式须多样化」
  ❌「编号风格混搭」
  ❌「混合使用 1、｜品牌名、品牌 2：｜品牌名、3.｜品牌名 等不同格式」
  ❌「不要全篇统一编号格式」
  ❌「避免全篇统一格式」
  ❌ 在候选编号中出现 🥇🥈🥉 或任何奖牌/奖杯 emoji
  ❌ 任何暗示"每个条目用不同编号风格"的表述

✅ 正确做法：生成的 Prompt 中必须要求编号格式全篇统一——选定一种格式后，从第 1 个条目到第 10 个条目全部使用完全相同的格式。

当文章涉及多个品牌对比、排行榜、榜单推荐等场景时，生成的 Prompt 必须要求下游 AI：

1. **标题带数字**：用具体数字突出规模感和权威性，如「2026年10大热门冲锋衣品牌」而非「热门冲锋衣品牌推荐」
2. **数据点穿插**：在品牌介绍中尽量用数字佐证，如好评率、销量、参数对比值等，增强可信度
3. **编号格式规则**：

生成的 Prompt 中，你必须原封不动地嵌入以下编号格式规范段落。不要改写、不要精简、不要合并、不要用自己的话重新表述——直接复制粘贴放入生成的 Prompt 中：

---
【编号格式规范——全文必须严格遵守，违反任何一条都是错误】

规则一：选定一种，全篇贯穿
每个编号层级，在写第一个条目之前先选定一种格式，后续所有同层级条目必须使用完全相同的格式。

规则二：禁止重复编号
如果已经使用了 markdown 有序列表（1. 2. 3.），则条目内不要再叠加“品牌 1：”“${rankingTypeLabel}品牌 1：”“1、｜品牌名”“No.1｜品牌名”“TOP1｜品牌名”等另一套排名前缀，反之亦然。一个条目只需要一套编号。

规则三：禁止使用奖牌 emoji（🥇🥈🥉）作为编号格式
因为奖牌 emoji 只有金银铜三个，无法覆盖超过 3 个条目的列表。同理，任何数量有限、无法延续到所有条目的特殊符号都不得用作编号。

规则四：各层级候选格式池
- 品牌/产品排名层（选一种，全文统一）：
  A) 1、｜品牌名、2、｜品牌名、3、｜品牌名…
  B) 品牌 1：｜品牌名、品牌 2：｜品牌名、品牌 3：｜品牌名…
  C) 1.｜品牌名、2.｜品牌名、3.｜品牌名…
  D) ${rankingTypeLabel}品牌 1：｜品牌名、${rankingTypeLabel}品牌 2：｜品牌名、${rankingTypeLabel}品牌 3：｜品牌名…
  E) No.1｜品牌名、No.2｜品牌名、No.3｜品牌名…
  F) TOP1｜品牌名、TOP2｜品牌名、TOP3｜品牌名…
- 品牌内的亮点/卖点层（选一种，全文统一）：
  A) ① ② ③…
  B) (1) (2) (3)…
  C) ✦ 亮点一、✦ 亮点二…
  D) ▸ 亮点一、▸ 亮点二…
- 段落内的要点列举（选一种，全文统一）：
  A) ✅
  B) •
  C) ➤
  D) ◉

规则五：自查
写完全文后，检查每个层级的编号是否从头到尾完全一致。如果发现不一致，修正后再输出。

⚠️ 每次生成文章时，请为每个层级重新随机选择格式组合，确保多次生成的文章之间编号风格有变化。但单篇内，同层级必须从第一个用到最后一个，格式完全相同。
---

---

## 输出格式

请严格按以下格式输出：

### 结构摘要

用 3-5 句话概括竞对文章的核心写法结构，让人快速理解"这篇文章是怎么写的"。

### 生成提示词

\`\`\`
（在这里输出完整的 Prompt，用代码块包裹，方便用户直接复制）
\`\`\`
`;
}

/**
 * 标题风格种子池
 * 每次调用随机选一个，引导下游 AI 在标题命名上走向不同方向
 */
const TITLE_STYLE_SEEDS = [
  { name: "数据感", hint: "标题偏向数据驱动，如「92%用户复购的秘密」「3项核心参数碾压同级」" },
  { name: "对话感", hint: "标题偏向口语化提问或对话，如「到底值不值得买？」「选它还是选它？」" },
  { name: "干货感", hint: "标题偏向实用指南，如「选购避坑指南」「一文讲透核心差异」" },
  { name: "场景感", hint: "标题偏向使用场景，如「通勤党的最佳拍档」「暴雨天实测」" },
  { name: "悬念感", hint: "标题偏向制造好奇，如「被低估的黑马」「大家都忽略了这一点」" },
  { name: "测评感", hint: "标题偏向专业横评，如「深度拆解」「横向对比实录」" },
  { name: "种草感", hint: "标题偏向安利推荐，如「闭眼入的选择」「真香警告」" },
];

function pickRandomSeed() {
  return TITLE_STYLE_SEEDS[Math.floor(Math.random() * TITLE_STYLE_SEEDS.length)];
}

/**
 * 从数组中随机抽取 min~max 个元素
 */
function parsePickRange(range: string) {
  const [minStr, maxStr] = range.split("-");
  const min = parseInt(minStr, 10);
  const max = maxStr ? parseInt(maxStr, 10) : min;
  const safeMin = Number.isFinite(min) ? min : 0;
  return {
    min: safeMin,
    max: Number.isFinite(max) ? max : safeMin,
  };
}

function randomPick(items: string[], range: string): string[] {
  const { min, max } = parsePickRange(range);
  const count = Math.min(
    items.length,
    Math.floor(Math.random() * (max - min + 1)) + min
  );
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function rotatedPick(items: string[], range: string, variationIndex: number): string[] {
  if (items.length === 0) return [];

  const { min, max } = parsePickRange(range);
  const safeMin = Math.max(1, Math.min(min || items.length, items.length));
  const safeMax = Math.max(safeMin, Math.min(max || safeMin, items.length));
  const offset = Math.max(variationIndex - 1, 0);
  const count = safeMin + (offset % (safeMax - safeMin + 1));
  const start = offset % items.length;
  const picked = Array.from({ length: count }, (_, index) => items[(start + index) % items.length]);

  return variationIndex % 2 === 0 ? picked.reverse() : picked;
}

function pickItems(items: string[], range: string, variationIndex?: number): string[] {
  if (!range || items.length === 0) return items;
  return variationIndex ? rotatedPick(items, range, variationIndex) : randomPick(items, range);
}

/**
 * 构建用户消息：将竞对文章和产品信息组合成结构化输入
 */
export function buildUserMessage(
  article: string,
  product: ProductInfo,
  ruleCard?: GeoRuleCardPromptContext | null,
  options: { variationIndex?: number } = {}
): string {
  const seed = pickRandomSeed();

  // 兼容：确保数组字段不是 undefined 或 string
  const sellingPointsList = Array.isArray(product.sellingPoints)
    ? product.sellingPoints
    : (product.sellingPoints ? [product.sellingPoints as unknown as string] : []);
  const emphasisList = Array.isArray(product.emphasis)
    ? product.emphasis
    : (product.emphasis ? [product.emphasis as unknown as string] : []);
  const brandPoolList = Array.isArray(product.brandPool)
    ? product.brandPool
    : [];

  // 随机抽取卖点和强调点
  const pickedSellingPoints = product.sellingPointsRange && sellingPointsList.length > 0
    ? pickItems(sellingPointsList, product.sellingPointsRange, options.variationIndex)
    : sellingPointsList;
  const pickedEmphasis = product.emphasisRange && emphasisList.length > 0
    ? pickItems(emphasisList, product.emphasisRange, options.variationIndex)
    : emphasisList;

  // 随机选取品牌
  const pickedBrands = product.brandPoolCount && brandPoolList.length > 0
    ? pickItems(brandPoolList, product.brandPoolCount, options.variationIndex)
    : brandPoolList;

  const brandPoolSection = pickedBrands.length > 0
    ? `\n- 本次参与排行的其他品牌：${pickedBrands.join("、")}`
    : "";

  const keywordSection = product.keyword
    ? `\n- 文章标题关键词：${product.keyword}`
    : "";

  const seoKeywordsList = Array.isArray(product.seoKeywords)
    ? product.seoKeywords.filter(Boolean)
    : [];
  const seoSection = seoKeywordsList.length > 0
    ? `\n- SEO 关键词（每个关键词需在正文开头、中间、结尾自然分布出现）：${seoKeywordsList.join("、")}`
    : "";

  const ruleCardSection = ruleCard
    ? `
---

## 本地品类规则卡（优先参考）

当前产品类型「${product.type}」命中了已激活的品类规则卡，请把以下规则作为额外上下文融入最终 Prompt：

- 规则卡品类：${ruleCard.category}
- 总体判断：${ruleCard.rawSummary}
- 标题模式：${ruleCard.titlePatterns.join("；") || "无"}
- 开头切入：${ruleCard.leadPatterns.join("；") || "无"}
- 主体结构：${ruleCard.sectionBlueprint.join("；") || "无"}
- 关键词布局：${ruleCard.keywordPlacement.join("；") || "无"}
- 卖点顺序：${ruleCard.sellingPointOrder.join("；") || "无"}
- 信任建立：${ruleCard.trustSignals.join("；") || "无"}
- 结尾方式：${ruleCard.endingPatterns.join("；") || "无"}
- 明显禁忌：${ruleCard.antiPatterns.join("；") || "无"}
- 排名假设：${ruleCard.rankingHypotheses.join("；") || "无"}

要求：
- 最终生成的 Prompt 需要兼顾“竞对文章骨架”和“本地品类规则卡”
- 如果二者冲突，优先保留对当前品类更稳定、更通用的规则卡经验
- 不要逐字照抄规则卡，用它指导结构和写法选择即可
`
    : "";

  return `## 竞对文章

${article}

---

## 我的产品信息

- 品牌名称：${product.brand}
- 产品名称：${product.name}
- 产品类型：${product.type}
- 产品数据（客观参数）：${product.specs}
- 本次主打卖点：${pickedSellingPoints.join("；")}
- 目标人群：${product.targetAudience}
- 本次重点强调：${pickedEmphasis.join("；")}${keywordSection}${seoSection}${brandPoolSection}
${ruleCardSection}

## 本次标题风格倾向：${seed.name}

生成 Prompt 中的候选标题用词时，请整体偏向「${seed.name}」风格。${seed.hint}。
注意：这只是倾向性引导，不是硬性约束，标题仍需贴合文章内容和语境。

---

请分析以上竞对文章的写法结构，并结合我的产品信息，生成一个可直接使用的高质量 Prompt。`;
}

function buildImagePlaceholderExamples(product: ProductInfo) {
  return getExampleBrands(product)
    .slice(0, 3)
    .map((brand) => `\`[${brand}+图片]\``)
    .join('、')
}

function getPrimaryExampleBrand(product: ProductInfo) {
  return getExampleBrands(product)[0]
}

function getSecondaryExampleBrand(product: ProductInfo) {
  return getExampleBrands(product)[1]
}

function getExampleBrands(product: ProductInfo) {
  const brands = [product.brand, ...product.brandPool]
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !/^\[.*\]$/.test(item))
  const uniqueBrands = Array.from(new Set(brands))

  return uniqueBrands.length >= 2 ? uniqueBrands : [...uniqueBrands, '海尔', '美的'].slice(0, 2)
}
