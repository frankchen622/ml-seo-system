// Cron: 关键词发现 - 每周一运行
import { NextRequest, NextResponse } from 'next/server'
import { discoverKeywords, saveKeywords } from '@/lib/seo/keyword-engine'

export async function POST(req: NextRequest) {
  // 验证 cron secret
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const seeds: string[] = body.seeds || [
      'influencer marketing',
      'influencer rate',
      'social media influencer',
      'tiktok influencer',
      'instagram influencer pricing',
    ]

    const results = await discoverKeywords(seeds)
    const stats = await saveKeywords(results, seeds.join(','))

    return NextResponse.json({
      success: true,
      discovered: results.length,
      ...stats,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
