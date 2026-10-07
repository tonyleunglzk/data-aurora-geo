<template>
  <section class="assembly-workbench">
    <aside class="assembly-sidebar">
      <div class="assembly-sidebar__head">
        <div>
          <h2>旁白成片</h2>
          <span>{{ taxonomy?.label || '当前产品' }} · {{ projects.length }} 个项目</span>
        </div>
        <el-button :icon="Refresh" :loading="loadingProjects" circle plain @click="refreshProjects()" />
      </div>

      <el-button :icon="Plus" class="new-project-button" type="primary" @click="openCreateDialog">
        新建成片项目
      </el-button>

      <div v-loading="loadingProjects && !projects.length" class="assembly-project-list">
        <button
          v-for="project in projects"
          :key="project.id"
          :class="['assembly-project-item', { active: project.id === selectedProjectId }]"
          type="button"
          @click="selectProject(project.id)"
        >
          <div>
            <strong>{{ project.name }}</strong>
            <el-tag :type="statusTagType(project.status)" effect="light" size="small">
              {{ statusLabel(project.status) }}
            </el-tag>
          </div>
          <p>{{ project.stage }}</p>
          <span>{{ project.sceneCount }} 段 · {{ formatDate(project.updatedAt) }}</span>
          <el-progress
            v-if="isBusy(project.status)"
            :percentage="project.progress"
            :show-text="false"
            :stroke-width="4"
          />
        </button>
        <el-empty v-if="!loadingProjects && !projects.length" description="还没有成片项目" :image-size="72" />
      </div>
    </aside>

    <main class="assembly-detail">
      <template v-if="selectedProject">
        <header class="assembly-detail__head">
          <div>
            <div class="assembly-title-row">
              <h2>{{ selectedProject.name }}</h2>
              <el-tag :type="statusTagType(selectedProject.status)" effect="light">
                {{ statusLabel(selectedProject.status) }}
              </el-tag>
            </div>
            <span>{{ selectedProject.stage }}</span>
          </div>
          <div class="assembly-actions">
            <label class="confirmed-only-control">
              <span>只用已确认素材</span>
              <el-switch v-model="confirmedOnly" />
            </label>
            <el-button
              :disabled="isBusy(selectedProject.status)"
              :icon="Refresh"
              :loading="matching"
              plain
              @click="rematchProject"
            >
              重新匹配
            </el-button>
            <el-button
              :disabled="!canRender || isBusy(selectedProject.status)"
              :icon="VideoPlay"
              type="primary"
              @click="startRender"
            >
              {{ selectedProject.narrationAudioUrl ? '合成视频' : '导出静音预览' }}
            </el-button>
            <el-button
              :disabled="isBusy(selectedProject.status)"
              :icon="Delete"
              plain
              type="danger"
              @click="deleteProject"
            />
          </div>
        </header>

        <div v-if="isBusy(selectedProject.status)" class="assembly-progress">
          <div>
            <strong>{{ selectedProject.stage }}</strong>
            <span>{{ selectedProject.progress }}%</span>
          </div>
          <el-progress :percentage="selectedProject.progress" :show-text="false" :stroke-width="8" />
        </div>

        <div v-if="selectedProject.status === 'FAILED'" class="assembly-error">
          <el-icon><WarningFilled /></el-icon>
          <div>
            <strong>{{ selectedProject.stage }}</strong>
            <span>{{ selectedProject.errorMessage }}</span>
          </div>
        </div>

        <section class="assembly-summary">
          <div>
            <span>旁白分段</span>
            <strong>{{ selectedProject.sceneCount }}</strong>
          </div>
          <div>
            <span>已匹配画面</span>
            <strong>{{ matchedSceneCount }} / {{ selectedProject.sceneCount }}</strong>
          </div>
          <div>
            <span>预计时长</span>
            <strong>{{ formatSeconds(estimatedDurationMs) }}</strong>
          </div>
          <div>
            <span>旁白音频</span>
            <strong>{{ selectedProject.narrationAudioUrl ? '已上传' : '未上传' }}</strong>
          </div>
        </section>
        <div class="assembly-ai-usage">
          <span>旁白规划模型 {{ selectedProject.aiModel || '尚未规划' }}</span>
          <span>输入 {{ selectedProject.aiInputTokens.toLocaleString('zh-CN') }} tokens</span>
          <span>输出 {{ selectedProject.aiOutputTokens.toLocaleString('zh-CN') }} tokens</span>
        </div>

        <section class="assembly-settings">
          <div class="assembly-section-head">
            <div>
              <h3>旁白与输出</h3>
              <span>修改旁白后需要重新智能规划。</span>
            </div>
            <div>
              <el-button :disabled="isBusy(selectedProject.status)" :loading="savingProject" @click="saveProjectSettings">
                保存
              </el-button>
              <el-button
                :disabled="isBusy(selectedProject.status)"
                :icon="MagicStick"
                :loading="planning"
                type="primary"
                @click="replanProject"
              >
                重新智能规划
              </el-button>
            </div>
          </div>
          <el-input
            v-model="projectDraft.narrationText"
            :autosize="{ minRows: 5, maxRows: 12 }"
            maxlength="100000"
            type="textarea"
          />
          <div class="material-scope-settings">
            <div class="settings-field">
              <span>素材范围</span>
              <el-segmented v-model="projectDraft.sourceMode" :options="sourceModeOptions" />
            </div>
            <div v-if="projectDraft.sourceMode === 'SELECTED'" class="source-material-picker settings-field">
              <span>指定来源视频</span>
              <el-select
                v-model="projectDraft.sourceMaterialIds"
                collapse-tags
                collapse-tags-tooltip
                filterable
                multiple
                placeholder="选择一个或多个已拆片视频"
              >
                <el-option
                  v-for="material in availableMaterials"
                  :key="material.id"
                  :disabled="material.status !== 'READY'"
                  :label="`${material.originalName}（${material.clipCount} 段）`"
                  :value="material.id"
                />
              </el-select>
            </div>
          </div>
          <div class="output-settings-row">
            <div class="settings-field">
              <span>画面比例</span>
              <el-segmented v-model="projectDraft.aspectRatio" :options="aspectRatioOptions" />
            </div>
            <label class="subtitle-switch">
              <span>处理原字幕区域</span>
              <el-switch v-model="projectDraft.removeSourceSubtitles" />
            </label>
            <label>
              <span>画面适配</span>
              <el-select v-model="projectDraft.framingMode" class="framing-select">
                <el-option
                  v-for="option in framingModeOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </label>
            <div class="audio-control">
              <input
                ref="audioInputRef"
                accept="audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/flac,audio/ogg,.mp3,.wav,.m4a,.aac,.flac,.ogg"
                class="hidden-input"
                type="file"
                @change="handleAudioSelection"
              />
              <el-button :icon="Upload" :loading="uploadingAudio" plain @click="audioInputRef?.click()">
                {{ selectedProject.narrationAudioUrl ? '更换旁白音频' : '上传旁白音频' }}
              </el-button>
              <audio
                v-if="selectedProject.narrationAudioUrl"
                :src="resolveVideoMaterialUrl(selectedProject.narrationAudioUrl)"
                controls
                preload="metadata"
              />
            </div>
          </div>
        </section>

        <section v-if="selectedProject.outputUrl" class="assembly-output">
          <div class="assembly-section-head">
            <div>
              <h3>{{ selectedProject.outputStale ? '上一次成片' : '成片结果' }}</h3>
              <span v-if="selectedProject.outputStale" class="stale-output-label">
                当前画面方案已有变化，重新合成后才会更新此视频。
              </span>
              <span v-else>{{ formatSeconds(selectedProject.durationMs) }} · {{ selectedProject.aspectRatio }}</span>
            </div>
            <a :href="resolveVideoMaterialUrl(selectedProject.outputUrl)" :download="selectedProject.outputFileName">
              <el-button :icon="Download" :type="selectedProject.outputStale ? 'default' : 'primary'">
                {{ selectedProject.outputStale ? '下载上次成片' : '下载成片' }}
              </el-button>
            </a>
          </div>
          <video
            :src="resolveVideoMaterialUrl(selectedProject.outputUrl)"
            controls
            playsinline
            preload="metadata"
          />
        </section>

        <section class="assembly-scenes">
          <div class="assembly-section-head">
            <div>
              <h3>成片时间线</h3>
              <span>按旁白顺序排列，每段可从候选素材中替换画面。</span>
            </div>
          </div>
          <div v-if="selectedProject.scenes?.length" class="assembly-scene-list">
            <article v-for="scene in selectedProject.scenes" :key="scene.id" class="assembly-scene-row">
              <div class="scene-order">
                <strong>{{ String(scene.sceneIndex).padStart(2, '0') }}</strong>
                <span>{{ formatSeconds(scene.targetDurationMs) }}</span>
              </div>
              <button
                v-if="scene.selectedClip"
                class="scene-preview"
                type="button"
                @click="openClipPreview(scene.selectedClip)"
              >
                <img :src="resolveVideoMaterialUrl(scene.selectedClip.keyframeUrl)" alt="" loading="lazy" />
                <span><el-icon><VideoPlay /></el-icon></span>
              </button>
              <div v-else class="scene-preview scene-preview--empty">未匹配</div>
              <div class="scene-copy">
                <el-tag effect="plain" size="small" class="intent-tag">
                  {{ visualIntentLabel(scene.visualIntent) }}
                </el-tag>
                <p>{{ scene.narrationText }}</p>
                <span>{{ scene.visualBrief }}</span>
                <div class="scene-keywords">
                  <el-tag v-for="keyword in scene.keywords" :key="keyword" effect="plain" size="small">
                    {{ keyword }}
                  </el-tag>
                </div>
              </div>
              <div class="scene-match">
                <el-button
                  :disabled="!scene.candidates.length"
                  :loading="savingSceneId === scene.id"
                  plain
                  @click="openCandidatePanel(scene)"
                >
                  {{ scene.selectedClip ? '替换素材' : '选择素材' }}（{{ scene.candidates.length }}）
                </el-button>
                <div v-if="scene.selectedClip" class="selected-clip-meta">
                  <div>
                    <strong>{{ scene.selectedClip.materialName }} · 镜头 {{ scene.selectedClip.clipIndex }}</strong>
                    <el-tag
                      :type="reviewStatusTagType(scene.selectedClip.reviewStatus)"
                      effect="plain"
                      size="small"
                    >
                      {{ reviewStatusLabel(scene.selectedClip.reviewStatus) }}
                    </el-tag>
                  </div>
                  <span>{{ scene.matchScore ?? 0 }} 分 · {{ scene.matchReason }}</span>
                </div>
                <div v-if="scene.selectedClip" class="trim-control">
                  <div>
                    <span>取片位置</span>
                    <strong>{{ formatMilliseconds(scene.clipStartOffsetMs) }}</strong>
                  </div>
                  <el-slider
                    :disabled="maxClipStart(scene) <= 0 || savingSceneId === scene.id"
                    :max="maxClipStart(scene)"
                    :model-value="scene.clipStartOffsetMs"
                    :show-tooltip="false"
                    :step="100"
                    @change="(value: number | number[]) => updateClipStart(scene, Number(value))"
                  />
                </div>
                <div v-if="scene.warningFlags.length" class="scene-warning-tags">
                  <el-tag
                    v-for="warning in scene.warningFlags"
                    :key="warning"
                    effect="light"
                    size="small"
                    type="warning"
                  >
                    {{ warningLabel(warning) }}
                  </el-tag>
                </div>
                <div v-if="sceneReviewHint(scene)" class="scene-review-hint">
                  <el-icon><WarningFilled /></el-icon>
                  <span>{{ sceneReviewHint(scene) }}</span>
                </div>
              </div>
            </article>
          </div>
          <el-empty v-else description="保存旁白后进行智能规划" :image-size="80" />
        </section>
      </template>
      <el-empty v-else description="新建或选择一个旁白成片项目" :image-size="96" />
    </main>
  </section>

  <el-dialog v-model="createVisible" title="新建旁白成片" width="min(760px, 92vw)" destroy-on-close>
    <el-form label-position="top">
      <el-form-item label="项目名称">
        <el-input v-model="createForm.name" maxlength="120" placeholder="例如：防晒衣 618 测评视频" />
      </el-form-item>
      <el-form-item label="完整旁白">
        <el-input
          v-model="createForm.narrationText"
          :autosize="{ minRows: 10, maxRows: 18 }"
          maxlength="100000"
          placeholder="输入最终准备配音的完整旁白"
          type="textarea"
        />
      </el-form-item>
      <div class="create-options">
        <el-form-item label="画面比例">
          <el-segmented v-model="createForm.aspectRatio" :options="aspectRatioOptions" />
        </el-form-item>
        <el-form-item label="处理原字幕区域">
          <el-switch v-model="createForm.removeSourceSubtitles" />
        </el-form-item>
        <el-form-item label="画面适配">
          <el-select v-model="createForm.framingMode">
            <el-option
              v-for="option in framingModeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
      </div>
      <el-form-item label="素材范围">
        <el-segmented v-model="createForm.sourceMode" :options="sourceModeOptions" />
      </el-form-item>
      <el-form-item v-if="createForm.sourceMode === 'SELECTED'" label="指定来源视频">
        <el-select
          v-model="createForm.sourceMaterialIds"
          filterable
          multiple
          placeholder="选择一个或多个已拆片视频"
        >
          <el-option
            v-for="material in availableMaterials"
            :key="material.id"
            :disabled="material.status !== 'READY'"
            :label="`${material.originalName}（${material.clipCount} 段）`"
            :value="material.id"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="createVisible = false">取消</el-button>
      <el-button :loading="creating" type="primary" @click="createAndPlan">创建并智能规划</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="candidateVisible"
    :title="candidateScene ? `第 ${candidateScene.sceneIndex} 段 · 选择画面` : '选择画面'"
    width="min(1040px, 94vw)"
    destroy-on-close
  >
    <div v-if="candidateScene" class="candidate-panel">
      <article
        v-for="candidate in candidateScene.candidates"
        :key="candidate.clipId"
        :class="['candidate-card', { selected: candidate.clipId === candidateScene.selectedClipId }]"
      >
        <button class="candidate-thumb" type="button" @click="openClipPreview(candidate)">
          <img :src="resolveVideoMaterialUrl(candidate.keyframeUrl)" alt="" loading="lazy" />
          <span><el-icon><VideoPlay /></el-icon>预览</span>
        </button>
        <div class="candidate-card__body">
          <div class="candidate-card__title">
            <strong>{{ candidate.score }} 分 · 镜头 {{ String(candidate.clipIndex).padStart(2, '0') }}</strong>
            <el-tag :type="reviewStatusTagType(candidate.reviewStatus)" effect="plain" size="small">
              {{ reviewStatusLabel(candidate.reviewStatus) }}
            </el-tag>
          </div>
          <span :title="candidate.materialName">{{ candidate.materialName }}</span>
          <p>{{ candidate.description || candidate.reason }}</p>
          <div class="candidate-facts">
            <el-tag effect="plain" size="small">{{ motionLevelLabel(candidate.motionLevel) }}</el-tag>
            <el-tag v-if="candidate.staticFallback" effect="light" size="small" type="warning">静态备选</el-tag>
            <el-tag v-if="!candidate.visualCompatible" effect="light" size="small" type="danger">意图不完全一致</el-tag>
          </div>
          <span class="candidate-reason">{{ candidate.reason }}</span>
          <el-button
            :disabled="savingSceneId === candidateScene.id || candidate.clipId === candidateScene.selectedClipId"
            :loading="savingSceneId === candidateScene.id && candidate.clipId !== candidateScene.selectedClipId"
            type="primary"
            @click="selectCandidate(candidateScene, candidate.clipId)"
          >
            {{ candidate.clipId === candidateScene.selectedClipId ? '当前画面' : '使用这个画面' }}
          </el-button>
        </div>
      </article>
    </div>
  </el-dialog>

  <el-dialog v-model="previewVisible" title="素材镜头预览" width="min(860px, 92vw)" destroy-on-close>
    <video
      v-if="previewClip"
      :src="resolveVideoMaterialUrl(previewClip.clipUrl)"
      class="assembly-preview-video"
      controls
      playsinline
      preload="metadata"
    />
  </el-dialog>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  Delete,
  Download,
  MagicStick,
  Plus,
  Refresh,
  Upload,
  VideoPlay,
  WarningFilled,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createVideoAssemblyProject,
  fetchVideoAssemblyProject,
  fetchVideoAssemblyProjects,
  matchVideoAssemblyProject,
  planVideoAssemblyProject,
  removeVideoAssemblyProject,
  renderVideoAssemblyProject,
  updateVideoAssemblyProject,
  updateVideoAssemblyScene,
  uploadVideoAssemblyAudio,
  type VideoAssemblyCandidate,
  type VideoAssemblyProject,
  type VideoAssemblyScene,
  type VideoAssemblySelectedClip,
  type VideoAssemblyStatus,
} from '@/api/videoAssembly'
import {
  fetchVideoMaterials,
  resolveVideoMaterialUrl,
  type VideoMaterial,
  type VideoMaterialProductCategory,
  type VideoMaterialTaxonomy,
} from '@/api/videoMaterials'

