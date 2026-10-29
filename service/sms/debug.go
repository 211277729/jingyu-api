package sms

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
)

// DebugSender 本地调试用：不发送真实短信，把验证码打印到运行日志。
// 仅在管理端把短信服务商显式选为 debug 时生效。
type DebugSender struct{}

func (d *DebugSender) Send(phone string, code string) error {
	common.SysLog(common.LogText(
		"[SMS DEBUG] phone=%s code=%s （debug 服务商不发送真实短信，验证码仅输出到日志）",
		MaskPhone(phone), code,
	))
	fmt.Printf("[SMS DEBUG] phone=%s code=%s\n", MaskPhone(phone), code)
	return nil
}
