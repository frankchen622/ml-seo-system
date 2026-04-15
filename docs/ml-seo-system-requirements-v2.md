# ML-SEO 代运营系统 - 完整需求文档

## 一、项目定位

面向 SEO 代运营服务商的智能内容系统。核心理念：**让 Google 告诉你该写什么**。

系统通过采集客户 Google Search Console 和 GA4 的真实数据，自动学习什么内容有效、什么无效，然后用 AI 生成精准匹配搜索意图的高质量内容，发布到客户的 WordPress 网站，持续监控表现并自我进化。

**不是猜，是用数据说话。**

---

## 二、核心运作流程（进化引擎）

整个系统是一个持续循环的进化引擎：

```
Google 提供信号 → 系统学习 → 生产更好内容 → Google 给更多流量 → 继续学习
```

### 五阶段循环（每周/每月）

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ① 数据采集        ② 分析学习        ③ 内容生成           │
│   (GSC + GA4)  →   (权重+模式)   →   (AI执行)             │
│                                                             │
│        ▲                                    │               │
│        │                                    ▼               │
│                                                             │
│   ⑤ 监控反馈        ④ 发布上线                              │
│   (表现追踪)   ←   (WordPress)                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、阶段详解

### 阶段一：数据采集 —— 让 Google 告诉你该做什么

系统每周自动通过 GSC API 和 GA4 Data API 拉取每个客户的真实数据。

**GSC 采集：**
- 查询词数据：keyword、impressions、clicks、CTR、position
- 重点标记：impressions 高但 CTR 低、position 5-20 的"快赢"机会词
- 已收录页面的表现数据
- 索引覆盖率状态

**GA4 采集：**
- 每篇文章的有机流量来源
- 用户行为：平均停留时间、跳出率、页面深度
- 转化数据（如果客户配置了转化目标）

这些数据就是系统学习的"教材"——Google 通过展现告诉你用户在搜什么，你的页面哪里还不够好。

---

### 阶段二：分析与学习 —— 权重算法 + 模式提取

**关键词机会分类：**

| 类型 | 条件 | 策略 |
|------|------|------|
| Quick Win（快赢）| position 5-20, impressions>50, CTR<3% | 优化现有页面标题/meta/内容 |
| New Content（新内容）| GSC 出现但无对应页面的查询词 | 生成新文章 |
| Optimize（优化）| 有排名但表现下滑，跳出率高 | 改写内容 |
| Expand（扩展）| 高流量词的相关长尾词 | 创建内容集群 |

**模式学习（核心壁垒）：**

系统自动分析高表现文章的共同特征，提取可复用的模式：
- "带对比表格的文章 CTR 比纯文字高 40%"
- "第一人称案例的文章停留时间长 2 倍"
- "FAQ 结构的文章更容易获得精选摘要"
- "2000-2500 字的文章排名最稳定"

这些模式会被存储并自动注入后续的 AI 生成 prompt 中。

**动态权重算法：**

```
表现分 = (
  clicks × 0.30 +
  impressions × 0.15 +
  CTR × 0.25 +
  (100 - position) / 100 × 0.15 +
  avg_time_on_page / 300 × 0.15
)

新权重 = 旧权重 × 0.6 + 表现分 × 0.4

规则：
- Quick Win 关键词额外加权 × 1.3
- 连续两周零数据：权重 × 0.5
- 权重 < 0.05 自动归档
- 新关键词初始权重 0.5
```

成功了权重上升，失败了权重下降。系统永远优先选择高权重方向。**这不是规则，这是进化。优胜劣汰，自然选择。**

---

### 阶段三：AI 内容生成 —— 精准执行

**生成流程：**

```
1. 从关键词池选取高权重 + 高优先级关键词
2. 查询 GSC 中的 People Also Ask / 相关搜索
3. 加载该客户学到的 content_patterns（高表现模式）
4. 生成大纲：
   - 参考竞品页面结构
   - 融入 PAA 问题作为 FAQ
   - 应用高表现模式（如：加入对比表格、真实案例）
5. 生成完整文章：
   - 独特观点 + 真实数据
   - E-E-A-T 信号（经验、专业、权威、可信）
   - Schema 结构化数据
   - FAQ Schema
   - 内部链接建议
6. AI 自审质量检查
7. 存入数据库
```

**内容质量要求：**
- 每篇文章有真实信息量，不是关键词堆砌
- 有独立的观点角度和完整的内容结构
- 注入真实数据、案例、E-E-A-T 信号
- 避免纯模板"AI味"
- 从 Google 角度看，这就是一篇正常的、有价值的文章

