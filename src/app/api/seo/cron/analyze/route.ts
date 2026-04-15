// Cron: 阶段二 - 分析学习（权重 + 模式 + 分类）
import { NextRequest, NextResponse } from 'next/server'
import { updateAllWeights } from '@/lib/seo/analyzers/weight-calculator'
import { learnAllPatterns } from '@/lib/seo/analyzers/pattern-learner'
import { classifyAllClients } from '@/lib/seo/analyzers/keyword-analyzer'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const weights = await updateAllWeights()
    const patterns = await learnAllPatterns()
    const classify = await classifyAllClients()

    return NextResponse.json({
      success: true,
      weights,
      patterns,
      classify,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
