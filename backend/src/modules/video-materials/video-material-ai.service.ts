import { Injectable } from '@nestjs/common'
import { readFile } from 'node:fs/promises'

export type VideoMaterialAiUsage = {
  inputTokens: number
  outputTokens: number
  audioSeconds: number
}

export type VideoMaterialAiClassificationInput = {
  clipIndex: number
  startMs: number
  endMs: number
  keyframePaths: string[]
  transcript: string
  transcriptContext: string
}

export type VideoMaterialTranscriptWord = {
  startMs: number
  endMs: number
  text: string
  punctuation: string
}

export type VideoMaterialTranscriptSegmentResult = {
  startMs: number
  endMs: number
  text: string
  words: VideoMaterialTranscriptWord[]
  chunkIndex: number
}

export type VideoMaterialAiClassificationResult = {
  clipIndex: number
  shotType: string
  contentType: string
  contentTopics: string[]
  description: string
  tags: string[]
  actions: string[]
  objects: string[]
  scenes: string[]
  brands: string[]
  qualityFlags: string[]
  qualityScore: number
  usabilityScore: number
  hasPerson: boolean
  hasTextOverlay: boolean
  confidence: number
}

export type VideoNarrationScenePlan = {
  sceneIndex: number
  narrationText: string
  targetDurationMs: number
  visualBrief: string
  contentTypes: string[]
  shotTypes: string[]
  keywords: string[]
  negativeKeywords: string[]
  visualIntent: string
}

type AiResponse<T> = {
  data: T
  usage: VideoMaterialAiUsage
}

type TaxonomyOption = {
  value: string
  label: string
}

type ClassificationContext = {
  totalClips: number
  durationMs: number
  brandAliases: Array<{
    canonical: string
    aliases: string[]
  }>
}

const CONTENT_TYPE_GUIDANCE: Record<string, string> = {
  PRODUCT_OVERVIEW: '围绕产品整体特点、定位或综合能力',
  GENERAL_CONTEXT: '消费需求、行业乱象、用户痛点、开场背景或片尾收束',
  KNOWLEDGE_GUIDE: '科普原理、标准或通用选购指标，不针对单个品牌',
  UV_PROTECTION: 'UPF、UVA、UVB、防晒力、晒黑晒伤或紫外线阻隔',
  BREATHABILITY_COOLING: '透气、凉感、排汗或闷热',
  COVERAGE_DESIGN: '帽檐、面罩、袖口、拇指孔等遮蔽结构',
  FABRIC_CRAFT: '面料、编织、原纱、涂层、拉链、缝线或工艺',
  WASH_DURABILITY: '洗涤、摩擦、耐磨、起球或长期耐用性',
  WATER_REPELLENCY: '防水、防泼水或水珠滚落',
  WATERPROOF: '冲锋衣防水能力或防水测试',
  WINDPROOF: '冲锋衣防风能力或防风测试',
  BREATHABILITY: '冲锋衣透气、排汗或闷热表现',
  SEAM_CONSTRUCTION: '压胶、接缝或缝制工艺',
  HOOD_CUFF_DESIGN: '帽檐、帽兜、袖口或下摆调节设计',
  ABRASION_DURABILITY: '冲锋衣耐磨、抗刮或耐用性',
  BRAND_REVIEW: '围绕一个品牌或单款产品介绍参数、优缺点与适用场景',
  BRAND_COMPARISON: '两个及以上品牌或产品的横向比较、榜单或筛选结果',
  PRICE_BUYING_GUIDE: '价格、预算、性价比或明确购买建议是主要信息',
  OTHER: '只在无法归入其他任何类别时使用',
}

