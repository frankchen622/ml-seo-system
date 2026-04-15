// 动态 Prompt 构建器 - V2.1 询盘导向版
// 融合基础 SEO 最佳实践 + 外贸B2B询盘优化 + 客户配置 + 学到的高表现模式
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

// B2B 询盘导向的内容类型映射
function getContentTypeGuidance(intent: string, keyword: string): string {
  const kw = keyword.toLowerCase()

  // 供应商搜索类
  if (/supplier|manufacturer|factory|vendor|company|wholesale/.test(kw)) {
    return `## Content Type: Supplier/Manufacturer Guide
- Position the brand as a trusted, experienced manufacturer
- Include: production capacity, certifications (ISO, SGS), export experience
- Add a clear "Request a Quote" or "Contact Us" CTA in the conclusion
- Mention MOQ, lead time, customization capabilities
- Include customer testimonials or case study references`
  }

  // 产品对比类
  if (/vs|versus|comparison|compare|difference|better/.test(kw)) {
    return `## Content Type: Product Comparison (Inquiry Driver)
- Create an objective, data-driven comparison table
- Highlight unique advantages of the brand's products naturally
- Include application-specific recommendations ("For X application, choose Y because...")
- End with "Need help choosing? Contact our technical team for a free consultation" CTA
- Use real performance data: temperature range, chemical resistance, shelf life`
  }

  // 技术规格类
  if (/specification|datasheet|technical|properties|parameters|msds|tds/.test(kw)) {
    return `## Content Type: Technical Specification / Data Sheet Article
- Present detailed technical parameters in tables
- Explain what each spec means for the end user's application
- Include downloadable resources mention (TDS, MSDS)
- Add "Request Full Technical Data Sheet" CTA
- Demonstrate deep technical expertise (E-E-A-T)`
  }

  // 应用场景类
  if (/how to|application|use|guide|process|method|technique/.test(kw)) {
    return `## Content Type: Application Guide (Lead Nurturing)
- Write step-by-step practical guidance
- Include real-world application examples with specific industries
- Add troubleshooting tips and common mistakes
- Include "Need application support? Our engineers can help" CTA
- Reference specific product models/SKUs where relevant`
  }

  // 商业意图
  if (intent === 'commercial' || intent === 'transactional') {
    return `## Content Type: Commercial/Buying Guide
- Focus on helping buyers make informed purchasing decisions
- Include pricing factors, quality indicators, what to look for in a supplier
- Add comparison criteria and selection checklist
- Include strong CTA: "Get a Custom Quote" or "Request Free Samples"
- Mention certifications, testing standards, quality assurance`
  }

  // 信息类（也要有转化路径）
  return `## Content Type: Educational Content (with Conversion Path)
- Provide genuinely useful, in-depth educational content
- Naturally introduce the brand's expertise and solutions
- Include a soft CTA: "Learn more about our solutions" or "Discuss your project with our team"
- Build topical authority for the brand`
}

// 避免 AI 痕迹的写作规则
const ANTI_AI_RULES = `## Anti-AI Detection Rules (CRITICAL)
- NEVER use these words/phrases: "delve", "tapestry", "landscape", "in the realm of", "it's important to note", "in conclusion", "furthermore", "moreover", "comprehensive", "robust", "leverage", "utilize", "facilitate", "in today's world", "game-changer", "cutting-edge"
- Write like a real industry expert, not a language model
- Use specific numbers, brand names, and real-world examples
- Vary sentence length: mix short punchy sentences with longer explanatory ones
- Include occasional colloquial expressions appropriate for B2B trade
- Start paragraphs differently — avoid repetitive patterns
- Use active voice predominantly
- Include specific technical details that only an industry insider would know`

