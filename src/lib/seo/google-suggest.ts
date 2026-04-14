// Google Suggest API - 免费抓取关键词建议
// 通过 Google 自动补全接口获取长尾关键词

export interface SuggestResult {
  keyword: string
  source: string
}

const GOOGLE_SUGGEST_URL = 'https://suggestqueries.google.com/complete/search'

export async function fetchGoogleSuggestions(
  seed: string,
  lang = 'en',
  country = 'us'
): Promise<SuggestResult[]> {
  const params = new URLSearchParams({
    client: 'firefox',
    q: seed,
    hl: lang,
    gl: country,
  })

  const res = await fetch(`${GOOGLE_SUGGEST_URL}?${params}`)
  if (!res.ok) throw new Error(`Google Suggest failed: ${res.status}`)

  const data = await res.json()
  const suggestions: string[] = data[1] || []

  return suggestions
    .filter((s: string) => s.toLowerCase() !== seed.toLowerCase())
    .map((s: string) => ({ keyword: s.trim(), source: 'google_suggest' }))
}

// 字母扩展：seed + a, seed + b, ... seed + z
export async function expandWithAlphabet(
  seed: string,
  lang = 'en',
  country = 'us'
): Promise<SuggestResult[]> {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('')
  const results: SuggestResult[] = []

  for (const letter of letters) {
    try {
      const suggestions = await fetchGoogleSuggestions(`${seed} ${letter}`, lang, country)
      results.push(...suggestions)
      // 避免请求过快被限流
      await sleep(200)
    } catch {
      // 单个字母失败不影响整体
      continue
    }
  }

  return dedup(results)
}

// 问题扩展：what/how/why/when/where + seed
export async function expandWithQuestions(
  seed: string,
  lang = 'en',
  country = 'us'
): Promise<SuggestResult[]> {
  const prefixes = ['what', 'how', 'why', 'when', 'where', 'which', 'who', 'is', 'can', 'does']
  const results: SuggestResult[] = []

  for (const prefix of prefixes) {
    try {
      const suggestions = await fetchGoogleSuggestions(`${prefix} ${seed}`, lang, country)
      results.push(...suggestions)
      await sleep(200)
    } catch {
      continue
    }
  }

  return dedup(results)
}

// 对比扩展：seed vs, seed or, seed compared to
export async function expandWithComparisons(
  seed: string,
  lang = 'en',
  country = 'us'
): Promise<SuggestResult[]> {
  const suffixes = ['vs', 'or', 'compared to', 'alternative', 'versus']
  const results: SuggestResult[] = []

  for (const suffix of suffixes) {
    try {
      const suggestions = await fetchGoogleSuggestions(`${seed} ${suffix}`, lang, country)
      results.push(...suggestions)
      await sleep(200)
    } catch {
      continue
    }
  }

  return dedup(results)
}

function dedup(results: SuggestResult[]): SuggestResult[] {
  const seen = new Set<string>()
  return results.filter((r) => {
    const key = r.keyword.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