const props = defineProps<{
  productCategory: VideoMaterialProductCategory
  taxonomy?: VideoMaterialTaxonomy
}>()

const projects = ref<VideoAssemblyProject[]>([])
const selectedProjectId = ref<number | null>(null)
const selectedProject = ref<VideoAssemblyProject | null>(null)
const loadingProjects = ref(false)
const createVisible = ref(false)
const creating = ref(false)
const planning = ref(false)
const matching = ref(false)
const confirmedOnly = ref(false)
const savingProject = ref(false)
const savingSceneId = ref<number | null>(null)
const uploadingAudio = ref(false)
const audioInputRef = ref<HTMLInputElement | null>(null)
const previewVisible = ref(false)
const previewClip = ref<VideoAssemblySelectedClip | VideoAssemblyCandidate | null>(null)
const candidateVisible = ref(false)
const candidateScene = ref<VideoAssemblyScene | null>(null)
const availableMaterials = ref<VideoMaterial[]>([])
let pollTimer: ReturnType<typeof setTimeout> | null = null

const createForm = reactive({
  name: '',
  narrationText: '',
  aspectRatio: '9:16' as '9:16' | '16:9' | '1:1',
  removeSourceSubtitles: true,
  sourceMode: 'ALL' as 'ALL' | 'SELECTED',
  sourceMaterialIds: [] as number[],
  framingMode: 'SMART' as 'SMART' | 'FILL_CROP' | 'FIT_BLUR',
})

