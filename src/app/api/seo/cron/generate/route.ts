// Cron: 阶段三 - 内容生成
import { NextRequest, NextResponse } from 'next/server'
import { generateForClient } from '@/lib/seo/generators/content-generator'
import { supabaseAdmin } from '@/lib/supabase'

// Vercel Pro 计划最长 300 秒
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 获取所有活跃客户
    const { data: clients } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('status', 'active')

    if (!clients || clients.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No active clients',
        generated: 0 
      })
    }

    // 每次 cron 只为第一个客户生成 1 篇文章（避免超时）
    const client = clients[0]
    const result = await generateForClient(client, 1)

    return NextResponse.json({ 
      success: true, 
      client: client.name,
      ...result,
      timestamp: new Date().toISOString()
    })
  } catch (err: any) {
    console.error('Generate cron error:', err)
    return NextResponse.json({ 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 })
  }
}
