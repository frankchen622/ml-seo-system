-- ============================================
-- Fix: Drop conflicting V1 indexes before V2 creation
-- Run this FIRST, then run 002_v2_multi_client.sql again
-- ============================================

-- Drop V1 indexes that conflict with V2
DROP INDEX IF EXISTS idx_keywords_weight;
DROP INDEX IF EXISTS idx_keywords_status;
DROP INDEX IF EXISTS idx_articles_status;
DROP INDEX IF EXISTS idx_articles_slug;
DROP INDEX IF EXISTS idx_kw_perf_date;
DROP INDEX IF EXISTS idx_art_perf_date;

-- Also drop V2 indexes in case of partial run
DROP INDEX IF EXISTS idx_keywords_client;
DROP INDEX IF EXISTS idx_keywords_opportunity;
DROP INDEX IF EXISTS idx_articles_client;
DROP INDEX IF EXISTS idx_articles_keyword;
DROP INDEX IF EXISTS idx_kw_history_week;
DROP INDEX IF EXISTS idx_art_perf_week;
DROP INDEX IF EXISTS idx_opt_log_client;
DROP INDEX IF EXISTS idx_content_patterns_client;