**Prompt 进化机制：**
- 基础 prompt：SEO 最佳实践 + 内容结构
- 客户 prompt：行业知识 + 品牌调性 + 目标受众
- 模式 prompt：从 content_patterns 动态注入学到的高表现元素
- 每篇文章记录 prompt 版本，方便 A/B 对比哪个版本效果更好

可选：人工抽查 5-10% 关键页面，确保价值。

---

### 阶段四：发布到客户 WordPress

**通过 WordPress REST API 自动发布：**
- 自动创建文章（标题、正文、slug、meta description）
- 自动设置分类、标签、特色图片
- 自动生成内部链接
- 发布后自动提交 sitemap 到 GSC，加速收录

**发布节奏控制：**
- 每个客户每周发布量可配置（默认 5-10 篇）
- 发布时间分散在工作日，模拟人工节奏
- 新客户前两周减半发布，逐步提量
- 避免短时间大量发布触发 Google 警觉

**审核流程（可选）：**
- draft → review（人工抽查）→ approved → published
- 也可跳过 review 直接自动发布

---

### 阶段五：监控与反馈 —— 闭环闭合

**新文章上线后持续追踪：**
- 第 1 周：是否被 Google 收录
- 第 2-3 周：展现量和初始排名
- 第 4 周+：点击、CTR、用户行为

**自动优化决策：**

| 表现 | 决策 |
|------|------|
| 表现好（高流量高停留）| 权重上升，扩展相关长尾内容 |
| 有展现无点击 | 优化标题和 meta description |
| 有点击高跳出 | 改写内容结构和可读性 |
| 排名 11-30 位 | 内容优化冲刺首页 |
| 未收录 | 重新提交索引 |
| 30天零数据 | 归档或重写 |

**Prompt 进化：**
- 对比不同 prompt 版本生成的文章表现
- 自动识别哪个版本效果更好
- 下一轮生成使用更优的 prompt 模板

---

## 四、时间线预期（新站纯自然流量）

| 阶段 | 时间 | 状态 |
|------|------|------|
| 学习期 | 第 1-2 周 | 系统生成内容，但流量近零。Google 开始爬取。 |
| 收录期 | 第 3-4 周 | Google 开始收录，长尾词有展现，少量点击。 |
| 增长期 | 1-2 个月 | 系统学会有效模式，内容命中率明显提升，流量开始增长。 |
| 复利期 | 3 个月+ | 高权重关键词持续积累，流量复利式增长。 |

---

## 五、多客户管理

每个客户独立配置：
- Google Search Console 授权
- Google Analytics 4 授权
- WordPress 站点地址 + API 凭证
- 行业、目标受众、品牌调性
- 发布频率和审核流程
- 独立的关键词池和权重系统
- 独立的内容模式学习

---

## 六、数据库设计

### 客户表 (clients)
```sql
CREATE TABLE clients (
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
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 关键词表 (keywords)
```sql
CREATE TABLE keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  source TEXT,                       -- gsc/suggest/manual
  search_intent TEXT,                -- informational/commercial/transactional
  -- GSC 最新数据
  gsc_impressions INT DEFAULT 0,
  gsc_clicks INT DEFAULT 0,
  gsc_ctr FLOAT,
  gsc_position FLOAT,
  -- 权重系统
  weight FLOAT DEFAULT 0.5,
  opportunity_type TEXT,             -- quick_win/new_content/optimize/expand
  status TEXT DEFAULT 'discovered',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, keyword)
);
```

### 关键词历史 (keyword_history)
```sql
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
```

### 内容模式表 (content_patterns)
```sql
CREATE TABLE content_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL,        -- structure/tone/element/format
  description TEXT NOT NULL,
  evidence JSONB,
  effectiveness_score FLOAT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 文章表 (articles)
```sql
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
  status TEXT DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, slug)
);
```

### 文章表现 (article_performance)
```sql
CREATE TABLE article_performance (
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
```

### 优化日志 (optimization_log)
```sql
CREATE TABLE optimization_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  cycle_date DATE NOT NULL,
  action_type TEXT NOT NULL,         -- new_content/rewrite/meta_optimize/expand/archive
  target_keyword TEXT,
  target_article_id UUID,
  reason TEXT,
  data_snapshot JSONB,
  result TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 系统配置 (system_config)
```sql
CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 七、技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 前端/后台 | Next.js 16 (App Router) | 管理后台 + API |
| 数据库 | Supabase (PostgreSQL) | 已有 |
| 样式 | Tailwind CSS 4 | 已有 |
| 部署 | Vercel | 已有 + Cron Jobs |
| AI | Claude API (第三方) | 内容生成 |
| 发布 | WordPress REST API | 发布到客户站 |
| 数据源 | GSC API + GA4 Data API | 免费 |

---

## 八、项目文件结构

