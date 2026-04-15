// 优化决策引擎 - V2 多客户版本
// 根据文章表现数据自动生成优化决策
import { supabaseAdmin } from '../../supabase'

type ActionType = 'new_content' | 'rewrite' | 'meta_optimize' | 'expand' | 'archive'

interface Decision {
  client_id: string
  action_type: ActionType
  target_keyword: string | null
  target_article_id: string | null
  reason: string
  data_snapshot: any
}

// 为单个客户生成优化决策
export async function analyzeForClient(clientId: string): Promise<{
  decisions: number
  breakdown: Record<string, number>
}> {
  const decisions: Decision[] = []
  const today = new Date().toISOString().split('T')[0]

  // 1. 有展现无点击 → 优化标题和 meta
  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id, title, slug, keyword_id, published_at, created_at')
    .eq('client_id', clientId)
    .eq('status', 'published')

  if (!articles || articles.length === 0) {
    return { decisions: 0, breakdown: {} }
  }

  for (const art of articles) {
    // 获取最近 2 周表现
    const { data: perfs } = await supabaseAdmin
      .from('article_performance')
      .select('*')
      .eq('article_id', art.id)
      .order('week_start', { ascending: false })
      .limit(2)

    if (!perfs || perfs.length === 0) {
      // 发布超过 30 天但无数据 → 可能未收录
      const publishedAt = new Date(art.published_at || art.created_at)
      const daysSincePublish = Math.floor((Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24))
      if (daysSincePublish > 30) {
        decisions.push({
          client_id: clientId,
          action_type: 'rewrite',
          target_keyword: null,
          target_article_id: art.id,
          reason: `Published ${daysSincePublish} days ago with zero performance data — likely not indexed`,
          data_snapshot: { days_since_publish: daysSincePublish },
        })
      }
      continue
    }

    const latest = perfs[0]

    // 有展现无点击 → meta 优化
    if ((latest.impressions || 0) > 50 && (latest.clicks || 0) <= 2) {
      decisions.push({
        client_id: clientId,
        action_type: 'meta_optimize',
        target_keyword: null,
        target_article_id: art.id,
        reason: `${latest.impressions} impressions but only ${latest.clicks} clicks — title/meta needs optimization`,
        data_snapshot: { impressions: latest.impressions, clicks: latest.clicks, ctr: latest.ctr },
      })
    }

    // 有点击高跳出 → 内容重写
    if ((latest.clicks || 0) > 10 && (latest.bounce_rate || 0) > 0.75) {
      decisions.push({
        client_id: clientId,
        action_type: 'rewrite',
        target_keyword: null,
        target_article_id: art.id,
        reason: `${latest.clicks} clicks but ${(latest.bounce_rate * 100).toFixed(0)}% bounce rate — content not meeting expectations`,
        data_snapshot: { clicks: latest.clicks, bounce_rate: latest.bounce_rate, avg_time: latest.avg_time_on_page },
      })
    }

    // 排名 11-30 → 冲刺首页
    if ((latest.avg_position || 100) >= 11 && (latest.avg_position || 100) <= 30 && (latest.impressions || 0) > 30) {
      decisions.push({
        client_id: clientId,
        action_type: 'rewrite',
        target_keyword: null,
        target_article_id: art.id,
        reason: `Position ${latest.avg_position?.toFixed(1)} with ${latest.impressions} impressions — optimize to push to page 1`,
        data_snapshot: { position: latest.avg_position, impressions: latest.impressions },
      })
    }

    // 表现好 → 扩展长尾
    if ((latest.clicks || 0) > 20 && (latest.avg_time_on_page || 0) > 120) {
      decisions.push({
        client_id: clientId,
        action_type: 'expand',
        target_keyword: null,
        target_article_id: art.id,
        reason: `High performer: ${latest.clicks} clicks, ${(latest.avg_time_on_page / 60).toFixed(1)}min avg time — expand to related topics`,
        data_snapshot: { clicks: latest.clicks, time: latest.avg_time_on_page },
      })
    }

    // 流量下滑 → 优化
    if (perfs.length >= 2) {
      const prev = perfs[1]
      if ((prev.clicks || 0) > 10 && (latest.clicks || 0) < (prev.clicks || 0) * 0.5) {
        decisions.push({
          client_id: clientId,
          action_type: 'rewrite',
          target_keyword: null,
          target_article_id: art.id,
          reason: `Traffic dropped ${((1 - latest.clicks / prev.clicks) * 100).toFixed(0)}%: ${prev.clicks} → ${latest.clicks} clicks`,
          data_snapshot: { prev_clicks: prev.clicks, curr_clicks: latest.clicks },
        })
      }
    }
  }

  // 保存决策
  const breakdown: Record<string, number> = {}
  for (const d of decisions) {
    breakdown[d.action_type] = (breakdown[d.action_type] || 0) + 1
    await supabaseAdmin.from('optimization_log').insert({
      client_id: d.client_id,
      cycle_date: today,
      action_type: d.action_type,
      target_keyword: d.target_keyword,
      target_article_id: d.target_article_id,
      reason: d.reason,
      data_snapshot: d.data_snapshot,
      status: 'pending',
    })
  }

  return { decisions: decisions.length, breakdown }
}

// 遍历所有活跃客户
export async function analyzeAll(): Promise<{
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
      results[client.name] = await analyzeForClient(client.id)
    } catch (err: any) {
      results[client.name] = { error: err.message }
    }
  }

  return { clients_processed: clients.length, results }
}
