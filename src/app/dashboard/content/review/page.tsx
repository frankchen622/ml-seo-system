// 内容审核页
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

async function getPendingArticles() {
  const { data } = await supabaseAdmin
    .from('articles')
    .select('*, clients(name, domain), keywords(keyword)')
    .in('status', ['draft', 'review'])
    .order('created_at', { ascending: false })
    .limit(50)
  return data || []
}

export default async function ReviewPage() {
  const articles = await getPendingArticles()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">内容审核</h1>
      <p className="text-sm text-gray-500 mb-6">共 {articles.length} 篇待审核文章</p>

      <div className="grid gap-4">
        {articles.map((art) => (
          <div key={art.id} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="text-xs text-gray-400">{art.clients?.name}</span>
                <h3 className="font-semibold text-gray-900 mt-1">{art.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{art.meta_description}</p>
              </div>
              <div className="flex items-center gap-2">
                {art.quality_score && (
                  <span className={`px-2 py-0.5 rounded text-xs ${art.quality_score >= 7 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    质量 {art.quality_score.toFixed(1)}
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded text-xs ${art.status === 'review' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                  {art.status === 'review' ? '需审核' : '草稿'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {art.keywords?.keyword && <span>🔑 {art.keywords.keyword}</span>}
              {art.word_count && <span>{art.word_count} 字</span>}
              <span>{new Date(art.created_at).toLocaleDateString('zh-CN')}</span>
            </div>
            {/* 预览前 200 字 */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-700 max-h-32 overflow-hidden">
              {art.content_markdown?.slice(0, 300)}...
            </div>
          </div>
        ))}
        {articles.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
            没有待审核的文章 🎉
          </div>
        )}
      </div>
    </div>
  )
}