```
src/
  lib/
    supabase.ts
    seo/
      collectors/
        gsc-collector.ts         -- GSC 数据采集
        ga4-collector.ts         -- GA4 数据采集
      analyzers/
        keyword-analyzer.ts      -- 关键词机会分类
        pattern-learner.ts       -- 高表现模式提取
        weight-calculator.ts     -- 权重更新
      generators/
        content-generator.ts     -- AI 内容生成主流程
        outline-builder.ts       -- 大纲生成
        article-writer.ts        -- 正文生成
        schema-generator.ts      -- 结构化数据
        prompt-builder.ts        -- 动态 prompt（融合模式学习）
        quality-checker.ts       -- 质量检查
      publishers/
        wordpress-publisher.ts   -- WordPress REST API 发布
        sitemap-submitter.ts     -- GSC sitemap 提交
        publish-scheduler.ts     -- 发布节奏控制
      monitors/
        performance-tracker.ts   -- 文章表现追踪
        optimization-engine.ts   -- 优化决策引擎
  app/
    page.tsx                     -- 首页
    layout.tsx
    dashboard/
      page.tsx                   -- 总览
      clients/
        page.tsx                 -- 客户列表
        [id]/
          page.tsx               -- 客户详情
          keywords/page.tsx      -- 关键词面板
          articles/page.tsx      -- 文章管理
          performance/page.tsx   -- 数据表现
          settings/page.tsx      -- 客户配置
      content/
        review/page.tsx          -- 待审核文章
      system/
        settings/page.tsx        -- 系统配置
    api/
      clients/route.ts           -- 客户 CRUD
      seo/
        cron/
          collect/route.ts       -- 阶段一：数据采集
          analyze/route.ts       -- 阶段二：分析学习
          generate/route.ts      -- 阶段三：内容生成
          publish/route.ts       -- 阶段四：发布
          monitor/route.ts       -- 阶段五：监控反馈
```

---

## 九、Cron 调度

| 任务 | 频率 | 说明 |
|------|------|------|
| 数据采集 | 每周一 8:00 | 遍历所有活跃客户，拉取 GSC + GA4 |
| 分析学习 | 每周一 10:00 | 权重更新 + 模式提取 + 机会分类 |
| 内容生成 | 每周二-五 10:00 | 每天为每个客户生成 2-3 篇 |
| 内容发布 | 每周二-五 14:00 | 发布到客户 WordPress |
| 监控反馈 | 每周日 8:00 | 检查新文章表现，生成优化决策 |

---

## 十、外部服务

| 服务 | 用途 | 费用 |
|------|------|------|
| Google Search Console API | 搜索数据采集 | 免费 |
| Google Analytics 4 Data API | 用户行为数据 | 免费 |
| WordPress REST API | 文章发布 | 免费 |
| Claude API (第三方) | AI 内容生成 | 按量付费 |
| Supabase | 数据库 | 免费额度内 |
| Vercel | 部署 + Cron | 免费额度内 |

---

## 十一、实施路线图

### Phase 1（第1-2周）：基础 + 数据采集
- 数据库 V2 建表
- 客户管理 CRUD + 管理后台
- GSC API 接入 + 数据采集
- GA4 API 接入 + 数据采集

### Phase 2（第3-4周）：分析引擎
- 关键词机会分类算法
- 权重计算系统
- 模式学习引擎
- 数据面板

### Phase 3（第5-6周）：内容生成
- 动态 prompt 构建（融合模式学习）
- AI 内容生成（大纲→正文→质量检查）
- Schema / FAQ 自动生成
- 内链分析

### Phase 4（第7-8周）：发布 + 闭环
- WordPress REST API 发布
- 发布节奏控制
- 新文章监控
- 优化决策引擎
- Prompt 版本 A/B 对比

### Phase 5（持续）：优化迭代
- 根据真实数据调优算法参数
- 扩展客户数量
- 自动生成客户报告

---

## 十二、与传统 SEO 的本质区别

| | 传统 SEO | ML-SEO 系统 |
|---|---------|------------|
| 关键词选择 | 人工猜测 + 工具辅助 | Google 数据驱动，系统自动发现 |
| 内容生成 | 手写或低质量批量 | AI 深度生成，融合学到的高表现模式 |
| 优化方向 | 凭经验判断 | 权重算法自动进化 |
| 反馈周期 | 人工查看报表，周期长 | 系统自动采集分析，每周迭代 |
| 扩展性 | 受限于人力 | 多客户并行，自动化运行 |

**黑帽是对抗 Google，这套系统是和 Google 站在同一边。** Google 想给用户好内容，系统就生产好内容。Google 更新算法只会帮你，因为你的内容本来就是高质量的。