const projectDraft = reactive({
  name: '',
  narrationText: '',
  aspectRatio: '9:16' as '9:16' | '16:9' | '1:1',
  removeSourceSubtitles: true,
  sourceMode: 'ALL' as 'ALL' | 'SELECTED',
  sourceMaterialIds: [] as number[],
  framingMode: 'SMART' as 'SMART' | 'FILL_CROP' | 'FIT_BLUR',
})

const aspectRatioOptions = [
  { label: '9:16 竖屏', value: '9:16' },
  { label: '16:9 横屏', value: '16:9' },
  { label: '1:1 方形', value: '1:1' },
]

const sourceModeOptions = [
  { label: '当前产品全部素材', value: 'ALL' },
  { label: '指定视频', value: 'SELECTED' },
]

const framingModeOptions = [
  { label: '智能适配', value: 'SMART' },
  { label: '填满并裁切', value: 'FILL_CROP' },
  { label: '完整画面 + 模糊背景', value: 'FIT_BLUR' },
]

const matchedSceneCount = computed(() =>
  selectedProject.value?.scenes?.filter((scene) => scene.selectedClipId).length ?? 0
)

const estimatedDurationMs = computed(() =>
  selectedProject.value?.scenes?.reduce((sum, scene) => sum + scene.targetDurationMs, 0) ?? 0
)

