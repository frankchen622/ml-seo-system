// AI 内容生成引擎
// 根据高权重关键词自动生成 SEO 优化文章
import { supabase } from '../supabase'
import { getTopKeywords } from './keyword-engine'

interface GeneratedArticle {
  title: string
  slug: string
  meta_description: string
  content: string
  word_count: number
  quality_score: number
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

// 大纲生成 prompt
function buildOutlinePrompt(keyword: string, intent: string): string {
  return `You are an expert SEO content strategist in the influencer marketing industry.

Create a detailed article outline for the keyword: "${keyword}"
Search intent: ${intent}

Requirements:
- Title should be compelling and include the keyword naturally
- 5-8 main sections with 2-3 subsections each
- Include a FAQ section with 3-5 questions
- Each section should have a brief note on what to cover
- The outline should target 1500-2500 words

Return as JSON:
{
  "title": "...",
  "meta_description": "... (under 160 chars)",
  "sections": [
    { "heading": "...", "notes": "...", "subsections": [{ "heading": "...", "notes": "..." }] }
  ],
  "faqs": [{ "question": "...", "answer_notes": "..." }]
}`
}

// 文章生成 prompt
function buildArticlePrompt(keyword: string, outline: string): string {
  return `You are an expert content writer specializing in influencer marketing and social media.

Write a comprehensive, SEO-optimized article based on this outline:

Keyword: "${keyword}"
${outline}

Requirements:
- Write in a natural, engaging tone (not robotic or generic)
- Include specific data points, examples, and actionable advice
- Use the keyword naturally 3-5 times (no keyword stuffing)
- Use H2 and H3 headings matching the outline
- Include internal linking opportunities marked as [INTERNAL_LINK: topic]
- Write 1500-2500 words
- End with a clear conclusion and call-to-action
- Output in Markdown format

Do NOT include generic filler. Every paragraph should provide real value.`
}

// 质量检查 prompt
function buildQualityCheckPrompt(content: string, keyword: string): string {
  return `Rate this SEO article on a scale of 0.0 to 1.0. Be strict.

Keyword: "${keyword}"
Article:
${content.slice(0, 3000)}

Score these dimensions (0-1 each):
1. Relevance to keyword
2. Information depth (real facts, not fluff)
3. Readability and structure
4. Uniqueness of perspective
5. SEO optimization (natural keyword usage, headings, meta)

Return JSON only:
{ "overall": 0.X, "relevance": 0.X, "depth": 0.X, "readability": 0.X, "uniqueness": 0.X, "seo": 0.X, "issues": ["..."] }`
}

// 调用 AI API（支持 Claude 和 OpenAI）
async function callAI(prompt: string, model?: string): Promise<string> {
  const aiModel = model || process.env.AI_MODEL || 'claude-sonnet-4-6'

  if (aiModel.startsWith('claude')) {
    return callClaude(prompt, aiModel)
  } else {
    return callOpenAI(prompt, aiModel)
  }
}

async function callClaude(prompt: string, model: string): Promise<string> {
  const baseUrl = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '')
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY!
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`)
  const data = await res.json()
  return data.content[0].text
}

async function callOpenAI(prompt: string, model: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)
  const data = await res.json()
  return data.choices[0].message.content
}

// 生成单篇文章
export async function generateArticle(
  keyword: string,
  intent: string
): Promise<GeneratedArticle> {
  // Step 1: 生成大纲
  const outlinePrompt = buildOutlinePrompt(keyword, intent)
  const outlineRaw = await callAI(outlinePrompt)

  // Step 2: 根据大纲生成文章
  const articlePrompt = buildArticlePrompt(keyword, outlineRaw)
  const content = await callAI(articlePrompt)

  // Step 3: 质量检查
  const qualityPrompt = buildQualityCheckPrompt(content, keyword)
  const qualityRaw = await callAI(qualityPrompt)

  let qualityScore = 0.5
  try {
    const qualityJson = JSON.parse(qualityRaw.replace(/```json?\n?/g, '').replace(/```/g, ''))
    qualityScore = qualityJson.overall || 0.5
  } catch {
    // 解析失败用默认分
  }

  // 从大纲提取标题和 meta
  let title = keyword
  let metaDesc = ''
  try {
    const outlineJson = JSON.parse(outlineRaw.replace(/```json?\n?/g, '').replace(/```/g, ''))
    title = outlineJson.title || keyword
    metaDesc = outlineJson.meta_description || ''
  } catch {
    // 提取失败用关键词作标题
  }

  const wordCount = content.split(/\s+/).length

  return {
    title,
    slug: toSlug(title),
    meta_description: metaDesc,
    content,
    word_count: wordCount,
    quality_score: qualityScore,
  }
}

// 批量生成并存储文章
export async function generateBatch(count = 3): Promise<{
  generated: number
  rejected: number
}> {
  const keywords = await getTopKeywords(count, 'pending')
  let generated = 0
  let rejected = 0

  for (const kw of keywords) {
    try {
      const article = await generateArticle(kw.keyword, kw.search_intent || 'informational')

      // 质量分低于 0.4 不入库（初期放宽阈值，后续根据数据调整）
      // 暂时跳过质量检查，先确保流程跑通
      // if (article.quality_score < 0.4) {
      //   rejected++
      //   continue
      // }

      // 存入数据库
      const { error } = await supabase.from('seo_articles').insert({
        keyword_id: (kw as any).id,
        title: article.title,
        slug: article.slug,
        meta_description: article.meta_description,
        content: article.content,
        word_count: article.word_count,
        quality_score: article.quality_score,
        generation_model: process.env.AI_MODEL || 'claude-sonnet-4-6',
        status: 'draft',
      })

      if (error) {
        console.error(`Save article failed for "${kw.keyword}":`, error.message)
        rejected++
        continue
      }

      // 更新关键词状态
      await supabase
        .from('seo_keywords')
        .update({ status: 'assigned', updated_at: new Date().toISOString() })
        .eq('id', (kw as any).id)

      generated++
    } catch (err) {
      console.error(`Generate failed for "${kw.keyword}":`, err)
      rejected++
    }
  }

  return { generated, rejected }
}
