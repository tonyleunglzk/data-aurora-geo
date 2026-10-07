import assert from 'node:assert/strict'

const baseUrl = (process.env.VIDEO_WORKFLOW_BASE_URL || 'http://127.0.0.1:19988/api').replace(/\/$/, '')
// 仅检查本地隔离测试服务；此脚本会读取素材并调用分析/拆片预览接口。
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname)) {
  throw new Error('此展示副本的工作流检查只允许连接本地测试服务')
}
const productCategory = process.env.VIDEO_WORKFLOW_PRODUCT || 'SUN_PROTECTIVE_CLOTHING'

const request = async (path, init) => {
  const response = await fetch(`${baseUrl}${path}`, init)
  const text = await response.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!response.ok) {
    throw new Error(`${init?.method || 'GET'} ${path} -> ${response.status}: ${text.slice(0, 500)}`)
  }
  return body
}

const postJson = (path, body) => request(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const health = await request('/video-materials/assembly/runtime-health')
assert.equal(health.ready, true, `视频运行环境不可用：${health.errors?.join('；') || '未知错误'}`)
assert.equal(health.checks?.storageWritable, true, '成片目录不可写')
assert.equal(health.checks?.sharpReady, true, 'Sharp 图片处理不可用')
assert.match(String(health.checks?.ffmpegVersion || ''), /^ffmpeg version /)
assert.match(String(health.checks?.ffprobeVersion || ''), /^ffprobe version /)

const materials = await request(
  `/video-materials/materials?productCategory=${encodeURIComponent(productCategory)}`
)
assert.ok(Array.isArray(materials) && materials.length > 0, `品类 ${productCategory} 没有测试素材`)
const materialSummary = [...materials]
  .filter((material) => material.status === 'READY' && material.clipCount > 0)
  .sort((left, right) => right.durationMs - left.durationMs)[0]
assert.ok(materialSummary, '没有可用于回归的已拆片素材')

const before = await request(`/video-materials/materials/${materialSummary.id}`)
const beforeClipIds = before.clips.map((clip) => clip.id)
const segmentation = await postJson(
  `/video-materials/materials/${before.id}/segmentation-preview`,
  {
    sceneThreshold: before.sceneThreshold,
    minClipDurationMs: before.minClipDurationMs,
    maxClipDurationMs: before.maxClipDurationMs,
  }
)
assert.equal(segmentation.materialId, before.id)
assert.ok(segmentation.preview.outputSegmentCount > 0, '拆片预览没有输出镜头')
assert.equal(segmentation.preview.segments.length, segmentation.preview.outputSegmentCount)
assert.ok(segmentation.preview.shortestSegmentMs >= Math.min(1000, before.minClipDurationMs))

const selectedClipIds = beforeClipIds.slice(0, Math.min(2, beforeClipIds.length))
const aiPreview = await postJson(
  `/video-materials/materials/${before.id}/analyze-preview`,
  { clipIds: selectedClipIds, reanalyzeConfirmed: false }
)
assert.deepEqual(aiPreview.clipIds, selectedClipIds)
assert.equal(aiPreview.clipCount, selectedClipIds.length)
assert.equal(aiPreview.keyframeCount, selectedClipIds.length * 3)
assert.equal(typeof aiPreview.timelineWillBeCreated, 'boolean')
assert.equal(typeof aiPreview.timelineSegmentCount, 'number')
assert.ok(String(aiPreview.timelineAsrModel || '').length > 0, '时间轴语音模型未返回')

const after = await request(`/video-materials/materials/${before.id}`)
assert.equal(after.status, before.status, '只读预览修改了素材状态')
assert.equal(after.aiStatus, before.aiStatus, '只读预览修改了 AI 状态')
assert.deepEqual(after.clips.map((clip) => clip.id), beforeClipIds, '只读预览替换了镜头记录')

const projects = await request(
  `/video-materials/assembly/projects?productCategory=${encodeURIComponent(productCategory)}`
)
let projectSummary = null
if (Array.isArray(projects) && projects.length > 0) {
  const project = await request(`/video-materials/assembly/projects/${projects[0].id}`)
  const scenes = project.scenes || []
  assert.deepEqual(
    scenes.map((scene) => scene.sceneIndex),
    scenes.map((scene) => scene.sceneIndex).sort((left, right) => left - right),
    '成片分段顺序不稳定'
  )
  for (const scene of scenes) {
    assert.ok(
      ['INFORMATION', 'ACTION', 'EXPERIENCE', 'PRODUCT', 'MIXED'].includes(scene.visualIntent),
      `第 ${scene.sceneIndex} 段缺少有效画面意图`
    )
    const scores = (scene.candidates || []).map((candidate) => candidate.score)
    assert.deepEqual(scores, [...scores].sort((left, right) => right - left), `第 ${scene.sceneIndex} 段候选未按分数排序`)
    assert.ok(scores.every((score) => score >= 0 && score <= 100), `第 ${scene.sceneIndex} 段候选分数越界`)
    for (const candidate of scene.candidates || []) {
      assert.equal(typeof candidate.visualCompatible, 'boolean', `第 ${scene.sceneIndex} 段候选缺少意图兼容状态`)
      assert.equal(typeof candidate.staticFallback, 'boolean', `第 ${scene.sceneIndex} 段候选缺少静态兜底状态`)
      assert.ok(candidate.scoreBreakdown && typeof candidate.scoreBreakdown === 'object', `第 ${scene.sceneIndex} 段候选缺少评分明细`)
      assert.ok(Array.isArray(candidate.warningFlags), `第 ${scene.sceneIndex} 段候选缺少风险标识`)
    }
  }
  if (project.outputUrl) {
    const outputResponse = await fetch(`${baseUrl.replace(/\/api$/, '')}${project.outputUrl}`, { method: 'HEAD' })
    assert.equal(outputResponse.ok, true, '现有成片文件不可访问')
  }
  projectSummary = {
    id: project.id,
    status: project.status,
    sceneCount: scenes.length,
    matchedSceneCount: scenes.filter((scene) => scene.selectedClipId).length,
    outputAvailable: Boolean(project.outputUrl),
    sourceMode: project.sourceMode,
    sourceMaterialCount: project.sourceMaterials?.length || 0,
    framingMode: project.framingMode,
  }
}

console.log(JSON.stringify({
  ok: true,
  runtime: {
    ffmpeg: health.checks.ffmpegVersion,
    ffprobe: health.checks.ffprobeVersion,
    sharp: health.checks.sharpVersion,
  },
  material: {
    id: before.id,
    name: before.originalName,
    currentClipCount: before.clipCount,
    previewClipCount: segmentation.preview.outputSegmentCount,
    selectedAiPreviewCount: aiPreview.clipCount,
    estimatedInputTokens: aiPreview.estimatedInputTokens,
    estimatedOutputTokens: aiPreview.estimatedOutputTokens,
  },
  project: projectSummary,
}, null, 2))