const canRender = computed(() =>
  Boolean(selectedProject.value?.scenes?.length)
  && matchedSceneCount.value === selectedProject.value?.sceneCount
)

const clearPoll = () => {
  if (pollTimer) clearTimeout(pollTimer)
  pollTimer = null
}

const schedulePoll = () => {
  clearPoll()
  if (!projects.value.some((project) => isBusy(project.status))) return
  pollTimer = setTimeout(() => void refreshProjects(true), 2000)
}

const loadSelectedProject = async () => {
  if (!selectedProjectId.value) {
    selectedProject.value = null
    return
  }
  selectedProject.value = await fetchVideoAssemblyProject(selectedProjectId.value)
  syncProjectDraft()
}

const refreshProjects = async (silent = false) => {
  if (!silent) loadingProjects.value = true
  try {
    const [projectRows, materialRows] = await Promise.all([
      fetchVideoAssemblyProjects(props.productCategory),
      fetchVideoMaterials(props.productCategory),
    ])
    projects.value = projectRows
    availableMaterials.value = materialRows
    if (!projects.value.some((project) => project.id === selectedProjectId.value)) {
      selectedProjectId.value = projects.value[0]?.id ?? null
    }
    await loadSelectedProject()
  } catch (error) {
    if (!silent) ElMessage.error(error instanceof Error ? error.message : '成片项目加载失败')
  } finally {
    loadingProjects.value = false
    schedulePoll()
  }
}

const selectProject = async (id: number) => {
  selectedProjectId.value = id
  try {
    await loadSelectedProject()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '成片项目加载失败')
  }
}

