package service

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func maskTestContext(t *testing.T, mapped bool) *gin.Context {
	t.Helper()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		OriginModelName: "requested",
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "mapped", IsModelMapped: mapped},
	}
	common.SetContextKey(c, constant.ContextKeyRelayInfo, info)
	return c
}

func maskFixture(t *testing.T) func() {
	t.Helper()
	previous := operation_setting.GetGeneralSetting().HideMappedModelName
	operation_setting.GetGeneralSetting().HideMappedModelName = true
	return func() {
		operation_setting.GetGeneralSetting().HideMappedModelName = previous
	}
}

func TestMaskMappedResponseModelRewritesBody(t *testing.T) {
	restore := maskFixture(t)
	defer restore()

	c := maskTestContext(t, true)
	data := []byte(`{"id":"1","model":"mapped","usage":{"total":1},"model_version_meta":"keep"}`)
	got := MaskMappedResponseModel(c, data)

	var out map[string]any
	require.NoError(t, json.Unmarshal(got, &out))
	assert.Equal(t, "requested", out["model"])
	assert.Equal(t, float64(1), out["usage"].(map[string]any)["total"])
}

func TestMaskMappedResponseModelRewritesModelVersion(t *testing.T) {
	restore := maskFixture(t)
	defer restore()

	c := maskTestContext(t, true)
	got := MaskMappedResponseModel(c, []byte(`{"model":"mapped","modelVersion":"mapped-2026"}`))
	assert.JSONEq(t, `{"model":"requested","modelVersion":"requested"}`, string(got))
}

func TestMaskMappedResponseModelStrWithoutFields(t *testing.T) {
	restore := maskFixture(t)
	defer restore()

	c := maskTestContext(t, true)
	got := MaskMappedResponseModel(c, []byte(`{"id":"1"}`))
	assert.JSONEq(t, `{"id":"1"}`, string(got))
	assert.Equal(t, "[DONE]", MaskMappedResponseModelString(c, "[DONE]"))
}

func TestMaskMappedResponseModelSkipsWhenNotMapped(t *testing.T) {
	restore := maskFixture(t)
	defer restore()

	// 未命中映射（IsModelMapped=false）
	got := MaskMappedResponseModel(maskTestContext(t, false), []byte(`{"model":"mapped"}`))
	assert.JSONEq(t, `{"model":"mapped"}`, string(got))

	// 无 RelayInfo 的非 relay 写入路径
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	assert.Equal(t, `{"model":"mapped"}`, MaskMappedResponseModelString(c, `{"model":"mapped"}`))

	// 设置关闭
	operation_setting.GetGeneralSetting().HideMappedModelName = false
	defer func() { operation_setting.GetGeneralSetting().HideMappedModelName = true }()
	got = MaskMappedResponseModel(maskTestContext(t, true), []byte(`{"model":"mapped"}`))
	assert.JSONEq(t, `{"model":"mapped"}`, string(got))
}

func TestMaskMappedResponseModelString(t *testing.T) {
	restore := maskFixture(t)
	defer restore()

	c := maskTestContext(t, true)
	frame := `{"id":"x","model":"mapped","choices":[{"delta":{"content":"hi"}}]}`
	got := MaskMappedResponseModelString(c, frame)
	assert.JSONEq(t, `{"id":"x","model":"requested","choices":[{"delta":{"content":"hi"}}]}`, got)
}
