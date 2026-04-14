// Cron: 内容生成 - 每天运行
import { NextRequest, NextResponse } from 'next/server'
import { generateBatch } from '@/lib/seo/content-generator'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const count = body.count || 3

    const result = await generateBatch(count)

    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
