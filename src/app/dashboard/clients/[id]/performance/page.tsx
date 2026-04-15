// 数据表现页
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

async function getPerformanceData(clientId: string) {
  // 获取已发布文章及其最近表现
  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id, title, slug, published_at')
    .eq('client_id', clientId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50)

  if (!articles || articles.length === 0) return []

  const result = []
  for (const art of articles) {
    const { data: perf } = await supabaseAdmin
      .from('article_performance')
      .select('*')
      .eq('article_id', art.id)
      .order('week_start', { ascending: false })
      .limit(1)
      .single()

    result.push({ ...art, performance: perf })
  }
  return result
}

async function getOptimizationLog(clientId: string) {
  const { data } = await supabaseAdmin
    .from('optimization_log')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(20)
  return data || []
}

export default async function PerformancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [articles, logs] = await Promise.all([
    getPerformanceData(id),
    getOptimizationLog(id),
  ])

  // 汇总
  const totalClicks = articles.reduce((s, a) => s + (a.performance?.clicks || 0), 0)
  const totalImpressions = articles.reduce((s, a) => s + (a.performance?.impressions || 0), 0)
  const avgPosition = articles.filter(a => a.performance?.avg_position).length > 0
    ? articles.reduce((s, a) => s + (a.performance?.avg_position || 0), 0) / articles.filter(a => a.performance?.avg_position).length
    : 0

  return (
    <div>
      <div className="mb-6">
        <Link href={`/dashboard/clients/${id}`} className="text-sm text-gray-500 hover:text-gray-700">← 返回</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">数据表现</h1>
      </div>

      {/* 汇总 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-2xl font-bold text-blue-600">{totalClicks}</div>
          <div className="text-xs text-gray-500 mt-1">本周总点击</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-2xl font-bold text-green-600">{totalImpressions}</div>
          <div className="text-xs text-gray-500 mt-1">本周总展现</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-2xl font-bold text-purple-600">{avgPosition > 0 ? avgPosition.toFixed(1) : '-'}</div>
          <div className="text-xs text-gray-500 mt-1">平均排名</div>
        </div>
      </div>

      {/* 文章表现 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-gray-200 font-semibold">文章表现</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">标题</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">点击</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">展现</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">CTR</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">排名</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">停留</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">跳出率</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((art) => (
              <tr key={art.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{art.title}</td>
                <td className="px-4 py-3 text-right">{art.performance?.clicks ?? '-'}</td>
                <td className="px-4 py-3 text-right">{art.performance?.impressions ?? '-'}</td>
                <td className="px-4 py-3 text-right">{art.performance?.ctr ? `${(art.performance.ctr * 100).toFixed(1)}%` : '-'}</td>
                <td className="px-4 py-3 text-right">{art.performance?.avg_position?.toFixed(1) ?? '-'}</td>
                <td className="px-4 py-3 text-right">{art.performance?.avg_time_on_page ? `${(art.performance.avg_time_on_page / 60).toFixed(1)}m` : '-'}</td>
                <td className="px-4 py-3 text-right">{art.performance?.bounce_rate ? `${(art.performance.bounce_rate * 100).toFixed(0)}%` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {articles.length === 0 && (
          <div className="p-8 text-center text-gray-500">暂无已发布文章的表现数据</div>
        )}
      </div>

      {/* 优化建议 */}
      {logs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 font-semibold">最近优化建议</div>
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <div key={log.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <ActionBadge type={log.action_type} />
                  <span className="ml-3 text-sm text-gray-700">{log.reason}</span>
                </div>
                <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleDateString('zh-CN')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ActionBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    new_content: 'bg-blue-100 text-blue-700',
    rewrite: 'bg-orange-100 text-orange-700',
    meta_optimize: 'bg-yellow-100 text-yellow-700',
    expand: 'bg-green-100 text-green-700',
    archive: 'bg-gray-100 text-gray-500',
  }
  return <span className={`px-2 py-0.5 rounded text-xs ${styles[type] || 'bg-gray-100'}`}>{type}</span>
}
