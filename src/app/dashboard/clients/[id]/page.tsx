// 客户详情页
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

async function getClient(id: string) {
  const { data } = await supabaseAdmin.from('clients').select('*').eq('id', id).single()
  return data
}

async function getClientStats(id: string) {
  const [keywords, articles, published, patterns] = await Promise.all([
    supabaseAdmin.from('keywords').select('id, opportunity_type, weight', { count: 'exact' }).eq('client_id', id).neq('status', 'archived'),
    supabaseAdmin.from('articles').select('id, status', { count: 'exact' }).eq('client_id', id),
    supabaseAdmin.from('articles').select('id').eq('client_id', id).eq('status', 'published'),
    supabaseAdmin.from('content_patterns').select('id', { count: 'exact' }).eq('client_id', id).eq('active', true),
  ])

  // 关键词机会分布
  const kwData = keywords.data || []
  const opportunities: Record<string, number> = {}
  for (const kw of kwData) {
    const t = kw.opportunity_type || 'unclassified'
    opportunities[t] = (opportunities[t] || 0) + 1
  }

  // 文章状态分布
  const artData = articles.data || []
  const artStatus: Record<string, number> = {}
  for (const a of artData) {
    artStatus[a.status] = (artStatus[a.status] || 0) + 1
  }

  return {
    totalKeywords: keywords.count || 0,
    totalArticles: articles.count || 0,
    publishedArticles: published.data?.length || 0,
    activePatterns: patterns.count || 0,
    opportunities,
    articleStatus: artStatus,
  }
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = await getClient(id)
  if (!client) notFound()

  const stats = await getClientStats(id)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/dashboard/clients" className="text-sm text-gray-500 hover:text-gray-700">← 返回客户列表</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{client.name}</h1>
          <p className="text-gray-500">{client.domain}</p>
        </div>
        <Link
          href={`/dashboard/clients/${id}/settings`}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
        >
          ⚙️ 设置
        </Link>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MiniStat label="关键词" value={stats.totalKeywords} />
        <MiniStat label="文章总数" value={stats.totalArticles} />
        <MiniStat label="已发布" value={stats.publishedArticles} />
        <MiniStat label="活跃模式" value={stats.activePatterns} />
      </div>

      {/* 导航面板 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <PanelLink href={`/dashboard/clients/${id}/keywords`} icon="🔑" title="关键词面板" desc="查看关键词池、权重和机会分类" />
        <PanelLink href={`/dashboard/clients/${id}/articles`} icon="📄" title="文章管理" desc="管理生成的文章和发布状态" />
        <PanelLink href={`/dashboard/clients/${id}/performance`} icon="📈" title="数据表现" desc="查看流量、排名和优化建议" />
      </div>

      {/* 机会分布 */}
      {Object.keys(stats.opportunities).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold mb-4">关键词机会分布</h2>
          <div className="flex gap-4">
            {Object.entries(stats.opportunities).map(([type, count]) => (
              <div key={type} className="px-3 py-2 bg-gray-50 rounded-lg text-sm">
                <span className="font-medium">{typeLabel(type)}</span>
                <span className="ml-2 text-gray-500">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  )
}

function PanelLink({ href, icon, title, desc }: { href: string; icon: string; title: string; desc: string }) {
  return (
    <Link href={href} className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-sm transition-all block">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{desc}</p>
    </Link>
  )
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    quick_win: '🎯 快赢',
    new_content: '✨ 新内容',
    optimize: '🔧 优化',
    expand: '🌱 扩展',
    unclassified: '❓ 未分类',
  }
  return labels[type] || type
}
