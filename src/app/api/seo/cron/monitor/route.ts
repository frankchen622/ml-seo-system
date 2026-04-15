// Cron: 阶段五 - 监控反馈
import { NextRequest, NextResponse } from 'next/server'
import { trackAllPerformance } from '@/lib/seo/monitors/performance-tracker'
import { analyzeAll } from '@/lib/seo/monitors/optimization-engine'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tracking = await trackAllPerformance()
    const optimization = await analyzeAll()

    return NextResponse.json({
      success: true,
      tracking,
      optimization,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
