<template>
  <PageHeader
    eyebrow="Video Library"
    title="视频素材库"
    :description="workspaceMode === 'LIBRARY'
      ? '把长视频拆成可检索、可复用的业务镜头素材。'
      : '按完整旁白规划画面、匹配素材并合成视频。'"
  >
    <template #actions>
      <el-radio-group v-model="selectedProduct" class="product-switch">
        <el-radio-button
          v-for="product in taxonomy"
          :key="product.value"
          :value="product.value"
        >
          {{ product.label }}
        </el-radio-button>
      </el-radio-group>
    </template>
  </PageHeader>

  <div class="video-workspace-switch">
    <el-segmented v-model="workspaceMode" :options="workspaceOptions" />
  </div>

  <VideoAssemblyWorkbench
    v-if="workspaceMode === 'ASSEMBLY'"
    :product-category="selectedProduct"
    :taxonomy="activeTaxonomy"
  />

  <section v-else class="material-workbench">
    <aside class="material-sidebar">
      <div class="panel-heading">
        <div>
          <h2>导入视频</h2>
          <span>{{ activeProductLabel }}素材库</span>
        </div>
        <el-button :icon="Refresh" :loading="loadingMaterials" circle plain @click="refreshData()" />
      </div>

      <div class="upload-controls">
        <button class="native-upload" type="button" @click="openFilePicker">
          <el-icon><UploadFilled /></el-icon>
          <span>选择视频</span>
        </button>
        <input
          id="material-video-input"
          ref="fileInputRef"
          accept="video/mp4,video/quicktime,video/x-m4v,video/x-msvideo,video/x-matroska,video/webm,.mp4,.mov,.m4v,.avi,.mkv,.webm"
          class="native-file-input"
          multiple
          type="file"
          @change="handleFileSelection"
        />

        <div class="split-settings">
          <div class="setting-row">
            <span>拆片精度</span>
            <el-segmented v-model="sceneThreshold" :options="sensitivityOptions" />
          </div>
          <div class="setting-row">
            <span>最短片段</span>
            <el-select v-model="minClipDurationMs">
              <el-option :value="3000" label="3 秒" />
              <el-option :value="4000" label="4 秒" />
              <el-option :value="5000" label="5 秒" />
            </el-select>
          </div>
          <div class="setting-row">
            <span>最长片段</span>
            <el-select v-model="maxClipDurationMs">
              <el-option :value="10000" label="10 秒" />
              <el-option :value="15000" label="15 秒" />
              <el-option :value="20000" label="20 秒" />
              <el-option :value="30000" label="30 秒" />
            </el-select>
          </div>
        </div>

        <div v-if="pendingFiles.length" class="pending-files">
          <div v-for="(file, index) in pendingFiles" :key="`${file.name}-${file.lastModified}`">
            <div>
              <strong>{{ file.name }}</strong>
              <span>{{ formatFileSize(file.size) }}</span>
            </div>
            <el-button :icon="Close" circle text @click="removePendingFile(index)" />
          </div>
        </div>

        <el-button
          :disabled="!pendingFiles.length"
          :loading="uploading"
          class="upload-submit"
          type="primary"
          @click="startUpload"
        >
          {{ uploading ? `正在导入 ${uploadProgress.current}/${uploadProgress.total}` : `导入并拆片${pendingFiles.length ? `（${pendingFiles.length}）` : ''}` }}
        </el-button>
      </div>

      <div class="library-heading">
        <strong>处理记录</strong>
        <span>{{ materials.length }} 个视频</span>
      </div>

      <div v-loading="loadingMaterials && !materials.length" class="material-list">
        <button
          v-for="material in materials"
          :key="material.id"
          :class="['material-list-item', { active: material.id === selectedMaterialId }]"
          type="button"
          @click="selectMaterial(material.id)"
        >
          <div class="material-list-item__top">
            <strong :title="material.originalName">{{ material.originalName }}</strong>
            <el-tag :type="statusTagType(material.status)" effect="light" size="small">
              {{ statusLabel(material.status) }}
            </el-tag>
          </div>
          <div class="material-list-item__meta">
            <span>{{ material.clipCount }} 段</span>
            <span>{{ formatDuration(material.durationMs) }}</span>
            <span>{{ formatDate(material.createdAt) }}</span>
          </div>
          <el-progress
            v-if="isMaterialBusy(material)"
            :percentage="material.aiStatus === 'QUEUED' || material.aiStatus === 'ANALYZING' ? material.aiProgress : material.progress"
            :show-text="false"
            :stroke-width="4"
          />
          <span v-if="material.status === 'PROCESSING' || material.status === 'QUEUED'" class="material-stage">
            {{ material.stage }}
          </span>
          <span v-else-if="material.aiStatus === 'QUEUED' || material.aiStatus === 'ANALYZING'" class="material-stage">
            {{ material.aiStage }}
          </span>
          <span v-else-if="material.status === 'FAILED'" class="material-error">
            {{ material.errorMessage }}
          </span>
        </button>

        <el-empty v-if="!loadingMaterials && !materials.length" description="还没有视频素材" :image-size="72" />
      </div>
    </aside>

    <main class="material-detail">
      <div v-if="selectedMaterial" class="detail-content">
        <header class="detail-header">
          <div class="detail-title">
            <div class="detail-title__row">
              <h2>{{ selectedMaterial.originalName }}</h2>
              <el-tag :type="statusTagType(selectedMaterial.status)" effect="light">
                {{ statusLabel(selectedMaterial.status) }}
              </el-tag>
            </div>
            <div class="detail-meta">
              <span>{{ formatDuration(selectedMaterial.durationMs) }}</span>
              <span v-if="selectedMaterial.width">{{ selectedMaterial.width }} × {{ selectedMaterial.height }}</span>
              <span>{{ selectedMaterial.hasAudio ? '有声音' : '无声音' }}</span>
              <span>{{ formatFileSize(Number(selectedMaterial.fileSizeBytes)) }}</span>
            </div>
          </div>
          <div class="detail-actions">
            <el-button
              :disabled="selectedMaterial.status !== 'READY' || aiRunning || !aiConfiguration.configured"
              :icon="MagicStick"
              :loading="aiRunning"
              type="primary"
              @click="handleAiAnalysis"
            >
              {{ aiButtonLabel }}
            </el-button>
            <el-button
              :disabled="selectedMaterial.status === 'PROCESSING' || aiRunning"
              :icon="Refresh"
              :loading="previewingSegmentation"
              plain
              @click="handleReprocess"
            >
              预览重新拆片
            </el-button>
            <el-button
              :disabled="selectedMaterial.status === 'PROCESSING' || aiRunning"
              :icon="Delete"
              plain
              type="danger"
              @click="handleDeleteMaterial"
            >
              删除
            </el-button>
          </div>
        </header>

        <div v-if="selectedMaterial.status === 'FAILED'" class="failure-notice">
          <el-icon><WarningFilled /></el-icon>
          <div>
            <strong>视频处理失败</strong>
            <span>{{ selectedMaterial.errorMessage }}</span>
          </div>
        </div>

        <div
          v-else-if="selectedMaterial.status === 'QUEUED' || selectedMaterial.status === 'PROCESSING'"
          class="processing-notice"
        >
          <div class="processing-notice__head">
            <strong>{{ selectedMaterial.stage }}</strong>
            <span>{{ selectedMaterial.progress }}%</span>
          </div>
          <el-progress :percentage="selectedMaterial.progress" :show-text="false" :stroke-width="8" />
        </div>

        <div v-if="aiRunning" class="ai-analysis-notice">
          <div class="processing-notice__head">
            <div>
              <strong>{{ selectedMaterial.aiStage }}</strong>
              <span>刷新或关闭页面不会中断任务</span>
            </div>
            <span>{{ selectedMaterial.aiProgress }}%</span>
          </div>
          <el-progress :percentage="selectedMaterial.aiProgress" :show-text="false" :stroke-width="8" />
        </div>

        <div v-else-if="selectedMaterial.aiStatus === 'FAILED'" class="failure-notice ai-failure-notice">
          <el-icon><WarningFilled /></el-icon>
          <div>
            <strong>AI 智能分类失败</strong>
            <span>{{ selectedMaterial.aiErrorMessage }}</span>
          </div>
        </div>

        <div v-else-if="selectedMaterial.aiStatus === 'COMPLETED'" class="ai-result-notice">
          <div>
            <strong>{{ selectedMaterial.aiStage }}</strong>
            <span>已结合关键画面和旁白生成分类、描述与标签，等待人工确认。</span>
          </div>
          <el-button
            v-if="highConfidencePendingCount"
            :loading="confirmingAiClips"
            plain
            size="small"
            type="primary"
            @click="confirmHighConfidenceClips"
          >
            确认可信镜头（{{ highConfidencePendingCount }}）
          </el-button>
          <span v-if="selectedMaterial.aiErrorMessage">{{ selectedMaterial.aiErrorMessage }}</span>
          <div class="ai-usage-breakdown">
            <span>语音 {{ selectedMaterial.aiAudioSeconds.toFixed(1) }} 秒</span>
            <span>视觉输入 {{ formatTokenEstimate(selectedMaterial.aiInputTokens) }}</span>
            <span>视觉输出 {{ formatTokenEstimate(selectedMaterial.aiOutputTokens) }}</span>
            <span>时间轴 {{ selectedMaterial.transcriptSegmentCount }} 句</span>
          </div>
        </div>

        <template v-if="selectedMaterial.status === 'READY'">
          <section class="source-preview-band">
            <video
              :key="selectedMaterial.id"
              :src="resolveVideoMaterialUrl(selectedMaterial.sourceUrl)"
              controls
              playsinline
              preload="metadata"
            />
            <div class="source-insights">
              <div class="source-summary">
                <div>
                  <span>拆分结果</span>
                  <strong>{{ selectedMaterial.clipCount }} 个镜头</strong>
                </div>
                <div>
                  <span>已确认分类</span>
                  <strong>{{ confirmedClipCount }} / {{ selectedMaterial.clipCount }}</strong>
                </div>
                <div>
                  <span>AI 已识别</span>
                  <strong>{{ aiAnalyzedClipCount }} / {{ selectedMaterial.clipCount }}</strong>
                </div>
                <div>
                  <span>平均时长</span>
                  <strong>{{ averageClipDuration }}</strong>
                </div>
              </div>
              <div v-if="selectedMaterial.segmentation" class="segmentation-summary">
                <span>识别 {{ selectedMaterial.segmentation.detectedSceneCount }} 次画面变化</span>
                <span>合并 {{ selectedMaterial.segmentation.mergedShortSegmentCount }} 个过短片段</span>
                <span v-if="selectedMaterial.segmentation.forcedSplitCount">
                  补切 {{ selectedMaterial.segmentation.forcedSplitCount }} 个过长镜头
                </span>
                <span>
                  时长范围
                  {{ formatDuration(selectedMaterial.segmentation.shortestSegmentMs) }} -
                  {{ formatDuration(selectedMaterial.segmentation.longestSegmentMs) }}
                </span>
              </div>
            </div>
          </section>

          <section class="clip-section">
            <div class="clip-section__head">
              <div>
                <h3>镜头片段</h3>
                <span>按原视频时间顺序排列</span>
              </div>
              <div class="clip-toolbar">
                <el-checkbox
                  :indeterminate="someFilteredClipsSelected && !allFilteredClipsSelected"
                  :model-value="allFilteredClipsSelected"
                  @change="toggleAllFilteredClips"
                >
                  选择当前
                </el-checkbox>
                <el-button
                  :disabled="!selectedClipIds.length || aiRunning"
                  :icon="MagicStick"
                  plain
                  size="small"
                  @click="handleSelectedAiAnalysis"
                >
                  重识别已选（{{ selectedClipIds.length }}）
                </el-button>
                <el-select v-model="clipFilter" class="clip-filter-select" size="small">
                  <el-option label="全部镜头" value="ALL" />
                  <el-option label="待确认" value="PENDING" />
                  <el-option label="重点复核" value="NEEDS_REVIEW" />
                  <el-option label="已确认" value="CONFIRMED" />
                  <el-option label="动态画面" value="DYNAMIC" />
                  <el-option label="静态图文" value="STATIC" />
                  <el-option label="语音跨镜头" value="SPEECH_CROSS" />
                  <el-option label="低可用度" value="LOW_USABILITY" />
                </el-select>
              </div>
            </div>

            <div v-if="filteredClips.length" class="clip-grid">
              <article v-for="clip in filteredClips" :key="clip.id" class="clip-card">
                <button class="clip-thumb" type="button" @click="openClipPreview(clip)">
                  <img :src="resolveVideoMaterialUrl(clip.keyframeUrl)" alt="" loading="lazy" />
                  <span class="clip-number">{{ String(clip.clipIndex).padStart(2, '0') }}</span>
                  <span class="clip-play"><el-icon><VideoPlay /></el-icon></span>
                  <span class="clip-time">{{ formatRange(clip) }}</span>
                </button>

                <div class="clip-fields">
                  <div class="clip-selection-row">
                    <el-checkbox
                      :model-value="selectedClipIds.includes(clip.id)"
                      @change="toggleClipSelection(clip.id, Boolean($event))"
                    >
                      选择重识别
                    </el-checkbox>
                  </div>
                  <div class="clip-classification-row">
                    <label class="clip-taxonomy-field">
                      <span>画面类型</span>
                      <el-select v-model="clip.shotType" placeholder="选择画面类型">
                        <el-option
                          v-for="option in activeShotTypes"
                          :key="option.value"
                          :label="option.label"
                          :value="option.value"
                        />
                      </el-select>
                    </label>
                    <label class="clip-taxonomy-field">
                      <span>内容主题</span>
                      <el-select v-model="clip.contentType" placeholder="选择内容主题">
                        <el-option
                          v-for="option in activeContentTypes"
                          :key="option.value"
                          :label="option.label"
                          :value="option.value"
                        />
                      </el-select>
                    </label>
                    <el-tag
                      :type="clipReviewTagType(clip.reviewStatus)"
                      effect="light"
                      size="small"
                    >
                      {{ clipReviewLabel(clip.reviewStatus) }}
                    </el-tag>
                  </div>
                  <el-input
                    v-model="clip.description"
                    :autosize="{ minRows: 2, maxRows: 4 }"
                    maxlength="300"
                    placeholder="补充这个镜头的内容，例如：洗衣机高速旋转，展示耐洗场景"
                    type="textarea"
                  />
                  <div v-if="hasStructuredMetadata(clip)" class="clip-dimensions">
                    <div v-if="clip.contentTopics.length">
                      <span>主题</span>
                      <el-tag v-for="topic in clip.contentTopics" :key="topic" effect="plain" size="small">
                        {{ contentTypeLabel(topic) }}
                      </el-tag>
                    </div>
                    <div v-if="clip.actions.length">
                      <span>动作</span>
                      <el-tag v-for="action in clip.actions" :key="action" effect="plain" size="small">
                        {{ action }}
                      </el-tag>
                    </div>
                    <div v-if="clip.objects.length">
                      <span>物体</span>
                      <el-tag v-for="object in clip.objects" :key="object" effect="plain" size="small">
                        {{ object }}
                      </el-tag>
                    </div>
                    <div v-if="clip.scenes.length">
                      <span>场景</span>
                      <el-tag v-for="scene in clip.scenes" :key="scene" effect="plain" size="small">
                        {{ scene }}
                      </el-tag>
                    </div>
                    <div v-if="clip.brands.length">
                      <span>品牌</span>
                      <el-tag v-for="brand in clip.brands" :key="brand" effect="plain" size="small" type="success">
                        {{ brand }}
                      </el-tag>
                    </div>
                    <div>
                      <span>画面</span>
                      <el-tag v-if="clip.hasPerson" effect="plain" size="small">有人物</el-tag>
                      <el-tag v-if="clip.hasTextOverlay" effect="plain" size="small" type="warning">有原字幕</el-tag>
                      <el-tag v-if="clip.motionLevel !== 'UNKNOWN'" effect="plain" size="small">
                        {{ motionLevelLabel(clip.motionLevel) }}
                      </el-tag>
                      <el-tag
                        v-if="isSpeechCrossing(clip.speechBoundaryStatus)"
                        effect="plain"
                        size="small"
                        type="warning"
                      >
                        语音跨镜头
                      </el-tag>
                      <el-tag v-if="clip.usabilityScore !== null" effect="plain" size="small">
                        可用度 {{ Math.round(clip.usabilityScore * 100) }}
                      </el-tag>
                    </div>
                    <div v-if="clip.qualityFlags.length">
                      <span>注意</span>
                      <el-tag v-for="flag in clip.qualityFlags" :key="flag" effect="plain" size="small" type="danger">
                        {{ flag }}
                      </el-tag>
                    </div>
                  </div>
                  <div v-if="clip.transcript" class="clip-transcript">
                    <span>旁白</span>
                    <p>{{ clip.transcript }}</p>
                  </div>
                  <div
                    v-if="clip.transcriptContext && clip.transcriptContext !== clip.transcript"
                    class="clip-transcript clip-transcript--context"
                  >
                    <span>完整语境</span>
                    <p>{{ clip.transcriptContext }}</p>
                  </div>
                  <div v-if="clip.analyzedAt" class="clip-ai-meta">
                    <span v-if="clip.confidence !== null">AI {{ Math.round(clip.confidence * 100) }}%</span>
                    <el-tag v-for="tag in clip.tags" :key="tag" effect="plain" size="small">
                      {{ tag }}
                    </el-tag>
                  </div>
                  <div class="clip-card__footer">
                    <span>{{ formatSeconds(clip.durationMs) }}</span>
                    <el-button
                      :disabled="clip.shotType === 'UNCLASSIFIED' || clip.contentType === 'UNCLASSIFIED'"
                      :loading="savingClipIds.includes(clip.id)"
                      size="small"
                      type="primary"
                      @click="saveClip(clip)"
                    >
                      确认分类
                    </el-button>
                  </div>
                </div>
              </article>
            </div>
            <el-empty v-else description="当前筛选条件下没有片段" :image-size="72" />
          </section>
        </template>
      </div>

      <el-empty v-else description="选择一个视频查看拆片结果" :image-size="96" />
    </main>
  </section>

  <el-dialog
    v-model="previewVisible"
    :title="previewClip
      ? `镜头 ${previewClip.clipIndex} · ${shotTypeLabel(previewClip.shotType)} · ${contentTypeLabel(previewClip.contentType)}`
      : '镜头预览'"
    class="clip-preview-dialog"
    destroy-on-close
    width="min(860px, 92vw)"
  >
    <video
      v-if="previewClip"
      :src="resolveVideoMaterialUrl(previewClip.clipUrl)"
      class="clip-preview-video"
      controls
      playsinline
      preload="metadata"
    />
    <template #footer>
      <div class="preview-footer">
        <span v-if="previewClip">{{ formatRange(previewClip) }} · {{ formatSeconds(previewClip.durationMs) }}</span>
        <div>
          <el-button :disabled="!canPreviewPrevious" @click="moveClipPreview(-1)">上一段</el-button>
          <el-button :disabled="!canPreviewNext" @click="moveClipPreview(1)">下一段</el-button>
        </div>
      </div>
    </template>
  </el-dialog>

  <el-dialog
    v-model="segmentationPreviewVisible"
    class="segmentation-preview-dialog"
    title="重新拆片预览"
    width="min(760px, 92vw)"
  >
    <template v-if="segmentationPreview">
      <p class="segmentation-preview-intro">
        这里只计算新的切点，不会修改当前镜头。确认应用后，新片段全部生成成功才会替换旧结果。
      </p>
      <div class="segmentation-compare">
        <section>
          <span>当前结果</span>
          <strong>{{ segmentationPreview.current.clipCount }} 个镜头</strong>
          <small>
            {{ formatSeconds(segmentationPreview.current.shortestSegmentMs) }} -
            {{ formatSeconds(segmentationPreview.current.longestSegmentMs) }}
          </small>
        </section>
        <section class="is-preview">
          <span>新拆片方案</span>
          <strong>{{ segmentationPreview.preview.outputSegmentCount }} 个镜头</strong>
          <small>
            {{ formatSeconds(segmentationPreview.preview.shortestSegmentMs) }} -
            {{ formatSeconds(segmentationPreview.preview.longestSegmentMs) }}
          </small>
        </section>
      </div>
      <div class="segmentation-preview-facts">
        <span>识别 {{ segmentationPreview.preview.detectedSceneCount }} 次画面变化</span>
        <span>合并 {{ segmentationPreview.preview.mergedShortSegmentCount }} 个过短片段</span>
        <span>补切 {{ segmentationPreview.preview.forcedSplitCount }} 个过长镜头</span>
        <span>平均 {{ formatSeconds(segmentationPreview.preview.averageSegmentMs) }}</span>
      </div>
      <el-alert
        v-if="segmentationPreview.current.confirmedClipCount"
        :closable="false"
        show-icon
        title="当前人工确认的分类会随旧镜头一起替换"
        type="warning"
      />
      <el-alert
        v-if="segmentationPreview.linkedSceneCount"
        :closable="false"
        show-icon
        :title="`有 ${segmentationPreview.linkedSceneCount} 个成片分段正在使用旧镜头，应用后需要重新匹配`"
        type="warning"
      />
      <div class="segmentation-segment-list">
        <div
          v-for="segment in segmentationPreview.preview.segments"
          :key="segment.clipIndex"
        >
          <strong>{{ String(segment.clipIndex).padStart(2, '0') }}</strong>
          <span>{{ formatTimecode(segment.startMs) }} - {{ formatTimecode(segment.endMs) }}</span>
          <span>{{ formatSeconds(segment.durationMs) }}</span>
        </div>
      </div>
    </template>
    <template #footer>
      <el-button @click="segmentationPreviewVisible = false">取消</el-button>
      <el-button
        :loading="applyingSegmentation"
        type="primary"
        @click="applyReprocess"
      >
        应用新拆片方案
      </el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  Close,
  Delete,
  MagicStick,
  Refresh,
  UploadFilled,
  VideoPlay,
  WarningFilled,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import VideoAssemblyWorkbench from './VideoAssemblyWorkbench.vue'