const syncProjectDraft = () => {
  if (!selectedProject.value) return
  projectDraft.name = selectedProject.value.name
  projectDraft.narrationText = selectedProject.value.narrationText
  projectDraft.aspectRatio = selectedProject.value.aspectRatio
  projectDraft.removeSourceSubtitles = selectedProject.value.removeSourceSubtitles
  projectDraft.sourceMode = selectedProject.value.sourceMode
  projectDraft.sourceMaterialIds = [...selectedProject.value.sourceMaterialIds]
  projectDraft.framingMode = selectedProject.value.framingMode
}

const openCreateDialog = () => {
  createForm.name = ''
  createForm.narrationText = ''
  createForm.aspectRatio = '9:16'
  createForm.removeSourceSubtitles = true
  createForm.sourceMode = 'ALL'
  createForm.sourceMaterialIds = []
  createForm.framingMode = 'SMART'
  createVisible.value = true
}

const createAndPlan = async () => {
  if (!createForm.name.trim()) {
    ElMessage.warning('请输入项目名称')
    return
  }
  if (!createForm.narrationText.trim()) {
    ElMessage.warning('请输入完整旁白')
    return
  }
  if (createForm.sourceMode === 'SELECTED' && !createForm.sourceMaterialIds.length) {
    ElMessage.warning('指定视频模式至少要选择一个来源视频')
    return
  }
  creating.value = true
  try {
    const project = await createVideoAssemblyProject({
      productCategory: props.productCategory,
      name: createForm.name.trim(),
      narrationText: createForm.narrationText.trim(),
      aspectRatio: createForm.aspectRatio,
      removeSourceSubtitles: createForm.removeSourceSubtitles,
      sourceMode: createForm.sourceMode,
      sourceMaterialIds: [...createForm.sourceMaterialIds],
      framingMode: createForm.framingMode,
    })
    selectedProjectId.value = project.id
    createVisible.value = false
    await refreshProjects(true)
    planning.value = true
    selectedProject.value = await planVideoAssemblyProject(project.id)
    ElMessage.success('旁白已拆解并完成第一轮素材匹配')
    await refreshProjects(true)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '项目创建失败')
    await refreshProjects(true)
  } finally {
    creating.value = false
    planning.value = false
  }
}

const saveProjectSettings = async () => {
  if (!selectedProject.value || savingProject.value) return
  if (!projectDraft.narrationText.trim()) {
    ElMessage.warning('完整旁白不能为空')
    return
  }
  if (projectDraft.sourceMode === 'SELECTED' && !projectDraft.sourceMaterialIds.length) {
    ElMessage.warning('指定视频模式至少要选择一个来源视频')
    return
  }
  savingProject.value = true
  try {
    await updateVideoAssemblyProject(selectedProject.value.id, {
      name: projectDraft.name.trim(),
      narrationText: projectDraft.narrationText.trim(),
      aspectRatio: projectDraft.aspectRatio,
      removeSourceSubtitles: projectDraft.removeSourceSubtitles,
      sourceMode: projectDraft.sourceMode,
      sourceMaterialIds: [...projectDraft.sourceMaterialIds],
      framingMode: projectDraft.framingMode,
    })
    ElMessage.success('项目设置已保存')
    await refreshProjects(true)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    savingProject.value = false
  }
}

const replanProject = async () => {
  if (!selectedProject.value || planning.value) return
  try {
    await ElMessageBox.confirm(
      '重新规划会替换当前旁白分段和自动匹配结果，已手动选择的画面也会重置。',
      '重新智能规划',
      { type: 'warning', confirmButtonText: '重新规划', cancelButtonText: '取消' }
    )
    planning.value = true
    await updateVideoAssemblyProject(selectedProject.value.id, {
      name: projectDraft.name.trim(),
      narrationText: projectDraft.narrationText.trim(),
      aspectRatio: projectDraft.aspectRatio,
      removeSourceSubtitles: projectDraft.removeSourceSubtitles,
      sourceMode: projectDraft.sourceMode,
      sourceMaterialIds: [...projectDraft.sourceMaterialIds],
      framingMode: projectDraft.framingMode,
    })
    selectedProject.value = await planVideoAssemblyProject(selectedProject.value.id)
    ElMessage.success('已重新规划并匹配素材')
    await refreshProjects(true)
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error instanceof Error ? error.message : '重新规划失败')
  } finally {
    planning.value = false
  }
}

const rematchProject = async () => {
  if (!selectedProject.value || matching.value) return
  matching.value = true
  try {
    selectedProject.value = await matchVideoAssemblyProject(
      selectedProject.value.id,
      confirmedOnly.value
    )
    ElMessage.success(
      confirmedOnly.value
        ? '已仅使用人工确认素材重新匹配，未找到合适画面的段落会保留为空'
        : '已重新计算素材候选，手动选择的画面已保留'
    )
    await refreshProjects(true)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '重新匹配失败')
  } finally {
    matching.value = false
  }
}

const selectCandidate = async (scene: VideoAssemblyScene, clipId: number) => {
  if (savingSceneId.value) return
  savingSceneId.value = scene.id
  try {
    selectedProject.value = await updateVideoAssemblyScene(scene.id, { selectedClipId: clipId })
    candidateVisible.value = false
    candidateScene.value = null
    ElMessage.success(`第 ${scene.sceneIndex} 段画面已替换`)
    await refreshProjects(true)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '替换素材失败')
  } finally {
    savingSceneId.value = null
  }
}

