-- ============================================
-- ML-SEO V2: 清理旧表 + 重建全部
-- 一次性执行即可
-- ============================================

-- 1. 删除旧 V1 索引
DROP INDEX IF EXISTS idx_keywords_weight;
DROP INDEX IF EXISTS idx_keywords_status;
DROP INDEX IF EXISTS idx_articles_status;
DROP INDEX IF EXISTS idx_articles_slug;
DROP INDEX IF EXISTS idx_kw_perf_date;
DROP INDEX IF EXISTS idx_art_perf_date;

-- 2. 删除旧 V1 表（注意顺序，先删有外键依赖的）
DROP TABLE IF EXISTS seo_optimization_decisions CASCADE;
DROP TABLE IF EXISTS seo_article_performance CASCADE;
DROP TABLE IF EXISTS seo_keyword_performance CASCADE;
DROP TABLE IF EXISTS seo_articles CASCADE;
DROP TABLE IF EXISTS seo_keywords CASCADE;
DROP TABLE IF EXISTS seo_config CASCADE;

-- 3. 删除 V2 表（如果之前部分创建了）
DROP TABLE IF EXISTS optimization_log CASCADE;
DROP TABLE IF EXISTS article_performance CASCADE;
DROP TABLE IF EXISTS content_patterns CASCADE;
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS keyword_history CASCADE;
DROP TABLE IF EXISTS keywords CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;

-- ============================================
-- 4. 创建 V2 新表
-- ============================================

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  wp_url TEXT NOT NULL,
  wp_username TEXT,
  wp_app_password TEXT,
  gsc_site_url TEXT,
  google_refresh_token TEXT,
  google_client_id TEXT,
  google_client_secret TEXT,
  ga4_property_id TEXT,
  industry TEXT,
  target_audience TEXT,
  brand_voice TEXT,
  publish_per_week INT DEFAULT 10,
  ai_model TEXT DEFAULT 'claude-sonnet-4-6',
  auto_publish BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  source TEXT,
  search_intent TEXT CHECK (search_intent IN ('informational', 'commercial', 'transactional', 'navigational')),
  gsc_impressions INT DEFAULT 0,
  gsc_clicks INT DEFAULT 0,
  gsc_ctr FLOAT,
  gsc_position FLOAT,
  weight FLOAT DEFAULT 0.5,
  opportunity_type TEXT CHECK (opportunity_type IN ('quick_win', 'new_content', 'optimize', 'expand')),
  status TEXT DEFAULT 'discovered' CHECK (status IN ('discovered', 'queued', 'assigned', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, keyword)
);

CREATE TABLE keyword_history (
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

CREATE TABLE content_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('structure', 'tone', 'element', 'format')),
  description TEXT NOT NULL,
  evidence JSONB,
  effectiveness_score FLOAT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  keyword_id UUID REFERENCES keywords(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  meta_description TEXT,
  content_markdown TEXT NOT NULL,
  content_html TEXT,
  word_count INT,
  generation_model TEXT,
  prompt_version TEXT,
  quality_score FLOAT,
  schema_markup JSONB,
  faq_items JSONB,
  internal_links JSONB,
  wp_post_id INT,
  wp_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, slug)
);

CREATE TABLE article_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  ctr FLOAT,
  avg_position FLOAT,
  pageviews INT DEFAULT 0,
  unique_visitors INT DEFAULT 0,
  avg_time_on_page FLOAT,
  bounce_rate FLOAT,
  conversions INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, week_start)
);

CREATE TABLE optimization_log (
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

CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 索引
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

-- 6. 默认配置
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
  }'::jsonb);
