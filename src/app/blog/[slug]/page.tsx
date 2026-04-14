import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const { data: article } = await supabase
    .from('seo_articles')
    .select('title, meta_description')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!article) return { title: 'Not Found' }

  return {
    title: article.title,
    description: article.meta_description,
  }
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params
  const { data: article } = await supabase
    .from('seo_articles')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!article) notFound()

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <article>
        <h1 className="text-3xl font-bold mb-4">{article.title}</h1>
        <time className="text-gray-500 text-sm block mb-8">
          {new Date(article.published_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
          })}
        </time>
        <div
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: article.content_html || article.content }}
        />
      </article>
    </main>
  )
}

// ISR: 每小时重新生成
export const revalidate = 3600
