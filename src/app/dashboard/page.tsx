// Dashboard 总览页
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

async function getStats() {
  const [clients, keywords, articles, pendingReview] = await Promise.all([
    supabaseAdmin.from('clients').select('id', { count: 'exact' }).eq('status', 'active'),
    supabaseAdmin.from('keywords').select('id', { count: 'exact' }).neq('status', 'archived'),
    supabaseAdmin.from('articles').select('id', { count: 'exact' }),
    supabaseAdmin.from('articles').select('id', { count: 'exact' }).eq('status', 'review'),
  ])
  return {
    activeClients: clients.count || 0,
    totalKeywords: keywords.count || 0,
    totalArticles: articles.count || 0,
    pendingReview: pendingReview.count || 0,
  }
}

export default async function DashboardPage() {
  const stats = await getStats()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">系统总览</h1>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard label="活跃客户" value={stats.activeClients} color="blue" />
        <StatCard label="关键词总数" value={stats.totalKeywords} color="green" />
        <StatCard label="文章总数" value={stats.totalArticles} color="purple" />
        <StatCard label="待审核" value={stats.pendingReview} color="orange" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">快速操作</h2>
        <div className="flex gap-4">
          <Link href="/dashboard/clients" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            管理客户
          </Link>
          <Link href="/dashboard/content/review" className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm">
            审核内容
          </Link>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  }
  return (
    <div className={`rounded-xl border p-6 ${colors[color]}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-1 opacity-80">{label}</div>
    </div>
  )
}
