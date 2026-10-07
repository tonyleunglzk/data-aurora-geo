import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

export interface FetchedArticleDetail {
  url: string
  html: string
  title: string
  text: string
  excerpt: string
  author: string
  publishAt: string
  headings: string[]
}

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const MOBILE_BROWSER_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const ARTICLE_FETCH_TIMEOUT_MS = 15_000

const SAFETY_VERIFICATION_PATTERNS = [
  '百度安全验证',
  '网络不给力，请稍后重试',
  'mkdjump',
  'x-waf-captcha',
  'probe.js',
  'buid = "fffffffffffffffffff"',
]

const SAFETY_VERIFICATION_MESSAGE =
  '目标网站返回安全验证，当前服务器无法直接抓取该页面内容，请在浏览器打开后复制正文，改用“粘贴文本”模式继续对话'

const isSafetyVerificationPage = (html: string) => {
  return SAFETY_VERIFICATION_PATTERNS.some((pattern) => html.includes(pattern))
}

const isSafetyVerificationError = (error: unknown) => {
  return error instanceof Error && error.message === SAFETY_VERIFICATION_MESSAGE
}

const toReadableFallbackUrl = (url: string) => {
  try {
    const parsed = new URL(url)

    if (
      ['post.smzdm.com', 'www.smzdm.com', 'm.smzdm.com'].includes(parsed.hostname) &&
      parsed.pathname.startsWith('/p/')
    ) {
      parsed.protocol = 'https:'
      parsed.hostname = 'post.m.smzdm.com'
      parsed.hash = ''
      return parsed.toString()
    }
  } catch {
    return ''
  }

  return ''
}

const toRequestUserAgent = (url: string) => {
  try {
    const parsed = new URL(url)
    return parsed.hostname === 'post.m.smzdm.com' ? MOBILE_BROWSER_USER_AGENT : BROWSER_USER_AGENT
  } catch {
    return BROWSER_USER_AGENT
  }
}

export async function fetchArticle(url: string): Promise<string> {
  const detail = await fetchArticleDetail(url)
  return composeArticleText(detail)
}

export async function fetchArticleDetail(url: string): Promise<FetchedArticleDetail> {
  const fallbackUrl = toReadableFallbackUrl(url)
  const urls = Array.from(new Set([url, fallbackUrl].filter(Boolean)))
  let safetyError: unknown = null

  for (const candidateUrl of urls) {
    try {
      return await fetchArticleDetailOnce(candidateUrl)
    } catch (error) {
      if (isSafetyVerificationError(error) && candidateUrl !== urls[urls.length - 1]) {
        safetyError = error
        continue
      }

      throw error
    }
  }

  if (safetyError instanceof Error) {
    throw safetyError
  }

  throw new Error('无法提取文章正文，请尝试手动粘贴文章内容')
}

