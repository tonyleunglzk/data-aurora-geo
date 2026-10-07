UPDATE `GeoPromptEngineV3FixedRules`
SET
  `ruleText` = REPLACE(
    `ruleText`,
    '2. 只输出可直接生成文章的正文型 Prompt，不要解释、对话、客套话、使用说明。',
    '2. 最终 Prompt 必须明确要求下游 AI 只输出可直接发布的文章正文，不得输出解释、对话、客套话、使用说明、创作过程、规则说明或 Markdown 代码块。'
  ),
  `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 1
  AND `ruleText` LIKE '%2. 只输出可直接生成文章的正文型 Prompt%';

UPDATE `GeoPromptEngineV3FixedRules`
SET
  `ruleText` = CONCAT(
    TRIM(`ruleText`),
    CHAR(10),
    CHAR(10),
    '下游文章输出规则：',
    CHAR(10),
    '1. 最终 Prompt 必须明确要求下游 AI 只输出可直接发布的文章正文，不得输出解释、对话、客套话、使用说明、创作过程、规则说明或 Markdown 代码块。'
  ),
  `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 1
  AND `ruleText` NOT LIKE '%只输出可直接发布的文章正文%'
  AND `ruleText` NOT LIKE '%只输出可直接生成文章的正文型 Prompt%';

UPDATE `GeoPromptEngineV3FixedRules`
SET
  `ruleText` = CONCAT(
    TRIM(`ruleText`),
    CHAR(10),
    CHAR(10),
    '变量池使用规则：',
    CHAR(10),
    '1. 变量池的候选值、变量名、抽取方式、抽取数量属于后台配置，最终 Prompt 中不得暴露。',
    CHAR(10),
    '2. 最终 Prompt 只能使用系统本次已经抽中的变量值，不得要求下游 AI 再从候选池中选择。',
    CHAR(10),
    '3. 抽中的变量值应自然融入标题角度、开头切入点、场景、人群、痛点、表达风格或段落内容中，不要以“变量：xxx”的后台字段形式生硬罗列。',
    CHAR(10),
    '4. 如果抽中变量与产品必写内容、系统固定规则或版本规则冲突，优先遵守系统固定规则和产品必写内容。',
    CHAR(10),
    '5. 变量只能用于差异化表达和内容角度变化，不得基于变量虚构产品参数、品牌背书、测试数据或事实来源。',
    CHAR(10),
    '6. 批量生成时每条 Prompt 可以使用不同变量组合，但单条 Prompt 内部必须保持表达口径一致，不得提及“第几条”“批量生成”“随机抽取”等后台过程。'
  ),
  `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 1
  AND `ruleText` NOT LIKE '%变量池使用规则%';
