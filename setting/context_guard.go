package setting

// 超长上下文守卫（ContextLengthGuard）配置。
//
// 目标用户是不懂技术的年长客户：当请求的输入 token 估算超过阈值时，
// 直接拦截并返回教他们输入 /compact 压缩对话的中文文案，
// 避免超大请求挤占网关带宽、拖慢其他用户。

// ContextLengthGuardMaxTokens 输入 token 估算上限，0 表示关闭守卫。
var ContextLengthGuardMaxTokens = 0

// ContextLengthGuardIdleMinutes 活跃窗口（分钟）：窗口内该用户发过请求即视为
// 任务进行中，超长请求也放行，避免打断长任务；冷启动（超过窗口未请求）才拦截。
var ContextLengthGuardIdleMinutes = 10

// ContextLengthGuardExemptLimit 连续超长放行上限：活跃窗口只看「最近有没有请求」，
// 一个不停活跃的用户可以永远不压缩。该值限制同一用户**连续**放行的超长请求数，
// 期间只要出现一条不超长的请求（即压缩成功后的正常请求）计数就清零。达到上限后
// 即使在活跃窗口内也拦截，拦截后复用活跃窗口作为宽限期（压缩请求能放行）。
// 0 表示不限制，保持纯活跃窗口行为。
var ContextLengthGuardExemptLimit = 0

// ContextLengthGuardMessage 自定义拦截文案，留空使用内置 i18n 文案。
// 支持 {{.Tokens}}（本次估算）与 {{.Max}}（上限）占位符，Go text/template 语法。
var ContextLengthGuardMessage = ""
