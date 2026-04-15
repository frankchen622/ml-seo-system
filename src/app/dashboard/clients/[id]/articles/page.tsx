// 文章管理页
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

async function getArticles(clientId: string) {
  const { data } = await supabaseAdmin
    .from('articles')
    .select('*, keywords(keyword)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(100)
  return data || []
}

export default async function ArticlesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const articles = await getArticles(id)

  return (
    <div>
      <div className="mb-6">
        <Link href={`/dashboard/clients/${id}`} className="text-sm text-gray-500 hover:text-gray-700">← 返回</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">文章管理</h1>
      </div>

      <div className="grid gap-4">
        {articles.map((art) => (
          <div key={art.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{art.title}</h3>
                <p className="text-sm text-gray-500 mt-1 truncate">{art.meta_description}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                  {art.keywords?.keyword && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded">🔑 {art.keywords.keyword}</span>
                  )}
                  {art.word_count && <span>{art.word_count} 字</span>}
                  {art.quality_score && <span>质量: {art.quality_score.toFixed(1)}/10</span>}
                  {art.generation_model && <span>模型: {art.generation_model}</span>}
                  <span>{new Date(art.created_at).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <ArticleStatus status={art.status} />
                {art.wp_url && (
                  <a href={art.wp_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                    查看 ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
        {articles.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
            暂无文章，等待内容生成
          </div>
        )}
      </div>
    </div>
  )
}

function ArticleStatus({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    review: 'bg-orange-100 text-orange-700',
    approved: 'bg-blue-100 text-blue-700',
    published: 'bg-green-100 text-green-700',
    archived: 'bg-gray-100 text-gray-400',
  }
  const labels: Record<string, string> = {
    draft: '草稿', review: '待审核', approved: '已批准', published: '已发布', archived: '已归档',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${styles[status] || ''}`}>
      {labels[status] || status}
    </span>
  )
}
