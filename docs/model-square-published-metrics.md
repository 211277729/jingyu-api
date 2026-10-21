# 模型广场对外展示口径（已实现 + 待办）

> 记录模型广场/模型详情页对外展示的延迟、吞吐、成功率的口径设计、实现位置、已知限制，以及后续要改的项（成功率按档、速度口径再调整）。
>
> 最后更新：2026-10-22

## 一、背景

中转上游（尤其高峰期）的真实延迟会被两件事拉高：

1. **输入规模**：agent 类客户端每次带 13–28 万 token 上下文，首字本身就要 5–40 秒；普通对话（≤8K）只有 2–3 秒。
2. **上游排队**：同一模型在高峰期逐小时波动可达 2.4s ↔ 47.7s。

直接展示"全量平均"会让新用户看到 10–20 秒的数字，与"发一句话多久出字"的实际体验不符。因此增加了**后台可配的对外口径**：管理员选择对外展示哪一类请求的统计，前端只显示最终数字。

## 二、配置项（系统设置 → 监控与告警 → 性能指标）

| 配置键 | 含义 | 默认值 |
| --- | --- | --- |
| `perf_metrics_setting.published_bucket` | 对外口径：`all` 全部请求 / `short` 标准对话 | `short` |
| `perf_metrics_setting.published_prompt_token_limit` | 标准对话档的输入 token 上限 | `8000` |
| `perf_metrics_setting.published_note` | 展示在延迟旁的口径说明；留空用内置多语言文案 | 空 |
| `perf_metrics_setting.published_min_samples` | 档内样本不足时的回退阈值（仅数据库/API 可改） | `20` |

> 口径是全站统一的，不区分管理员与普通访客。

## 三、口径定义（当前实现）

| 展示数字 | 口径 | 取值来源 |
| --- | --- | --- |
| 模型广场卡片：延迟 `avg_latency_ms` | 档内 | `logs` 现算 |
| 模型广场卡片：吞吐 `avg_tps` | **全量**（仅成功且测到首字的流式请求） | `perf_metrics` |
| 模型广场卡片：成功率 `success_rate` | **全量** | `perf_metrics` |
| 模型详情：延迟 / 首字 `avg_ttft_ms` | 档内 | `logs` 现算 |
| 模型详情：吞吐 `avg_tps` | **全量**（仅成功且测到首字的流式请求） | `perf_metrics` |
| 模型详情：分组行（延迟 / 首字） | 档内（样本不足回落全量） | `logs` 现算 |
| 模型详情：分组行吞吐 | **全量** | `perf_metrics` |
| 模型详情：延迟趋势图 | 档内（无样本的小时被丢弃） | `logs` 现算 |
| 模型详情：成功率（汇总/分组/趋势） | **全量** | `perf_metrics` |

**为什么成功率没按档**：失败请求写在错误日志（`type=5`）里，而错误日志在写入时没有记录输入规模（`logs.prompt_tokens = 0`）。若强行套用档位过滤，会把失败请求全部排除，导致成功率虚高。见"五、待办"。

**为什么吞吐不按档（2026-10-22 修正）**：档内是"标准对话"（≤8K 输入）的小请求，而真实流量是 agent 的长上下文请求（13–28 万 token）。小请求每次只吐几百 token，首字后的固定开销（收尾、缓冲、结算）被摊到很少的 token 上，**测出来的 t/s 天然只有大请求的一半左右**。实测对照（2026-10-21 线上库，24 小时窗口）：

| 模型 | 档内样本数 | 档内 t/s | 全量 t/s |
| --- | --- | --- | --- |
| `deepseek/deepseek-v4.1-flash` | 44 | 66.61 | 185.80 |
| `deepseek/deepseek-v4-pro` | 8 | 82.91 | 102.19 |

所以吞吐改回全量口径：延迟仍按档（长上下文的首字等待确实会让新用户看到 10–20 秒），速度按真实流量给。

**吞吐的样本条件**：`perf_metrics` 只累计**成功且测到首字的流式请求**。非流式请求没有首字，其耗时覆盖整个来回（含首字等待），混进来会把速度整体压低。

## 四、实现位置

| 文件 | 作用 |
| --- | --- |
| `setting/perf_metrics_setting/config.go` | 4 个配置项、`PublishedScope()` / `MinSamples()` / `Note()` |
| `model/log_prompt_scope.go` | 从 `logs` 现算的聚合：按模型 / 按分组 / 按小时；含跨库的 `frt` 取值（PostgreSQL / MySQL / SQLite 三分支 + `{%` 守卫） |
| `pkg/perf_metrics/scope.go` | 把档内延迟覆盖到发布结果（吞吐保持全量）；`metrics_scope` 随响应返回 |
| `pkg/perf_metrics/types.go` | `MetricsScope`、`QueryResult.MetricsScope`、`SummaryAllResult.MetricsScope` |
| `controller/perf_metrics.go` | 两个接口按同一口径；5 分钟进程内缓存（公开页面不扫日志窗口） |
| `web/src/features/performance-metrics/components/metrics-scope-note.tsx` | 口径说明组件（模型广场、模型详情共用） |
| `web/src/features/pricing/components/model-card-grid.tsx` | 卡片区渲染说明（`px-4`，与卡片内文同一条左竖线） |
| `web/src/features/pricing/components/model-details-performance.tsx` | 详情页渲染说明 |
| `web/src/features/system-settings/integrations/monitoring-settings-section.tsx` | 后台设置面板字段 |

