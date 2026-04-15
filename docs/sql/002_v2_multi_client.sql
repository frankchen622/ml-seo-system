-- ============================================
-- ML-SEO System V2 - Multi-Client Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 客户表
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  -- WordPress
  wp_url TEXT NOT NULL,
  wp_username TEXT,
  wp_app_password TEXT,
  -- Google APIs
  gsc_site_url TEXT,
  google_refresh_token TEXT,
  google_client_id TEXT,
  google_client_secret TEXT,
  ga4_property_id TEXT,
  -- 内容策略
  industry TEXT,
  target_audience TEXT,
  brand_voice TEXT,
  publish_per_week INT DEFAULT 10,
  ai_model TEXT DEFAULT 'claude-sonnet-4-6',
  auto_publish BOOLEAN DEFAULT false,
  -- 状态
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 关键词表 (V2 多客户)
CREATE TABLE IF NOT EXISTS keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  source TEXT,
  search_intent TEXT CHECK (search_intent IN ('informational', 'commercial', 'transactional', 'navigational')),
  -- GSC 最新数据
  gsc_impressions INT DEFAULT 0,
  gsc_clicks INT DEFAULT 0,
  gsc_ctr FLOAT,
  gsc_position FLOAT,
  -- 权重系统
  weight FLOAT DEFAULT 0.5,
  opportunity_type TEXT CHECK (opportunity_type IN ('quick_win', 'new_content', 'optimize', 'expand')),
  status TEXT DEFAULT 'discovered' CHECK (status IN ('discovered', 'queued', 'assigned', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, keyword)
);

-- 关键词历史
CREATE TABLE IF NOT EXISTS keyword_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  ctr FLOAT,
  avg_position FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(keyword_id, week_start)
);

-- 内容模式表
CREATE TABLE IF NOT EXISTS content_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('structure', 'tone', 'element', 'format')),
  description TEXT NOT NULL,
  evidence JSONB,
  effectiveness_score FLOAT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 文章表 (V2 多客户)
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  keyword_id UUID REFERENCES keywords(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  meta_description TEXT,
  content_markdown TEXT NOT NULL,
  content_html TEXT,
  word_count INT,
  -- 生成信息
  generation_model TEXT,
  prompt_version TEXT,
  quality_score FLOAT,
  -- SEO 元素
  schema_markup JSONB,
  faq_items JSONB,
  internal_links JSONB,
  -- WordPress
  wp_post_id INT,
  wp_url TEXT,
  -- 状态
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, slug)
);

-- 文章表现
CREATE TABLE IF NOT EXISTS article_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  -- GSC
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  ctr FLOAT,
  avg_position FLOAT,
  -- GA4
  pageviews INT DEFAULT 0,
  unique_visitors INT DEFAULT 0,
  avg_time_on_page FLOAT,
  bounce_rate FLOAT,
  conversions INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, week_start)
);

-- 优化日志
CREATE TABLE IF NOT EXISTS optimization_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  cycle_date DATE NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('new_content', 'rewrite', 'meta_optimize', 'expand', 'archive')),
  target_keyword TEXT,
  target_article_id UUID,
  reason TEXT,
  data_snapshot JSONB,
  result TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 系统配置 (V2)
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_keywords_client ON keywords(client_id);
CREATE INDEX idx_keywords_weight ON keywords(client_id, weight DESC);
CREATE INDEX idx_keywords_status ON keywords(status);
CREATE INDEX idx_keywords_opportunity ON keywords(opportunity_type);
CREATE INDEX idx_articles_client ON articles(client_id);
CREATE INDEX idx_articles_status ON articles(client_id, status);
CREATE INDEX idx_articles_keyword ON articles(keyword_id);
CREATE INDEX idx_kw_history_week ON keyword_history(week_start);
CREATE INDEX idx_art_perf_week ON article_performance(week_start);
CREATE INDEX idx_opt_log_client ON optimization_log(client_id);
CREATE INDEX idx_content_patterns_client ON content_patterns(client_id);

-- 默认系统配置
INSERT INTO system_config (key, value) VALUES
  ('weight_params', '{
    "clicks_weight": 0.30,
    "impressions_weight": 0.15,
    "ctr_weight": 0.25,
    "position_weight": 0.15,
    "time_on_page_weight": 0.15,
    "old_weight_factor": 0.6,
    "new_score_factor": 0.4,
    "quick_win_boost": 1.3,
    "zero_data_decay": 0.5,
    "archive_threshold": 0.05,
    "initial_weight": 0.5
  }'::jsonb),
  ('default_publish', '{
    "per_week": 10,
    "ramp_up_weeks": 2,
    "ramp_up_ratio": 0.5,
    "spread_weekdays": true
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 启用 RLS (可选，按需开启)
-- ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
