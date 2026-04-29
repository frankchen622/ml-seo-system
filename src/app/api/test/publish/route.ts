// 手动触发发布（无需 CRON_SECRET）
import { NextResponse } from 'next/server'
import { publishBatch } from '@/lib/seo/publishers/publish-scheduler'

export const maxDuration = 300

export async function GET() {
  try {
    const result = await publishBatch()
    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      ...result 
    })
  } catch (err: any) {
    console.error('Manual publish error:', err)
    return NextResponse.json({ 
      success: false, 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 })
  }
}

export async function POST() {
  return GET()
}