const SHOT_TYPE_GUIDANCE: Record<string, string> = {
  TITLE_CARD: '标题、章节名、目录或大字主题卡是主要画面',
  TALKING_HEAD: '人物面对镜头讲解或口播，产品动作不是主体',
  PRODUCT_DISPLAY: '完整产品、版型、挂拍或静态陈列是主体',
  DETAIL_CLOSEUP: '面料、拉链、袖口、帽檐等局部近景是主体',
  TRY_ON: '人物上身穿着并展示版型或活动效果',
  OUTDOOR_USAGE: '户外环境中的穿着、运动、通勤或使用场景',
  TEST_DEMONSTRATION: '仪器、喷水、摩擦、洗涤、拉伸等真实动作或测试过程',
  DATA_GRAPHIC: '参数卡、表格、对比图、知识图文或大段文字信息',
  SCREEN_CONTENT: '网页、搜索结果、评论区、社交媒体或手机屏幕内容',
  MONTAGE: '同一片段内出现多个明显不同画面，包括先后切换、拼接、分屏或快速合集',
  TRANSITION: '没有独立素材意义的承接、转场或空镜',
  ENDING: '片尾总结、收藏转发、关注等行动号召画面',
  OTHER: '只在画面无法归入其他任何类型时使用',
}

@Injectable()
export class VideoMaterialAiService {
  private readonly apiKey = process.env.VIDEO_MATERIAL_AI_API_KEY?.trim()
    || process.env.DASHSCOPE_API_KEY?.trim()
    || ''
  private readonly baseUrl = (
    process.env.VIDEO_MATERIAL_AI_BASE_URL?.trim()
    || process.env.DASHSCOPE_BASE_URL?.trim()
    || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  ).replace(/\/+$/, '')
  private readonly visionModel = process.env.VIDEO_MATERIAL_VISION_MODEL?.trim()
    || 'qwen3-vl-flash'
  private readonly asrModel = process.env.VIDEO_MATERIAL_ASR_MODEL?.trim()
    || 'qwen3-asr-flash-2026-02-10'
  private readonly textModel = process.env.VIDEO_MATERIAL_TEXT_MODEL?.trim()
    || this.visionModel
  private readonly timelineAsrModel = process.env.VIDEO_MATERIAL_TIMELINE_ASR_MODEL?.trim()
    || 'qwen-audio-3.0-asr-flash'
  private readonly dashscopeBaseUrl = (
    process.env.VIDEO_MATERIAL_DASHSCOPE_BASE_URL?.trim()
    || this.baseUrl.replace(/\/compatible-mode\/v1$/, '/api/v1')
  ).replace(/\/+$/, '')

  configuration() {
    return {
      configured: Boolean(this.apiKey && this.baseUrl),
      visionModel: this.visionModel,
      asrModel: this.asrModel,
      timelineAsrModel: this.timelineAsrModel,
      timelineAsrConfigured: this.dashscopeBaseUrl.endsWith('/api/v1'),
      textModel: this.textModel,
    }
  }

