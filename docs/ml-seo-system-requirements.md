# 机器学习SEO系统 - 需求文档

## 项目概述

在现有 influencer-rate-kit（Next.js + Vercel + Supabase）基础上，搭建一套"AI内容生成 + 流量数据回收 + 自动优化迭代"的机器学习SEO系统。目标：让系统自动发现高价值关键词、批量生成高质量内容、根据真实流量数据自我进化。

## 现有技术栈

- 前端/SSR: Next.js 16 (App Router)
- 部署: Vercel
- 数据库: Supabase (PostgreSQL)
- 样式: Tailwind CSS 4
- 语言: TypeScript
- 域名: influencer-rate-kit 相关

---

## 系统架构（四大模块）

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  1.关键词引擎 │───▶│ 2.内容生成引擎 │───▶│ 3.自动发布系统 │───▶│ 4.数据闭环系统 │
│  Keyword     │    │  Content     │    │  Publisher   │    │  Feedback    │
│  Engine      │    │  Generator   │    │  System      │    │  Loop        │
└─────────────┘    └──────────────┘    └──────────────┘    └──────┬───────┘
                                                                  │
                                                                  ▼
                                                          ┌──────────────┐
                                                          │ 权重更新，反馈 │
                                                          │ 到关键词引擎   │
                                                          └──────────────┘
```

---

## 模块一：关键词引擎

### 功能
- 从种子关键词出发，自动扩展长尾关键词
- 对每个关键词计算动态权重（初始权重 + 流量反馈权重）
- 按搜索意图分类：informational / commercial / transactional

### 数据来源
- Google Search Console API（已有站点的真实查询词）
- Google Suggest API（自动补全建议，免费）
- 可选：SEMrush/Ahrefs API（付费，更精准的搜索量和竞争度）

### 数据库表设计

```sql
-- 关键词池
CREATE TABLE keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL UNIQUE,
  seed_keyword TEXT,              -- 来源种子词
  search_intent TEXT,             -- informational/commercial/transactional
  estimated_volume INT,           -- 预估月搜索量
  competition_score FLOAT,        -- 竞争度 0-1
  weight FLOAT DEFAULT 0.5,       -- 动态权重 0-1，核心字段
  status TEXT DEFAULT 'pending',  -- pending/assigned/published/archived
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 关键词表现记录
CREATE TABLE keyword_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID REFERENCES keywords(id),
  date DATE NOT NULL,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  avg_position FLOAT,
  ctr FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 权重算法

```
新权重 = 旧权重 × 0.7 + 表现分 × 0.3

表现分 = normalize(
  clicks × 0.4 +
  impressions × 0.2 +
  ctr × 0.25 +
  (100 - avg_position) × 0.15
)
```

- 连续两周零流量的关键词，权重衰减至 0.1
- 权重 < 0.05 的关键词自动归档
- 新关键词初始权重 0.5，给予探索机会

### 实现方式

```
src/lib/seo/
  keyword-engine.ts      -- 关键词发现与扩展
  keyword-scorer.ts      -- 权重计算
  google-suggest.ts      -- Google Suggest 抓取
  search-console.ts      -- GSC API 封装
```

- 关键词发现脚本：每周运行一次，从种子词扩展新关键词
- 权重更新脚本：每周运行一次，根据 GSC 数据更新权重

---

## 模块二：AI内容生成引擎

### 功能
- 根据关键词池中高权重关键词，自动生成SEO优化文章
- 每篇文章包含：标题、meta description、正文、内链建议
- 内容质量要求：有真实信息量、独立观点、完整结构

### 生成流程

```
1. 从关键词池选取 top N 高权重关键词（未发布的）
2. 分析搜索意图，确定内容类型（教程/对比/列表/深度分析）
3. 调用 AI API 生成文章大纲
4. 调用 AI API 根据大纲生成完整文章
5. 自动生成 meta title / description / slug
6. 内链分析：扫描已有文章，插入相关内链
7. 存入数据库，状态设为 draft
```

### AI调用策略
- 主模型：Claude API（内容质量更高）
- 备选：OpenAI GPT-4o
- 每篇文章分两次调用：先生成大纲，再生成正文（避免一次性生成质量下降）
- Prompt 中注入行业知识和SEO规则

### 数据库表设计

