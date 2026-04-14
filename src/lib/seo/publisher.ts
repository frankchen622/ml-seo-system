// 自动发布系统
// 将 draft 文章发布为 published，控制发布节奏
import { supabase } from '../supabase'

interface PublishConfig {
  min: number
  max: number
}

// 获取发布配置
async function getPublishConfig(): Promise<PublishConfig> {
  const { data } = await supabase
    .from('seo_config')
    .select('value')
    .eq('key', 'publish_per_day')
    .single()
  return data?.value || { min: 2, max: 5 }
}

// 随机数
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 发布文章
export async function publishArticles(): Promise<{
  published: number
  slugs: string[]
}> {
  const config = await getPublishConfig()
  const count = randomInt(config.min, config.max)

  // 取质量分最高的 draft 文章
  const { data: drafts, error } = await supabase
    .from('seo_articles')
    .select('id, slug, keyword_id')
    .eq('status', 'draft')
    .order('quality_score', { ascending: false })
    .limit(count)

  if (error || !drafts || drafts.length === 0) {
    return { published: 0, slugs: [] }
  }

  const publishedSlugs: string[] = []

  for (const article of drafts) {
    const now = new Date().toISOString()

    const { error: updateErr } = await supabase
      .from('seo_articles')
      .update({ status: 'published', published_at: now, updated_at: now })
      .eq('id', article.id)

    if (updateErr) {
      console.error(`Publish failed for ${article.slug}:`, updateErr.message)
      continue
    }

    // 更新关键词状态
    if (article.keyword_id) {
      await supabase
        .from('seo_keywords')
        .update({ status: 'published', updated_at: now })
        .eq('id', article.keyword_id)
    }

    publishedSlugs.push(article.slug)
  }

  // 触发 sitemap 重新生成（通过 revalidate）
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    await fetch(`${appUrl}/api/seo/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: ['/sitemap.xml', ...publishedSlugs.map((s) => `/blog/${s}`)] }),
    })
  } catch {
    // revalidate 失败不阻塞
  }

  return { published: publishedSlugs.length, slugs: publishedSlugs }
}

// 获取发布统计
export async function getPublishStats() {
  const today = new Date().toISOString().split('T')[0]

  const { count: todayCount } = await supabase
    .from('seo_articles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')
    .gte('published_at', `${today}T00:00:00`)

  const { count: totalPublished } = await supabase
    .from('seo_articles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')

  const { count: totalDraft } = await supabase
    .from('seo_articles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'draft')

  return {
    today: todayCount || 0,
    totalPublished: totalPublished || 0,
    totalDraft: totalDraft || 0,
  }
}