async function fetchArticleDetailOnce(url: string): Promise<FetchedArticleDetail> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ARTICLE_FETCH_TIMEOUT_MS)

  let response: Response

  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': toRequestUserAgent(url),
      },
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('抓取文章超时，请尝试手动粘贴文章内容')
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }

  if (response.status === 202) {
    throw new Error(SAFETY_VERIFICATION_MESSAGE)
  }

  if (!response.ok) {
    throw new Error(`抓取失败: HTTP ${response.status}`)
  }

  const html = await response.text()

  if (isSafetyVerificationPage(html)) {
    throw new Error(SAFETY_VERIFICATION_MESSAGE)
  }

  const dom = new JSDOM(html, { url })
  const reader = new Readability(dom.window.document)
  const article = reader.parse()

  if (!article || !article.textContent) {
    throw new Error('无法提取文章正文，请尝试手动粘贴文章内容')
  }

  const title = extractArticleTitle(dom.window.document, article?.title)
  const text = article.textContent.trim()
  const excerpt = text.slice(0, 220)
  const author =
    dom.window.document.querySelector('meta[name="author"]')?.getAttribute('content')?.trim() ||
    dom.window.document.querySelector('meta[property="article:author"]')?.getAttribute('content')?.trim() ||
    dom.window.document.querySelector('[itemprop="author"]')?.textContent?.trim() ||
    dom.window.document.querySelector('.author-name')?.textContent?.trim() ||
    ''
  const publishAt =
    dom.window.document
      .querySelector('meta[property="article:published_time"]')
      ?.getAttribute('content')
      ?.trim() ||
    dom.window.document.querySelector('meta[name="publishdate"]')?.getAttribute('content')?.trim() ||
    dom.window.document.querySelector('time')?.getAttribute('datetime')?.trim() ||
    dom.window.document.querySelector('time')?.textContent?.trim() ||
    ''
  const headings = Array.from(dom.window.document.querySelectorAll('h1, h2, h3'))
    .map((node) => node.textContent?.trim() || '')
    .filter(Boolean)
    .slice(0, 12)

  return {
    url,
    html,
    title,
    text,
    excerpt,
    author,
    publishAt,
    headings,
  }
}

function composeArticleText(detail: FetchedArticleDetail) {
  const text = detail.text.trim()
  const title = detail.title.trim()

  if (!title) return text

  const leadText = text.slice(0, 240)
  if (leadText.includes(title)) return text

  return `标题：${title}\n\n正文：\n${text}`
}

function extractArticleTitle(document: Document, readabilityTitle?: string | null) {
  const candidates = [
    readabilityTitle,
    readMeta(document, 'property', 'og:title'),
    readMeta(document, 'name', 'twitter:title'),
    readMeta(document, 'property', 'article:title'),
    readMeta(document, 'name', 'weibo:title'),
    readMeta(document, 'name', 'parsely-title'),
    readMeta(document, 'name', 'sailthru.title'),
    readJsonLdTitle(document),
    document.querySelector('h1')?.textContent,
    document.querySelector('.article-title')?.textContent,
    document.querySelector('.title')?.textContent,
    document.querySelector('#activity-name')?.textContent,
    document.querySelector('title')?.textContent,
  ]

  for (const candidate of candidates) {
    const title = cleanTitle(candidate)
    if (title) return title
  }

  return ''
}

function readMeta(document: Document, attr: 'name' | 'property', value: string) {
  return document.querySelector(`meta[${attr}="${value}"]`)?.getAttribute('content')
}

function readJsonLdTitle(document: Document) {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))

  for (const script of scripts) {
    const rawText = script.textContent?.trim()
    if (!rawText) continue

    try {
      const parsed = JSON.parse(rawText)
      const title = findJsonLdTitle(parsed)
      if (title) return title
    } catch {
      continue
    }
  }

  return ''
}

function findJsonLdTitle(value: unknown): string {
  if (!value) return ''

  if (Array.isArray(value)) {
    for (const item of value) {
      const title = findJsonLdTitle(item)
      if (title) return title
    }
    return ''
  }

  if (typeof value !== 'object') return ''

  const source = value as Record<string, unknown>
  const graphTitle = findJsonLdTitle(source['@graph'])
  if (graphTitle) return graphTitle

  const headline = source.headline
  if (typeof headline === 'string' && headline.trim()) return headline

  const name = source.name
  if (typeof name === 'string' && name.trim()) return name

  return ''
}

function cleanTitle(value?: string | null) {
  const title = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!title) return ''

  return title
    .replace(/\s*[-_|]\s*(百度百家|百家号|百度|搜狐|腾讯新闻|今日头条|什么值得买|知乎)\s*$/i, '')
    .replace(/\s*[-_|]\s*[\w\u4e00-\u9fa5]{2,20}\s*$/i, (match, offset, fullText) => {
      const before = fullText.slice(0, offset).trim()
      return before.length >= 12 ? '' : match
    })
    .trim()
}
