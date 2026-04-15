// 文章表现追踪器
// 追踪已发布文章在 GSC 中的表现，合并到 article_performance
import { supabaseAdmin, type Client } from '../../supabase'

// 获取 Access Token
async function getAccessToken(client: Client): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: client.google_refresh_token!,
      client_id: client.google_client_id!,
      client_secret: client.google_client_secret!,
    }),
  })
  if (!res.ok) throw new Error(`OAuth refresh failed: ${res.status}`)
  const data = await res.json()
  return data.access_token
}

// 从 GSC 获取页面级数据
async function fetchPagePerformance(
  siteUrl: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>> {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: 5000,
      }),
    }
  )
  if (!res.ok) throw new Error(`GSC page query failed: ${res.status}`)
  const data = await res.json()
  return (data.rows || []).map((r: any) => ({
    page: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }))
}

// 从 URL 提取 slug
function extractSlug(url: string): string {
  try {
    const path = new URL(url).pathname
    return path.replace(/^\//, '').replace(/\/$/, '')
  } catch {
    return url.replace(/^\//, '').replace(/\/$/, '')
  }
}

// 获取本周起始日
function getWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(now.setDate(diff)).toISOString().split('T')[0]
}

// 为单个客户追踪文章表现
async function trackForClient(client: Client): Promise<{ tracked: number }> {
  if (!client.gsc_site_url || !client.google_refresh_token) {
    return { tracked: 0 }
  }

  const accessToken = await getAccessToken(client)
  const end = new Date()
  end.setDate(end.getDate() - 3)
  const start = new Date(end)
  start.setDate(start.getDate() - 7)

  const pages = await fetchPagePerformance(
    client.gsc_site_url, accessToken,
    start.toISOString().split('T')[0],
    end.toISOString().split('T')[0]
  )

  const weekStart = getWeekStart()
  let tracked = 0

  for (const page of pages) {
    const slug = extractSlug(page.page)
    if (!slug) continue

    const { data: article } = await supabaseAdmin
      .from('articles')
      .select('id')
      .eq('client_id', client.id)
      .eq('slug', slug)
      .single()

    if (!article) continue

    // Upsert GSC 部分数据到 article_performance
    const { data: existing } = await supabaseAdmin
      .from('article_performance')
      .select('id, pageviews, unique_visitors, avg_time_on_page, bounce_rate, conversions')
      .eq('article_id', article.id)
      .eq('week_start', weekStart)
      .single()

    if (existing) {
      await supabaseAdmin
        .from('article_performance')
        .update({
          impressions: page.impressions,
          clicks: page.clicks,
          ctr: page.ctr,
          avg_position: page.position,
        })
        .eq('id', existing.id)
    } else {
      await supabaseAdmin
        .from('article_performance')
        .insert({
          article_id: article.id,
          week_start: weekStart,
          impressions: page.impressions,
          clicks: page.clicks,
          ctr: page.ctr,
          avg_position: page.position,
        })
    }
    tracked++
  }

  return { tracked }
}

// 遍历所有活跃客户
export async function trackAllPerformance(): Promise<{
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
      results[client.name] = await trackForClient(client)
    } catch (err: any) {
      results[client.name] = { error: err.message }
    }
  }

  return { clients_processed: clients.length, results }
}
