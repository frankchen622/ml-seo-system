// 数据回收 - 从 Google Search Console API 拉取流量数据
// 需要配置 Google Service Account 或 OAuth
import { supabase } from '../supabase'

interface GSCRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

// 调用 GSC API
async function fetchGSCData(
  siteUrl: string,
  startDate: string,
  endDate: string,
  accessToken: string
): Promise<GSCRow[]> {
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
        dimensions: ['query', 'page'],
        rowLimit: 5000,
      }),
    }
  )

  if (!res.ok) throw new Error(`GSC API error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.rows || []
}

// 获取 Google OAuth access token（使用 refresh token）
async function getAccessToken(): Promise<string> {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
  const data = await res.json()
  return data.access_token
}

// 回收数据并写入数据库
export async function collectSearchData(): Promise<{
  processed: number
  matched: number
}> {
  const siteUrl = process.env.GSC_SITE_URL
  if (!siteUrl) throw new Error('GSC_SITE_URL not configured')

  const accessToken = await getAccessToken()

  // 拉取过去 7 天数据（GSC 有 2-3 天延迟，所以取 3-10 天前）
  const endDate = new Date()
  endDate.setDate(endDate.getDate() - 3)
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 10)

  const rows = await fetchGSCData(
    siteUrl,
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0],
    accessToken
  )

  let processed = 0
  let matched = 0

  for (const row of rows) {
    const query = row.keys[0] // 搜索词
    processed++

    // 匹配数据库中的关键词
    const { data: keyword } = await supabase
      .from('seo_keywords')
      .select('id')
      .ilike('keyword', query)
      .single()

    if (!keyword) continue
    matched++

    // 写入表现数据
    const date = endDate.toISOString().split('T')[0]
    await supabase.from('seo_keyword_performance').upsert(
      {
        keyword_id: keyword.id,
        date,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        avg_position: row.position,
      },
      { onConflict: 'keyword_id,date' }
    )
  }

  return { processed, matched }
}

// 回收文章级别的页面数据（从 GSC 按页面维度）
export async function collectPageData(): Promise<{
  processed: number
  matched: number
}> {
  const siteUrl = process.env.GSC_SITE_URL
  if (!siteUrl) throw new Error('GSC_SITE_URL not configured')

  const accessToken = await getAccessToken()

  const endDate = new Date()
  endDate.setDate(endDate.getDate() - 3)
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 10)

  // 按页面维度查询
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dimensions: ['page'],
        rowLimit: 5000,
      }),
    }
  )

  if (!res.ok) throw new Error(`GSC page query error: ${res.status}`)
  const data = await res.json()
  const rows = data.rows || []

  let processed = 0
  let matched = 0

  for (const row of rows) {
    const pageUrl: string = row.keys[0]
    processed++

    // 从 URL 提取 slug
    const slugMatch = pageUrl.match(/\/blog\/([^/?#]+)/)
    if (!slugMatch) continue

    const slug = slugMatch[1]

    // 匹配文章
    const { data: article } = await supabase
      .from('seo_articles')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!article) continue
    matched++

    const date = endDate.toISOString().split('T')[0]
    await supabase.from('seo_article_performance').upsert(
      {
        article_id: article.id,
        date,
        organic_clicks: row.clicks,
        pageviews: row.impressions, // GSC impressions 作为曝光参考
      },
      { onConflict: 'article_id,date' }
    )
  }

  return { processed, matched }
}