const handleAudioSelection = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !selectedProject.value) return
  uploadingAudio.value = true
  try {
    selectedProject.value = await uploadVideoAssemblyAudio(selectedProject.value.id, file)
    ElMessage.success('旁白音频已上传')
    await refreshProjects(true)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '旁白音频上传失败')
  } finally {
    uploadingAudio.value = false
  }
}

const startRender = async () => {
  if (!selectedProject.value || !canRender.value) return
  try {
    if (!selectedProject.value.narrationAudioUrl) {
      await ElMessageBox.confirm(
        '当前没有旁白音频，将导出无声画面预览。新字幕仍会写入画面。',
        '导出静音预览',
        { type: 'warning', confirmButtonText: '继续导出', cancelButtonText: '取消' }
      )
    }
    await renderVideoAssemblyProject(selectedProject.value.id)
    ElMessage.success('已进入本地合成队列')
    await refreshProjects(true)
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error instanceof Error ? error.message : '视频合成启动失败')
  }
}

const deleteProject = async () => {
  if (!selectedProject.value) return
  try {
    await ElMessageBox.confirm(
      `将删除“${selectedProject.value.name}”及其成片结果，原素材不会删除。`,
      '删除成片项目',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    await removeVideoAssemblyProject(selectedProject.value.id)
    selectedProjectId.value = null
    selectedProject.value = null
    ElMessage.success('项目已删除')
    await refreshProjects(true)
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
  }
}

const openClipPreview = (clip: VideoAssemblySelectedClip | VideoAssemblyCandidate) => {
  previewClip.value = clip
  previewVisible.value = true
}

const openCandidatePanel = (scene: VideoAssemblyScene) => {
  candidateScene.value = scene
  candidateVisible.value = true
}

const maxClipStart = (scene: VideoAssemblyScene) => Math.max(
  0,
  (scene.selectedClip?.durationMs || 0) - Math.max(1000, scene.clipDurationMs)
)

const updateClipStart = async (scene: VideoAssemblyScene, offsetMs: number) => {
  if (savingSceneId.value) return
  savingSceneId.value = scene.id
  try {
    selectedProject.value = await updateVideoAssemblyScene(scene.id, {
      clipStartOffsetMs: Math.max(0, Math.min(maxClipStart(scene), Math.round(offsetMs))),
    })
    ElMessage.success(`第 ${scene.sceneIndex} 段取片位置已更新`)
    await refreshProjects(true)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '取片位置保存失败')
  } finally {
    savingSceneId.value = null
  }
}

const visualIntentLabel = (intent: string) => ({
  INFORMATION: '参数说明',
  ACTION: '动作演示',
  EXPERIENCE: '户外 / 试穿体验',
  PRODUCT: '产品展示',
  MIXED: '综合画面',
}[intent] || '综合画面')

const motionLevelLabel = (level: string) => ({
  STATIC: '静态',
  LOW: '轻微运动',
  MEDIUM: '中等运动',
  HIGH: '明显运动',
  UNKNOWN: '动态未知',
}[level] || '动态未知')

const warningLabel = (warning: string) => ({
  STATIC_FALLBACK: '使用静态备选',
  LOW_SCORE: '匹配分偏低',
  UNCONFIRMED: '素材待确认',
  INTENT_MISMATCH: '画面意图不完全一致',
  LOW_USABILITY: '素材可用度偏低',
}[warning] || warning)

const reviewStatusLabel = (status: string) => ({
  CONFIRMED: '已确认',
  NEEDS_REVIEW: '重点复核',
  PENDING: '待确认',
}[status] || '待确认')

const reviewStatusTagType = (status: string): 'success' | 'warning' | 'info' => ({
  CONFIRMED: 'success',
  NEEDS_REVIEW: 'warning',
  PENDING: 'info',
}[status] as 'success' | 'warning' | 'info' || 'info')

const sceneReviewHint = (scene: VideoAssemblyScene) => {
  if (!scene.selectedClip) return '当前没有达到自动匹配门槛的素材，请补充素材或手动选择。'
  if (scene.selectedClip.reviewStatus === 'NEEDS_REVIEW') {
    return '当前画面的分类被标记为重点复核，建议预览后再合成。'
  }
  if (scene.selectedClip.reviewStatus !== 'CONFIRMED') {
    return '当前画面尚未人工确认，建议预览后再合成。'
  }
  if ((scene.matchScore ?? 0) < 60) {
    return '当前匹配分较低，建议检查画面是否真正对应这段旁白。'
  }
  return ''
}

const formatMilliseconds = (milliseconds: number) => `${(milliseconds / 1000).toFixed(1)} 秒`

const isBusy = (status: VideoAssemblyStatus) =>
  ['PLANNING', 'MATCHING', 'RENDER_QUEUED', 'RENDERING'].includes(status)

const statusLabel = (status: VideoAssemblyStatus) => ({
  DRAFT: '待规划',
  PLANNING: '规划中',
  MATCHING: '匹配中',
  READY: '待合成',
  RENDER_QUEUED: '排队中',
  RENDERING: '合成中',
  COMPLETED: '已完成',
  FAILED: '需处理',
}[status])

const statusTagType = (
  status: VideoAssemblyStatus
): 'success' | 'warning' | 'danger' | 'info' => ({
  DRAFT: 'info',
  PLANNING: 'warning',
  MATCHING: 'warning',
  READY: 'info',
  RENDER_QUEUED: 'warning',
  RENDERING: 'warning',
  COMPLETED: 'success',
  FAILED: 'danger',
}[status] as 'success' | 'warning' | 'danger' | 'info')

