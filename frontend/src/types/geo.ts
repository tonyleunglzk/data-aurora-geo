export type GeoKeywordMode = 'exact' | 'recompose'

export interface GeoProductPayload {
  brand: string
  name: string
  type: string
  specs: string
  sellingPoints: string[]
  sellingPointsRange: string
  targetAudience: string
  emphasis: string[]
  emphasisRange: string
  keyword: string
  keywordMode: GeoKeywordMode
  seoKeywords: string[]
  brandPool: string[]
  brandPoolCount: string
}

export interface GeoProfileItem {
  id: number
  profileName: string
  articleUrl: string
  product: GeoProductPayload
  createdAt: string
  updatedAt: string
}

export interface GeoProviderConfigView {
  model: string
  hasApiKey: boolean
  hasBaseUrl: boolean
  apiKeyHint: string
  baseUrlHint: string
}

export interface GeoProviderConfigPayload {
  apiKey?: string
  baseUrl?: string
  model: string
}

export interface GeoProfilePayload extends GeoProductPayload {
  profileName: string
  articleUrl?: string
}

export interface GeoGeneratePayload {
  articleText?: string
  articleUrl?: string
  product: GeoProductPayload
}

export interface GeoGenerateV2Payload extends GeoGeneratePayload {
  versionId: number
}

export type GeoPromptBatchEngineType = 'LEGACY' | 'V2'
export type GeoPromptBatchJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILED' | 'FAILED'
export type GeoPromptBatchItemStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'

export interface GeoPromptBatchCreatePayload {
  engineType: GeoPromptBatchEngineType
  profileId: number
  versionId?: number
  count: number
  articleText?: string
  articleUrl?: string
}

