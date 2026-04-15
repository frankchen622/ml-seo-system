// AI 内容生成主流程 - V2.1 渐进式发布 + 询盘导向
import { supabaseAdmin, type Client } from '../../supabase'
import { buildOutlinePrompt, buildArticlePrompt, buildQualityCheckPrompt } from './prompt-builder'

// 调用 AI API
async function callAI(prompt: string, model: string): Promise<string> {
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
  try { return JSON.parse(text) } catch {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (match) {
    try { return JSON.parse(match[1]) } catch {}
  }
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

// 渐进式发布：根据客户创建时间计算每天应生成的文章数
function getDailyCount(client: Client): number {
  const createdAt = new Date(client.created_at)
  const now = new Date()
  const weeksSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000))

  // 第 1-2 周: 每天 1 篇
  // 第 3-4 周: 每天 2 篇
  // 第 5 周起: 每天 3 篇 (上限)
  if (weeksSinceCreation < 2) return 1
  if (weeksSinceCreation < 4) return 2
  return 3
}

// 智能关键词选择：优先选择询盘潜力高的关键词
async function selectKeywords(clientId: string, count: number) {
  // 优先级 1: commercial/transactional intent + 高权重
  const { data: commercialKws } = await supabaseAdmin
    .from('keywords')
    .select('*')
    .eq('client_id', clientId)
    .in('status', ['discovered', 'queued'])
    .in('search_intent', ['commercial', 'transactional'])
    .order('weight', { ascending: false })
    .limit(count)

  if (commercialKws && commercialKws.length >= count) {
    return commercialKws
  }

  // 优先级 2: 有展现有点击的 informational（证明有流量潜力）
  const remaining = count - (commercialKws?.length || 0)
  const { data: infoKws } = await supabaseAdmin
    .from('keywords')
    .select('*')
    .eq('client_id', clientId)
    .in('status', ['discovered', 'queued'])
    .eq('search_intent', 'informational')
    .gt('gsc_clicks', 0)
    .order('weight', { ascending: false })
    .limit(remaining)

  // 优先级 3: 纯 informational 补齐（也有价值，建立主题权威）
  const stillNeeded = remaining - (infoKws?.length || 0)
  let extraKws: any[] = []
  if (stillNeeded > 0) {
    const { data } = await supabaseAdmin
      .from('keywords')
      .select('*')
      .eq('client_id', clientId)
      .in('status', ['discovered', 'queued'])
      .eq('search_intent', 'informational')
      .order('weight', { ascending: false })
      .limit(stillNeeded)
    extraKws = data || []
  }

  return [...(commercialKws || []), ...(infoKws || []), ...extraKws]
}

// 为单个客户生成内容
export async function generateForClient(
  client: Client,
  count?: number
): Promise<{ generated: number; articles: string[] }> {
  const model = client.ai_model || 'claude-sonnet-4-6'
  const dailyCount = count || getDailyCount(client)

  // 智能选关键词（优先商业意图）
  const keywords = await selectKeywords(client.id, dailyCount)

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
          status: qc.pass ? 'draft' : 'review',
        })

      if (!error) {
        generatedTitles.push(outline.title)
        // 更新关键词状态
        await supabaseAdmin
          .from('keywords')
          .update({ status: 'used', updated_at: new Date().toISOString() })
          .eq('id', kw.id)
      }
    } catch (err: any) {
      console.error(`Failed to generate for keyword "${kw.keyword}":`, err.message)
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
      const dailyCount = getDailyCount(client)
      results[client.name] = {
        ...(await generateForClient(client, dailyCount)),
        daily_quota: dailyCount,
      }
    } catch (err: any) {
      results[client.name] = { error: err.message }
    }
  }

  return { clients_processed: clients.length, results }
}
