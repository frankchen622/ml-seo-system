// 模式学习引擎
// 分析高表现文章的共同特征，提取可复用的内容模式
import { supabaseAdmin } from '../../supabase'

interface ArticleWithPerf {
  id: string
  client_id: string
  title: string
  content_markdown: string
  word_count: number | null
  faq_items: any
  schema_markup: any
  avg_clicks: number
  avg_ctr: number
  avg_time_on_page: number
  avg_bounce_rate: number
}

// 内容特征检测
function detectFeatures(article: ArticleWithPerf): string[] {
  const features: string[] = []
  const content = article.content_markdown.toLowerCase()

  // 结构特征
  if (content.includes('|') && content.includes('---')) features.push('has_table')
  if (content.match(/#{2,3}\s.*\?/g)) features.push('has_question_headings')
  if (article.faq_items && Array.isArray(article.faq_items) && article.faq_items.length > 0) features.push('has_faq')
  if (content.includes('```') || content.includes('<code>')) features.push('has_code_blocks')
  if (content.match(/\d+[\.\)]\s/g)?.length || 0 >= 5) features.push('has_numbered_list')
  if (content.match(/[-*]\s/g)?.length || 0 >= 5) features.push('has_bullet_list')
  if (article.schema_markup) features.push('has_schema')

  // 语气特征
  if (content.match(/\bi\s|\bmy\s|\bwe\s|\bour\s/g)?.length || 0 >= 3) features.push('first_person')
  if (content.match(/\byou\s|\byour\s/g)?.length || 0 >= 5) features.push('second_person')

  // 内容特征
  if (content.match(/case study|real example|in practice/g)) features.push('has_case_study')
  if (content.match(/\d+%|\$[\d,]+|according to/g)) features.push('has_data_points')
  if (content.match(/step \d|how to/g)) features.push('how_to_format')
  if (content.match(/vs\.?|versus|compared to|comparison/g)) features.push('comparison_format')

  // 长度特征
  const wc = article.word_count || 0
  if (wc >= 2000 && wc <= 2500) features.push('length_2000_2500')
  else if (wc >= 1500 && wc < 2000) features.push('length_1500_2000')
  else if (wc > 2500 && wc <= 3500) features.push('length_2500_3500')
  else if (wc > 3500) features.push('length_3500_plus')

  return features
}

// 为单个客户提取模式
export async function learnPatternsForClient(clientId: string): Promise<{
  patterns_found: number
  patterns_saved: number
}> {
  // 获取有表现数据的已发布文章
  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id, client_id, title, content_markdown, word_count, faq_items, schema_markup')
    .eq('client_id', clientId)
    .eq('status', 'published')

  if (!articles || articles.length < 5) {
    // 数据太少，不做模式学习
    return { patterns_found: 0, patterns_saved: 0 }
  }

  // 获取每篇文章的平均表现
  const articlesWithPerf: ArticleWithPerf[] = []
  for (const art of articles) {
    const { data: perfs } = await supabaseAdmin
      .from('article_performance')
      .select('clicks, ctr, avg_time_on_page, bounce_rate')
      .eq('article_id', art.id)

    if (!perfs || perfs.length === 0) continue

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
    articlesWithPerf.push({
      ...art,
      avg_clicks: avg(perfs.map(p => p.clicks || 0)),
      avg_ctr: avg(perfs.map(p => p.ctr || 0)),
      avg_time_on_page: avg(perfs.map(p => p.avg_time_on_page || 0)),
      avg_bounce_rate: avg(perfs.map(p => p.bounce_rate || 0)),
    })
  }

  if (articlesWithPerf.length < 5) {
    return { patterns_found: 0, patterns_saved: 0 }
  }

  // 按综合表现排序，取 top 30% 为高表现组
  articlesWithPerf.sort((a, b) => {
    const scoreA = a.avg_clicks * 0.4 + a.avg_ctr * 100 * 0.3 + a.avg_time_on_page / 60 * 0.3
    const scoreB = b.avg_clicks * 0.4 + b.avg_ctr * 100 * 0.3 + b.avg_time_on_page / 60 * 0.3
    return scoreB - scoreA
  })

  const topCount = Math.max(3, Math.floor(articlesWithPerf.length * 0.3))
  const topArticles = articlesWithPerf.slice(0, topCount)
  const bottomArticles = articlesWithPerf.slice(-topCount)

  // 统计特征频率
  const topFeatures: Record<string, number> = {}
  const bottomFeatures: Record<string, number> = {}

  for (const art of topArticles) {
    for (const f of detectFeatures(art)) {
      topFeatures[f] = (topFeatures[f] || 0) + 1
    }
  }
  for (const art of bottomArticles) {
    for (const f of detectFeatures(art)) {
      bottomFeatures[f] = (bottomFeatures[f] || 0) + 1
    }
  }

  // 找出高表现组显著高于低表现组的特征
  const patterns: Array<{ type: string; description: string; evidence: any; score: number }> = []
  const featureDescriptions: Record<string, { type: string; desc: string }> = {
    has_table: { type: 'element', desc: 'Articles with comparison tables perform better' },
    has_faq: { type: 'structure', desc: 'FAQ sections improve engagement' },
    has_question_headings: { type: 'structure', desc: 'Question-based headings attract more clicks' },
    first_person: { type: 'tone', desc: 'First-person narrative increases time on page' },
    second_person: { type: 'tone', desc: 'Direct "you" language improves engagement' },
    has_case_study: { type: 'element', desc: 'Real case studies boost credibility and time on page' },
    has_data_points: { type: 'element', desc: 'Data-backed content performs better' },
    how_to_format: { type: 'structure', desc: 'How-to format drives higher CTR' },
    comparison_format: { type: 'structure', desc: 'Comparison content attracts commercial intent traffic' },
    has_numbered_list: { type: 'format', desc: 'Numbered lists improve readability' },
    length_2000_2500: { type: 'format', desc: 'Articles between 2000-2500 words rank most consistently' },
    has_schema: { type: 'element', desc: 'Schema markup correlates with better rankings' },
  }

  for (const [feature, topCount_] of Object.entries(topFeatures)) {
    const topRate = topCount_ / topArticles.length
    const bottomRate = (bottomFeatures[feature] || 0) / bottomArticles.length
    const diff = topRate - bottomRate

    if (diff > 0.2 && topRate > 0.4) {
      const info = featureDescriptions[feature]
      if (info) {
        patterns.push({
          type: info.type,
          description: info.desc,
          evidence: { feature, top_rate: topRate, bottom_rate: bottomRate, diff },
          score: diff,
        })
      }
    }
  }

  // 保存到数据库（先清除旧模式）
  await supabaseAdmin
    .from('content_patterns')
    .update({ active: false })
    .eq('client_id', clientId)

  let saved = 0
  for (const p of patterns) {
    const { error } = await supabaseAdmin
      .from('content_patterns')
      .insert({
        client_id: clientId,
        pattern_type: p.type,
        description: p.description,
        evidence: p.evidence,
        effectiveness_score: p.score,
        active: true,
      })
    if (!error) saved++
  }

  return { patterns_found: patterns.length, patterns_saved: saved }
}

// 遍历所有活跃客户
export async function learnAllPatterns(): Promise<{
  clients_processed: number
  results: Record<string, any>
}> {
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, name')
    .eq('status', 'active')

  if (!clients || clients.length === 0) {
    return { clients_processed: 0, results: {} }
  }

  const results: Record<string, any> = {}
  for (const client of clients) {
    try {
      results[client.name] = await learnPatternsForClient(client.id)
    } catch (err: any) {
      results[client.name] = { error: err.message }
    }
  }

  return { clients_processed: clients.length, results }
}
