// 关键词机会分类器
// 根据 GSC 数据将关键词分为 quick_win / new_content / optimize / expand
import { supabaseAdmin } from '../../supabase'

interface OpportunityResult {
  keyword_id: string
  keyword: string
  opportunity_type: string
  reason: string
}

// 为单个客户分类关键词机会
export async function classifyOpportunities(clientId: string): Promise<{
  classified: number
  breakdown: Record<string, number>
}> {
  const { data: keywords } = await supabaseAdmin
    .from('keywords')
    .select('*')
    .eq('client_id', clientId)
    .in('status', ['discovered', 'queued'])

  if (!keywords || keywords.length === 0) {
    return { classified: 0, breakdown: {} }
  }

  // 获取该客户已有文章的关键词
  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('keyword_id, slug')
    .eq('client_id', clientId)
    .neq('status', 'archived')

  const publishedKeywordIds = new Set((articles || []).map(a => a.keyword_id).filter(Boolean))

  const results: OpportunityResult[] = []
  const breakdown: Record<string, number> = {}

  for (const kw of keywords) {
    let type: string
    let reason: string

    const hasArticle = publishedKeywordIds.has(kw.id)
    const imp = kw.gsc_impressions || 0
    const clicks = kw.gsc_clicks || 0
    const ctr = kw.gsc_ctr || 0
    const pos = kw.gsc_position || 100

    if (!hasArticle && imp > 0) {
      // GSC 有展现但没有对应文章 → 新内容机会
      type = 'new_content'
      reason = `GSC shows ${imp} impressions but no article exists`
    } else if (pos >= 5 && pos <= 20 && imp >= 50 && ctr < 0.03) {
      // 排名 5-20，展现多但 CTR 低 → 快赢
      type = 'quick_win'
      reason = `Position ${pos.toFixed(1)}, ${imp} impressions, CTR only ${(ctr * 100).toFixed(1)}%`
    } else if (hasArticle && imp > 100) {
      // 有文章有流量，检查是否需要优化
      // 获取最近两周历史看趋势
      const { data: history } = await supabaseAdmin
        .from('keyword_history')
        .select('*')
        .eq('keyword_id', kw.id)
        .order('week_start', { ascending: false })
        .limit(2)

      if (history && history.length >= 2) {
        const recent = history[0]
        const prev = history[1]
        if (recent.clicks < prev.clicks * 0.7) {
          type = 'optimize'
          reason = `Traffic declining: ${prev.clicks} → ${recent.clicks} clicks`
        } else {
          type = 'expand'
          reason = `Stable performer with ${imp} impressions, expand to long-tail`
        }
      } else {
        type = 'expand'
        reason = `High impressions (${imp}), expand to related terms`
      }
    } else if (!hasArticle) {
      type = 'new_content'
      reason = 'No article exists for this keyword'
    } else {
      continue // 不分类
    }

    results.push({ keyword_id: kw.id, keyword: kw.keyword, opportunity_type: type, reason })
    breakdown[type] = (breakdown[type] || 0) + 1
  }

  // 批量更新
  for (const r of results) {
    await supabaseAdmin
      .from('keywords')
      .update({ opportunity_type: r.opportunity_type, updated_at: new Date().toISOString() })
      .eq('id', r.keyword_id)
  }

  return { classified: results.length, breakdown }
}

// 遍历所有活跃客户
export async function classifyAllClients(): Promise<{
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
      results[client.name] = await classifyOpportunities(client.id)
    } catch (err: any) {
      results[client.name] = { error: err.message }
    }
  }

  return { clients_processed: clients.length, results }
}
