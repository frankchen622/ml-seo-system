// AI 内容生成主流程 - V2 多客户版本
import { supabaseAdmin, type Client } from '../../supabase'
import { buildOutlinePrompt, buildArticlePrompt, buildQualityCheckPrompt } from './prompt-builder'

// 调用 AI API
async function callAI(prompt: string, model: string): Promise<string> {
  // 使用第三方 Claude API
  const apiKey = process.env.AI_API_KEY
  const apiBase = process.env.AI_API_BASE || 'https://api.anthropic.com'

  const res = await fetch(`${apiBase}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`AI API failed (${res.status}): ${err}`)
  }

  const data = await res.json()
  return data.content[0].text
}

// 解析 JSON（容错处理）
function parseJSON(text: string): any {
  // 尝试直接解析
  try { return JSON.parse(text) } catch {}
  // 尝试提取 JSON 块
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (match) {
    try { return JSON.parse(match[1]) } catch {}
  }
  // 尝试找 { } 块
  const braceMatch = text.match(/\{[\s\S]*\}/)
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]) } catch {}
  }
  throw new Error('Failed to parse AI response as JSON')
}

// 生成 slug
function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    .replace(/-$/, '')
}

// 为单个客户生成内容
export async function generateForClient(
  client: Client,
  count: number = 3
): Promise<{ generated: number; articles: string[] }> {
  const model = client.ai_model || 'claude-sonnet-4-6'

  // 选取高权重 + 高优先级关键词
  const { data: keywords } = await supabaseAdmin
    .from('keywords')
    .select('*')
    .eq('client_id', client.id)
    .in('status', ['discovered', 'queued'])
    .in('opportunity_type', ['new_content', 'quick_win', 'expand'])
    .order('weight', { ascending: false })
    .limit(count)

  if (!keywords || keywords.length === 0) {
    return { generated: 0, articles: [] }
  }

  const generatedTitles: string[] = []

  for (const kw of keywords) {
    try {
      // 标记为 assigned
      await supabaseAdmin
        .from('keywords')
        .update({ status: 'assigned', updated_at: new Date().toISOString() })
        .eq('id', kw.id)

      // 1. 生成大纲
      const { prompt: outlinePrompt, version } = await buildOutlinePrompt(
        client, kw.keyword, kw.search_intent || 'informational'
      )
      const outlineRaw = await callAI(outlinePrompt, model)
      const outline = parseJSON(outlineRaw)

      // 2. 生成正文
      const articlePrompt = await buildArticlePrompt(client, kw.keyword, outline)
      const content = await callAI(articlePrompt, model)

      // 3. 质量检查
      const qcPrompt = buildQualityCheckPrompt(kw.keyword, content)
      const qcRaw = await callAI(qcPrompt, model)
      const qc = parseJSON(qcRaw)

      const slug = outline.slug || toSlug(outline.title)
      const wordCount = content.split(/\s+/).length

      // 4. 存入数据库
      const { error } = await supabaseAdmin
        .from('articles')
        .insert({
          client_id: client.id,
          keyword_id: kw.id,
          title: outline.title,
          slug,
          meta_description: outline.meta_description,
          content_markdown: content,
          word_count: wordCount,
          generation_model: model,
          prompt_version: version,
          quality_score: qc.overall_score,
          faq_items: outline.faq,
          internal_links: outline.internal_links,
          status: qc.pass ? 'draft' : 'review', // 质量不过关进 review
        })

      if (!error) {
        generatedTitles.push(outline.title)
      }
    } catch (err: any) {
      console.error(`Failed to generate for keyword "${kw.keyword}":`, err.message)
      // 回滚状态
      await supabaseAdmin
        .from('keywords')
        .update({ status: 'queued', updated_at: new Date().toISOString() })
        .eq('id', kw.id)
    }
  }

  return { generated: generatedTitles.length, articles: generatedTitles }
}

// 遍历所有活跃客户批量生成
export async function generateBatch(): Promise<{
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
      // 每天每客户生成 2-3 篇
      const dailyCount = Math.min(3, Math.ceil(client.publish_per_week / 5))
      results[client.name] = await generateForClient(client, dailyCount)
    } catch (err: any) {
      results[client.name] = { error: err.message }
    }
  }

  return { clients_processed: clients.length, results }
}
