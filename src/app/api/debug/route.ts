// 临时诊断接口 - 测试数据库连接
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const results: Record<string, any> = {}

  // 检查环境变量是否存在
  results.env = {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
    AI_API_KEY: process.env.AI_API_KEY ? 'SET' : 'MISSING',
    CRON_SECRET: process.env.CRON_SECRET ? 'SET' : 'MISSING',
  }

  // 测试数据库查询
  try {
    const { data, error, count } = await supabaseAdmin
      .from('clients')
      .select('id, name, status', { count: 'exact' })

    results.clients = {
      count: count,
      data: data,
      error: error?.message || null,
    }
  } catch (e: any) {
    results.clients = { error: e.message }
  }

  try {
    const { count, error } = await supabaseAdmin
      .from('keywords')
      .select('id', { count: 'exact' })

    results.keywords = { count, error: error?.message || null }
  } catch (e: any) {
    results.keywords = { error: e.message }
  }

  try {
    const { count, error } = await supabaseAdmin
      .from('articles')
      .select('id', { count: 'exact' })

    results.articles = { count, error: error?.message || null }
  } catch (e: any) {
    results.articles = { error: e.message }
  }

  return NextResponse.json(results)
}
