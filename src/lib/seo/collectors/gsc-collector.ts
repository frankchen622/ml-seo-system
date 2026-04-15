// GSC 数据采集 - 多客户版本
// 通过 Google Search Console API 拉取每个客户的搜索数据
import { supabaseAdmin, type Client } from '../../supabase'

interface GSCRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

// 获取 Google Access Token（通过 refresh token）
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

// 调用 GSC Search Analytics API
async function fetchGSCSearchData(
  siteUrl: string,
  accessToken: string,
  startDate: string,
  endDate: string
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
        dimensions: ['query'],
        rowLimit: 5000,
        dataState: 'final',
      }),
    }
  )
  if (!res.ok) throw new Error(`GSC API failed: ${res.status}`)
  const data = await res.json()
  return data.rows || []
}

// 获取日期范围（过去 7 天）
function getDateRange(): { startDate: string; endDate: string } {
  const end = new Date()
  end.setDate(end.getDate() - 3) // GSC 数据有 3 天延迟
  const start = new Date(end)
  start.setDate(start.getDate() - 7)
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}

// 获取本周起始日期
function getWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

// 为单个客户采集 GSC 数据
async function collectForClient(client: Client): Promise<{
  keywords_updated: number
  keywords_new: number
  history_saved: number
}> {
  if (!client.gsc_site_url || !client.google_refresh_token) {
    console.log(`Skipping ${client.name}: GSC not configured`)
    return { keywords_updated: 0, keywords_new: 0, history_saved: 0 }
  }

  const accessToken = await getAccessToken(client)
  const { startDate, endDate } = getDateRange()
  const rows = await fetchGSCSearchData(client.gsc_site_url, accessToken, startDate, endDate)
  const weekStart = getWeekStart()

  let keywords_updated = 0
  let keywords_new = 0
  let history_saved = 0

  for (const row of rows) {
    const keyword = row.keys[0]
    if (!keyword) continue

    // Upsert 关键词
    const { data: existing } = await supabaseAdmin
      .from('keywords')
      .select('id')
      .eq('client_id', client.id)
      .eq('keyword', keyword)
      .single()

    let keywordId: string

    if (existing) {
      const { error } = await supabaseAdmin
        .from('keywords')
        .update({
          gsc_impressions: row.impressions,
          gsc_clicks: row.clicks,
          gsc_ctr: row.ctr,
          gsc_position: row.position,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      if (!error) keywords_updated++
      keywordId = existing.id
    } else {
      const { data: newKw, error } = await supabaseAdmin
        .from('keywords')
        .insert({
          client_id: client.id,
          keyword,
          source: 'gsc',
          search_intent: classifyIntent(keyword),
          gsc_impressions: row.impressions,
          gsc_clicks: row.clicks,
          gsc_ctr: row.ctr,
          gsc_position: row.position,
          weight: 0.5,
          status: 'discovered',
        })
        .select('id')
        .single()
      if (!error && newKw) {
        keywords_new++
        keywordId = newKw.id
      } else continue
    }

    // 保存历史记录
    const { error: histErr } = await supabaseAdmin
      .from('keyword_history')
      .upsert({
        keyword_id: keywordId!,
        week_start: weekStart,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: row.ctr,
        avg_position: row.position,
      }, { onConflict: 'keyword_id,week_start' })
    if (!histErr) history_saved++
  }

  return { keywords_updated, keywords_new, history_saved }
}

// 简单意图分类
function classifyIntent(keyword: string): string {
  const kw = keyword.toLowerCase()
  const transactional = ['buy', 'price', 'cost', 'cheap', 'deal', 'discount', 'hire', 'order', 'purchase']
  const commercial = ['best', 'top', 'review', 'compare', 'vs', 'versus', 'alternative']
  if (transactional.some(t => kw.includes(t))) return 'transactional'
  if (commercial.some(t => kw.includes(t))) return 'commercial'
  return 'informational'
}

// 主入口：遍历所有活跃客户采集
export async function collectGSCData(): Promise<{
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