const formatSeconds = (milliseconds: number) => {
  const seconds = Math.max(0, milliseconds) / 1000
  return `${seconds >= 10 ? seconds.toFixed(1) : seconds.toFixed(2).replace(/0$/, '')} 秒`
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

watch(() => props.productCategory, () => {
  clearPoll()
  selectedProjectId.value = null
  selectedProject.value = null
  void refreshProjects()
})

onMounted(() => void refreshProjects())
onBeforeUnmount(clearPoll)
</script>

<style scoped>
.assembly-workbench {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  min-height: 680px;
  overflow: hidden;
  border: 1px solid rgba(217, 107, 114, 0.16);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 12px 30px rgba(139, 83, 89, 0.07);
}

.assembly-sidebar {
  padding: 18px;
  border-right: 1px solid rgba(217, 107, 114, 0.14);
  background: #fffafa;
}

.assembly-sidebar__head,
.assembly-detail__head,
.assembly-section-head,
.assembly-title-row,
.assembly-actions,
.assembly-progress > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.assembly-sidebar__head h2,
.assembly-detail__head h2,
.assembly-section-head h3 {
  margin: 0;
  color: #46383a;
  letter-spacing: 0;
}

.assembly-sidebar__head h2 {
  font-size: 17px;
}

.assembly-sidebar__head span,
.assembly-detail__head > div > span,
.assembly-section-head span {
  display: block;
  margin-top: 3px;
  color: #988387;
  font-size: 12px;
}

.new-project-button {
  width: 100%;
  margin: 16px 0;
}

.assembly-project-list {
  display: grid;
  max-height: 760px;
  gap: 8px;
  overflow: auto;
}

.assembly-project-item {
  width: 100%;
  padding: 12px;
  border: 1px solid #f0dfe0;
  border-radius: 6px;
  color: #5d4b4e;
  text-align: left;
  background: #fff;
  cursor: pointer;
}

.assembly-project-item.active {
  border-color: #dc7a80;
  background: #fff4f4;
}

.assembly-project-item > div {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.assembly-project-item strong {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assembly-project-item p {
  margin: 7px 0 5px;
  overflow: hidden;
  color: #8c7478;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assembly-project-item > span {
  color: #ac9699;
  font-size: 11px;
}

.assembly-project-item :deep(.el-progress) {
  margin-top: 8px;
}

.assembly-detail {
  min-width: 0;
  padding: 22px;
}

.assembly-detail__head {
  align-items: flex-start;
}

.assembly-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.confirmed-only-control {
  display: flex;
  min-height: 32px;
  align-items: center;
  gap: 8px;
  color: #806b6e;
  font-size: 12px;
}

.assembly-detail__head h2 {
  max-width: 720px;
  font-size: 20px;
}

.assembly-progress,
.assembly-error {
  margin-top: 18px;
  padding: 15px 16px;
  border: 1px solid #f0d7d9;
  background: #fff7f7;
}

.assembly-progress > div {
  margin-bottom: 10px;
  color: #72575b;
  font-size: 13px;
}

.assembly-error {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: #b94c55;
}

.assembly-error span {
  display: block;
  margin-top: 3px;
  color: #8c7478;
  font-size: 12px;
}

.assembly-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 20px 0;
  border: 1px solid #f0e0e1;
  border-radius: 6px;
  background: #fffafa;
}

.assembly-summary > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 16px;
}

.assembly-summary > div + div {
  border-left: 1px solid #f0e0e1;
}

.assembly-summary span {
  color: #9b8588;
  font-size: 12px;
}

.assembly-summary strong {
  margin-top: 7px;
  color: #c95a62;
  font-size: 19px;
}

.assembly-ai-usage {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin: -10px 0 20px;
  color: #988387;
  font-size: 11px;
}

.assembly-settings,
.assembly-output,
.assembly-scenes {
  padding: 18px 0;
  border-top: 1px solid #f1e4e5;
}

.assembly-section-head {
  margin-bottom: 14px;
}

.assembly-section-head h3 {
  font-size: 16px;
}

.output-settings-row {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 16px 28px;
  margin-top: 14px;
}

.material-scope-settings {
  display: grid;
  grid-template-columns: minmax(280px, 0.7fr) minmax(320px, 1fr);
  gap: 16px;
  margin-top: 14px;
  padding: 14px;
  border: 1px solid #f0e0e1;
  border-radius: 6px;
  background: #fffafa;
}

.material-scope-settings .settings-field {
  display: grid;
  min-width: 0;
  gap: 7px;
}

.material-scope-settings .settings-field > span {
  color: #806b6e;
  font-size: 12px;
}

.source-material-picker :deep(.el-select),
.framing-select {
  width: 100%;
}

.output-settings-row label,
.output-settings-row .settings-field {
  display: grid;
  gap: 7px;
}

.output-settings-row label > span,
.output-settings-row .settings-field > span {
  color: #806b6e;
  font-size: 12px;
}

.subtitle-switch {
  min-height: 54px;
  align-content: end;
}

.audio-control {
  display: flex;
  min-width: min(100%, 420px);
  align-items: center;
  gap: 10px;
}

.audio-control audio {
  width: min(280px, 100%);
  height: 34px;
}

.hidden-input {
  display: none;
}

.assembly-output video {
  display: block;
  width: min(100%, 460px);
  max-height: 560px;
  margin: 0 auto;
  background: #221e1f;
}

.assembly-output a {
  text-decoration: none;
}

.assembly-section-head .stale-output-label {
  color: #a4662f;
}

.assembly-scene-list {
  display: grid;
  gap: 10px;
}

.assembly-scene-row {
  display: grid;
  grid-template-columns: 56px 156px minmax(220px, 1fr) minmax(250px, 0.8fr);
  gap: 14px;
  align-items: center;
  padding: 12px;
  border: 1px solid #efdfdf;
  border-radius: 6px;
  background: #fff;
}

.scene-order {
  display: grid;
  gap: 4px;
  text-align: center;
}

.scene-order strong {
  color: #c95a62;
  font-size: 20px;
}

.scene-order span {
  color: #9b8588;
  font-size: 11px;
}

.scene-preview {
  position: relative;
  width: 156px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: #eee4e5;
  cursor: pointer;
}

.scene-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scene-preview > span {
  position: absolute;
  inset: 50% auto auto 50%;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: rgba(35, 28, 29, 0.58);
  transform: translate(-50%, -50%);
}

.scene-preview--empty {
  display: grid;
  place-items: center;
  color: #a58f92;
  font-size: 12px;
}

.scene-copy,
.scene-match {
  min-width: 0;
}

.scene-copy p {
  margin: 0;
  color: #504144;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.6;
}

.scene-copy .intent-tag {
  width: fit-content;
  margin-bottom: 7px;
}

.scene-copy > span,
.selected-clip-meta span {
  display: block;
  margin-top: 5px;
  color: #8e797c;
  font-size: 12px;
  line-height: 1.55;
}

.scene-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 7px;
}

