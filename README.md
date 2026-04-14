# ML SEO System

AI 驱动的机器学习 SEO 系统，自动发现关键词、生成内容、回收数据、优化迭代。

## 架构

- **关键词引擎**: Google Suggest 自动扩展长尾关键词，动态权重排序
- **内容生成**: Claude/GPT API 两步生成（大纲→正文），质量检查过滤
- **自动发布**: 定时发布 + ISR 渲染 + Google Indexing API 提交
- **数据闭环**: GSC/GA4 数据回收 → 权重更新 → 优化决策 → 下一轮生成

## 技术栈

- Next.js 16 (App Router)
- Supabase (PostgreSQL)
- Tailwind CSS 4
- Vercel (部署 + Cron)
- Claude / OpenAI API

## 快速开始

1. Clone 仓库
2. 在 Supabase 新建项目，运行 `docs/sql/001_seo_tables.sql` 建表
3. 复制 `.env.example` 为 `.env.local`，填入配置
4. `npm install && npm run dev`
5. 部署到 Vercel，配置环境变量和 Cron

## Cron 调度

| 任务 | 频率 | 路径 |
|------|------|------|
| 关键词发现 | 每周一 9:00 | `/api/seo/cron/discover-keywords` |
| 内容生成 | 每天 10:00 | `/api/seo/cron/generate-content` |
| 文章发布 | 每天 14:00 | `/api/seo/cron/publish` |
| 数据回收 | 每周日 8:00 | `/api/seo/cron/collect-data` |
| 权重更新 | 每周日 9:00 | `/api/seo/cron/update-weights` |
| 优化决策 | 每周日 10:00 | `/api/seo/cron/optimize` |
