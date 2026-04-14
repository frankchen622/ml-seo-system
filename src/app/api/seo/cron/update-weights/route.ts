// Cron: 权重更新 - 每周日运行（数据回收之后）
import { NextRequest, NextResponse } from 'next/server'
import { updateAllWeights } from '@/lib/seo/keyword-scorer'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await updateAllWeights()
    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
