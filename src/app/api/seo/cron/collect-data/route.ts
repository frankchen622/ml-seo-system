// Cron: 数据回收 - 每周日运行
import { NextRequest, NextResponse } from 'next/server'
import { collectSearchData, collectPageData } from '@/lib/seo/data-collector'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchResult = await collectSearchData()
    const pageResult = await collectPageData()

    return NextResponse.json({
      success: true,
      search: searchResult,
      pages: pageResult,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
