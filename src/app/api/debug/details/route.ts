// 诊断接口 - 检查关键词状态和 cron 配置
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  // 查关键词状态分布
  const { data: keywords } = await supabaseAdmin
    .from('keywords')
    .select('keyword, status, search_intent, weight')
    .order('weight', { ascending: false })

  // 查文章状态
  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('title, status, created_at, generation_model')

  // 查客户配置
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('name, status, ai_model, auto_publish, created_at, wp_url')

  return NextResponse.json({
    keywords,
    articles,
    clients,
    cron_secret_set: !!process.env.CRON_SECRET,
  })
}
