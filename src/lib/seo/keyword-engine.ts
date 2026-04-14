// 关键词引擎 - 发现、扩展、管理关键词
import { supabase } from '../supabase'
import {
  fetchGoogleSuggestions,
  expandWithAlphabet,
  expandWithQuestions,
  expandWithComparisons,
  type SuggestResult,
} from './google-suggest'

export interface KeywordEntry {
  keyword: string
  seed_keyword: string
  search_intent?: string
  estimated_volume?: number
  competition_score?: number
}

// 搜索意图分类（基于关键词模式）
function classifyIntent(keyword: string): string {
  const kw = keyword.toLowerCase()

  const transactional = ['buy', 'price', 'cost', 'cheap', 'deal', 'discount', 'coupon', 'hire', 'book', 'order', 'purchase']
  const commercial = ['best', 'top', 'review', 'compare', 'vs', 'versus', 'alternative', 'recommended']
  const navigational = ['login', 'sign in', 'website', 'official', 'app', 'download']

  if (transactional.some((t) => kw.includes(t))) return 'transactional'
  if (commercial.some((t) => kw.includes(t))) return 'commercial'
  if (navigational.some((t) => kw.includes(t))) return 'navigational'
  return 'informational'
}

// 从种子关键词发现新关键词
export async function discoverKeywords(
  seeds: string[],
  lang = 'en',
  country = 'us'
): Promise<SuggestResult[]> {
  const allResults: SuggestResult[] = []

  for (const seed of seeds) {
    // 基础建议
    const basic = await fetchGoogleSuggestions(seed, lang, country)
    allResults.push(...basic)

    // 字母扩展
    const alpha = await expandWithAlphabet(seed, lang, country)
    allResults.push(...alpha)

    // 问题扩展
    const questions = await expandWithQuestions(seed, lang, country)
    allResults.push(...questions)

    // 对比扩展
    const comparisons = await expandWithComparisons(seed, lang, country)
    allResults.push(...comparisons)
  }

  // 去重
  const seen = new Set<string>()
  return allResults.filter((r) => {
    const key = r.keyword.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// 将发现的关键词存入数据库
export async function saveKeywords(
  keywords: SuggestResult[],
  seedKeyword: string
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0
  let skipped = 0

  // 批量 upsert，每批 50 个
  const batch = keywords.map((kw) => ({
    keyword: kw.keyword,
    seed_keyword: seedKeyword,
    search_intent: classifyIntent(kw.keyword),
    weight: 0.5,
    status: 'pending' as const,
  }))

  for (let i = 0; i < batch.length; i += 50) {
    const chunk = batch.slice(i, i + 50)
    const { data, error } = await supabase
      .from('seo_keywords')
      .upsert(chunk, { onConflict: 'keyword', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error('Save keywords error:', error.message)
      skipped += chunk.length
    } else {
      inserted += data?.length || 0
      skipped += chunk.length - (data?.length || 0)
    }
  }

  return { inserted, skipped }
}

// 获取高权重待处理关键词
export async function getTopKeywords(
  limit = 10,
  status = 'pending'
): Promise<KeywordEntry[]> {
  const { data, error } = await supabase
    .from('seo_keywords')
    .select('*')
    .eq('status', status)
    .gte('weight', 0.05)
    .order('weight', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Get top keywords failed: ${error.message}`)
  return data || []
}

// 获取关键词统计
export async function getKeywordStats() {
  const { count: total } = await supabase
    .from('seo_keywords')
    .select('*', { count: 'exact', head: true })

  const { count: pending } = await supabase
    .from('seo_keywords')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: published } = await supabase
    .from('seo_keywords')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')

  const { count: archived } = await supabase
    .from('seo_keywords')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'archived')

  return { total: total || 0, pending: pending || 0, published: published || 0, archived: archived || 0 }
}
