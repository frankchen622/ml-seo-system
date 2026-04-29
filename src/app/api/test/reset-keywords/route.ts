// 重置卡住的关键词 + 自动修复
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 300

export async function GET() {
  try {
    // 把所有 assigned 状态的关键词重置为 discovered
    const { data, error } = await supabaseAdmin
      .from('keywords')
      .update({ 
        status: 'discovered',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'assigned')
      .select('keyword, status')

    if (error) throw error

    return NextResponse.json({
      success: true,
      reset_count: data?.length || 0,
      keywords: data
    })
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 })
  }
}

export async function POST() {
  return GET()
}
