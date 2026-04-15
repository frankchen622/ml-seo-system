// 发布节奏控制器
// 按客户配置的发布频率，智能分配发布时间
import { supabaseAdmin, type Client } from '../../supabase'
import { publishArticle } from './wordpress-publisher'

// 获取默认发布配置
async function getDefaultPublishConfig(): Promise<any> {
  const { data } = await supabaseAdmin
    .from('system_config')
    .select('value')
    .eq('key', 'default_publish')
    .single()
  return data?.value || { per_week: 10, ramp_up_weeks: 2, ramp_up_ratio: 0.5, spread_weekdays: true }
}

// 计算今天应该发布几篇（考虑 ramp-up）
function calcDailyQuota(client: Client, config: any): number {
  const perWeek = client.publish_per_week || config.per_week
  const dailyBase = Math.ceil(perWeek / 5) // 工作日均摊

  // 检查客户创建时间，如果在 ramp-up 期内，减少发布量
  const createdAt = new Date(client.created_at)
  const now = new Date()
  const daysActive = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
  const rampUpDays = (config.ramp_up_weeks || 2) * 7

  if (daysActive < rampUpDays) {
    return Math.max(1, Math.floor(dailyBase * (config.ramp_up_ratio || 0.5)))
  }

  return dailyBase
}

// 检查今天是否已发布足够
async function getTodayPublishedCount(clientId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabaseAdmin
    .from('articles')
    .select('id')
    .eq('client_id', clientId)
    .gte('published_at', `${today}T00:00:00Z`)
    .lte('published_at', `${today}T23:59:59Z`)

  return data?.length || 0
}

// 为单个客户执行发布
async function publishForClient(client: Client): Promise<{
  published: number
  articles: string[]
}> {
  if (!client.auto_publish) {
    return { published: 0, articles: [] }
  }

  if (!client.wp_url || !client.wp_username || !client.wp_app_password) {
    console.log(`Skipping ${client.name}: WordPress not configured`)
    return { published: 0, articles: [] }
  }

  const config = await getDefaultPublishConfig()
  const quota = calcDailyQuota(client, config)
  const alreadyPublished = await getTodayPublishedCount(client.id)
  const remaining = quota - alreadyPublished

  if (remaining <= 0) {
    return { published: 0, articles: [] }
  }

  // 获取待发布文章（优先 approved，其次 draft）
  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('*')
    .eq('client_id', client.id)
    .in('status', ['approved', 'draft'])
    .order('quality_score', { ascending: false })
    .limit(remaining)

  if (!articles || articles.length === 0) {
    return { published: 0, articles: [] }
  }

  const publishedTitles: string[] = []

  for (const article of articles) {
    try {
      const result = await publishArticle(client, article)
      publishedTitles.push(article.title)
      console.log(`Published: ${article.title} → ${result.wp_url}`)
    } catch (err: any) {
      console.error(`Failed to publish "${article.title}":`, err.message)
    }
  }

  return { published: publishedTitles.length, articles: publishedTitles }
}

// 遍历所有活跃客户执行发布
export async function publishBatch(): Promise<{
  clients_processed: number
  results: Record<string, any>
}> {
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('status', 'active')

  if (!clients || clients.length === 0) {
    return { clients_processed: 0, results: {} }
  }

  const results: Record<string, any> = {}
  for (const client of clients) {
    try {
      results[client.name] = await publishForClient(client)
    } catch (err: any) {
      results[client.name] = { error: err.message }
    }
  }

  return { clients_processed: clients.length, results }
}
