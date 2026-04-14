// 关键词权重计算器
// 根据 GSC 流量数据动态更新关键词权重
import { supabase } from '../supabase'

interface WeightParams {
  decay_factor: number      // 旧权重衰减系数，默认 0.7
  performance_factor: number // 新表现权重系数，默认 0.3
  min_weight: number        // 最低权重阈值，默认 0.05
  initial_weight: number    // 新关键词初始权重，默认 0.5
}

const DEFAULT_PARAMS: WeightParams = {
  decay_factor: 0.7,
  performance_factor: 0.3,
  min_weight: 0.05,
  initial_weight: 0.5,
}

// 从配置表读取权重参数
async function getWeightParams(): Promise<WeightParams> {
  const { data } = await supabase
    .from('seo_config')
    .select('value')
    .eq('key', 'weight_params')
    .single()

  return data?.value || DEFAULT_PARAMS
}

// 计算单个关键词的表现分（0-1）
function calculatePerformanceScore(
  clicks: number,
  impressions: number,
  ctr: number,
  avgPosition: number
): number {
  // 各指标归一化后加权
  const clickScore = Math.min(clicks / 100, 1)          // 100 clicks = 满分
  const impressionScore = Math.min(impressions / 1000, 1) // 1000 impressions = 满分
  const ctrScore = Math.min(ctr / 0.1, 1)                // 10% CTR = 满分
  const positionScore = Math.max(0, (100 - avgPosition) / 100)

  return (
    clickScore * 0.4 +
    impressionScore * 0.2 +
    ctrScore * 0.25 +
    positionScore * 0.15
  )
}

// 更新所有关键词的权重
export async function updateAllWeights(): Promise<{
  updated: number
  archived: number
}> {
  const params = await getWeightParams()

  // 获取所有非归档关键词
  const { data: keywords, error } = await supabase
    .from('seo_keywords')
    .select('id, weight, status')
    .neq('status', 'archived')

  if (error || !keywords) throw new Error(`Fetch keywords failed: ${error?.message}`)

  let updated = 0
  let archived = 0

  for (const kw of keywords) {
    // 获取最近 14 天的表现数据
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    const { data: perfData } = await supabase
      .from('seo_keyword_performance')
      .select('clicks, impressions, ctr, avg_position')
      .eq('keyword_id', kw.id)
      .gte('date', twoWeeksAgo.toISOString().split('T')[0])

    let newWeight: number

    if (!perfData || perfData.length === 0) {
      // 无数据：权重衰减
      newWeight = kw.weight * 0.9
    } else {
      // 汇总表现数据
      const totalClicks = perfData.reduce((s, p) => s + (p.clicks || 0), 0)
      const totalImpressions = perfData.reduce((s, p) => s + (p.impressions || 0), 0)
      const avgCtr = perfData.reduce((s, p) => s + (p.ctr || 0), 0) / perfData.length
      const avgPos = perfData.reduce((s, p) => s + (p.avg_position || 100), 0) / perfData.length

      const perfScore = calculatePerformanceScore(totalClicks, totalImpressions, avgCtr, avgPos)
      newWeight = kw.weight * params.decay_factor + perfScore * params.performance_factor
    }

    // 权重下限检查
    if (newWeight < params.min_weight) {
      // 归档
      await supabase
        .from('seo_keywords')
        .update({ status: 'archived', weight: newWeight, updated_at: new Date().toISOString() })
        .eq('id', kw.id)
      archived++
    } else {
      await supabase
        .from('seo_keywords')
        .update({ weight: newWeight, updated_at: new Date().toISOString() })
        .eq('id', kw.id)
      updated++
    }
  }

  return { updated, archived }
}

// 获取权重排行榜
export async function getWeightLeaderboard(limit = 20) {
  const { data, error } = await supabase
    .from('seo_keywords')
    .select('id, keyword, weight, status, search_intent')
    .neq('status', 'archived')
    .order('weight', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Leaderboard failed: ${error.message}`)
  return data || []
}
