// 手动触发生成接口（无需 CRON_SECRET）
import { NextResponse } from 'next/server'
import { generateForClient } from '@/lib/seo/generators/content-generator'
import { supabaseAdmin } from '@/lib/supabase'

// Vercel Pro 计划最长 300 秒
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const { count = 1 } = await req.json().catch(() => ({}))
    
    // 获取第一个活跃客户
    const { data: clients } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('status', 'active')
      .limit(1)

    if (!clients || clients.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active clients found' 
      }, { status: 404 })
    }

    const client = clients[0]
    const result = await generateForClient(client, count)
    
    return NextResponse.json({ 
      success: true, 
      client: client.name,
      timestamp: new Date().toISOString(),
      ...result 
    })
  } catch (err: any) {
    console.error('Manual generate error:', err)
    return NextResponse.json({ 
      success: false, 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 })
  }
}

// 也支持 GET 方便测试
export async function GET() {
  try {
    const { data: clients } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('status', 'active')
      .limit(1)

    if (!clients || clients.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active clients found' 
      }, { status: 404 })
    }

    const client = clients[0]
    const result = await generateForClient(client, 1)
    
    return NextResponse.json({ 
      success: true,
      client: client.name, 
      timestamp: new Date().toISOString(),
      ...result 
    })
  } catch (err: any) {
    console.error('Manual generate error:', err)
    return NextResponse.json({ 
      success: false, 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 })
  }
}