// 构建大纲生成 prompt
export async function buildOutlinePrompt(
  client: Client,
  keyword: string,
  intent: string,
  relatedQueries: string[] = []
): Promise<{ prompt: string; version: string }> {
  const patterns = await getActivePatterns(client.id)
  const existingArticles = await getExistingArticles(client.id)
  const contentTypeGuide = getContentTypeGuidance(intent, keyword)

  const version = `v2.1-inquiry-${Date.now()}`

  let prompt = `You are a senior content strategist for B2B industrial/manufacturing companies, specializing in creating content that drives international trade inquiries.

## Task
Create a detailed article outline for the keyword: "${keyword}"
Search intent: ${intent}

## Industry Context
- Industry: ${client.industry || 'industrial manufacturing'}
- Target audience: ${client.target_audience || 'international B2B buyers, procurement managers, engineers'}
- Brand voice: ${client.brand_voice || 'professional, technically authoritative, solution-oriented'}
- Goal: Drive qualified inquiries from international buyers

${contentTypeGuide}

## SEO Requirements
- Title must include the primary keyword naturally — no keyword stuffing
- Include H2 and H3 subheadings with semantic variations and long-tail keywords
- Plan for 2000-3000 words (longer for technical/comparison content)
- Include an FAQ section with 4-6 questions that real buyers would ask
- Plan internal links to existing content where relevant
- Include schema markup suggestions (FAQ, Product, HowTo as appropriate)

## Inquiry Conversion Elements
- Plan at least 2 natural CTA placements (not just at the end)
- Include a "Why Choose [Brand]" or expertise section
- Plan for trust signals: certifications, experience years, export countries
- Suggest where to place contact forms or quote request buttons`

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
  "title": "SEO-optimized title with keyword",
  "meta_description": "155 chars max, compelling with keyword and value proposition",
  "slug": "url-friendly-slug",
  "content_type": "comparison|technical|application|supplier|buying_guide|educational",
  "sections": [
    { "heading": "H2 heading", "subheadings": ["H3 a", "H3 b"], "notes": "what to cover", "cta": "optional CTA placement note" }
  ],
  "faq": [
    { "question": "buyer-focused question", "answer_notes": "key points to cover" }
  ],
  "internal_links": ["slug1", "slug2"],
  "estimated_word_count": 2500
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

  let prompt = `You are a senior technical writer for ${client.industry || 'industrial manufacturing'} with 15+ years of experience in international trade. You write content that ranks on Google AND converts readers into qualified leads.

## Task
Write a complete, high-quality article based on the outline below.

## Article Outline
Title: ${outline.title}
Keyword: ${keyword}
Content Type: ${outline.content_type || 'educational'}

Sections:
${outline.sections.map((s: any) =>
  `### ${s.heading}\n${(s.subheadings || []).map((sh: string) => `  - ${sh}`).join('\n')}\nNotes: ${s.notes}${s.cta ? `\nCTA: ${s.cta}` : ''}`
).join('\n\n')}

FAQ:
${(outline.faq || []).map((f: any) => `Q: ${f.question}\nA notes: ${f.answer_notes}`).join('\n')}

## Writing Guidelines
- Brand voice: ${client.brand_voice || 'professional, technically authoritative, solution-oriented'}
- Target audience: ${client.target_audience || 'international B2B buyers, procurement managers, engineers'}
- Write as a real industry expert sharing practical knowledge
- Include specific data: temperatures, pressures, percentages, time durations
- Reference real industry standards (ASTM, ISO, SAE) where relevant
- Use the primary keyword naturally (1.5-2.5% density, never forced)
- E-E-A-T: demonstrate hands-on Experience, deep Expertise, industry Authority, and Trustworthiness
- Every paragraph must deliver value — zero filler content
- Use transition sentences between sections for natural flow
- Include comparison tables where appropriate (Markdown tables)

## Inquiry Conversion
- Include 2-3 natural CTAs woven into the content (not salesy, consultative tone)
- Examples: "For specific recommendations for your application, contact our technical team"
- "Request a free sample to test in your production environment"
- "Get a custom formulation quote based on your requirements"

${ANTI_AI_RULES}`

  if (patterns.length > 0) {
    prompt += `\n\n## Apply These Proven Patterns
${patterns.map(p => `- ${p}`).join('\n')}`
  }

  prompt += `\n\n## Output
Write the full article in Markdown format. Include all sections from the outline.
Do NOT include the title as an H1 (it will be set separately).
Start directly with the introduction paragraph.
Include FAQ section with proper schema-friendly formatting:
## Frequently Asked Questions
### Q: question here
Answer here`

  return prompt
}

// 构建质量检查 prompt
export function buildQualityCheckPrompt(keyword: string, content: string): string {
  return `You are an SEO content quality auditor specializing in B2B industrial content. Review this article targeting "${keyword}".

Rate each criterion 1-10 and provide a brief note:

1. Keyword Integration — natural usage, not stuffed, includes semantic variations
2. Content Depth — real technical information, specific data points, not generic fluff
3. Readability — clear structure, good flow, appropriate for B2B audience
4. E-E-A-T Signals — expertise, real data, industry knowledge, credibility
5. Uniqueness — original angles, specific insights, not rehashed generic content
6. User Intent Match — does it answer what the searcher wants?
7. Inquiry Potential — does it naturally guide readers toward making contact?
8. AI Detection Risk — does it read like a human expert or an AI? (10 = very human)

Article (first 4000 chars):
${content.slice(0, 4000)}

Output JSON:
{
  "scores": {
    "keyword_integration": { "score": 8, "note": "..." },
    "content_depth": { "score": 7, "note": "..." },
    "readability": { "score": 9, "note": "..." },
    "eeat_signals": { "score": 6, "note": "..." },
    "uniqueness": { "score": 7, "note": "..." },
    "intent_match": { "score": 8, "note": "..." },
    "inquiry_potential": { "score": 7, "note": "..." },
    "ai_detection_risk": { "score": 7, "note": "..." }
  },
  "overall_score": 7.5,
  "pass": true,
  "suggestions": ["suggestion 1", "suggestion 2"]
}`
}
