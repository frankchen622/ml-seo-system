// 调试用：测试 AI API 和数据库写入
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, any> = {}

  // 1. 测试数据库读取
  try {
    const { data, error } = await supabase
      .from('seo_keywords')
      .select('id, keyword, search_intent')
      .eq('status', 'pending')
      .order('weight', { ascending: false })
      .limit(1)

    results.db_read = error ? { error: error.message } : { keyword: data?.[0] }
  } catch (e: any) {
    results.db_read = { error: e.message }
  }

  // 2. 测试 AI API
  try {
    const baseUrl = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '')
    const apiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || ''

    results.ai_config = {
      baseUrl,
      hasKey: apiKey.length > 0,
      keyPrefix: apiKey.slice(0, 8) + '...',
      model: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
    }

    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Say "hello" in one word.' }],
      }),
    })

    const text = await res.text()
    results.ai_response = {
      status: res.status,
      body: text.slice(0, 500),
    }
  } catch (e: any) {
    results.ai_response = { error: e.message }
  }

  // 3. 测试数据库写入
  try {
    const { data, error } = await supabase
      .from('seo_articles')
      .insert({
        keyword_id: results.db_read?.keyword?.id,
        title: 'Test Article - Delete Me',
        slug: 'test-article-delete-me-' + Date.now(),
        meta_description: 'Test',
        content: 'Test content',
        word_count: 2,
        quality_score: 0.5,
        generation_model: 'test',
        status: 'draft',
      })
      .select('id')

    results.db_write = error ? { error: error.message } : { success: true, id: data?.[0]?.id }
  } catch (e: any) {
    results.db_write = { error: e.message }
  }

  return NextResponse.json(results)
}
