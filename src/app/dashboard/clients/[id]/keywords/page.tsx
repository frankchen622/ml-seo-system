// 关键词面板
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

async function getKeywords(clientId: string) {
  const { data } = await supabaseAdmin
    .from('keywords')
    .select('*')
    .eq('client_id', clientId)
    .neq('status', 'archived')
    .order('weight', { ascending: false })
    .limit(200)
  return data || []
}

export default async function KeywordsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const keywords = await getKeywords(id)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href={`/dashboard/clients/${id}`} className="text-sm text-gray-500 hover:text-gray-700">← 返回</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">关键词面板</h1>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">关键词</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">意图</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">展现</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">点击</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">CTR</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">排名</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">权重</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">机会</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
            </tr>
          </thead>
          <tbody>
            {keywords.map((kw) => (
              <tr key={kw.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{kw.keyword}</td>
                <td className="px-4 py-3 text-gray-500">{kw.search_intent || '-'}</td>
                <td className="px-4 py-3 text-right text-gray-700">{kw.gsc_impressions || 0}</td>
                <td className="px-4 py-3 text-right text-gray-700">{kw.gsc_clicks || 0}</td>
                <td className="px-4 py-3 text-right text-gray-700">{kw.gsc_ctr ? `${(kw.gsc_ctr * 100).toFixed(1)}%` : '-'}</td>
                <td className="px-4 py-3 text-right text-gray-700">{kw.gsc_position ? kw.gsc_position.toFixed(1) : '-'}</td>
                <td className="px-4 py-3 text-right">
                  <WeightBar value={kw.weight} />
                </td>
                <td className="px-4 py-3">
                  <OpportunityBadge type={kw.opportunity_type} />
                </td>
                <td className="px-4 py-3">
                  <StatusDot status={kw.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {keywords.length === 0 && (
          <div className="p-12 text-center text-gray-500">暂无关键词数据，等待 GSC 数据采集</div>
        )}
      </div>
    </div>
  )
}

function WeightBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct > 60 ? 'bg-green-500' : pct > 30 ? 'bg-yellow-500' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8">{pct}%</span>
    </div>
  )
}

function OpportunityBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-gray-400 text-xs">-</span>
  const styles: Record<string, string> = {
    quick_win: 'bg-red-100 text-red-700',
    new_content: 'bg-blue-100 text-blue-700',
    optimize: 'bg-yellow-100 text-yellow-700',
    expand: 'bg-green-100 text-green-700',
  }
  const labels: Record<string, string> = { quick_win: '快赢', new_content: '新内容', optimize: '优化', expand: '扩展' }
  return <span className={`px-2 py-0.5 rounded text-xs ${styles[type] || ''}`}>{labels[type] || type}</span>
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    discovered: 'bg-gray-400', queued: 'bg-blue-400', assigned: 'bg-yellow-400', published: 'bg-green-400',
  }
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${colors[status] || 'bg-gray-300'}`} />
      <span className="text-xs text-gray-500">{status}</span>
    </div>
  )
}
