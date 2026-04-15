// 客户 CRUD API - 列表 + 创建
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/clients - 获取客户列表
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') || 'active'

  let query = supabaseAdmin.from('clients').select('*').order('created_at', { ascending: false })
  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ clients: data })
}

// POST /api/clients - 创建客户
export async function POST(req: NextRequest) {
  const body = await req.json()

  const required = ['name', 'domain', 'wp_url']
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert({
      name: body.name,
      domain: body.domain,
      wp_url: body.wp_url,
      wp_username: body.wp_username || null,
      wp_app_password: body.wp_app_password || null,
      gsc_site_url: body.gsc_site_url || null,
      google_refresh_token: body.google_refresh_token || null,
      google_client_id: body.google_client_id || null,
      google_client_secret: body.google_client_secret || null,
      ga4_property_id: body.ga4_property_id || null,
      industry: body.industry || null,
      target_audience: body.target_audience || null,
      brand_voice: body.brand_voice || null,
      publish_per_week: body.publish_per_week || 10,
      ai_model: body.ai_model || 'claude-sonnet-4-6',
      auto_publish: body.auto_publish || false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ client: data }, { status: 201 })
}
