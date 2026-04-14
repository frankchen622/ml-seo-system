// 优化决策引擎
// 根据数据自动生成优化建议并执行
import { supabase } from '../supabase'

type DecisionType = 'rewrite' | 'expand' | 'archive' | 'boost' | 'new_content'

interface Decision {
  decision_type: DecisionType
  target_type: 'keyword' | 'article'
  target_id: string
  reason: string
}

// 分析并生成优化决策
export async function analyzeAndDecide(): Promise<Decision[]> {
  const decisions: Decision[] = []

  // 1. 有展现无点击的关键词 → 优化标题/meta
  const { data: highImpLowClick } = await supabase
    .from('seo_keyword_performance')
    .select('keyword_id, impressions, clicks')
    .gte('impressions', 50)
    .lte('clicks', 2)
    .gte('date', daysAgo(14))

  if (highImpLowClick) {
    const seen = new Set<string>()
    for (const row of highImpLowClick) {
      if (seen.has(row.keyword_id)) continue
      seen.add(row.keyword_id)
      decisions.push({
        decision_type: 'rewrite',
        target_type: 'keyword',
        target_id: row.keyword_id,
        reason: `高展现(${row.impressions})低点击(${row.clicks})，需优化标题和meta description`,
      })
    }
  }

  // 2. 排名 11-30 的文章 → 内容优化争取进首页
  const { data: almostFirstPage } = await supabase
    .from('seo_keyword_performance')
    .select('keyword_id, avg_position')
    .gte('avg_position', 11)
    .lte('avg_position', 30)
    .gte('date', daysAgo(7))

  if (almostFirstPage) {
    const seen = new Set<string>()
    for (const row of almostFirstPage) {
      if (seen.has(row.keyword_id)) continue
      seen.add(row.keyword_id)

      // 找到对应文章
      const { data: article } = await supabase
        .from('seo_articles')
        .select('id')
        .eq('keyword_id', row.keyword_id)
        .eq('status', 'published')
        .single()

      if (article) {
        decisions.push({
          decision_type: 'boost',
          target_type: 'article',
          target_id: article.id,
          reason: `排名${Math.round(row.avg_position)}位，接近首页，值得优化内容冲刺`,
        })
      }
    }
  }

  // 3. 高流量关键词 → 扩展系列内容
  const { data: highTraffic } = await supabase
    .from('seo_keyword_performance')
    .select('keyword_id, clicks')
    .gte('clicks', 20)
    .gte('date', daysAgo(7))

  if (highTraffic) {
    const seen = new Set<string>()
    for (const row of highTraffic) {
      if (seen.has(row.keyword_id)) continue
      seen.add(row.keyword_id)
      decisions.push({
        decision_type: 'expand',
        target_type: 'keyword',
        target_id: row.keyword_id,
        reason: `高流量(${row.clicks} clicks/周)，值得扩展更多相关长尾内容`,
      })
    }
  }

  // 4. 发布超过30天零流量的文章 → 归档
  const thirtyDaysAgo = daysAgo(30)
  const { data: deadArticles } = await supabase
    .from('seo_articles')
    .select('id, slug, published_at')
    .eq('status', 'published')
    .lte('published_at', thirtyDaysAgo)

  if (deadArticles) {
    for (const article of deadArticles) {
      const { data: perf } = await supabase
        .from('seo_article_performance')
        .select('organic_clicks')
        .eq('article_id', article.id)
        .gte('date', daysAgo(30))

      const totalClicks = perf?.reduce((s, p) => s + (p.organic_clicks || 0), 0) || 0
      if (totalClicks === 0) {
        decisions.push({
          decision_type: 'archive',
          target_type: 'article',
          target_id: article.id,
          reason: `发布超过30天，零自然流量，建议归档或重写`,
        })
      }
    }
  }

  return decisions
}

// 保存决策到数据库
export async function saveDecisions(decisions: Decision[]): Promise<number> {
  if (decisions.length === 0) return 0

  const { data, error } = await supabase
    .from('seo_optimization_decisions')
    .insert(decisions)
    .select('id')

  if (error) throw new Error(`Save decisions failed: ${error.message}`)
  return data?.length || 0
}

// 执行归档决策
export async function executeArchiveDecisions(): Promise<number> {
  const { data: pending } = await supabase
    .from('seo_optimization_decisions')
    .select('id, target_id, target_type')
    .eq('decision_type', 'archive')
    .eq('status', 'pending')

  if (!pending || pending.length === 0) return 0

  let executed = 0
  for (const d of pending) {
    const table = d.target_type === 'article' ? 'seo_articles' : 'seo_keywords'
    await supabase.from(table).update({ status: 'archived' }).eq('id', d.target_id)
    await supabase
      .from('seo_optimization_decisions')
      .update({ status: 'executed', executed_at: new Date().toISOString() })
      .eq('id', d.id)
    executed++
  }

  return executed
}

// 获取待处理决策
export async function getPendingDecisions() {
  const { data } = await supabase
    .from('seo_optimization_decisions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50)

  return data || []
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}
