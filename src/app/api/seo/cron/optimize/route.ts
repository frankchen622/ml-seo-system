// Cron: 优化决策 - 每两周运行
import { NextRequest, NextResponse } from 'next/server'
import { analyzeAndDecide, saveDecisions, executeArchiveDecisions } from '@/lib/seo/optimization-engine'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const decisions = await analyzeAndDecide()
    const saved = await saveDecisions(decisions)

    // 自动执行归档决策
    const archived = await executeArchiveDecisions()

    return NextResponse.json({
      success: true,
      decisions: decisions.length,
      saved,
      autoArchived: archived,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
