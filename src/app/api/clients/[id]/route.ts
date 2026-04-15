// 客户 CRUD API - 详情 + 更新 + 删除
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/clients/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // 附带统计数据
  const [keywords, articles, recentPerf] = await Promise.all([
    supabaseAdmin.from('keywords').select('id, status, opportunity_type', { count: 'exact' }).eq('client_id', id),
    supabaseAdmin.from('articles').select('id, status', { count: 'exact' }).eq('client_id', id),
    supabaseAdmin.from('articles')
      .select('id, article_performance(clicks, impressions)')
      .eq('client_id', id)
      .eq('status', 'published'),
  ])

  return NextResponse.json({
    client: data,
    stats: {
      total_keywords: keywords.count || 0,
      total_articles: articles.count || 0,
    },
  })
}

// PATCH /api/clients/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const allowedFields = [
    'name', 'domain', 'wp_url', 'wp_username', 'wp_app_password',
    'gsc_site_url', 'google_refresh_token', 'google_client_id', 'google_client_secret',
    'ga4_property_id', 'industry', 'target_audience', 'brand_voice',
    'publish_per_week', 'ai_model', 'auto_publish', 'status',
  ]

  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field]
    }
  }

  const { data, error } = await supabaseAdmin
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ client: data })
}

// DELETE /api/clients/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { error } = await supabaseAdmin
    .from('clients')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
