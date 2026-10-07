import { JSDOM } from 'jsdom'

export interface BaiduSerpCollectionInput {
  keyword: string
  rankLimit: number
}

export interface BaiduSerpItem {
  rank: number
  title: string
  snippet: string
  searchUrl: string
  finalUrl: string
  domain: string
}

export interface BaiduSerpCollectionResult {
  inspectedCount: number
  matchedCount: number
  blockedDetected: boolean
  statusMessage: string
  items: BaiduSerpItem[]
}

const SAFETY_VERIFICATION_PATTERNS = ['百度安全验证', '网络不给力，请稍后重试', 'mkdjump']
const BAIDU_SEARCH_BASE_URL = 'https://www.baidu.com/s'
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export async function collectBaiduBaijiahaoSerp(
  input: BaiduSerpCollectionInput
): Promise<BaiduSerpCollectionResult> {
  const searchUrl = `${BAIDU_SEARCH_BASE_URL}?ie=utf-8&wd=${encodeURIComponent(input.keyword)}&rn=${input.rankLimit}`
  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
    },
  })

  if (!response.ok) {
    throw new Error(`百度搜索抓取失败: HTTP ${response.status}`)
  }

  const html = await response.text()

  if (SAFETY_VERIFICATION_PATTERNS.some((pattern) => html.includes(pattern))) {
    return {
      inspectedCount: 0,
      matchedCount: 0,
      blockedDetected: true,
      statusMessage: '百度返回安全验证，当前服务器环境暂时无法直接抓取搜索结果。',
      items: [],
    }
  }

  const items = parseBaiduSearchHtml(html, searchUrl)
  const limitedItems = items.slice(0, input.rankLimit)
  const matchedItems = limitedItems.filter((item) => item.domain.includes('baijiahao.baidu.com'))

  return {
    inspectedCount: limitedItems.length,
    matchedCount: matchedItems.length,
    blockedDetected: false,
    statusMessage:
      matchedItems.length > 0
        ? `在百度前 ${input.rankLimit} 名中命中了 ${matchedItems.length} 篇百家号文章。`
        : `已检查百度前 ${input.rankLimit} 名结果，但没有命中百家号文章。`,
    items: matchedItems,
  }
}

function parseBaiduSearchHtml(html: string, pageUrl: string) {
  const dom = new JSDOM(html, { url: pageUrl })
  const document = dom.window.document
  const containers = Array.from(
    document.querySelectorAll<HTMLElement>('div.result, div.result-op, div.c-container, div.c-result, article')
  )

  const seen = new Set<string>()
  const items: BaiduSerpItem[] = []

  for (const container of containers) {
    const anchor =
      container.querySelector<HTMLAnchorElement>('h3 a') ||
      container.querySelector<HTMLAnchorElement>('a')

    const title = normalizeWhitespace(anchor?.textContent || '')
    const searchUrl = resolveHref(anchor?.getAttribute('href') || '', pageUrl)
    const finalUrl = resolveHref(
      container.getAttribute('mu') ||
        container.querySelector<HTMLElement>('[mu]')?.getAttribute('mu') ||
        searchUrl,
      pageUrl
    )

    if (!title || !searchUrl) continue

    const dedupeKey = `${title}::${finalUrl || searchUrl}`
    if (seen.has(dedupeKey)) continue

    seen.add(dedupeKey)

    const snippet = normalizeWhitespace(
      container.querySelector('.c-abstract')?.textContent ||
        container.querySelector('.content-right_8Zs40')?.textContent ||
        container.querySelector('.c-line-clamp3')?.textContent ||
        container.querySelector('p')?.textContent ||
        ''
    )
    const domainText = normalizeWhitespace(
      container.querySelector('.c-showurl')?.textContent ||
        container.querySelector('.c-color-gray')?.textContent ||
        ''
    )

    const domain = extractDomain(finalUrl || searchUrl || domainText)
    items.push({
      rank: items.length + 1,
      title,
      snippet,
      searchUrl,
      finalUrl,
      domain,
    })
  }

  return items
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function resolveHref(href: string, baseUrl: string) {
  if (!href) return ''

  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return href
  }
}

function extractDomain(value: string) {
  try {
    return new URL(value).hostname
  } catch {
    return value
  }
}
