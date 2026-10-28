package service

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// 本文件实现「隐藏模型映射」（运营设置 hide_mapped_model_name）：
// 命中渠道模型映射的请求，返回客户端的响应 JSON 里 model / modelVersion
// 字段改写为请求模型名，下游无法从响应体回推出上游模型；真实路由仅
// 记录在管理员使用日志的 other.admin_info 中（见 service/log_info_generate.go）。
//
// 收口点只挂三处，均为单行调用，便于与上游更新合并：
//   - service/http.go IOCopyBytesGracefully（非流式回写）
//   - relay/helper/common.go StringData（SSE 数据帧唯一出口，ObjectData、
//     ResponseChunkData 等最终都通过它或同参写入）
//   - relay/helper/common.go ResponseChunkData（Responses API 事件帧）

// relayInfoForMask 从请求 context 取回 genBaseRelayInfo 挂载的 RelayInfo。
// 非 relay 写入路径（任务回调、管理后台等）拿不到 info，保持原样返回。
func relayInfoForMask(c *gin.Context) *relaycommon.RelayInfo {
	if c == nil {
		return nil
	}
	info, ok := common.GetContextKeyType[*relaycommon.RelayInfo](c, constant.ContextKeyRelayInfo)
	if !ok {
		return nil
	}
	return info
}

// MaskMappedResponseModel 按设置改写非流式响应体中的模型名字段。
func MaskMappedResponseModel(c *gin.Context, data []byte) []byte {
	if !operation_setting.GetGeneralSetting().HideMappedModelName {
		return data
	}
	info := relayInfoForMask(c)
	if info == nil || !info.IsModelMapped || info.OriginModelName == "" {
		return data
	}
	rewritten, changed := maskModelFields(data, info.OriginModelName)
	if !changed {
		return data
	}
	logger.LogDebug(c, "response model rewritten to requested name %s", info.OriginModelName)
	return rewritten
}

// MaskMappedResponseModelString 是 MaskMappedResponseModel 的字符串包装，
// 供 SSE 帧写入点使用。
func MaskMappedResponseModelString(c *gin.Context, str string) string {
	// 快速路径：[DONE] 等非 JSON 帧直接返回，不做解析开销。
	if !gjson.Valid(str) {
		return str
	}
	if !operation_setting.GetGeneralSetting().HideMappedModelName {
		return str
	}
	info := relayInfoForMask(c)
	if info == nil || !info.IsModelMapped || info.OriginModelName == "" {
		return str
	}
	rewritten, changed := maskModelFields([]byte(str), info.OriginModelName)
	if !changed {
		return str
	}
	return string(rewritten)
}

// maskModelFields 把 JSON 对象顶层的 model（以及 Gemini 的 modelVersion）
// 字符串字段替换为 requestedName，其余字节保持 gjson/sjson 原样序列化。
func maskModelFields(data []byte, requestedName string) ([]byte, bool) {
	changed := false
	if modelField := gjson.GetBytes(data, "model"); modelField.Type == gjson.String && modelField.String() != "" {
		next, err := sjson.SetBytes(data, "model", requestedName)
		if err != nil {
			return data, false
		}
		data = next
		changed = true
	}
	if version := gjson.GetBytes(data, "modelVersion"); version.Type == gjson.String && version.String() != "" && version.String() != requestedName {
		next, err := sjson.SetBytes(data, "modelVersion", requestedName)
		if err != nil {
			return data, changed
		}
		data = next
		changed = true
	}
	return data, changed
}
