// 动态 Prompt 构建器
// 融合基础 SEO 最佳实践 + 客户配置 + 学到的高表现模式
import { supabaseAdmin, type Client } from '../../supabase'

// 获取客户的活跃内容模式
async function getActivePatterns(clientId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('content_patterns')
    .select('description')
    .eq('client_id', clientId)
    .eq('active', true)
    .order('effectiveness_score', { ascending: false })
    .limit(8)

  return (data || []).map(p => p.description)
}

// 获取客户已有文章标题（用于内链建议）
async function getExistingArticles(clientId: string): Promise<Array<{ title: string; slug: string }>> {
  const { data } = await supabaseAdmin
    .from('articles')
    .select('title, slug')
    .eq('client_id', clientId)
    .eq('status', 'published')
    .limit(50)

  return data || []
}

// 构建大纲生成 prompt
export async function buildOutlinePrompt(
  client: Client,
  keyword: string,
  intent: string,
  relatedQueries: string[] = []
): Promise<{ prompt: string; version: string }> {
  const patterns = await getActivePatterns(client.id)
  const existingArticles = await getExistingArticles(client.id)

  const version = `v2-${Date.now()}`

  let prompt = `You are an expert SEO content strategist.

## Task
Create a detailed article outline for the keyword: "${keyword}"
Search intent: ${intent}

## Industry Context
- Industry: ${client.industry || 'general'}
- Target audience: ${client.target_audience || 'general readers'}
- Brand voice: ${client.brand_voice || 'professional and informative'}

## SEO Requirements
- Title must include the primary keyword naturally
- Include H2 and H3 subheadings with semantic variations
- Plan for 2000-2500 words
- Include an FAQ section with 4-6 questions
- Plan internal links to existing content where relevant`

  if (relatedQueries.length > 0) {
    prompt += `\n\n## People Also Ask / Related Queries
Include these as FAQ or section topics:
${relatedQueries.map(q => `- ${q}`).join('\n')}`
  }

  if (patterns.length > 0) {
    prompt += `\n\n## High-Performance Patterns (data-driven insights from this site)
Apply these patterns that have proven effective:
${patterns.map(p => `- ${p}`).join('\n')}`
  }

  if (existingArticles.length > 0) {
    prompt += `\n\n## Existing Content (for internal linking)
${existingArticles.slice(0, 20).map(a => `- "${a.title}" (/${a.slug})`).join('\n')}`
  }

  prompt += `\n\n## Output Format
Return a JSON object:
{
  "title": "SEO-optimized title",
  "meta_description": "155 chars max, compelling with keyword",
  "slug": "url-friendly-slug",
  "sections": [
    { "heading": "H2 heading", "subheadings": ["H3 a", "H3 b"], "notes": "what to cover" }
  ],
  "faq": [
    { "question": "...", "answer_notes": "key points to cover" }
  ],
  "internal_links": ["slug1", "slug2"],
  "estimated_word_count": 2200
}`

  return { prompt, version }
}

// 构建正文生成 prompt
export async function buildArticlePrompt(
  client: Client,
  keyword: string,
  outline: any
): Promise<string> {
  const patterns = await getActivePatterns(client.id)

  let prompt = `You are an expert content writer specializing in ${client.industry || 'digital marketing'}.

## Task
Write a complete, high-quality article based on the outline below.

## Article Outline
Title: ${outline.title}
Keyword: ${keyword}

Sections:
${outline.sections.map((s: any) =>
  `### ${s.heading}\n${(s.subheadings || []).map((sh: string) => `  - ${sh}`).join('\n')}\nNotes: ${s.notes}`
).join('\n\n')}

FAQ:
${(outline.faq || []).map((f: any) => `Q: ${f.question}\nA notes: ${f.answer_notes}`).join('\n')}

## Writing Guidelines
- Brand voice: ${client.brand_voice || 'professional, informative, and engaging'}
- Target audience: ${client.target_audience || 'general readers'}
- Write naturally — this should read like a human expert wrote it
- Include real data points, statistics, or examples where possible
- Use the primary keyword naturally (2-3% density, not forced)
- E-E-A-T signals: demonstrate Experience, Expertise, Authoritativeness, Trustworthiness
- Avoid generic filler — every paragraph should add value
- Use transition sentences between sections`

  if (patterns.length > 0) {
    prompt += `\n\n## Apply These Proven Patterns
${patterns.map(p => `- ${p}`).join('\n')}`
  }

  prompt += `\n\n## Output
Write the full article in Markdown format. Include all sections from the outline.
Do NOT include the title as an H1 (it will be set separately).
Start directly with the introduction paragraph.`

  return prompt
}

// 构建质量检查 prompt
export function buildQualityCheckPrompt(keyword: string, content: string): string {
  return `You are an SEO content quality auditor. Review this article targeting "${keyword}".

Rate each criterion 1-10 and provide a brief note:

1. Keyword Integration — natural usage, not stuffed
2. Content Depth — real information value, not fluff
3. Readability — clear structure, good flow
4. E-E-A-T Signals — expertise, data, credibility
5. Uniqueness — original angles, not generic
6. User Intent Match — does it answer what the searcher wants?

Article:
${content.slice(0, 4000)}

Output JSON:
{
  "scores": {
    "keyword_integration": { "score": 8, "note": "..." },
    "content_depth": { "score": 7, "note": "..." },
    "readability": { "score": 9, "note": "..." },
    "eeat_signals": { "score": 6, "note": "..." },
    "uniqueness": { "score": 7, "note": "..." },
    "intent_match": { "score": 8, "note": "..." }
  },
  "overall_score": 7.5,
  "pass": true,
  "suggestions": ["suggestion 1", "suggestion 2"]
}`
}
