// Cron: 阶段一 - 数据采集（GSC + GA4）
import { NextRequest, NextResponse } from 'next/server'
import { collectGSCData } from '@/lib/seo/collectors/gsc-collector'
import { collectGA4Data } from '@/lib/seo/collectors/ga4-collector'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const gsc = await collectGSCData()
    const ga4 = await collectGA4Data()

    return NextResponse.json({
      success: true,
      gsc,
      ga4,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
