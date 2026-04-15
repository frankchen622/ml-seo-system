// Sitemap 提交器
// 发布文章后自动通知 Google 重新抓取 sitemap
import { supabaseAdmin, type Client } from '../../supabase'

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
  if (!res.ok) throw new Error(`OAuth refresh failed: ${res.status}`)
  const data = await res.json()
  return data.access_token
}

// 提交 sitemap 到 GSC
export async function submitSitemap(client: Client): Promise<{ success: boolean; sitemapUrl: string }> {
  if (!client.gsc_site_url || !client.google_refresh_token) {
    throw new Error('GSC not configured')
  }

  const accessToken = await getAccessToken(client)
  const domain = client.domain.replace(/\/$/, '')
  const sitemapUrl = `${domain}/sitemap.xml`

  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(client.gsc_site_url)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  // 204 = success, 已存在也返回成功
  if (!res.ok && res.status !== 204) {
    throw new Error(`Sitemap submit failed: ${res.status}`)
  }

  return { success: true, sitemapUrl }
}

// 请求 Google 索引特定 URL（Indexing API，需要额外权限）
export async function requestIndexing(client: Client, url: string): Promise<boolean> {
  if (!client.google_refresh_token) return false

  try {
    const accessToken = await getAccessToken(client)
    const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        url,
        type: 'URL_UPDATED',
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