export interface GeoPromptBatchJobItem {
  id: number
  jobId: number
  itemIndex: number
  status: GeoPromptBatchItemStatus
  sequence: number | null
  fileName: string
  promptText: string
  rawOutput: string
  errorMessage: string
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface GeoPromptBatchJob {
  id: number
  engineType: GeoPromptBatchEngineType
  profileId: number
  profileName: string
  versionId: number | null
  versionName: string
  articleUrl: string
  requestedCount: number
  successCount: number
  failedCount: number
  queuedCount: number
  runningCount: number
  progress: number
  status: GeoPromptBatchJobStatus
  lastError: string
  sequenceStart: number | null
  sequenceEnd: number | null
  zipFileName: string
  canDownload: boolean
  createdAt: string
  updatedAt: string
  completedAt: string | null
  items?: GeoPromptBatchJobItem[]
}

export type GeoPublicationOptionType = 'PRODUCT' | 'PLATFORM' | 'ACCOUNT_TYPE'
export type GeoPublicationAccountType = string

export interface GeoPublicationRecord {
  id: number
  publishedAt: string
  product: string
  title: string
  platform: string
  accountType: GeoPublicationAccountType
  author: string
  promptCode: string
  link: string
  promptBatchJobItemId: number | null
  promptFileName: string
  promptBatchJobId: number | null
  promptProductProfile: string
  promptVersionName: string
  baiduAiMatched: boolean
  baiduAiCitationCount: number
  baiduAiMatchedKeywordCount: number
  baiduAiLatestMatchedAt: string
  createdAt: string
  updatedAt: string
}

export interface GeoPublicationRecordPayload {
  publishedAt: string
  product: string
  title: string
  platform: string
  accountType: GeoPublicationAccountType
  author: string
  promptCode: string
  link: string
  promptBatchJobItemId?: number | null
}

export interface GeoPublicationRecordQuery {
  product?: string
  platform?: string
  accountType?: GeoPublicationAccountType | ''
  promptCode?: string
  keyword?: string
  startDate?: string
  endDate?: string
}

export type GeoPublicationImportItemStatus = 'CREATED' | 'SKIPPED' | 'FAILED'

export interface GeoPublicationImportResultItem {
  rowNumber: number
  title: string
  link: string
  status: GeoPublicationImportItemStatus
  reason: string
}

export interface GeoPublicationImportResult {
  success: boolean
  message: string
  fileName: string
  sheetName: string
  totalRows: number
  createdCount: number
  skippedCount: number
  failedCount: number
  rematchedCitationCount: number
  items: GeoPublicationImportResultItem[]
}

export interface GeoPublicationStatsMetric {
  publicationCount: number
  matchedRecordCount: number
  matchedCitationCount: number
  citationCount: number
  matchRate: number
}

export interface GeoPublicationStatsSummary extends GeoPublicationStatsMetric {
  crawlKeywordCount: number
  latestCrawledAt: string
}

export interface GeoPublicationWeeklyStat extends GeoPublicationStatsMetric {
  weekNo: number
  weekLabel: string
  startDate: string
  endDate: string
}

export interface GeoPublicationProductStat extends GeoPublicationStatsMetric {
  product: string
}

export interface GeoPublicationKeywordStat {
  product: string
  keyword: string
  resultCount: number
  successCount: number
  noAiCount: number
  blockedCount: number
  failedCount: number
  citationCount: number
  matchedRecordCount: number
  matchedCitationCount: number
  matchRate: number
  latestCrawledAt: string
}

export interface GeoPublicationPromptCodeStat extends GeoPublicationStatsMetric {
  promptCode: string
}

export interface GeoPublicationStats {
  summary: GeoPublicationStatsSummary
  weeklyTrend: GeoPublicationWeeklyStat[]
  productStats: GeoPublicationProductStat[]
  keywordStats: GeoPublicationKeywordStat[]
  promptCodeStats: GeoPublicationPromptCodeStat[]
}

export interface GeoPublicationOption {
  id: number
  type: GeoPublicationOptionType
  label: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface GeoPublicationOptionsView {
  products: string[]
  platforms: string[]
  accountTypes: GeoPublicationAccountType[]
  items: GeoPublicationOption[]
}

export interface GeoPublicationOptionPayload {
  type: GeoPublicationOptionType
  label: string
}

export interface GeoPromptCodeOption {
  promptCode: string
  fileName: string
  promptBatchJobItemId: number
  promptBatchJobId: number
  productProfile: string
  versionName: string
  engineType: GeoPromptBatchEngineType
  sequence: number | null
  generatedAt: string
}

export interface GeoPublicationCrawlSetting {
  isEnabled: boolean
  dailyRunTime: string
  lookbackDays: number
  maxKeywordsPerRun: number
  requestIntervalMinSec: number
  requestIntervalMaxSec: number
  createdAt: string
  updatedAt: string
}

export interface GeoPublicationCrawlKeyword {
  id: number
  product: string
  keyword: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface GeoPublicationCrawlKeywordPayload {
  product: string
  keyword: string
  isActive?: boolean
  sortOrder?: number
}

export type GeoPublicationCrawlJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILED' | 'FAILED'
export type GeoPublicationCrawlResultStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'NO_AI' | 'BLOCKED' | 'FAILED'

export interface GeoPublicationCrawlCitation {
  id: number
  url: string
  title: string
  sourceName: string
  authorName: string
  brand: string
  publishTime: string
  isMatched: boolean
  publicationRecordId: number | null
  externalId: string
}

export interface GeoPublicationCrawlResult {
  id: number
  jobId: number
  product: string
  keyword: string
  status: GeoPublicationCrawlResultStatus
  aiTitle: string
  contentSummary: string
  citationCount: number
  matchedCitationCount: number
  blockedDetected: boolean
  errorMessage: string
  startedAt: string
  completedAt: string
  citations: GeoPublicationCrawlCitation[]
}

export interface GeoPublicationCrawlJob {
  id: number
  triggerType: string
  scheduleDate: string
  product: string
  status: GeoPublicationCrawlJobStatus
  keywordCount: number
  successCount: number
  noAiCount: number
  blockedCount: number
  failedCount: number
  runningCount: number
  queuedCount: number
  matchedCitationCount: number
  lastError: string
  startedAt: string
  completedAt: string
  createdAt: string
  updatedAt: string
  results: GeoPublicationCrawlResult[]
}

export interface GeoStreamEvent {
  type: 'text' | 'error' | 'done'
  content?: string
}

export interface GeoPromptEngineV2FixedRules {
  ruleText: string
  updatedAt: string
}

export interface GeoPromptEngineLegacyRules {
  summary: string
  ruleText: string
  conditionalNotes: string[]
}

export interface GeoPromptEngineVersion {
  id: number
  name: string
  description: string
  articleUrl: string
  articleText: string
  ruleText: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface GeoPromptEngineVersionPayload {
  name: string
  description?: string
  articleUrl?: string
  articleText?: string
  ruleText: string
  isActive?: boolean
  sortOrder?: number
}

export interface GeoPromptEngineVersionDraftMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
}

export interface GeoPromptEngineVersionDraftChatPayload {
  messages: GeoPromptEngineVersionDraftMessage[]
  articleText?: string
  articleUrl?: string
  notes?: string
  model?: string
}

export type GeoPromptEngineVersionDraftSessionStatus = 'ACTIVE' | 'APPLIED' | 'ARCHIVED'

export interface GeoPromptEngineVersionDraftSession {
  id: number
  title: string
  articleText: string
  articleUrl: string
  notes: string
  model: string
  messages: GeoPromptEngineVersionDraftMessage[]
  status: GeoPromptEngineVersionDraftSessionStatus
  ownerUserId: number | null
  ownerName: string
  suggestedName: string
  suggestedDescription: string
  suggestedRuleText: string
  lastMessagePreview: string
  createdAt: string
  updatedAt: string
}

export interface GeoPromptEngineVersionDraftSessionPayload {
  title?: string
  articleText?: string
  articleUrl?: string
  notes?: string
  model?: string
  messages?: GeoPromptEngineVersionDraftMessage[]
  status?: GeoPromptEngineVersionDraftSessionStatus
  ownerUserId?: number | null
  ownerName?: string
  suggestedName?: string
  suggestedDescription?: string
  suggestedRuleText?: string
}

export interface GeoPromptEngineVersionDraftSuggestion {
  suggestedName: string
  suggestedDescription: string
  suggestedRuleText: string
}

export interface GeoPromptEngineVersionDraftImportPayload {
  fileName: string
  content: string
}

export type GeoV3VariablePickMode = 'ONE' | 'MANY'
export type GeoV3RunMode = 'SINGLE' | 'BATCH'
export type GeoV3FixedRulesMode = 'SYSTEM' | 'NONE'
export type GeoV3RunStatus = 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILED' | 'FAILED'
export type GeoV3ItemStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'

export interface GeoV3Version {
  id: number
  name: string
  description: string
  sourceArticleUrl: string
  sourceArticleText: string
  sourceArticleTitle: string
  ruleText: string
  structureRules: string
  titleRules: string
  paragraphRules: string
  seoGeoRules: string
  forbiddenRules: string
  notes: string
  isActive: boolean
  sortOrder: number
  variableSets?: GeoV3VariableSet[]
  createdAt: string
  updatedAt: string
}

export type GeoV3VersionPayload = Omit<GeoV3Version, 'id' | 'variableSets' | 'createdAt' | 'updatedAt'>

export type GeoV3VersionBatchAction = 'PAUSE' | 'ARCHIVE'

export interface GeoV3VersionBatchActionResult {
  action: GeoV3VersionBatchAction
  requestedCount: number
  affectedCount: number
  ids: number[]
}

export interface GeoV3VersionDraftPayload {
  articleText?: string
  articleUrl?: string
  notes?: string
}

export interface GeoV3VersionDraftChatMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
}

export interface GeoV3VersionDraftChatPayload extends GeoV3VersionDraftPayload {
  messages: GeoV3VersionDraftChatMessage[]
  model?: string
}

export interface GeoV3VariableSetDraftPayload {
  versionName?: string
  ruleText?: string
  rawContent?: string
  notes?: string
  model?: string
}

export interface GeoV3VersionDraftVariableItem {
  name: string
  label: string
  description: string
  candidates: string[]
  pickMode: GeoV3VariablePickMode
  pickMin: number
  pickMax: number
  isActive: boolean
  sortOrder: number
}

export interface GeoV3VersionDraftVariableSet {
  name: string
  description: string
  isActive: boolean
  sortOrder: number
  items: GeoV3VersionDraftVariableItem[]
}

export interface GeoV3VersionDraftSuggestion {
  name: string
  description: string
  sourceArticleUrl: string
  sourceArticleText?: string
  sourceArticleTitle: string
  ruleText: string
  notes: string
  variableSetDraft: GeoV3VersionDraftVariableSet
}

export type GeoV3VersionDraftSessionStatus = 'ACTIVE' | 'APPLIED' | 'ARCHIVED'
export type GeoV3VersionDraftSessionSourceType = 'MANUAL_CHAT' | 'V2_IMPORT' | 'TXT_BATCH'
export type GeoV3BatchTxtJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILED' | 'FAILED'
export type GeoV3BatchTxtJobItemStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'SKIPPED' | 'FAILED'

export interface GeoV3VersionDraftSession {
  id: number
  title: string
  articleText: string
  articleUrl: string
  notes: string
  model: string
  messages: GeoV3VersionDraftChatMessage[]
  status: GeoV3VersionDraftSessionStatus
  ownerUserId: number | null
  ownerName: string
  suggestedName: string
  suggestedDescription: string
  suggestedRuleText: string
  suggestedVariableSetDraft: GeoV3VersionDraftVariableSet
  sourceV2SessionId: number | null
  sourceType: GeoV3VersionDraftSessionSourceType
  sourceBatchTxtJobId: number | null
  sourceBatchTxtJobItemId: number | null
  lastMessagePreview: string
  createdAt: string
  updatedAt: string
}

export interface GeoV3VersionDraftSessionPayload {
  title?: string
  articleText?: string
  articleUrl?: string
  notes?: string
  model?: string
  messages?: GeoV3VersionDraftChatMessage[]
  status?: GeoV3VersionDraftSessionStatus
  ownerUserId?: number | null
  ownerName?: string
  suggestedName?: string
  suggestedDescription?: string
  suggestedRuleText?: string
  suggestedVariableSetDraft?: GeoV3VersionDraftVariableSet
  sourceType?: GeoV3VersionDraftSessionSourceType
}

export interface GeoV3VersionDraftSessionImportV2Payload {
  sourceSessionId: number
}

export interface GeoV3VersionDraftSessionApplyPayload {
  feedback?: string
  forceRefresh?: boolean
}

export interface GeoV3BatchTxtJobFile {
  fileName: string
  content: string
}

export interface GeoV3BatchTxtJobPayload {
  productCategory?: string
  requirements: string[]
  model?: string
  files: GeoV3BatchTxtJobFile[]
}

export interface GeoV3BatchTxtJobItem {
  id: number
  jobId: number
  itemIndex: number
  fileName: string
  versionName: string
  status: GeoV3BatchTxtJobItemStatus
  errorMessage: string
  versionId: number | null
  variableSetId: number | null
  draftSessionId: number | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface GeoV3BatchTxtJob {
  id: number
  productCategory: string
  requirements: string[]
  model: string
  status: GeoV3BatchTxtJobStatus
  requestedCount: number
  successCount: number
  skippedCount: number
  failedCount: number
  queuedCount: number
  runningCount: number
  progress: number
  lastError: string
  ownerUserId: number | null
  ownerName: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
  items?: GeoV3BatchTxtJobItem[]
}

export interface GeoV3FixedRules {
  ruleText: string
  updatedAt: string
}

export interface GeoV3VariableItem {
  id?: number
  setId?: number
  name: string
  label: string
  description: string
  pickMode: GeoV3VariablePickMode
  pickMin: number
  pickMax: number
  candidates: string[]
  isActive: boolean
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export interface GeoV3VariableSet {
  id: number
  versionId: number | null
  name: string
  description: string
  isActive: boolean
  sortOrder: number
  items: GeoV3VariableItem[]
  createdAt: string
  updatedAt: string
}

export interface GeoV3VariableSetPayload {
  versionId?: number
  name: string
  description: string
  isActive: boolean
  sortOrder: number
  items: GeoV3VariableItem[]
}

export interface GeoV3Product {
  id: number
  name: string
  brand: string
  productName: string
  category: string
  targetAudience: string
  coreParameters: string
  keyword: string
  keywordMode: GeoKeywordMode
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
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type GeoV3ProductPayload = Omit<GeoV3Product, 'id' | 'createdAt' | 'updatedAt'>

export interface GeoV3GeneratePayload {
  articleText?: string
  articleUrl?: string
  versionId: number
  variableSetId?: number
  productProfileId: number
  count: number
  topic?: string
  extraRequirements?: string
  fixedRulesMode?: GeoV3FixedRulesMode
}

export interface GeoV3SelectedVariable {
  name: string
  label: string
  description: string
  values: string[]
}

export interface GeoV3SelectedProductContent {
  requiredContent: string[]
  randomContent: string[]
  sellingPoints: string[]
  emphasis: string[]
  brandPool: string[]
}

export interface GeoV3GenerationItem {
  id: number
  runId: number
  itemIndex: number
  status: GeoV3ItemStatus
  fileName: string
  promptText: string
  selectedVariables: GeoV3SelectedVariable[]
  selectedProductContent: GeoV3SelectedProductContent
  errorMessage: string
  createdAt: string
  updatedAt: string
}

export interface GeoV3GenerationRun {
  id: number
  mode: GeoV3RunMode
  fixedRulesMode: GeoV3FixedRulesMode
  status: GeoV3RunStatus
  versionId: number | null
  variableSetId: number | null
  productProfileId: number | null
  versionName: string
  variableSetName: string
  productProfileName: string
  topic: string
  extraRequirements: string
  articleUrl: string
  articleText: string
  versionSnapshot: GeoV3Version
  variableSetSnapshot: GeoV3VariableSet
  productSnapshot: GeoV3Product
  requestedCount: number
  successCount: number
  failedCount: number
  zipFileName: string
  canDownload: boolean
  lastError: string
  itemCount: number
  items?: GeoV3GenerationItem[]
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface GeoSerpAiSummaryDraft {
  projectId: number
  projectKeyword: string
  category: string
  engine: string
  requestedModel: string
  model: string
  fallbackUsed: boolean
  fallbackReason: string
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

export interface GeoSerpAiSummaryTestPayload {
  model?: string
  allowFallback?: boolean
}

export interface GeoSerpAiSummaryPromptPreview {
  requestedModel: string
  fallbackModel: string
  analyzedCount: number
  primaryIncludedCount: number
  retryIncludedCount: number
  fullTextIncludedCount: number
  excerptFallbackCount: number
  systemPrompt: string
  userPrompt: string
  retryUserPrompt: string
}

export type GeoSerpAiSummaryTestPrompt = GeoSerpAiSummaryPromptPreview

export interface GeoSerpAiSummaryStreamEvent {
  type: 'text' | 'status' | 'reset' | 'result' | 'error' | 'done'
  content?: string
  model?: string | null
  phase?: 'starting' | 'fallback' | 'repairing' | 'completed'
  summary?: GeoSerpAiSummaryDraft
}

export type GeoSerpProjectStatus = 'SUCCEEDED' | 'BLOCKED' | 'FAILED'
export type GeoSerpResultStatus = 'ANALYZED' | 'FETCH_FAILED'
export type GeoSerpResearchMode = 'automatic' | 'manual'

export interface GeoSerpKeywordHits {
  keyword: string
  titleMatches: number
  snippetMatches: number
  articleMatches: number
}

export interface GeoSerpAnalysisSummary {
  titlePattern: string
  leadPreview: string
  hasHeadings: boolean
  hasListStyle: boolean
}

export interface GeoSerpProjectSummary {
  id: number
  category: string
  keyword: string
  rankLimit: number
  engine: string
  domainFilter: string
  status: GeoSerpProjectStatus
  statusMessage: string
  inspectedCount: number
  matchedCount: number
  baiduBlockedDetected: boolean
  hasAiSummary: boolean
  createdAt: string
  updatedAt: string
}

export interface GeoSerpAiSummary extends GeoSerpAiSummaryDraft {
  id: number
  createdAt: string
  updatedAt: string
  projectUpdatedAt: string
}

export interface GeoSerpResultItem {
  id: number
  rank: number
  title: string
  snippet: string
  searchUrl: string
  finalUrl: string
  domain: string
  fetchStatus: GeoSerpResultStatus
  fetchMessage: string
  contentLength: number
  paragraphCount: number
  titleLength: number
  keywordHits: GeoSerpKeywordHits
  patternTags: string[]
  headingOutline: string[]
  analysisSummary: GeoSerpAnalysisSummary
  articleExcerpt: string
  publishAt: string
  author: string
  createdAt: string
  updatedAt: string
}

export interface GeoSerpProjectDetail extends GeoSerpProjectSummary {
  aiSummary: GeoSerpAiSummary | null
  results: GeoSerpResultItem[]
}

export interface GeoSerpProjectPayload {
  mode: GeoSerpResearchMode
  category: string
  keyword?: string
  rankLimit?: number
  articleUrls?: string[]
}

export interface GeoRuleCard {
  id: number
  category: string
  model: string
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
  sourceSummaryCount: number
  sourceSummaryIds: number[]
  sourceTimeStart: string | null
  sourceTimeEnd: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface GeoRuleCardGeneratePayload {
  category: string
  fromDate?: string
  toDate?: string
}
