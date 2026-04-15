// WordPress REST API 发布器
// 将文章通过 WordPress REST API 发布到客户站点
import { supabaseAdmin, type Client, type Article } from '../../supabase'

interface WPPostResult {
  id: number
  link: string
}

// Markdown 转简单 HTML（基础转换）
function markdownToHtml(md: string): string {
  let html = md
    // 标题
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    // 粗体和斜体
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 链接
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    // 无序列表
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // 有序列表
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // 段落
    .replace(/\n\n/g, '</p><p>')

  // 包裹 li 到 ul
  html = html.replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>')
  html = `<p>${html}</p>`
  return html
}

// 生成 FAQ Schema JSON-LD
function buildFAQSchema(faqItems: any[]): string {
  if (!faqItems || faqItems.length === 0) return ''
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer_notes || item.answer || '',
      },
    })),
  }
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`
}

// 通过 WordPress REST API 创建文章
async function createWPPost(
  client: Client,
  article: Article
): Promise<WPPostResult> {
  const wpUrl = client.wp_url.replace(/\/$/, '')
  const auth = Buffer.from(`${client.wp_username}:${client.wp_app_password}`).toString('base64')

  let contentHtml = article.content_html || markdownToHtml(article.content_markdown)

  // 追加 FAQ Schema
  if (article.faq_items && Array.isArray(article.faq_items)) {
    contentHtml += buildFAQSchema(article.faq_items)
  }

  const res = await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      title: article.title,
      slug: article.slug,
      content: contentHtml,
      status: 'publish',
      excerpt: article.meta_description || '',
      meta: {
        _yoast_wpseo_metadesc: article.meta_description || '',
        _yoast_wpseo_focuskw: '', // 可从关键词填充
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`WordPress API failed (${res.status}): ${err}`)
  }

  const data = await res.json()
  return { id: data.id, link: data.link }
}

// 发布单篇文章
export async function publishArticle(
  client: Client,
  article: Article
): Promise<{ wp_post_id: number; wp_url: string }> {
  const result = await createWPPost(client, article)

  // 更新数据库
  await supabaseAdmin
    .from('articles')
    .update({
      wp_post_id: result.id,
      wp_url: result.link,
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', article.id)

  // 更新关键词状态
  if (article.keyword_id) {
    await supabaseAdmin
      .from('keywords')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('id', article.keyword_id)
  }

  return { wp_post_id: result.id, wp_url: result.link }
}