```sql
-- 文章表
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID REFERENCES keywords(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  meta_description TEXT,
  content TEXT NOT NULL,           -- Markdown 格式
  content_html TEXT,               -- 渲染后的 HTML
  word_count INT,
  status TEXT DEFAULT 'draft',     -- draft/published/archived
  published_at TIMESTAMPTZ,
  generation_model TEXT,           -- 使用的AI模型
  generation_prompt_hash TEXT,     -- prompt版本追踪
  quality_score FLOAT,             -- AI自评分数
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 文章表现记录
CREATE TABLE article_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id),
  date DATE NOT NULL,
  pageviews INT DEFAULT 0,
  unique_visitors INT DEFAULT 0,
  avg_time_on_page FLOAT,
  bounce_rate FLOAT,
  organic_clicks INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 内容质量控制
- AI生成后自动做一轮"自审"：检查事实准确性、内容重复度、可读性
- 质量分 < 0.6 的文章不发布，回到队列重新生成
- 每篇文章的 prompt 版本记录，方便追踪哪个版本的 prompt 效果更好

### 实现方式

```
src/lib/seo/
  content-generator.ts    -- 内容生成主流程
  outline-builder.ts      -- 大纲生成
  article-writer.ts       -- 正文生成
  quality-checker.ts      -- 质量检查
  internal-linker.ts      -- 内链分析与插入
  prompts/
    outline.ts            -- 大纲生成 prompt
    article.ts            -- 文章生成 prompt
    quality-check.ts      -- 质量检查 prompt
```

---

## 模块三：自动发布系统

### 功能
- 将生成的文章自动发布为 Next.js 页面
- 自动生成 sitemap，提交 Google 索引
- 控制发布节奏，避免短时间大量发布触发 Google 警觉

### 发布策略
- 每天发布 2-5 篇（可配置）
- 发布时间随机分散在工作时间段（模拟人工发布）
- 新站前两周每天 1-2 篇，之后逐步提量

### 技术实现

方案：动态路由 + 数据库驱动

```
src/app/blog/[slug]/page.tsx    -- 动态路由，从 Supabase 读取文章
src/app/api/seo/publish/route.ts -- 发布API：将 draft 改为 published
src/app/sitemap.ts               -- 已有，改造为动态生成
src/app/robots.ts                -- 已有
```

- 文章存在 Supabase 中，通过动态路由渲染
- Next.js ISR（增量静态再生）确保性能
- 发布时自动通过 Google Indexing API 提交新页面

### 发布流程

```
1. 定时任务触发（每天固定时间）
2. 从 articles 表选取 status=draft 的文章，按关键词权重排序
3. 取 top N 篇，将 status 改为 published，设置 published_at
4. 触发 Next.js ISR 重新生成页面
5. 更新 sitemap
6. 调用 Google Indexing API 提交新 URL
7. 记录发布日志
```

### 实现方式

```
src/lib/seo/
  publisher.ts             -- 发布主流程
  indexing-api.ts          -- Google Indexing API 封装
  sitemap-generator.ts     -- 动态 sitemap 生成
```

---

## 模块四：数据闭环系统（核心）

### 功能
- 自动从 Google Search Console 和 GA4 回收流量数据
- 将数据关联到具体关键词和文章
- 更新关键词权重，驱动下一轮内容策略
- 生成优化建议：哪些文章需要改写、哪些关键词值得加码

### 数据回收

```
每周自动执行：
1. 调用 GSC API，获取过去7天的查询词数据（展现、点击、排名、CTR）
2. 调用 GA4 API，获取文章页面的 pageviews、停留时间、跳出率
3. 将数据写入 keyword_performance 和 article_performance 表
4. 运行权重更新算法
5. 生成周报（可选：发送到邮箱或消息通知）
```

### 优化决策引擎

```
基于数据自动做出以下决策：

1. 关键词层面：
   - 高权重关键词 → 生成更多相关长尾内容
   - 低权重关键词 → 降低优先级或归档
   - 有展现无点击 → 优化标题和 meta description

2. 文章层面：
   - 高流量文章 → 扩展为系列内容
   - 有排名但排名低（11-30位）→ 内容改写优化，争取进首页
   - 零流量超过30天 → 归档或重写
   - 跳出率高 → 优化内容结构和可读性

3. 全局层面：
   - 分析哪类内容模式（教程/对比/列表）表现最好
   - 调整后续生成的内容类型比例
   - 识别新的高潜力关键词方向
```

### 数据库表设计

```sql
-- 优化决策记录
CREATE TABLE optimization_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_type TEXT NOT NULL,     -- rewrite/expand/archive/boost
  target_type TEXT NOT NULL,       -- keyword/article
  target_id UUID NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',   -- pending/executed/skipped
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

-- 系统配置
CREATE TABLE seo_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 实现方式

```
src/lib/seo/
  data-collector.ts        -- GSC + GA4 数据回收
  weight-updater.ts        -- 权重更新算法
  optimization-engine.ts   -- 优化决策引擎
  reporter.ts              -- 周报生成
```

---

## 定时任务调度

