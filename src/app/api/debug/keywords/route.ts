// 调试：测试关键词选择逻辑
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // 获取客户
    const { data: clients } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('status', 'active')
      .limit(1)

    if (!clients || clients.length === 0) {
      return NextResponse.json({ error: 'No active clients' })
    }

    const client = clients[0]
    const clientId = client.id

    // 测试优先级 1: commercial/transactional
    const { data: commercialKws, error: e1 } = await supabaseAdmin
      .from('keywords')
      .select('*')
      .eq('client_id', clientId)
      .in('status', ['discovered', 'queued'])
      .in('search_intent', ['commercial', 'transactional'])
      .order('weight', { ascending: false })
      .limit(1)

    // 测试优先级 2: informational with clicks
    const { data: infoClickKws, error: e2 } = await supabaseAdmin
      .from('keywords')
      .select('*')
      .eq('client_id', clientId)
      .in('status', ['discovered', 'queued'])
      .eq('search_intent', 'informational')
      .gt('gsc_clicks', 0)
      .order('weight', { ascending: false })
      .limit(1)

    // 测试优先级 3: informational 补齐
    const { data: infoKws, error: e3 } = await supabaseAdmin
      .from('keywords')
      .select('*')
      .eq('client_id', clientId)
      .in('status', ['discovered', 'queued'])
      .eq('search_intent', 'informational')
      .order('weight', { ascending: false })
      .limit(1)

    // 所有可用关键词（不过滤 intent）
    const { data: allAvailable, error: e4 } = await supabaseAdmin
      .from('keywords')
      .select('*')
      .eq('client_id', clientId)
      .in('status', ['discovered', 'queued'])

    // 所有关键词（不过滤任何条件）
    const { data: allKws, error: e5 } = await supabaseAdmin
      .from('keywords')
      .select('keyword, status, search_intent, client_id')
      .eq('client_id', clientId)

    return NextResponse.json({
      client_id: clientId,
      client_name: client.name,
      commercial_keywords: { count: commercialKws?.length || 0, data: commercialKws, error: e1?.message },
      info_click_keywords: { count: infoClickKws?.length || 0, data: infoClickKws, error: e2?.message },
      info_keywords: { count: infoKws?.length || 0, data: infoKws, error: e3?.message },
      all_available: { count: allAvailable?.length || 0, error: e4?.message },
      all_keywords: { count: allKws?.length || 0, data: allKws, error: e5?.message },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