import {
  analyzeVideoMaterial,
  confirmVideoMaterialAiClips,
  fetchVideoMaterialAiConfiguration,
  fetchVideoMaterial,
  fetchVideoMaterials,
  fetchVideoMaterialTaxonomy,
  previewVideoMaterialAiAnalysis,
  previewVideoMaterialSegmentation,
  removeVideoMaterial,
  reprocessVideoMaterial,
  resolveVideoMaterialUrl,
  updateVideoMaterialClip,
  uploadVideoMaterial,
  type VideoMaterial,
  type VideoMaterialAiAnalysisInput,
  type VideoMaterialAiAnalysisPreview,
  type VideoMaterialAiConfiguration,
  type VideoMaterialClip,
  type VideoMaterialProductCategory,
  type VideoMaterialSegmentationPreview,
  type VideoMaterialStatus,
  type VideoMaterialTaxonomy,
} from '@/api/videoMaterials'

const taxonomy = ref<VideoMaterialTaxonomy[]>([])
const aiConfiguration = reactive<VideoMaterialAiConfiguration>({
  configured: false,
  visionModel: '',
  asrModel: '',
  timelineAsrModel: '',
  timelineAsrConfigured: false,
  textModel: '',
})
const selectedProduct = ref<VideoMaterialProductCategory>('SUN_PROTECTIVE_CLOTHING')
const workspaceMode = ref<'LIBRARY' | 'ASSEMBLY'>('LIBRARY')
const materials = ref<VideoMaterial[]>([])
const selectedMaterialId = ref<number | null>(null)
const selectedMaterial = ref<VideoMaterial | null>(null)
const loadingMaterials = ref(false)
const uploading = ref(false)
const pendingFiles = ref<File[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const sceneThreshold = ref(0.3)
const minClipDurationMs = ref(4000)
const maxClipDurationMs = ref(15_000)
const clipFilter = ref<
  | 'ALL'
  | 'PENDING'
  | 'NEEDS_REVIEW'
  | 'CONFIRMED'
  | 'DYNAMIC'
  | 'STATIC'
  | 'SPEECH_CROSS'
  | 'LOW_USABILITY'
>('ALL')
const selectedClipIds = ref<number[]>([])
const savingClipIds = ref<number[]>([])
const confirmingAiClips = ref(false)
const previewVisible = ref(false)
const previewClip = ref<VideoMaterialClip | null>(null)
const previewingSegmentation = ref(false)
const applyingSegmentation = ref(false)
const segmentationPreviewVisible = ref(false)
const segmentationPreview = ref<VideoMaterialSegmentationPreview | null>(null)
const uploadProgress = reactive({ current: 0, total: 0 })
let pollTimer: ReturnType<typeof setTimeout> | null = null

const sensitivityOptions = [
  { label: '稳健', value: 0.38 },
  { label: '标准', value: 0.3 },
  { label: '细致', value: 0.22 },
]

const workspaceOptions = [
  { label: '素材整理', value: 'LIBRARY' },
  { label: '旁白成片', value: 'ASSEMBLY' },
]

const activeTaxonomy = computed(() =>
  taxonomy.value.find((item) => item.value === selectedProduct.value)
)

const activeProductLabel = computed(() => activeTaxonomy.value?.label ?? '视频')

const activeContentTypes = computed(() => activeTaxonomy.value?.contentTypes ?? [])

const activeShotTypes = computed(() => activeTaxonomy.value?.shotTypes ?? [])

const clips = computed(() => selectedMaterial.value?.clips ?? [])

const filteredClips = computed(() => {
  if (clipFilter.value === 'ALL') return clips.value
  if (clipFilter.value === 'DYNAMIC') {
    return clips.value.filter((clip) => ['LOW', 'MEDIUM', 'HIGH'].includes(clip.motionLevel))
  }
  if (clipFilter.value === 'STATIC') {
    return clips.value.filter((clip) => (
      clip.motionLevel === 'STATIC'
      || ['DATA_GRAPHIC', 'SCREEN_CONTENT', 'TITLE_CARD'].includes(clip.shotType)
    ))
  }
  if (clipFilter.value === 'SPEECH_CROSS') {
    return clips.value.filter((clip) => isSpeechCrossing(clip.speechBoundaryStatus))
  }
  if (clipFilter.value === 'LOW_USABILITY') {
    return clips.value.filter((clip) => (clip.usabilityScore ?? 1) < 0.5)
  }
  return clips.value.filter((clip) => clip.reviewStatus === clipFilter.value)
})

const selectedClipIdSet = computed(() => new Set(selectedClipIds.value))
const selectedFilteredClipCount = computed(() =>
  filteredClips.value.filter((clip) => selectedClipIdSet.value.has(clip.id)).length
)
const allFilteredClipsSelected = computed(() =>
  filteredClips.value.length > 0
  && selectedFilteredClipCount.value === filteredClips.value.length
)
const someFilteredClipsSelected = computed(() => selectedFilteredClipCount.value > 0)

const confirmedClipCount = computed(() =>
  clips.value.filter((clip) => clip.reviewStatus === 'CONFIRMED').length
)

const aiAnalyzedClipCount = computed(() =>
  clips.value.filter((clip) => Boolean(clip.analyzedAt)).length
)

const highConfidencePendingCount = computed(() =>
  clips.value.filter((clip) =>
    clip.reviewStatus !== 'CONFIRMED'
    && (clip.confidence ?? 0) >= 0.75
    && !['UNCLASSIFIED', 'OTHER', 'TRANSITION'].includes(clip.shotType)
    && !['UNCLASSIFIED', 'OTHER'].includes(clip.contentType)
  ).length
)

const aiRunning = computed(() =>
  selectedMaterial.value?.aiStatus === 'QUEUED'
  || selectedMaterial.value?.aiStatus === 'ANALYZING'
)

const aiButtonLabel = computed(() => {
  if (aiRunning.value) return 'AI 分类中'
  if (selectedMaterial.value?.aiStatus === 'COMPLETED') return '重新智能分类'
  if (selectedMaterial.value?.aiStatus === 'FAILED') return '重试智能分类'
  return 'AI 智能分类'
})

const averageClipDuration = computed(() => {
  if (!clips.value.length) return '0 秒'
  const total = clips.value.reduce((sum, clip) => sum + clip.durationMs, 0)
  return formatSeconds(total / clips.value.length)
})

const previewIndex = computed(() =>
  previewClip.value ? clips.value.findIndex((clip) => clip.id === previewClip.value?.id) : -1
)

const canPreviewPrevious = computed(() => previewIndex.value > 0)
const canPreviewNext = computed(() => previewIndex.value >= 0 && previewIndex.value < clips.value.length - 1)

const clearPollTimer = () => {
  if (pollTimer) clearTimeout(pollTimer)
  pollTimer = null
}

const schedulePoll = () => {
  clearPollTimer()
  const hasRunningMaterial = materials.value.some((material) =>
    material.status === 'QUEUED'
    || material.status === 'PROCESSING'
    || material.aiStatus === 'QUEUED'
    || material.aiStatus === 'ANALYZING'
  )
  if (!hasRunningMaterial) return
  pollTimer = setTimeout(() => void refreshData(true), 2000)
}

const loadSelectedMaterial = async () => {
  if (!selectedMaterialId.value) {
    selectedMaterial.value = null
    return
  }
  try {
    selectedMaterial.value = await fetchVideoMaterial(selectedMaterialId.value)
  } catch (error) {
    selectedMaterial.value = null
    selectedMaterialId.value = null
    throw error
  }
}

const refreshData = async (silent = false) => {
  if (!silent) loadingMaterials.value = true
  try {
    materials.value = await fetchVideoMaterials(selectedProduct.value)
    if (!materials.value.some((material) => material.id === selectedMaterialId.value)) {
      selectedMaterialId.value = materials.value[0]?.id ?? null
    }
    await loadSelectedMaterial()
  } catch (error) {
    if (!silent) ElMessage.error(error instanceof Error ? error.message : '素材库加载失败')
  } finally {
    loadingMaterials.value = false
    schedulePoll()
  }
}

const selectMaterial = async (id: number) => {
  selectedMaterialId.value = id
  try {
    await loadSelectedMaterial()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '视频详情加载失败')
  }
}

