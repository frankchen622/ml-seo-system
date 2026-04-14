-- ============================================
-- ML-SEO System Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 关键词池
CREATE TABLE IF NOT EXISTS seo_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL UNIQUE,
  seed_keyword TEXT,
  search_intent TEXT CHECK (search_intent IN ('informational', 'commercial', 'transactional', 'navigational')),
  estimated_volume INT,
  competition_score FLOAT,
  weight FLOAT DEFAULT 0.5,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 关键词表现记录
CREATE TABLE IF NOT EXISTS seo_keyword_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID REFERENCES seo_keywords(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  avg_position FLOAT,
  ctr FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(keyword_id, date)
);

-- 文章表
CREATE TABLE IF NOT EXISTS seo_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID REFERENCES seo_keywords(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  meta_description TEXT,
  content TEXT NOT NULL,
  content_html TEXT,
  word_count INT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  generation_model TEXT,
  generation_prompt_hash TEXT,
  quality_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 文章表现记录
CREATE TABLE IF NOT EXISTS seo_article_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES seo_articles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  pageviews INT DEFAULT 0,
  unique_visitors INT DEFAULT 0,
  avg_time_on_page FLOAT,
  bounce_rate FLOAT,
  organic_clicks INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, date)
);

-- 优化决策记录
CREATE TABLE IF NOT EXISTS seo_optimization_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_type TEXT NOT NULL CHECK (decision_type IN ('rewrite', 'expand', 'archive', 'boost', 'new_content')),
  target_type TEXT NOT NULL CHECK (target_type IN ('keyword', 'article')),
  target_id UUID NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

-- 系统配置
CREATE TABLE IF NOT EXISTS seo_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_keywords_weight ON seo_keywords(weight DESC);
CREATE INDEX idx_keywords_status ON seo_keywords(status);
CREATE INDEX idx_articles_status ON seo_articles(status);
CREATE INDEX idx_articles_slug ON seo_articles(slug);
CREATE INDEX idx_kw_perf_date ON seo_keyword_performance(date);
CREATE INDEX idx_art_perf_date ON seo_article_performance(date);

-- 插入默认配置
INSERT INTO seo_config (key, value) VALUES
  ('publish_per_day', '{"min": 2, "max": 5}'::jsonb),
  ('ai_model', '{"primary": "claude-sonnet-4-20250514", "fallback": "gpt-4o"}'::jsonb),
  ('weight_params', '{"decay_factor": 0.7, "performance_factor": 0.3, "min_weight": 0.05, "initial_weight": 0.5}'::jsonb),
  ('publish_hours', '{"start": 8, "end": 20}'::jsonb)
ON CONFLICT (key) DO NOTHING;
