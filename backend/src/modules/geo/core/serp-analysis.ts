import type { FetchedArticleDetail } from './fetch'

const PATTERN_RULES = [
  { tag: '排行榜', patterns: ['排行榜', '排名', '十大', 'Top'] },
  { tag: '推荐', patterns: ['推荐', '值得买', '值得入手'] },
  { tag: '测评', patterns: ['测评', '评测', '实测', '横评'] },
  { tag: '避坑', patterns: ['避坑', '别乱买', '踩坑'] },
  { tag: '选购指南', patterns: ['怎么选', '选购', '购买指南'] },
  { tag: '参数对比', patterns: ['参数', '对比', '配置'] },
]

export interface SerpArticleAnalysis {
  contentLength: number
  paragraphCount: number
  titleLength: number
  keywordHits: {
    keyword: string
    titleMatches: number
    snippetMatches: number
    articleMatches: number
  }
  patternTags: string[]
  headingOutline: string[]
  analysisSummary: {
    titlePattern: string
    leadPreview: string
    hasHeadings: boolean
    hasListStyle: boolean
  }
  excerpt: string
  author: string
  publishAt: string
}

export function analyzeSerpArticle(
  keyword: string,
  title: string,
  snippet: string,
  detail: FetchedArticleDetail
): SerpArticleAnalysis {
  const paragraphs = detail.text
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
  const normalizedKeyword = keyword.trim()
  const headingOutline = detail.headings.length > 0 ? detail.headings : inferHeadingOutline(detail.text)
  const patternTags = PATTERN_RULES.filter(({ patterns }) =>
    patterns.some((pattern) => `${title} ${detail.text}`.includes(pattern))
  ).map((item) => item.tag)
  const titlePattern = inferTitlePattern(title)

  return {
    contentLength: detail.text.length,
    paragraphCount: paragraphs.length,
    titleLength: title.length,
    keywordHits: {
      keyword: normalizedKeyword,
      titleMatches: countOccurrences(title, normalizedKeyword),
      snippetMatches: countOccurrences(snippet, normalizedKeyword),
      articleMatches: countOccurrences(detail.text, normalizedKeyword),
    },
    patternTags,
    headingOutline: headingOutline.slice(0, 12),
    analysisSummary: {
      titlePattern,
      leadPreview: paragraphs[0]?.slice(0, 120) || detail.excerpt,
      hasHeadings: headingOutline.length > 0,
      hasListStyle: /[一二三四五六七八九十]\s*[、.．]|^\d+\s*[、.．]/m.test(detail.text),
    },
    excerpt: detail.excerpt,
    author: detail.author,
    publishAt: detail.publishAt,
  }
}

function countOccurrences(content: string, keyword: string) {
  if (!keyword) return 0

  return content.split(keyword).length - 1
}

function inferTitlePattern(title: string) {
  if (title.includes('排行榜') || title.includes('排名') || title.includes('十大')) return '排行型标题'
  if (title.includes('推荐') || title.includes('值得买')) return '推荐型标题'
  if (title.includes('测评') || title.includes('评测')) return '测评型标题'
  if (title.includes('怎么选') || title.includes('选购')) return '选购型标题'
  return '通用分析型标题'
}

function inferHeadingOutline(articleText: string) {
  return articleText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[一二三四五六七八九十0-9]+[、.．]/.test(line))
    .slice(0, 12)
}