const handleFileSelection = (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  const acceptedExtensions = /\.(mp4|mov|m4v|avi|mkv|webm)$/i
  const accepted = files.filter((file) => acceptedExtensions.test(file.name))
  if (accepted.length !== files.length) {
    ElMessage.warning('已忽略不支持的文件，仅接受常见视频格式')
  }
  const existingKeys = new Set(pendingFiles.value.map((file) => `${file.name}-${file.size}-${file.lastModified}`))
  pendingFiles.value.push(...accepted.filter((file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`)))
  input.value = ''
}

const openFilePicker = () => {
  fileInputRef.value?.click()
}

const removePendingFile = (index: number) => {
  pendingFiles.value.splice(index, 1)
}

const startUpload = async () => {
  if (!pendingFiles.value.length || uploading.value) return
  uploading.value = true
  const queue = [...pendingFiles.value]
  uploadProgress.total = queue.length
  uploadProgress.current = 0
  let succeeded = 0

  try {
    for (const file of queue) {
      uploadProgress.current += 1
      try {
        const material = await uploadVideoMaterial(file, {
          productCategory: selectedProduct.value,
          sceneThreshold: sceneThreshold.value,
          minClipDurationMs: minClipDurationMs.value,
          maxClipDurationMs: maxClipDurationMs.value,
        })
        succeeded += 1
        selectedMaterialId.value = material.id
        pendingFiles.value = pendingFiles.value.filter((item) => item !== file)
      } catch (error) {
        ElMessage.error(`${file.name}：${error instanceof Error ? error.message : '导入失败'}`)
      }
    }
    if (succeeded) ElMessage.success(`${succeeded} 个视频已进入拆片队列`)
    await refreshData(true)
  } finally {
    uploading.value = false
    uploadProgress.current = 0
    uploadProgress.total = 0
  }
}

const saveClip = async (clip: VideoMaterialClip) => {
  if (clip.shotType === 'UNCLASSIFIED' || clip.contentType === 'UNCLASSIFIED') {
    ElMessage.warning('请先选择画面类型和内容主题')
    return
  }
  savingClipIds.value.push(clip.id)
  try {
    const updated = await updateVideoMaterialClip(clip.id, {
      shotType: clip.shotType,
      contentType: clip.contentType,
      description: clip.description,
      reviewStatus: 'CONFIRMED',
    })
    Object.assign(clip, updated)
    ElMessage.success(`镜头 ${clip.clipIndex} 已确认`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '分类保存失败')
  } finally {
    savingClipIds.value = savingClipIds.value.filter((id) => id !== clip.id)
  }
}

const confirmHighConfidenceClips = async () => {
  if (!selectedMaterial.value || confirmingAiClips.value) return
  confirmingAiClips.value = true
  try {
    const result = await confirmVideoMaterialAiClips(selectedMaterial.value.id)
    ElMessage.success(result.confirmedCount
      ? `已确认 ${result.confirmedCount} 个高置信度镜头`
      : '没有新的高置信度镜头')
    await refreshData(true)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '批量确认失败')
  } finally {
    confirmingAiClips.value = false
  }
}

const toggleClipSelection = (clipId: number, checked: boolean) => {
  const selection = new Set(selectedClipIds.value)
  if (checked) selection.add(clipId)
  else selection.delete(clipId)
  selectedClipIds.value = [...selection]
}

const toggleAllFilteredClips = (checked: string | number | boolean) => {
  const selection = new Set(selectedClipIds.value)
  for (const clip of filteredClips.value) {
    if (Boolean(checked)) selection.add(clip.id)
    else selection.delete(clip.id)
  }
  selectedClipIds.value = [...selection]
}

const hasStructuredMetadata = (clip: VideoMaterialClip) =>
  clip.contentTopics.length > 0
  || clip.actions.length > 0
  || clip.objects.length > 0
  || clip.scenes.length > 0
  || clip.brands.length > 0
  || clip.qualityFlags.length > 0
  || clip.hasPerson
  || clip.hasTextOverlay
  || clip.usabilityScore !== null

const isSpeechCrossing = (status: string) => [
  'CROSSES_START',
  'CROSSES_END',
  'CROSSES_BOTH',
].includes(status)

const motionLevelLabel = (level: string) => ({
  STATIC: '静态画面',
  LOW: '轻微运动',
  MEDIUM: '中等运动',
  HIGH: '明显运动',
}[level] || '动态未知')

const formatTokenEstimate = (value: number | null) => value === null
  ? '暂无历史数据'
  : new Intl.NumberFormat('zh-CN').format(value)

const startAiAnalysis = async (input: VideoMaterialAiAnalysisInput = {}) => {
  if (!selectedMaterial.value || aiRunning.value) return
  if (!aiConfiguration.configured) {
    ElMessage.error('后端尚未配置百炼 API Key')
    return
  }

  const isRerun = selectedMaterial.value.aiStatus === 'COMPLETED'
    || selectedMaterial.value.aiStatus === 'FAILED'
  try {
    const preview: VideoMaterialAiAnalysisPreview = await previewVideoMaterialAiAnalysis(
      selectedMaterial.value.id,
      input
    )
    await ElMessageBox.confirm(
      [
        `本次识别 ${preview.clipCount} 个镜头、约 ${preview.keyframeCount} 张关键画面。`,
        preview.timelineWillBeCreated
          ? `将先识别整条约 ${preview.audioSeconds.toFixed(1)} 秒的音轨，并按时间轴回填完整语境。`
          : `已有 ${preview.timelineSegmentCount} 条句级时间轴，将直接复用，不重复付费识别。`,
        `参考历史用量：输入 ${formatTokenEstimate(preview.estimatedInputTokens)} tokens，输出 ${formatTokenEstimate(preview.estimatedOutputTokens)} tokens。`,
        `系统会把整条压缩音轨交给 ${preview.timelineAsrModel}，并把每个镜头的三张关键画面发送到阿里云百炼。`,
        preview.confirmedClipCount
          ? `所选范围包含 ${preview.confirmedClipCount} 个已确认镜头，它们会重新进入待确认状态。`
          : '未选择的镜头和已经人工确认的镜头不会被覆盖。',
        '任务进入后台后，刷新或关闭页面不会中断。',
      ].join('\n'),
      input.clipIds?.length
        ? `重识别所选 ${preview.clipCount} 个镜头`
        : isRerun ? '重新进行 AI 智能分类' : '开始 AI 智能分类',
      {
        type: 'warning',
        confirmButtonText: '确认并开始',
        cancelButtonText: '取消',
        dangerouslyUseHTMLString: false,
      }
    )
    await analyzeVideoMaterial(selectedMaterial.value.id, input)
    selectedClipIds.value = []
    ElMessage.success('已进入 AI 智能分类队列')
    await refreshData(true)
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error instanceof Error ? error.message : 'AI 智能分类启动失败')
  }
}

const handleAiAnalysis = () => startAiAnalysis()

const handleSelectedAiAnalysis = () => startAiAnalysis({ clipIds: [...selectedClipIds.value] })

const handleReprocess = async () => {
  if (!selectedMaterial.value || previewingSegmentation.value) return
  previewingSegmentation.value = true
  try {
    segmentationPreview.value = await previewVideoMaterialSegmentation(selectedMaterial.value.id, {
      sceneThreshold: sceneThreshold.value,
      minClipDurationMs: minClipDurationMs.value,
      maxClipDurationMs: maxClipDurationMs.value,
    })
    segmentationPreviewVisible.value = true
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '拆片预览失败')
  } finally {
    previewingSegmentation.value = false
  }
}

const applyReprocess = async () => {
  if (!selectedMaterial.value || !segmentationPreview.value || applyingSegmentation.value) return
  applyingSegmentation.value = true
  try {
    await reprocessVideoMaterial(selectedMaterial.value.id, segmentationPreview.value.configuration)
    segmentationPreviewVisible.value = false
    segmentationPreview.value = null
    ElMessage.success('已进入安全重新拆片队列，失败时会保留原结果')
    await refreshData(true)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '重新拆片失败')
  } finally {
    applyingSegmentation.value = false
  }
}

const handleDeleteMaterial = async () => {
  if (!selectedMaterial.value) return
  try {
    await ElMessageBox.confirm(
      `将永久删除“${selectedMaterial.value.originalName}”及其所有片段。`,
      '删除视频素材',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    await removeVideoMaterial(selectedMaterial.value.id)
    selectedMaterialId.value = null
    selectedMaterial.value = null
    ElMessage.success('视频素材已删除')
    await refreshData(true)
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
  }
}

const openClipPreview = (clip: VideoMaterialClip) => {
  previewClip.value = clip
  previewVisible.value = true
}

const moveClipPreview = (direction: -1 | 1) => {
  const target = clips.value[previewIndex.value + direction]
  if (target) previewClip.value = target
}

const contentTypeLabel = (value: string) =>
  activeContentTypes.value.find((item) => item.value === value)?.label ?? '待分类'

const shotTypeLabel = (value: string) =>
  activeShotTypes.value.find((item) => item.value === value)?.label ?? '待判断画面'

const isMaterialBusy = (material: VideoMaterial) =>
  material.status === 'QUEUED'
  || material.status === 'PROCESSING'
  || material.aiStatus === 'QUEUED'
  || material.aiStatus === 'ANALYZING'

const clipReviewLabel = (status: VideoMaterialClip['reviewStatus']) => ({
  PENDING: '待确认',
  NEEDS_REVIEW: '重点复核',
  CONFIRMED: '已确认',
}[status])

const clipReviewTagType = (
  status: VideoMaterialClip['reviewStatus']
): 'success' | 'warning' | 'danger' => ({
  PENDING: 'warning',
  NEEDS_REVIEW: 'danger',
  CONFIRMED: 'success',
}[status] as 'success' | 'warning' | 'danger')

const statusLabel = (status: VideoMaterialStatus) => ({
  QUEUED: '排队中',
  PROCESSING: '拆片中',
  READY: '可用',
  FAILED: '失败',
}[status])

const statusTagType = (status: VideoMaterialStatus): 'success' | 'warning' | 'danger' | 'info' => ({
  QUEUED: 'info',
  PROCESSING: 'warning',
  READY: 'success',
  FAILED: 'danger',
}[status] as 'success' | 'warning' | 'danger' | 'info')

const formatSeconds = (milliseconds: number) => {
  const seconds = Math.max(0, milliseconds) / 1000
  return `${seconds >= 10 ? seconds.toFixed(1) : seconds.toFixed(2).replace(/0$/, '')} 秒`
}

const formatDuration = (milliseconds: number) => {
  if (!milliseconds) return '待识别'
  const totalSeconds = Math.round(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds} 秒`
}

const formatTimecode = (milliseconds: number) => {
  const totalSeconds = Math.max(0, milliseconds) / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`
}

const formatRange = (clip: VideoMaterialClip) =>
  `${formatTimecode(clip.startMs)} - ${formatTimecode(clip.endMs)}`

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(unitIndex > 1 ? 1 : 0)} ${units[unitIndex]}`
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .format(new Date(value))

watch(selectedProduct, () => {
  clearPollTimer()
  selectedMaterialId.value = null
  selectedMaterial.value = null
  pendingFiles.value = []
  void refreshData()
})

watch(workspaceMode, () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
})

watch(() => selectedMaterial.value?.id, () => {
  selectedClipIds.value = []
  const material = selectedMaterial.value
  if (!material) return
  sceneThreshold.value = material.sceneThreshold
  minClipDurationMs.value = material.minClipDurationMs
  maxClipDurationMs.value = material.maxClipDurationMs
})

onMounted(async () => {
  document.body.classList.add('video-materials-route')
  try {
    const [taxonomyResult, configurationResult] = await Promise.all([
      fetchVideoMaterialTaxonomy(),
      fetchVideoMaterialAiConfiguration(),
    ])
    taxonomy.value = taxonomyResult
    Object.assign(aiConfiguration, configurationResult)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '素材库配置加载失败')
  }
  await refreshData()
})

onBeforeUnmount(() => {
  clearPollTimer()
  document.body.classList.remove('video-materials-route')
})
</script>

<style scoped>
.video-workspace-switch {
  display: flex;
  justify-content: flex-start;
  margin: -4px 0 14px;
}

.video-workspace-switch :deep(.el-segmented) {
  min-width: 260px;
}

.material-workbench {
  display: grid;
  grid-template-columns: minmax(290px, 340px) minmax(0, 1fr);
  min-height: 680px;
  overflow: hidden;
  border: 1px solid rgba(217, 107, 114, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 18px 42px rgba(121, 67, 70, 0.08);
}

.material-sidebar {
  display: flex;
  min-width: 0;
  flex-direction: column;
  border-right: 1px solid rgba(217, 107, 114, 0.16);
  background: #fffafa;
}

.panel-heading,
.detail-header,
.clip-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.panel-heading {
  padding: 20px 20px 14px;
}

.panel-heading h2,
.detail-header h2,
.clip-section__head h3 {
  margin: 0;
  color: #3e3032;
  letter-spacing: 0;
}

.panel-heading h2 {
  font-size: 18px;
}

.panel-heading span,
.library-heading span,
.clip-section__head span {
  color: #937d80;
  font-size: 13px;
}

.upload-controls {
  padding: 0 20px 20px;
  border-bottom: 1px solid rgba(217, 107, 114, 0.14);
}

.native-upload {
  display: flex;
  height: 72px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed rgba(217, 107, 114, 0.52);
  border-radius: 6px;
  color: #c95a62;
  background: #fff5f5;
  cursor: pointer;
  font-weight: 650;
  width: 100%;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.native-upload:hover {
  border-color: #c95a62;
  background: #fff0f0;
}

.native-file-input {
  position: fixed;
  left: -10000px;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.split-settings {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.setting-row {
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  color: #68575a;
  font-size: 13px;
}

.setting-row :deep(.el-segmented),
.setting-row :deep(.el-select) {
  width: 100%;
}

.pending-files {
  display: grid;
  max-height: 144px;
  gap: 6px;
  margin-top: 12px;
  overflow: auto;
}

.pending-files > div {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 8px 7px 10px;
  border: 1px solid #f3dfe0;
  border-radius: 5px;
  background: #fff;
}

.pending-files > div > div {
  min-width: 0;
}

.pending-files strong,
.pending-files span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-files strong {
  color: #59494c;
  font-size: 12px;
}

.pending-files span {
  margin-top: 2px;
  color: #a28e91;
  font-size: 11px;
}

.upload-submit {
  width: 100%;
  margin-top: 14px;
}

.library-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 10px;
  color: #534346;
  font-size: 14px;
}

.material-list {
  flex: 1;
  min-height: 280px;
  max-height: calc(100vh - 420px);
  padding: 0 10px 14px;
  overflow: auto;
}

.material-list-item {
  display: block;
  width: 100%;
  margin: 0 0 7px;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.material-list-item:hover {
  background: #fff;
}

.material-list-item.active {
  border-color: rgba(217, 107, 114, 0.35);
  background: #fff;
  box-shadow: 0 5px 16px rgba(121, 67, 70, 0.06);
}

.material-list-item__top,
.material-list-item__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.material-list-item__top {
  justify-content: space-between;
}

.material-list-item__top strong {
  min-width: 0;
  overflow: hidden;
  color: #49393c;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-list-item__meta {
  margin: 6px 0;
  color: #a08b8e;
  font-size: 11px;
}

.material-stage,
.material-error {
  display: -webkit-box;
  margin-top: 5px;
  overflow: hidden;
  font-size: 11px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.material-stage {
  color: #9b777b;
}

.material-error {
  color: #c45656;
}

.material-detail {
  min-width: 0;
  padding: 24px;
  background: #fff;
}

.detail-content {
  min-width: 0;
}

.detail-header {
  align-items: flex-start;
  padding-bottom: 20px;
  border-bottom: 1px solid #f2e4e5;
}

.detail-title {
  min-width: 0;
}

.detail-title__row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.detail-title__row h2 {
  overflow: hidden;
  font-size: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin-top: 8px;
  color: #927e81;
  font-size: 12px;
}

.detail-actions {
  display: flex;
  flex: none;
  gap: 8px;
}

.failure-notice,
.processing-notice {
  margin-top: 20px;
  border-radius: 6px;
}

.failure-notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 16px;
  color: #b84f56;
  background: #fff3f3;
}

.failure-notice div,
.failure-notice span {
  display: block;
}

.failure-notice span {
  margin-top: 4px;
  color: #8e696d;
  font-size: 13px;
}

.processing-notice {
  padding: 18px;
  border: 1px solid #f4dddd;
  background: #fff8f8;
}

.ai-analysis-notice,
.ai-result-notice {
  margin-top: 20px;
  border-radius: 6px;
}

.ai-analysis-notice {
  padding: 18px;
  border: 1px solid #f0d7d9;
  background: #fff6f6;
}

.ai-result-notice {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid #dcebd4;
  color: #4f7048;
  background: #f6fbf3;
}

.ai-result-notice div,
.ai-result-notice strong,
.ai-result-notice span,
.processing-notice__head div span {
  display: block;
}

.ai-result-notice .ai-usage-breakdown {
  display: flex;
  flex: 1 1 100%;
  flex-wrap: wrap;
  gap: 5px 14px;
}

.ai-result-notice .ai-usage-breakdown span {
  margin: 0;
  color: #6d8667;
  white-space: nowrap;
}

.ai-result-notice span,
.processing-notice__head div span {
  margin-top: 3px;
  color: #8c7a7d;
  font-size: 12px;
}

.ai-failure-notice {
  margin-top: 20px;
}

.processing-notice__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  color: #684f52;
  font-size: 13px;
}

.source-preview-band {
  display: grid;
  grid-template-columns: minmax(260px, 420px) minmax(0, 1fr);
  gap: 20px;
  align-items: stretch;
  margin: 20px 0 24px;
}

.source-preview-band video {
  width: 100%;
  height: 220px;
  border-radius: 6px;
  object-fit: contain;
  background: #211e1f;
}

.source-insights {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
}

.source-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border: 1px solid #f1e1e2;
  border-radius: 6px;
  background: #fffafa;
}

.source-summary > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  padding: 18px;
}

.source-summary > div + div {
  border-left: 1px solid #f1e1e2;
}

.source-summary span {
  color: #9b8588;
  font-size: 12px;
}

.source-summary strong {
  margin-top: 7px;
  color: #c95a62;
  font-size: 21px;
  letter-spacing: 0;
}

.segmentation-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  padding: 10px 14px;
  border-left: 3px solid #e7a0a5;
  color: #806d70;
  background: #fff7f7;
  font-size: 12px;
  line-height: 1.7;
}

.clip-section__head {
  margin-bottom: 14px;
}

.clip-section__head h3 {
  font-size: 17px;
}

.clip-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.clip-filter-select {
  width: 150px;
}

.clip-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.clip-card {
  display: grid;
  grid-template-columns: minmax(180px, 42%) minmax(0, 1fr);
  min-width: 0;
  overflow: hidden;
  border: 1px solid #eedfe0;
  border-radius: 6px;
  background: #fff;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.clip-card:hover {
  border-color: rgba(217, 107, 114, 0.48);
  box-shadow: 0 7px 20px rgba(121, 67, 70, 0.07);
}

.clip-thumb {
  position: relative;
  min-height: 210px;
  padding: 0;
  overflow: hidden;
  border: 0;
  color: #fff;
  background: #292526;
  cursor: pointer;
}

.clip-thumb img {
  width: 100%;
  height: 100%;
  min-height: 210px;
  object-fit: cover;
}

.clip-number,
.clip-time,
.clip-play {
  position: absolute;
  z-index: 1;
}

.clip-number {
  top: 10px;
  left: 10px;
  display: grid;
  width: 32px;
  height: 28px;
  place-items: center;
  border-radius: 4px;
  background: rgba(35, 27, 29, 0.76);
  font-size: 12px;
  font-weight: 700;
}

.clip-time {
  right: 8px;
  bottom: 8px;
  padding: 4px 6px;
  border-radius: 3px;
  background: rgba(35, 27, 29, 0.78);
  font-size: 10px;
}

.clip-play {
  top: 50%;
  left: 50%;
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 50%;
  background: rgba(35, 27, 29, 0.48);
  font-size: 21px;
  transform: translate(-50%, -50%);
}

.clip-fields {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

.clip-selection-row {
  display: flex;
  min-height: 22px;
  align-items: center;
  justify-content: flex-end;
}

.clip-selection-row :deep(.el-checkbox__label) {
  color: #8f7a7d;
  font-size: 11px;
}

.clip-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.clip-classification-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: end;
  gap: 8px;
}

.clip-taxonomy-field {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.clip-taxonomy-field > span {
  color: #8f7a7d;
  font-size: 11px;
}

.clip-taxonomy-field :deep(.el-select) {
  width: 100%;
  min-width: 0;
}

.clip-transcript {
  padding: 8px 10px;
  border-left: 3px solid #f1b6ba;
  color: #68575a;
  background: #fff8f8;
  font-size: 12px;
}

.clip-transcript span {
  color: #c95a62;
  font-weight: 650;
}

.clip-transcript p {
  display: -webkit-box;
  margin: 3px 0 0;
  overflow: hidden;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.clip-transcript--context {
  border-left-color: #e1a981;
  background: #fffaf5;
}

.clip-transcript--context span {
  color: #a96e42;
}

.clip-dimensions {
  display: grid;
  gap: 6px;
  padding: 9px 10px;
  border: 1px solid #f0e3e4;
  border-radius: 5px;
  background: #fffdfd;
}

.clip-dimensions > div {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
}

.clip-dimensions > div > span:first-child {
  width: 34px;
  flex: 0 0 34px;
  color: #9a7e82;
  font-size: 11px;
  font-weight: 650;
}

.clip-ai-meta {
  display: flex;
  min-height: 24px;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
}

.clip-ai-meta > span {
  margin-right: 2px;
  color: #9a767a;
  font-size: 11px;
  font-weight: 650;
}

.clip-card__footer {
  margin-top: auto;
}

.clip-card__footer span {
  color: #9b8588;
  font-size: 12px;
}

.clip-preview-video {
  display: block;
  width: 100%;
  max-height: 66vh;
  background: #211e1f;
}

.preview-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.preview-footer > span {
  color: #8f7a7d;
  font-size: 13px;
}

.segmentation-preview-intro {
  margin: 0 0 16px;
  color: #7e6c6f;
  line-height: 1.7;
}

.segmentation-compare {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.segmentation-compare section {
  display: grid;
  min-height: 108px;
  align-content: center;
  gap: 5px;
  padding: 16px 18px;
  border: 1px solid rgba(217, 107, 114, 0.18);
  border-radius: 6px;
  background: #fffafa;
}

.segmentation-compare section.is-preview {
  border-color: rgba(217, 107, 114, 0.45);
  background: #fff1f1;
}

.segmentation-compare span,
.segmentation-compare small {
  color: #8f7a7d;
}

.segmentation-compare strong {
  color: #3f3335;
  font-size: 21px;
}

.segmentation-preview-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin: 14px 0;
  color: #8f7a7d;
  font-size: 13px;
}

.segmentation-preview-dialog :deep(.el-alert) {
  margin-top: 10px;
}

.segmentation-segment-list {
  max-height: 220px;
  margin-top: 14px;
  overflow: auto;
  border-top: 1px solid rgba(217, 107, 114, 0.14);
  border-bottom: 1px solid rgba(217, 107, 114, 0.14);
}

.segmentation-segment-list > div {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 82px;
  align-items: center;
  min-height: 42px;
  border-bottom: 1px solid rgba(217, 107, 114, 0.1);
  font-size: 13px;
}

.segmentation-segment-list > div:last-child {
  border-bottom: 0;
}

.segmentation-segment-list > div span:last-child {
  color: #8f7a7d;
  text-align: right;
}

@media (max-width: 1280px) {
  .clip-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  :global(body.video-materials-route) {
    min-width: 0;
  }

  :global(body.video-materials-route .topbar) {
    gap: 8px;
    padding: 8px 12px;
  }

  :global(body.video-materials-route .brand-block) {
    min-width: auto;
  }

  :global(body.video-materials-route .brand-name),
  :global(body.video-materials-route .topbar-actions) {
    display: none;
  }

  :global(body.video-materials-route .topnav) {
    justify-content: flex-start;
    overflow-x: auto;
    scrollbar-width: none;
  }

  :global(body.video-materials-route .topnav::-webkit-scrollbar) {
    display: none;
  }

  :global(body.video-materials-route .topnav-item) {
    flex: none;
  }

  :global(body.video-materials-route .tabs-shell) {
    top: 53px;
  }

  :global(body.video-materials-route .tabs-shell__inner),
  :global(body.video-materials-route .page-shell) {
    width: calc(100% - 24px);
  }

  :global(body.video-materials-route .section-tip) {
    display: none;
  }

  :global(body.video-materials-route .page-header) {
    align-items: stretch;
    flex-direction: column;
    padding: 20px;
    border-radius: 8px;
  }

  :global(body.video-materials-route .page-header h1) {
    font-size: 28px;
  }

  :global(body.video-materials-route .page-actions),
  .product-switch {
    width: 100%;
  }

  .product-switch :deep(.el-radio-button) {
    flex: 1;
  }

  .product-switch :deep(.el-radio-button__inner) {
    width: 100%;
  }

  .material-workbench {
    grid-template-columns: 1fr;
  }

  .material-sidebar {
    border-right: 0;
    border-bottom: 1px solid rgba(217, 107, 114, 0.16);
  }

  .material-list {
    max-height: 320px;
  }

  .source-preview-band {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .material-detail {
    padding: 16px;
  }

  .detail-header,
  .clip-section__head {
    align-items: stretch;
    flex-direction: column;
  }

  .detail-actions {
    width: 100%;
  }

  .detail-actions :deep(.el-button) {
    flex: 1;
  }

  .source-summary {
    grid-template-columns: 1fr;
  }

  .source-summary > div + div {
    border-top: 1px solid #f1e1e2;
    border-left: 0;
  }

  .clip-card {
    grid-template-columns: 1fr;
  }

  .clip-thumb,
  .clip-thumb img {
    min-height: 190px;
  }

  .preview-footer {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