  async transcribeAudioTimeline(
    audioPath: string,
    chunkIndex: number,
    vocabulary: string[] = []
  ): Promise<AiResponse<VideoMaterialTranscriptSegmentResult[]>> {
    this.assertConfigured()
    const audio = await readFile(audioPath)
    const vocabularyWeights = Object.fromEntries(
      [...new Set(vocabulary.map((value) => value.trim()).filter(Boolean))]
        .slice(0, 50)
        .map((value) => [value, 4])
    )
    const response = await fetch(
      `${this.dashscopeBaseUrl}/services/aigc/multimodal-generation/generation`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-SSE': 'disable',
        },
        body: JSON.stringify({
          model: this.timelineAsrModel,
          input: {
            messages: [{
              role: 'user',
              content: [{
                type: 'input_audio',
                input_audio: {
                  data: `data:audio/mpeg;base64,${audio.toString('base64')}`,
                },
              }],
            }],
          },
          parameters: {
            format: 'mp3',
            sample_rate: '16000',
            language_hints: ['zh'],
            ...(Object.keys(vocabularyWeights).length ? { vocabulary: vocabularyWeights } : {}),
          },
        }),
        signal: AbortSignal.timeout(5 * 60 * 1000),
      }
    )
    if (!response.ok) {
      const text = await response.text()
      let payload: any = { message: text }
      try { payload = JSON.parse(text) } catch { /* keep response text */ }
      throw new Error(this.formatApiError(response.status, payload))
    }
    const responseText = await response.text()
    if (!responseText.trim()) throw new Error('百炼时间轴语音接口没有返回内容')

    const segments = new Map<string, VideoMaterialTranscriptSegmentResult>()
    let audioSeconds = 0
    const normalizeWords = (sentence: any): VideoMaterialTranscriptWord[] => (
      Array.isArray(sentence?.words)
        ? sentence.words.map((word: any) => ({
          startMs: Math.max(0, Math.round(Number(word?.begin_time || 0))),
          endMs: Math.max(0, Math.round(Number(word?.end_time || 0))),
          text: String(word?.text || '').trim(),
          punctuation: String(word?.punctuation || ''),
        })).filter((word: VideoMaterialTranscriptWord) => word.text || word.punctuation)
        : []
    )
    const addSentence = (sentence: any) => {
      if (!sentence || sentence.sentence_end === false || sentence.heartbeat === true) return
      const startMs = Math.max(0, Math.round(Number(sentence.begin_time || 0)))
      const endMs = Math.max(startMs + 1, Math.round(Number(sentence.end_time || startMs + 1)))
      const text = String(sentence.text || '').trim()
      if (!text) return
      const words = normalizeWords(sentence)
      const wordGroups: VideoMaterialTranscriptWord[][] = []
      let currentGroup: VideoMaterialTranscriptWord[] = []
      for (const word of words) {
        currentGroup.push(word)
        if (/[。！？!?；;]$/.test(`${word.text}${word.punctuation}`)) {
          wordGroups.push(currentGroup)
          currentGroup = []
        }
      }
      if (currentGroup.length) wordGroups.push(currentGroup)
      const normalizedGroups = wordGroups.length > 1
        ? wordGroups.map((group) => {
          const groupText = group
            .map((word) => `${word.text}${word.punctuation}`)
            .join('')
            .replace(/\s+([,.;!?，。；！？])/g, '$1')
            .trim()
          return {
            startMs: group[0]?.startMs ?? startMs,
            endMs: group[group.length - 1]?.endMs ?? endMs,
            text: groupText,
            words: group,
          }
        }).filter((group) => group.text)
        : [{ startMs, endMs, text, words }]
      for (const group of normalizedGroups) {
        const key = `${group.startMs}:${group.endMs}:${group.text}`
        segments.set(key, { ...group, chunkIndex })
        audioSeconds = Math.max(audioSeconds, group.endMs / 1000)
      }
    }

    const consumePayload = (payload: any) => {
      audioSeconds = Math.max(
        audioSeconds,
        Number(payload?.usage?.duration || 0),
        Number(payload?.output?.usage?.duration || 0),
        Number(payload?.payload?.usage?.duration || 0)
      )
      const sentenceCandidates = [
        payload?.sentence,
        payload?.output?.sentence,
        payload?.output?.output?.sentence,
        payload?.payload?.output?.sentence,
      ]
      sentenceCandidates.forEach(addSentence)
      const sentenceLists = [
        payload?.sentences,
        payload?.output?.sentences,
        payload?.output?.output?.sentences,
        payload?.payload?.output?.sentences,
        ...(Array.isArray(payload?.transcripts)
          ? payload.transcripts.map((transcript: any) => transcript?.sentences)
          : []),
        ...(Array.isArray(payload?.output?.transcripts)
          ? payload.output.transcripts.map((transcript: any) => transcript?.sentences)
          : []),
      ]
      sentenceLists.forEach((list) => {
        if (Array.isArray(list)) list.forEach(addSentence)
      })
    }

    let parsedJson = false
    try {
      consumePayload(JSON.parse(responseText))
      parsedJson = true
    } catch { /* try the SSE form below */ }
    if (!parsedJson) {
      const dataLines = responseText.split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
      for (const line of dataLines) {
        try { consumePayload(JSON.parse(line)) } catch { /* skip malformed event */ }
      }
    }
    const data = [...segments.values()].sort((left, right) => left.startMs - right.startMs)
    if (!data.length) throw new Error('百炼没有返回可用的句级时间轴')
    return {
      data,
      usage: { inputTokens: 0, outputTokens: 0, audioSeconds },
    }
  }

  async transcribeAudio(audioPath: string): Promise<AiResponse<string>> {
    this.assertConfigured()
    const audio = await readFile(audioPath)
    const payload = await this.requestJson('/chat/completions', {
      model: this.asrModel,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: {
                data: `data:audio/mpeg;base64,${audio.toString('base64')}`,
              },
            },
          ],
        },
      ],
      stream: false,
      asr_options: {
        enable_itn: true,
      },
    })

    return {
      data: this.readMessageContent(payload).trim(),
      usage: this.readUsage(payload),
    }
  }

  async classifyClips(
    clips: VideoMaterialAiClassificationInput[],
    productLabel: string,
    taxonomy: TaxonomyOption[],
    shotTypes: TaxonomyOption[],
    context: ClassificationContext
  ): Promise<AiResponse<VideoMaterialAiClassificationResult[]>> {
    this.assertConfigured()
    const content: Array<Record<string, unknown>> = [
      {
        type: 'text',
        text: [
          `产品范围：${productLabel}。`,
          `内容主题：${taxonomy.map((item) => `${item.value}=${item.label}${CONTENT_TYPE_GUIDANCE[item.value] ? `（${CONTENT_TYPE_GUIDANCE[item.value]}）` : ''}`).join('；')}。`,
          `画面类型：${shotTypes.map((item) => `${item.value}=${item.label}${SHOT_TYPE_GUIDANCE[item.value] ? `（${SHOT_TYPE_GUIDANCE[item.value]}）` : ''}`).join('；')}。`,
          '下面每个编号对应一个独立视频片段，每段依次提供前、中、后三张关键画面，旁白来自该片段音轨。',
          '每段还会提供语义上下文。上下文用于理解跨镜头完整句子，但不得把前后镜头没有出现的画面动作写进当前description。',
          '必须分别判断两个维度：shotType只回答画面实际是什么；contentType回答这段内容在讲什么。两者不得混为一谈。',
          '画面判断只以三张图片为准，旁白不能把户外画面变成测试画面，也不能把参数卡变成上身试穿。旁白只用于补充contentType、品牌和标签。',
          'description只客观描述画面中能看见的人物、物体、动作、环境和图文形式，不得复述画面中没有出现的旁白结论。',
          'TEST_DEMONSTRATION必须看见真实测试动作或仪器；DATA_GRAPHIC用于静态参数卡和知识图；SCREEN_CONTENT用于网页、评论或搜索界面。',
          'BRAND_REVIEW必须能从画面或旁白识别出具体品牌或型号；没有具体品牌时不得使用。片段最后出现总结、收藏、转发、关注等收尾表达时，shotType使用ENDING。',
          '请输出 JSON：{"clips":[{"clipIndex":1,"shotType":"画面类型值","contentType":"内容主题值","description":"客观画面描述","tags":["标签"],"confidence":0.85}]}。',
          '每段还要输出：contentTopics（1-3个允许的内容主题值）、actions（画面动作）、objects（主要物体）、scenes（环境场景）、brands（能确认的品牌）、qualityFlags（质量问题）、qualityScore、usabilityScore、hasPerson、hasTextOverlay。',
          '完整格式：{"clips":[{"clipIndex":1,"shotType":"画面类型值","contentType":"内容主题值","contentTopics":["内容主题值"],"description":"客观画面描述","tags":["标签"],"actions":["喷水测试"],"objects":["防晒衣"],"scenes":["测评工作室"],"brands":["品牌名"],"qualityFlags":[],"qualityScore":0.85,"usabilityScore":0.8,"hasPerson":true,"hasTextOverlay":true,"confidence":0.85}]}。',
          'shotType、contentType和contentTopics只能使用各自允许的值；description控制在80个中文字符以内；各数组写简短、具体、可检索的词；不得遗漏任何编号。',
          'qualityFlags只在确实存在时填写，可用值：画面模糊、快速闪切、遮挡严重、字幕较多、水印明显、信息量低、人物口播占比高；没有问题输出空数组。qualityScore和usabilityScore取0到1。',
          '标签规则：能识别品牌或型号时，必须把准确品牌名/型号作为独立标签；其余标签优先写动作、测试项、场景和具体卖点，不要只写“品牌介绍”这类泛词。',
          context.brandAliases.length
            ? `品牌标准词典：${context.brandAliases.map((item) => `${item.canonical}${item.aliases.length ? `（常见误写：${item.aliases.join('、')}）` : ''}`).join('；')}。画面或旁白对应这些品牌时，必须使用词典中的标准写法。`
            : '',
          '品牌名应优先逐字抄写关键帧中清晰可见的标题或品牌标识，不得按旁白发音自行音译；同一批相邻镜头属于同一品牌时保持写法一致。',
          '置信度规则：分类边界不明确、画面与旁白冲突、品牌文字模糊时应低于0.7，不要给出虚高分数。',
        ].filter(Boolean).join('\n'),
      },
    ]

    for (const clip of clips) {
      content.push({
        type: 'text',
        text: [
          `镜头 ${clip.clipIndex}/${context.totalClips}`,
          `时间：${(clip.startMs / 1000).toFixed(1)}-${(clip.endMs / 1000).toFixed(1)} 秒 / 全片 ${(context.durationMs / 1000).toFixed(1)} 秒`,
          `旁白：${clip.transcript || '未识别到清晰人声'}`,
          `语义上下文：${clip.transcriptContext || clip.transcript || '无'}`,
        ].join('\n'),
      })
      for (const keyframePath of clip.keyframePaths) {
        const keyframe = await readFile(keyframePath)
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${keyframe.toString('base64')}`,
          },
        })
      }
    }

    const payload = await this.requestJson('/chat/completions', {
      model: this.visionModel,
      messages: [
        {
          role: 'system',
          content: '你是电商短视频素材整理员，负责把镜头整理成可复用的业务素材。必须按照用户提供的分类表，以标准 JSON 输出。',
        },
        {
          role: 'user',
          content,
        },
      ],
      response_format: { type: 'json_object' },
      enable_thinking: false,
      temperature: 0.1,
    })

    const parsed = this.parseJsonContent(this.readMessageContent(payload))
    const rows = Array.isArray(parsed?.clips) ? parsed.clips : []
    const allowedTypes = new Set(taxonomy.map((item) => item.value))
    const allowedShotTypes = new Set(shotTypes.map((item) => item.value))
    const fallbackType = allowedTypes.has('OTHER') ? 'OTHER' : 'UNCLASSIFIED'
    const fallbackShotType = allowedShotTypes.has('OTHER') ? 'OTHER' : 'UNCLASSIFIED'

    const results = clips.map((clip) => {
      const row = rows.find((item: any) => Number(item?.clipIndex) === clip.clipIndex) || {}
      const rawConfidence = Number(row.confidence)
      const normalizedConfidence = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence
      const parsedContentType = allowedTypes.has(String(row.contentType))
        ? String(row.contentType)
        : fallbackType
      const parsedShotType = allowedShotTypes.has(String(row.shotType))
        ? String(row.shotType)
        : fallbackShotType

      const normalized = this.normalizeBrandEntities(
        String(row.description || 'AI 未能给出明确画面描述').trim().slice(0, 500),
        this.cleanTags(row.tags),
        context.brandAliases
      )
      const shotType = this.normalizeShotType(parsedShotType, clip, context)
      const contentType = this.normalizeContentType(
        parsedContentType,
        normalized.description,
        normalized.tags,
        allowedTypes,
        context.brandAliases,
        shotType
      )
      const contentTopics = this.cleanStringArray(row.contentTopics, 3)
        .filter((value) => allowedTypes.has(value) && value !== 'UNCLASSIFIED')
      if (!contentTopics.includes(contentType)) contentTopics.unshift(contentType)
      const brands = this.normalizeBrandList(
        this.cleanStringArray(row.brands, 5),
        context.brandAliases
      )
      const qualityScore = this.normalizeScore(row.qualityScore, 0.6)
      const usabilityScore = this.normalizeScore(row.usabilityScore, qualityScore)

      return {
        clipIndex: clip.clipIndex,
        shotType,
        contentType,
        contentTopics: [...new Set(contentTopics)].slice(0, 3),
        description: normalized.description,
        tags: normalized.tags,
        actions: this.cleanStringArray(row.actions, 6),
        objects: this.cleanStringArray(row.objects, 6),
        scenes: this.cleanStringArray(row.scenes, 4),
        brands,
        qualityFlags: this.cleanStringArray(row.qualityFlags, 6),
        qualityScore,
        usabilityScore,
        hasPerson: Boolean(row.hasPerson),
        hasTextOverlay: Boolean(row.hasTextOverlay),
        confidence: Number.isFinite(normalizedConfidence)
          ? Math.max(0, Math.min(1, normalizedConfidence))
          : 0.3,
      }
    })

    return {
      data: results,
      usage: this.readUsage(payload),
    }
  }

  async planNarration(
    narrationText: string,
    productLabel: string,
    taxonomy: TaxonomyOption[],
    shotTypes: TaxonomyOption[]
  ): Promise<AiResponse<VideoNarrationScenePlan[]>> {
    this.assertConfigured()
    const payload = await this.requestJson('/chat/completions', {
      model: this.textModel,
      messages: [
        {
          role: 'system',
          content: '你是短视频剪辑策划，负责把完整旁白拆成可执行的画面段落。只输出标准 JSON，不改写用户事实。',
        },
        {
          role: 'user',
          content: [
            `产品范围：${productLabel}。`,
            `可用内容主题：${taxonomy.map((item) => `${item.value}=${item.label}`).join('；')}。`,
            `可用画面类型：${shotTypes.map((item) => `${item.value}=${item.label}`).join('；')}。`,
            '请按语义和画面需求拆分旁白。每段应是一条可独立配画面的意思，通常持续3-10秒；不要把一句完整的话从中间截断。',
            '不要生成新旁白，只能从原文按顺序切分；所有原文实质内容必须保留且顺序不变。',
            'visualBrief描述应该找什么画面，不要写运镜术语堆砌。contentTypes和shotTypes可多选，keywords写具体动作、物体、场景、品牌或卖点，negativeKeywords写应避开的不相关画面。',
            '为每段选择visualIntent：INFORMATION=参数数据或知识图文；ACTION=测试、洗涤、摩擦或操作动作；EXPERIENCE=试穿、通勤或户外体验；PRODUCT=产品整体或细节；MIXED=多种均可。',
            'targetDurationMs按正常中文口播速度估算，范围3000-12000毫秒。',
            '输出格式：{"scenes":[{"sceneIndex":1,"narrationText":"原文片段","targetDurationMs":5000,"visualBrief":"需要的画面","visualIntent":"ACTION","contentTypes":["内容主题值"],"shotTypes":["画面类型值"],"keywords":["关键词"],"negativeKeywords":["排除词"]}]}。',
            `完整旁白：\n${narrationText.trim()}`,
          ].join('\n'),
        },
      ],
      response_format: { type: 'json_object' },
      enable_thinking: false,
      temperature: 0.1,
    })

    const parsed = this.parseJsonContent(this.readMessageContent(payload))
    const rows = Array.isArray(parsed?.scenes) ? parsed.scenes : []
    const allowedContentTypes = new Set(taxonomy.map((item) => item.value))
    const allowedShotTypes = new Set(shotTypes.map((item) => item.value))
    const allowedVisualIntents = new Set(['INFORMATION', 'ACTION', 'EXPERIENCE', 'PRODUCT', 'MIXED'])
    const plans = rows.map((row: any, index: number) => {
      const text = String(row?.narrationText || '').trim()
      const estimatedDuration = this.estimateNarrationDuration(text)
      const requestedDuration = Math.round(Number(row?.targetDurationMs))
      return {
        sceneIndex: index + 1,
        narrationText: text,
        targetDurationMs: Number.isFinite(requestedDuration)
          ? Math.max(3000, Math.min(12_000, requestedDuration))
          : estimatedDuration,
        visualBrief: String(row?.visualBrief || '').trim().slice(0, 1000),
        contentTypes: this.cleanStringArray(row?.contentTypes, 4)
          .filter((value) => allowedContentTypes.has(value) && value !== 'UNCLASSIFIED'),
        shotTypes: this.cleanStringArray(row?.shotTypes, 4)
          .filter((value) => allowedShotTypes.has(value) && value !== 'UNCLASSIFIED'),
        keywords: this.cleanStringArray(row?.keywords, 10),
        negativeKeywords: this.cleanStringArray(row?.negativeKeywords, 8),
        visualIntent: allowedVisualIntents.has(String(row?.visualIntent))
          ? String(row.visualIntent)
          : this.inferVisualIntent(row?.shotTypes),
      }
    }).filter((scene: VideoNarrationScenePlan) => scene.narrationText)

    if (!plans.length) throw new Error('AI 没有拆出可用的旁白段落，请调整旁白后重试')
    return { data: plans, usage: this.readUsage(payload) }
  }

  private async requestJson(path: string, body: Record<string, unknown>) {
    let lastError: Error | null = null
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 120_000)
      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        const text = await response.text()
        let payload: any = {}
        try {
          payload = text ? JSON.parse(text) : {}
        } catch {
          payload = { message: text }
        }
        if (!response.ok) {
          const error = new Error(this.formatApiError(response.status, payload))
          const retryableStatus = response.status === 429 || response.status >= 500
          if (!retryableStatus || attempt === 3) throw error
          lastError = error
        } else {
          return payload
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('百炼模型调用失败')
        const isRetryable = lastError.name === 'AbortError'
          || /fetch failed|network|429|timeout|超时/i.test(lastError.message)
        if (!isRetryable || attempt === 3) {
          if (lastError.name === 'AbortError') throw new Error('百炼模型响应超过 120 秒')
          throw lastError
        }
      } finally {
        clearTimeout(timeout)
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 1200))
    }
    throw lastError || new Error('百炼模型调用失败')
  }

  private assertConfigured() {
    if (!this.apiKey) throw new Error('尚未配置百炼 API Key')
    if (!this.baseUrl.startsWith('https://')) throw new Error('百炼 API 地址配置不正确')
  }

  private readMessageContent(payload: any) {
    const content = payload?.choices?.[0]?.message?.content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content.map((item) => typeof item === 'string' ? item : item?.text || '').join('')
    }
    return ''
  }

  private parseJsonContent(content: string) {
    const text = content.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
    try {
      return JSON.parse(text)
    } catch {
      throw new Error('百炼返回的分类结果不是有效 JSON，请重试')
    }
  }

  private readUsage(payload: any): VideoMaterialAiUsage {
    const usage = payload?.usage || {}
    return {
      inputTokens: Math.max(0, Number(usage.prompt_tokens || usage.input_tokens || 0)),
      outputTokens: Math.max(0, Number(usage.completion_tokens || usage.output_tokens || 0)),
      audioSeconds: Math.max(0, Number(usage.seconds || usage.audio_seconds || 0)),
    }
  }

  private cleanTags(value: unknown) {
    return this.cleanStringArray(value, 5)
  }

  private cleanStringArray(value: unknown, limit: number) {
    if (!Array.isArray(value)) return []
    return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].slice(0, limit)
  }

  private normalizeScore(value: unknown, fallback: number) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return fallback
    const normalized = parsed > 1 ? parsed / 100 : parsed
    return Math.max(0, Math.min(1, normalized))
  }

  private normalizeBrandList(
    brands: string[],
    entries: ClassificationContext['brandAliases']
  ) {
    const normalized = brands.map((brand) => {
      const match = entries.find((entry) =>
        [entry.canonical, ...entry.aliases]
          .some((alias) => alias.toLowerCase() === brand.toLowerCase())
      )
      return match?.canonical || brand
    })
    return [...new Set(normalized)].slice(0, 5)
  }

  private estimateNarrationDuration(text: string) {
    const characterCount = text.replace(/\s+/g, '').length
    return Math.max(3000, Math.min(12_000, Math.round((characterCount / 4) * 1000)))
  }

  private inferVisualIntent(value: unknown) {
    const shotTypes = Array.isArray(value) ? value.map(String) : []
    if (shotTypes.some((type) => ['TEST_DEMONSTRATION'].includes(type))) return 'ACTION'
    if (shotTypes.some((type) => ['TRY_ON', 'OUTDOOR_USAGE', 'TALKING_HEAD'].includes(type))) {
      return 'EXPERIENCE'
    }
    if (shotTypes.some((type) => ['DATA_GRAPHIC', 'SCREEN_CONTENT', 'TITLE_CARD'].includes(type))) {
      return 'INFORMATION'
    }
    if (shotTypes.some((type) => ['PRODUCT_DISPLAY', 'DETAIL_CLOSEUP'].includes(type))) return 'PRODUCT'
    return 'MIXED'
  }

  private normalizeContentType(
    contentType: string,
    description: string,
    tags: string[],
    allowedTypes: Set<string>,
    brandAliases: ClassificationContext['brandAliases'],
    shotType: string
  ) {
    const text = [description, ...tags].join(' ')
    const hasKnownBrand = brandAliases.some((entry) =>
      [entry.canonical, ...entry.aliases].some((brand) =>
        brand && text.toLowerCase().includes(brand.toLowerCase())
      )
    )

    if (contentType === 'OTHER' && hasKnownBrand && allowedTypes.has('BRAND_REVIEW')) {
      return 'BRAND_REVIEW'
    }

    if (contentType === 'BRAND_REVIEW' && !hasKnownBrand) {
      if (/面罩|袖口|帽檐|遮挡|指洞/.test(text) && allowedTypes.has('COVERAGE_DESIGN')) {
        return 'COVERAGE_DESIGN'
      }
      if (shotType === 'ENDING' && allowedTypes.has('GENERAL_CONTEXT')) {
        return 'GENERAL_CONTEXT'
      }
      return allowedTypes.has('PRODUCT_OVERVIEW') ? 'PRODUCT_OVERVIEW' : contentType
    }

    if (contentType !== 'BRAND_REVIEW' || !allowedTypes.has('BRAND_COMPARISON')) {
      return contentType
    }

    return /多品牌|多个品牌|不同品牌|两款不同品牌|三款不同品牌|多款对比|横向对比/.test(text)
      ? 'BRAND_COMPARISON'
      : contentType
  }

  private normalizeShotType(
    shotType: string,
    clip: VideoMaterialAiClassificationInput,
    context: ClassificationContext
  ) {
    const nearEnd = clip.startMs >= context.durationMs * 0.95
    const closingLanguage = /就到这|结束|收藏|转发|关注|下期|避开.*税|不踩坑/.test(clip.transcript)
    return nearEnd && closingLanguage ? 'ENDING' : shotType
  }

  private normalizeBrandEntities(
    description: string,
    tags: string[],
    entries: ClassificationContext['brandAliases']
  ) {
    const replaceBrands = (value: string) => {
      let normalized = value
      for (const entry of entries) {
        const aliases = [entry.canonical, ...entry.aliases]
          .filter(Boolean)
          .sort((left, right) => right.length - left.length)
        for (const alias of aliases) {
          normalized = normalized.replace(
            new RegExp(this.escapeRegExp(alias), 'gi'),
            entry.canonical
          )
        }
      }
      return normalized
    }

    const normalizedDescription = replaceBrands(description)
    let normalizedTags = [...new Set(tags.map(replaceBrands).filter(Boolean))]
    const searchableText = [normalizedDescription, ...normalizedTags].join(' ')

    for (const entry of entries) {
      if (!searchableText.toLowerCase().includes(entry.canonical.toLowerCase())) continue
      if (normalizedTags.some((tag) => tag.toLowerCase() === entry.canonical.toLowerCase())) continue
      normalizedTags.unshift(entry.canonical)
    }

    return {
      description: normalizedDescription,
      tags: [...new Set(normalizedTags)].slice(0, 5),
    }
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private formatApiError(status: number, payload: any) {
    const detail = String(
      payload?.error?.message
      || payload?.message
      || payload?.code
      || ''
    ).trim()
    if (status === 401) return '百炼 API Key 无效或已失效'
    if (status === 402) return '百炼账户余额或可用额度不足'
    if (status === 403) return '百炼 API Key 没有所选模型的访问权限'
    if (status === 404) return '百炼工作空间中找不到所选模型，请检查模型名称'
    if (status === 429) return '百炼调用过于频繁或账户额度不足，请稍后重试'
    return detail ? `百炼接口返回 ${status}：${detail.slice(0, 500)}` : `百炼接口返回 HTTP ${status}`
  }
}
