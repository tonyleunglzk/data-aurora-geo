export type VideoSegment = {
  startMs: number
  endMs: number
}

export type VideoSegmentationDiagnostics = {
  detectedSceneCount: number
  atomicSegmentCount: number
  mergedShortSegmentCount: number
  forcedSplitCount: number
  outputSegmentCount: number
  shortestSegmentMs: number
  longestSegmentMs: number
  averageSegmentMs: number
}

type SegmentPlanInput = {
  durationMs: number
  sceneTimes: number[]
  minDurationMs: number
  maxDurationMs: number
  dedupeWindowMs?: number
}

type MutableSegment = VideoSegment & {
  sceneCount: number
}

const durationOf = (segment: VideoSegment) => segment.endMs - segment.startMs

const normalizeSceneTimes = (
  sceneTimes: number[],
  durationMs: number,
  dedupeWindowMs: number
) => {
  const normalized = sceneTimes
    .map((value) => Math.round(Number(value)))
    .filter((value) => Number.isFinite(value) && value > 0 && value < durationMs)
    .sort((left, right) => left - right)

  return normalized.filter((value, index, values) => (
    index === 0 || value - values[index - 1] >= dedupeWindowMs
  ))
}

const chooseMergeDirection = (
  segments: MutableSegment[],
  index: number,
  maxDurationMs: number
) => {
  if (index === 0) return 1
  if (index === segments.length - 1) return -1

  const current = segments[index]
  const leftDuration = current.endMs - segments[index - 1].startMs
  const rightDuration = segments[index + 1].endMs - current.startMs
  const leftFits = leftDuration <= maxDurationMs
  const rightFits = rightDuration <= maxDurationMs

  if (leftFits !== rightFits) return leftFits ? -1 : 1
  return leftDuration <= rightDuration ? -1 : 1
}

const mergeShortSegments = (
  input: MutableSegment[],
  minDurationMs: number,
  maxDurationMs: number
) => {
  const segments = input.map((segment) => ({ ...segment }))
  let mergeCount = 0

  while (segments.length > 1) {
    let shortestIndex = -1
    let shortestDuration = Number.POSITIVE_INFINITY

    for (let index = 0; index < segments.length; index += 1) {
      const duration = durationOf(segments[index])
      if (duration >= minDurationMs || duration >= shortestDuration) continue
      shortestDuration = duration
      shortestIndex = index
    }

    if (shortestIndex < 0) break
    const direction = chooseMergeDirection(segments, shortestIndex, maxDurationMs)
    const leftIndex = direction < 0 ? shortestIndex - 1 : shortestIndex
    const rightIndex = leftIndex + 1
    const merged: MutableSegment = {
      startMs: segments[leftIndex].startMs,
      endMs: segments[rightIndex].endMs,
      sceneCount: segments[leftIndex].sceneCount + segments[rightIndex].sceneCount,
    }
    segments.splice(leftIndex, 2, merged)
    mergeCount += 1
  }

  return { segments, mergeCount }
}

const splitLongSegments = (
  input: MutableSegment[],
  minDurationMs: number,
  maxDurationMs: number
) => {
  let forcedSplitCount = 0
  const segments = input.flatMap((segment): MutableSegment[] => {
    const duration = durationOf(segment)
    let partCount = Math.ceil(duration / maxDurationMs)

    while (partCount > 1 && duration / partCount < minDurationMs) {
      partCount -= 1
    }
    if (partCount <= 1) return [segment]

    forcedSplitCount += partCount - 1
    return Array.from({ length: partCount }, (_, index) => ({
      startMs: index === 0
        ? segment.startMs
        : Math.round(segment.startMs + (duration * index) / partCount),
      endMs: index === partCount - 1
        ? segment.endMs
        : Math.round(segment.startMs + (duration * (index + 1)) / partCount),
      sceneCount: index === 0 ? segment.sceneCount : 0,
    }))
  })

  return { segments, forcedSplitCount }
}

export const planVideoSegments = ({
  durationMs,
  sceneTimes,
  minDurationMs,
  maxDurationMs,
  dedupeWindowMs = 280,
}: SegmentPlanInput) => {
  const safeDurationMs = Math.max(1, Math.round(durationMs))
  const safeMinDurationMs = Math.max(1, Math.round(minDurationMs))
  const safeMaxDurationMs = Math.max(safeMinDurationMs, Math.round(maxDurationMs))
  const normalizedSceneTimes = normalizeSceneTimes(
    sceneTimes,
    safeDurationMs,
    Math.max(0, Math.round(dedupeWindowMs))
  )
  const boundaries = [0, ...normalizedSceneTimes, safeDurationMs]
  const atomicSegments: MutableSegment[] = boundaries.slice(0, -1)
    .map((startMs, index) => ({
      startMs,
      endMs: boundaries[index + 1],
      sceneCount: 1,
    }))
    .filter((segment) => durationOf(segment) > 0)

  const merged = mergeShortSegments(
    atomicSegments,
    safeMinDurationMs,
    safeMaxDurationMs
  )
  const split = splitLongSegments(
    merged.segments,
    safeMinDurationMs,
    safeMaxDurationMs
  )
  const segments = split.segments.map(({ startMs, endMs }) => ({ startMs, endMs }))
  const durations = segments.map(durationOf)
  const totalDuration = durations.reduce((sum, duration) => sum + duration, 0)

  return {
    segments,
    diagnostics: {
      detectedSceneCount: normalizedSceneTimes.length,
      atomicSegmentCount: atomicSegments.length,
      mergedShortSegmentCount: merged.mergeCount,
      forcedSplitCount: split.forcedSplitCount,
      outputSegmentCount: segments.length,
      shortestSegmentMs: durations.length ? Math.min(...durations) : 0,
      longestSegmentMs: durations.length ? Math.max(...durations) : 0,
      averageSegmentMs: durations.length ? Math.round(totalDuration / durations.length) : 0,
    } satisfies VideoSegmentationDiagnostics,
  }
}