**设计要点**：口径从 `logs` 现算，**不新增表、不新增写入**，历史数据即时生效；只有 `type=2`（消费日志）参与，`prompt_tokens <= 阈值`。日志库若配置为 ClickHouse，该聚合不受支持，会自动回落到全量口径（服务端记一条 `prompt scoped stats unavailable` 日志）。

## 五、待办

### 5.1 成功率按档（优先级高）

**目标**：卡片与详情页的成功率也按所选口径统计。

**做法**：

1. 写错误日志时带上输入规模。`logs.prompt_tokens` 列已存在（错误日志当前写 0），**不需要改表结构**；在 `ProcessChannelError` → `RecordErrorLog` 链路上把 `relayInfo.GetEstimatePromptTokens()` 写进去。
2. 聚合口径改为：`档内成功率 = 档内消费条数 / (档内消费条数 + 档内失败条数)`。
3. 历史数据的处理需先决定（三选一）：
   - 只统计带规模的失败（老的失败被忽略，成功率偏乐观）；
   - 老的失败一律计入"全量"、不计入任何档位（本次推荐）；
   - 老的失败按"未知档"单独展示。
4. 影响面：卡片成功率、详情页分组成功率、成功率曲线（`series[].success_rate`）。

**工作量估计**：后端 2–3 个文件 + 1 个测试；前端无需改动（数字来源变了但字段不变）。

### 5.2 速度口径可能再调整（待定）

当前延迟 = 档内平均整条请求耗时（`logs.use_time`），吞吐 = 全量成功流式请求的输出 token ÷ 生成窗口（毫秒）。后续可能改成：

- 用 **P50/中位数** 代替均值（均值受长尾影响大，高峰期一个 47s 的请求就能拉高一个小时的数字）；
- 区分"首字速度"和"生成速度"两个指标分开展示；
- 窗口从固定 24h 改为可配（例如近 6h / 近 7 天）；
- 分档粒度从"短对话/全部"扩展为多档（≤8K / 8–32K / >32K）。

> 注意：P50 需要按请求留样本（当前 `perf_metrics` 只存小时聚合，没有分布），要么改成从 `logs` 现算百分位，要么新增直方图存储。

### 5.3 其他已知限制

- `published_min_samples` 未在设置面板暴露，只能通过设置 API 或数据库修改。
- 档内某个分组样本不足时，该分组回落到全量数字（不同分组可能口径不一致）。
- MySQL / SQLite 的 `frt` JSON 取值分支目前只有 SQLite 单测覆盖；生产（PostgreSQL）需按下方 SQL 自行核对一次。
- 口径变化会让历史曲线出现台阶：切换 `published_bucket` 前后不可直接比较。

## 六、验证方式

```sql
-- 短对话档 vs 全量（窗口按最新一条消费日志往前 24 小时）
SELECT CASE WHEN prompt_tokens <= 8000 THEN 'short' ELSE 'rest' END AS bucket,
       COUNT(*) AS n,
       ROUND(AVG(use_time) * 1000) AS avg_latency_ms,
       ROUND(AVG(CASE WHEN (other::json->>'frt')::numeric > 0
                      THEN (other::json->>'frt')::numeric END)) AS avg_ttft_ms
FROM logs
WHERE type = 2
  AND created_at >= (SELECT MAX(created_at) FROM logs WHERE type = 2) - 86400
GROUP BY 1;
```

接口侧对照：`GET /api/perf-metrics/summary?hours=24` 的 `data.metrics_scope` 应等于配置的档位，且 `data.summary.avg_latency_ms` 应与上面 `short` 行的 `avg_latency_ms` 一致（样本量足够时）。

对外吞吐来自预聚合表，不受档位限制：

```sql
SELECT model_name,
       SUM(output_tokens) AS out_tok,
       SUM(generation_ms) AS gen_ms,
       ROUND(SUM(output_tokens)::numeric / NULLIF(SUM(generation_ms) / 1000.0, 0), 2) AS tps
FROM perf_metrics
WHERE bucket_ts >= (SELECT MAX(bucket_ts) FROM perf_metrics) - 86400
GROUP BY model_name
ORDER BY tps DESC;
```

实测参考（2026-10-18，200 小时窗口）：

| 口径 | 样本数 | 平均延迟 |
| --- | --- | --- |
| 短对话档（≤8K） | 43 | 2,930ms |
| 全量 | 470 | 9,432ms |

## 七、复现/回归测试

- `model/log_prompt_scope_test.go`：SQLite 真引擎验证过滤条件、`frt` 取值、小时桶、按模型收窄。
- `pkg/perf_metrics/metrics_test.go`：档内延迟覆盖、吞吐保持全量、样本不足回落、成功率保持全量、吞吐桶只计成功且测到首字的流式请求。
- `web/src/features/performance-metrics/__tests__/metrics-scope-note.test.tsx`：说明文案的渲染与布局缩进。
