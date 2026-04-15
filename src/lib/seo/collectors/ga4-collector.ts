// GA4 数据采集 - 多客户版本
// 通过 Google Analytics 4 Data API 拉取用户行为数据
import { supabaseAdmin, type Client } from '../../supabase'

interface GA4Row {
  pagePath: string
  pageviews: number
  uniqueVisitors: number
  avgTimeOnPage: number
  bounceRate: number
  conversions: number
}

// 获取 Google Access Token
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
  if (!res.ok) throw new Error(`OAuth token refresh failed for ${client.name}: ${res.status}`)
  const data = await res.json()
  return data.access_token
}

// 调用 GA4 Data API
async function fetchGA4Data(
  propertyId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<GA4Row[]> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'totalUsers' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'conversions' },
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'sessionDefaultChannelGroup',
            stringFilter: { matchType: 'EXACT', value: 'Organic Search' },
          },
        },
        limit: 5000,
      }),
    }
  )
  if (!res.ok) throw new Error(`GA4 API failed: ${res.status}`)
  const data = await res.json()

  return (data.rows || []).map((row: any) => ({
    pagePath: row.dimensionValues[0].value,
    pageviews: parseInt(row.metricValues[0].value) || 0,
    uniqueVisitors: parseInt(row.metricValues[1].value) || 0,
    avgTimeOnPage: parseFloat(row.metricValues[2].value) || 0,
    bounceRate: parseFloat(row.metricValues[3].value) || 0,
    conversions: parseInt(row.metricValues[4].value) || 0,
  }))
}

// 获取本周起始日期
function getWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

// 为单个客户采集 GA4 数据
async function collectForClient(client: Client): Promise<{
  articles_updated: number
}> {
  if (!client.ga4_property_id || !client.google_refresh_token) {
    console.log(`Skipping ${client.name}: GA4 not configured`)
    return { articles_updated: 0 }
  }

  const accessToken = await getAccessToken(client)
  const endDate = new Date()
  endDate.setDate(endDate.getDate() - 1)
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - 7)

  const rows = await fetchGA4Data(
    client.ga4_property_id,
    accessToken,
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  )

  const weekStart = getWeekStart()
  let articles_updated = 0

  for (const row of rows) {
    // 从 pagePath 提取 slug 匹配文章
    const slug = row.pagePath.replace(/^\//, '').replace(/\/$/, '')
    if (!slug) continue

    const { data: article } = await supabaseAdmin
      .from('articles')
      .select('id')
      .eq('client_id', client.id)
      .eq('slug', slug)
      .single()

    if (!article) continue

    const { error } = await supabaseAdmin
      .from('article_performance')
      .upsert({
        article_id: article.id,
        week_start: weekStart,
        pageviews: row.pageviews,
        unique_visitors: row.uniqueVisitors,
        avg_time_on_page: row.avgTimeOnPage,
        bounce_rate: row.bounceRate,
        conversions: row.conversions,
      }, { onConflict: 'article_id,week_start' })

    if (!error) articles_updated++
  }

  return { articles_updated }
}

// 主入口：遍历所有活跃客户采集 GA4
export async function collectGA4Data(): Promise<{
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
      results[client.name] = await collectForClient(client)
    } catch (err: any) {
      results[client.name] = { error: err.message }
    }
  }

  return { clients_processed: clients.length, results }
}
