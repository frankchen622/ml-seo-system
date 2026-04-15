// 权重计算器 - V2 多客户版本
// 动态权重算法：表现好的关键词权重上升，差的下降
import { supabaseAdmin } from '../../supabase'

interface WeightParams {
  clicks_weight: number
  impressions_weight: number
  ctr_weight: number
  position_weight: number
  time_on_page_weight: number
  old_weight_factor: number
  new_score_factor: number
  quick_win_boost: number
  zero_data_decay: number
  archive_threshold: number
  initial_weight: number
}

const DEFAULT_PARAMS: WeightParams = {
  clicks_weight: 0.30,
  impressions_weight: 0.15,
  ctr_weight: 0.25,
  position_weight: 0.15,
  time_on_page_weight: 0.15,
  old_weight_factor: 0.6,
  new_score_factor: 0.4,
  quick_win_boost: 1.3,
  zero_data_decay: 0.5,
  archive_threshold: 0.05,
  initial_weight: 0.5,
}

// 从系统配置读取权重参数
async function getWeightParams(): Promise<WeightParams> {
  const { data } = await supabaseAdmin
    .from('system_config')
    .select('value')
    .eq('key', 'weight_params')
    .single()
  return data?.value || DEFAULT_PARAMS
}

// 计算单个关键词的表现分 (0-1)
function calcPerformanceScore(
  kw: any,
  avgTimeOnPage: number,
  params: WeightParams
): number {
  const clicks = Math.min((kw.gsc_clicks || 0) / 100, 1)
  const impressions = Math.min((kw.gsc_impressions || 0) / 1000, 1)
  const ctr = Math.min((kw.gsc_ctr || 0) * 10, 1) // CTR 10% = 满分
  const position = Math.max(0, (100 - (kw.gsc_position || 100)) / 100)
  const timeScore = Math.min(avgTimeOnPage / 300, 1) // 5分钟 = 满分

  return (
    clicks * params.clicks_weight +
    impressions * params.impressions_weight +
    ctr * params.ctr_weight +
    position * params.position_weight +
    timeScore * params.time_on_page_weight
  )
}

// 为单个客户更新所有关键词权重
export async function updateWeightsForClient(clientId: string): Promise<{
  updated: number
  archived: number
}> {
  const params = await getWeightParams()

  const { data: keywords } = await supabaseAdmin
    .from('keywords')
    .select('*')
    .eq('client_id', clientId)
    .neq('status', 'archived')

  if (!keywords || keywords.length === 0) {
    return { updated: 0, archived: 0 }
  }

  let updated = 0
  let archived = 0

  for (const kw of keywords) {
    // 获取关联文章的平均停留时间
    let avgTimeOnPage = 0
    const { data: article } = await supabaseAdmin
      .from('articles')
      .select('id')
      .eq('keyword_id', kw.id)
      .single()

    if (article) {
      const { data: perf } = await supabaseAdmin
        .from('article_performance')
        .select('avg_time_on_page')
        .eq('article_id', article.id)
        .order('week_start', { ascending: false })
        .limit(1)
        .single()
      avgTimeOnPage = perf?.avg_time_on_page || 0
    }

    // 检查是否连续两周零数据
    const { data: history } = await supabaseAdmin
      .from('keyword_history')
      .select('clicks, impressions')
      .eq('keyword_id', kw.id)
      .order('week_start', { ascending: false })
      .limit(2)

    const twoWeeksZero = history && history.length >= 2 &&
      history.every(h => (h.clicks || 0) === 0 && (h.impressions || 0) === 0)

    // 计算新权重
    const perfScore = calcPerformanceScore(kw, avgTimeOnPage, params)
    let newWeight = kw.weight * params.old_weight_factor + perfScore * params.new_score_factor

    // Quick Win 加权
    if (kw.opportunity_type === 'quick_win') {
      newWeight *= params.quick_win_boost
    }

    // 连续零数据衰减
    if (twoWeeksZero) {
      newWeight *= params.zero_data_decay
    }

    // 限制范围
    newWeight = Math.min(Math.max(newWeight, 0), 1)

    // 低于阈值自动归档
    if (newWeight < params.archive_threshold) {
      await supabaseAdmin
        .from('keywords')
        .update({ weight: newWeight, status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', kw.id)
      archived++
    } else {
      await supabaseAdmin
        .from('keywords')
        .update({ weight: newWeight, updated_at: new Date().toISOString() })
        .eq('id', kw.id)
      updated++
    }
  }

  return { updated, archived }
}

// 遍历所有活跃客户
export async function updateAllWeights(): Promise<{
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
      results[client.name] = await updateWeightsForClient(client.id)
    } catch (err: any) {
      results[client.name] = { error: err.message }
    }
  }

  return { clients_processed: clients.length, results }
}
