# 高级自定义渠道改进备忘：/v1/responses 入口支持 Claude 模型（Responses → Anthropic Messages）

> 记录日期：2026-10-22　|　状态：暂不实施，先用 chat 入口分流规则
> 仓库：jingyu-api（基于 QuantumNous/new-api）

## 背景与目标

上游站点对 Claude 系模型只开放 Anthropic 原生协议（`/provider/v1/messages`，Anthropic Messages 格式）。
已在「高级自定义」渠道用两条路由解决 chat 入口：

- `/v1/chat/completions` + `re:^claude-.*` → upstream `/provider/v1/messages`，converter `openai_chat_completions_to_anthropic_messages`
- `/v1/chat/completions` + models 留空（兜底，放最后）→ upstream `/v1/chat/completions`，converter `none`

遗留缺口：客户如果用 **OpenAI Responses 格式（`/v1/responses`）调 Claude 模型**，目前配不出来——
高级自定义的 `/v1/responses` 入口 converter 白名单没有 Responses→Anthropic 的转换器。

## 关键结论：转换器代码上游已写好，只差「接线」

`relaykit/relayconvert` 已注册 `openai_responses_to_claude_messages`（`request_registry.go:83`），实现完整、有测试、
正式 Claude 类型渠道走 Responses 时用的就是这套（`relay/channel/claude/adaptor.go` 的 `ConvertOpenAIResponsesRequest`
与 `DoResponse` → `ClaudeResponsesStreamHandler`）。缺口只在高级自定义层三处未放行。

## 实施清单（预计半天，核心改动 30–50 行）

1. **白名单放行** `relaykit/dto/channel_settings.go`
   - `validateAdvancedCustomConverterPath` 中 `/v1/responses` 的 switch 分支，
     增加 `relayconvert.ConverterOpenAIResponsesToClaudeMessages`（"openai_responses_to_claude_messages"）。
2. **请求转换** `relay/channel/advancedcustom/adaptor.go` → `ConvertOpenAIResponsesRequest`（现 106–129 行）
   - 加 case：`service.ConvertRequestByID(c, info, converter, request)`，断言产出 `*dto.ClaudeRequest`。
3. **响应分发** 同文件 `DoResponse`（现 284–319 行）
   - 加 case 复用 `a.claudeAdaptor.DoResponse(c, resp, info)`（其内部按 `RelayFormatOpenAIResponses`
     自动走 `ClaudeResponsesStreamHandler` / `ClaudeHandler`，与正式 Claude 渠道同路径）。
4. **请求头** 同文件 `shouldApplyClaudeHeaders`（现 492 行）
   - 条件加上该 converter，使自动补 `anthropic-version` 头。
   - 注意：若上游 Claude 端要 `x-api-key` 而非 Bearer，在路由 `auth: {type: header, name: x-api-key, value: {api_key}}` 配。
5. **测试** 扩展 `relay/channel/advancedcustom/adaptor_test.go`（URL 拼装 + 请求/响应转换用例）。
6. **前端**（需先确认是否枚举校验）`web/src/features/channels/` 高级自定义路由表单的 converter 选项加新值。

## 配置形态（实现后）

- `incoming_path`: `/v1/responses`
- `models`: `re:^claude-.*`
- `upstream_path`: `/provider/v1/messages`
- `converter`: `openai_responses_to_claude_messages`

硬规则不变：同路径下兜底路由（models 留空）放最后；同路径模型列表不得交叉；带 converter 的路由不能开透传请求体。

## 验证步骤

```powershell
# relaykit 模块独立性（AGENTS.md 硬约束）
cd D:\path\to\jingyu-api\relaykit
GOWORK=off go build ./...
GOWORK=off go test ./relayconvert/...

# 根模块
cd ..
go build ./...
go test ./relay/channel/advancedcustom/ ./relaykit/dto/
```

前端若有改动：`web/` 下 `bun run build`（dist 被 go:embed，必须重新构建再编译 Go 二进制）。
运行时验证：保存路由 → 渠道测试 → curl 用 Responses 格式发 `claude-haiku-5.5`，期望 200。

## 备选方案

- 给 new-api 上游提 issue/PR（合理功能缺口，转换器已存在，只差白名单收编；走 AGENTS.md 的 issue/PR 规范流程）。
- 长期看若客户无 Responses 格式调 Claude 的需求，可维持现状（chat 入口已闭环）。
