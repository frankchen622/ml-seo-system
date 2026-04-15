import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// 前端用 anon key
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 后端用 service role key（绕过 RLS）
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// 类型定义
export interface Client {
  id: string
  name: string
  domain: string
  wp_url: string
  wp_username: string | null
  wp_app_password: string | null
  gsc_site_url: string | null
  google_refresh_token: string | null
  google_client_id: string | null
  google_client_secret: string | null
  ga4_property_id: string | null
  industry: string | null
  target_audience: string | null
  brand_voice: string | null
  publish_per_week: number
  ai_model: string
  auto_publish: boolean
  status: 'active' | 'paused' | 'archived'
  created_at: string
  updated_at: string
}

export interface Keyword {
  id: string
  client_id: string
  keyword: string
  source: string | null
  search_intent: string | null
  gsc_impressions: number
  gsc_clicks: number
  gsc_ctr: number | null
  gsc_position: number | null
  weight: number
  opportunity_type: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface Article {
  id: string
  client_id: string
  keyword_id: string | null
  title: string
  slug: string
  meta_description: string | null
  content_markdown: string
  content_html: string | null
  word_count: number | null
  generation_model: string | null
  prompt_version: string | null
  quality_score: number | null
  schema_markup: any
  faq_items: any
  internal_links: any
  wp_post_id: number | null
  wp_url: string | null
  status: 'draft' | 'review' | 'approved' | 'published' | 'archived'
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface ContentPattern {
  id: string
  client_id: string
  pattern_type: 'structure' | 'tone' | 'element' | 'format'
  description: string
  evidence: any
  effectiveness_score: number | null
  active: boolean
  created_at: string
}
