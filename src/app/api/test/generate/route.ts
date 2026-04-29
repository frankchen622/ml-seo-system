// 手动触发生成接口（无需 CRON_SECRET）
import { NextResponse } from 'next/server'
import { generateBatch } from '@/lib/seo/generators/content-generator'

export async function POST(req: Request) {
  try {
    const { count } = await req.json().catch(() => ({}))
    
    // 如果指定了 count，覆盖默认的渐进式逻辑
    const result = await generateBatch()
    
    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      ...result 
    })
  } catch (err: any) {
    return NextResponse.json({ 
      success: false, 
      error: err.message,
      stack: err.stack 
    }, { status: 500 })
  }
}

// 也支持 GET 方便测试
export async function GET() {
  try {
    const result = await generateBatch()
    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      ...result 
    })
  } catch (err: any) {
    return NextResponse.json({ 
      success: false, 
      error: err.message,
      stack: err.stack 
    }, { status: 500 })
  }
}