使用 Vercel Cron Jobs 或外部调度（GitHub Actions）：

| 任务 | 频率 | 说明 |
|------|------|------|
| 关键词发现 | 每周一 | 从种子词扩展新关键词 |
| 内容生成 | 每天 | 生成 2-5 篇文章 |
| 内容发布 | 每天 | 发布 draft 文章 |
| 数据回收 | 每周日 | 从 GSC/GA4 拉取数据 |
| 权重更新 | 每周日 | 更新关键词权重 |
| 优化决策 | 每两周 | 生成优化建议并执行 |

### API 路由

```
src/app/api/seo/
  cron/
    discover-keywords/route.ts
    generate-content/route.ts
    publish/route.ts
    collect-data/route.ts
    update-weights/route.ts
    optimize/route.ts
  keywords/route.ts          -- 关键词 CRUD
  articles/route.ts          -- 文章 CRUD
  dashboard/route.ts         -- 数据面板
```

---

## 管理后台（可选但推荐）

在现有 dashboard 基础上增加 SEO 管理面板：

```
src/app/dashboard/seo/
  page.tsx                   -- SEO 总览：关键词数、文章数、总流量
  keywords/page.tsx          -- 关键词管理：查看权重、状态、表现
  articles/page.tsx          -- 文章管理：查看、编辑、手动发布
  performance/page.tsx       -- 流量数据面板：趋势图、排名变化
  settings/page.tsx          -- 系统配置：发布频率、AI模型选择等
```

---

## 需要的外部服务和 API Key

| 服务 | 用途 | 费用 |
|------|------|------|
| Google Search Console API | 搜索数据回收 | 免费 |
| Google Analytics 4 API | 页面流量数据 | 免费 |
| Google Indexing API | 主动提交索引 | 免费 |
| Claude API / OpenAI API | AI内容生成 | 按量付费 |
| Supabase | 数据库（已有） | 免费额度内 |
| Vercel | 部署（已有） | 免费额度内 |

---

## 实施路线图

### Phase 1（第1-2周）：基础设施
- [ ] Supabase 建表
- [ ] Google Search Console 接入（OAuth + API）
- [ ] GA4 接入
- [ ] 关键词引擎基础版（Google Suggest 抓取）

### Phase 2（第3-4周）：内容生成
- [ ] AI 内容生成引擎
- [ ] Prompt 调优（针对 influencer/marketing 行业）
- [ ] 质量检查流程
- [ ] 动态路由 + 文章渲染页面

### Phase 3（第5-6周）：自动化
- [ ] 自动发布系统
- [ ] Cron 定时任务
- [ ] Google Indexing API 集成
- [ ] Sitemap 动态生成

### Phase 4（第7-8周）：数据闭环
- [ ] GSC/GA4 数据自动回收
- [ ] 权重更新算法
- [ ] 优化决策引擎
- [ ] 管理后台面板

### Phase 5（持续）：迭代优化
- [ ] 根据真实数据调优权重算法参数
- [ ] 优化 prompt，提升内容命中率
- [ ] 扩展关键词来源
- [ ] A/B 测试不同内容模式

---

## 项目文件结构总览

```
src/
  lib/seo/
    keyword-engine.ts
    keyword-scorer.ts
    google-suggest.ts
    search-console.ts
    content-generator.ts
    outline-builder.ts
    article-writer.ts
    quality-checker.ts
    internal-linker.ts
    publisher.ts
    indexing-api.ts
    sitemap-generator.ts
    data-collector.ts
    weight-updater.ts
    optimization-engine.ts
    reporter.ts
    prompts/
      outline.ts
      article.ts
      quality-check.ts
  app/
    blog/[slug]/page.tsx
    api/seo/
      cron/
        discover-keywords/route.ts
        generate-content/route.ts
        publish/route.ts
        collect-data/route.ts
        update-weights/route.ts
        optimize/route.ts
      keywords/route.ts
      articles/route.ts
      dashboard/route.ts
    dashboard/seo/
      page.tsx
      keywords/page.tsx
      articles/page.tsx
      performance/page.tsx
      settings/page.tsx
```

---

## 风险与注意事项

1. Google 对 AI 内容的态度：Google 官方说不反对 AI 内容，但反对"低质量批量内容"。关键是内容要有真实价值。
2. 发布节奏：新站不要一天发几十篇，循序渐进。
3. 内容同质化：避免生成的文章之间太相似，需要在 prompt 中强调差异化。
4. API 成本：Claude/GPT 按 token 计费，一篇 2000 字文章大约 $0.05-0.15，每天 5 篇约 $0.25-0.75/天。
5. GSC 数据延迟：Google Search Console 数据有 2-3 天延迟，权重更新要考虑这个时差。