.scene-match :deep(.el-select) {
  width: 100%;
}

.selected-clip-meta {
  margin-top: 8px;
}

.trim-control {
  margin-top: 10px;
  padding: 8px 10px 1px;
  border: 1px solid #f0e0e1;
  border-radius: 5px;
  background: #fffafa;
}

.trim-control > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #8e797c;
  font-size: 11px;
}

.trim-control strong {
  color: #675458;
}

.scene-warning-tags,
.candidate-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}

.selected-clip-meta strong {
  color: #675458;
  font-size: 12px;
}

.selected-clip-meta > div,
.candidate-option > div {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.selected-clip-meta :deep(.el-tag),
.candidate-option :deep(.el-tag) {
  flex: 0 0 auto;
}

.scene-review-hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 8px;
  padding: 7px 9px;
  border: 1px solid #f2d9b7;
  border-radius: 5px;
  color: #9a6429;
  font-size: 11px;
  line-height: 1.45;
  background: #fff9ef;
}

.scene-review-hint .el-icon {
  margin-top: 2px;
  flex: 0 0 auto;
}

.create-options {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(150px, 0.45fr) minmax(190px, 0.65fr);
  gap: 20px;
}

.candidate-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.candidate-card {
  overflow: hidden;
  border: 1px solid #ead9da;
  border-radius: 6px;
  background: #fff;
}

.candidate-card.selected {
  border-color: #d96b72;
  box-shadow: 0 0 0 1px rgba(217, 107, 114, 0.18);
}

.candidate-thumb {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  padding: 0;
  border: 0;
  background: #eee5e6;
  cursor: pointer;
}

.candidate-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.candidate-thumb span {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 7px;
  border-radius: 4px;
  color: #fff;
  font-size: 11px;
  background: rgba(42, 33, 35, 0.72);
}

.candidate-card__body {
  display: grid;
  gap: 7px;
  padding: 11px;
}

.candidate-card__title {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.candidate-card__title strong {
  color: #58474a;
  font-size: 13px;
}

.candidate-card__body > span,
.candidate-reason {
  overflow: hidden;
  color: #917b7f;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.candidate-card__body p {
  min-height: 42px;
  margin: 0;
  color: #665457;
  font-size: 12px;
  line-height: 1.55;
}

.assembly-preview-video {
  display: block;
  width: 100%;
  max-height: 70vh;
  background: #211e1f;
}

@media (max-width: 1180px) {
  .assembly-scene-row {
    grid-template-columns: 48px 140px minmax(0, 1fr);
  }

  .scene-match {
    grid-column: 2 / -1;
  }
}

@media (max-width: 900px) {
  .assembly-workbench {
    grid-template-columns: 1fr;
  }

  .assembly-sidebar {
    border-right: 0;
    border-bottom: 1px solid rgba(217, 107, 114, 0.14);
  }

  .assembly-project-list {
    max-height: 280px;
  }

  .assembly-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .candidate-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .assembly-summary > div:nth-child(3) {
    border-top: 1px solid #f0e0e1;
    border-left: 0;
  }

  .assembly-summary > div:nth-child(4) {
    border-top: 1px solid #f0e0e1;
  }
}

@media (max-width: 640px) {
  .assembly-detail {
    padding: 16px;
  }

  .assembly-detail__head,
  .assembly-section-head,
  .assembly-actions,
  .audio-control {
    align-items: stretch;
    flex-direction: column;
  }

  .assembly-scene-row {
    grid-template-columns: 42px minmax(0, 1fr);
  }

  .scene-preview {
    width: 100%;
  }

  .scene-copy,
  .scene-match {
    grid-column: 1 / -1;
  }

  .create-options {
    grid-template-columns: 1fr;
  }

  .material-scope-settings,
  .candidate-panel {
    grid-template-columns: 1fr;
  }

  .output-settings-row {
    align-items: stretch;
    flex-direction: column;
    gap: 14px;
  }

  .output-settings-row > label,
  .output-settings-row > .settings-field,
  .audio-control {
    width: 100%;
  }

  .subtitle-switch {
    min-height: 0;
    align-content: start;
  }
}
</style>
