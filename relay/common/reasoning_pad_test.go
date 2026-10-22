package common

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestShouldPadReasoningContent(t *testing.T) {
	tests := []struct {
		name      string
		setting   dto.ChannelSettings
		modelName string
		want      bool
	}{
		{
			name:      "switch off disables padding for any model",
			setting:   dto.ChannelSettings{PadReasoningContentModels: []string{"*deepseek*"}},
			modelName: "deepseek-v4.1-flash-free",
			want:      false,
		},
		{
			name:      "enabled without patterns covers every model",
			setting:   dto.ChannelSettings{PadReasoningContent: true},
			modelName: "any-model",
			want:      true,
		},
		{
			name: "glob pattern matches model name case-insensitively",
			setting: dto.ChannelSettings{
				PadReasoningContent:       true,
				PadReasoningContentModels: []string{"*deepseek*"},
			},
			modelName: "DeepSeek-v4.1-flash-free",
			want:      true,
		},
		{
			name: "glob pattern without match keeps padding off",
			setting: dto.ChannelSettings{
				PadReasoningContent:       true,
				PadReasoningContentModels: []string{"*deepseek*"},
			},
			modelName: "qwen3-coder-plus",
			want:      false,
		},
		{
			name: "exact pattern matches only the exact model",
			setting: dto.ChannelSettings{
				PadReasoningContent:       true,
				PadReasoningContentModels: []string{"deepseek-flash"},
			},
			modelName: "deepseek-flash-free",
			want:      false,
		},
		{
			name: "blank patterns are skipped instead of matching everything",
			setting: dto.ChannelSettings{
				PadReasoningContent:       true,
				PadReasoningContentModels: []string{"", " ", "*deepseek*"},
			},
			modelName: "qwen3-coder-plus",
			want:      false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, ShouldPadReasoningContent(tt.setting, tt.modelName))
		})
	}
}

func TestPadMissingReasoningContent(t *testing.T) {
	existing := "previous thoughts"
	marked := "" // explicit empty value must survive untouched

	t.Run("request without tools stays untouched", func(t *testing.T) {
		req := &dto.GeneralOpenAIRequest{Messages: []dto.Message{{Role: "assistant", ReasoningContent: nil}}}
		PadMissingReasoningContent(req)
		assert.Nil(t, req.Messages[0].ReasoningContent)
	})

	t.Run("nil request stays untouched", func(t *testing.T) {
		assert.NotPanics(t, func() { PadMissingReasoningContent(nil) })
	})

	t.Run("tools request fills only assistant turns missing the field", func(t *testing.T) {
		req := &dto.GeneralOpenAIRequest{
			Tools: []dto.ToolCallRequest{{}},
			Messages: []dto.Message{
				{Role: "system"},
				{Role: "user"},
				{Role: "assistant", ReasoningContent: &existing},
				{Role: "tool"},
				{Role: "assistant", ReasoningContent: nil},
				{Role: "assistant", ReasoningContent: &marked},
				{Role: "assistant", Content: ""},
			},
		}
		PadMissingReasoningContent(req)

		assert.Same(t, &existing, req.Messages[2].ReasoningContent, "existing value must be preserved")
		assert.Nil(t, req.Messages[0].ReasoningContent, "system turn must stay untouched")
		assert.Nil(t, req.Messages[1].ReasoningContent, "user turn must stay untouched")
		assert.Nil(t, req.Messages[3].ReasoningContent, "tool turn must stay untouched")
		require.NotNil(t, req.Messages[4].ReasoningContent, "missing field must be filled")
		assert.Empty(t, *req.Messages[4].ReasoningContent)
		assert.Same(t, &marked, req.Messages[5].ReasoningContent, "explicit empty value must not be replaced")
		assert.NotNil(t, req.Messages[6].ReasoningContent, "assistant content-only turn must also be filled")
		assert.Empty(t, *req.Messages[6].ReasoningContent)
	})
}

func TestPadMissingReasoningContentJSON(t *testing.T) {
	t.Run("request without tools returns the body unchanged", func(t *testing.T) {
		raw := []byte(`{"model":"deepseek-flash","messages":[{"role":"assistant"}]}`)
		padded, err := PadMissingReasoningContentJSON(raw)
		require.NoError(t, err)
		assert.Equal(t, string(raw), string(padded))
	})

	t.Run("tools request pads only assistant turns missing the field and keeps the rest intact", func(t *testing.T) {
		raw := []byte(`{"model":"deepseek-flash","tools":[{"type":"function"}],"extra":{"big":1234567890123456789},` +
			`"messages":[` +
			`{"role":"system","content":"hi"},` +
			`{"role":"assistant","reasoning_content":"kept"},` +
			`{"role":"assistant","content":"no reasoning"},` +
			`{"role":"assistant","content":"padded"},` +
			`{"role":"tool","content":"result"}]}`)

		padded, err := PadMissingReasoningContentJSON(raw)
		require.NoError(t, err)

		assert.Contains(t, string(padded), `{"role":"assistant","content":"padded","reasoning_content":""}`)
		assert.Contains(t, string(padded), `{"role":"assistant","content":"no reasoning","reasoning_content":""}`)
		assert.Contains(t, string(padded), `"big":1234567890123456789`, "unknown fields must be preserved byte-exactly")
		assert.NotContains(t, string(padded), `{"role":"tool","content":"result","reasoning_content"`, "tool turn must stay untouched")
		assert.NotContains(t, string(padded), `{"role":"system","content":"hi","reasoning_content"`, "system turn must stay untouched")
	})
}

func TestPadReasoningContentForJSON(t *testing.T) {
	raw := []byte(`{"model":"deepseek-v4.1-flash-free","tools":[{"type":"function"}],` +
		`"messages":[{"role":"assistant","content":"no reasoning"}]}`)

	t.Run("model outside the pattern scope keeps padding off", func(t *testing.T) {
		setting := dto.ChannelSettings{
			PadReasoningContent:       true,
			PadReasoningContentModels: []string{"*qwen*"},
		}
		padded, changed, err := PadReasoningContentForJSON(setting, raw)
		require.NoError(t, err)
		assert.False(t, changed)
		assert.Equal(t, string(raw), string(padded))
	})

	t.Run("model inside the pattern scope gets padded", func(t *testing.T) {
		setting := dto.ChannelSettings{
			PadReasoningContent:       true,
			PadReasoningContentModels: []string{"*deepseek*"},
		}
		padded, changed, err := PadReasoningContentForJSON(setting, raw)
		require.NoError(t, err)
		assert.True(t, changed)
		assert.Contains(t, string(padded), `"reasoning_content":""`)
	})

	t.Run("switch off ignores body entirely", func(t *testing.T) {
		padded, changed, err := PadReasoningContentForJSON(dto.ChannelSettings{}, raw)
		require.NoError(t, err)
		assert.False(t, changed)
		assert.Equal(t, string(raw), string(padded))
	})
}

func TestPadReasoningContentJSONDoesNotRewriteUnrelatedMessages(t *testing.T) {
	raw := []byte(`{"model":"m","tools":[{"type":"function"}],"messages":[` +
		`{"role":"user","content":[{"type":"text","text":"a"},{"type":"image_url","image_url":{"url":"u"}}]},` +
		`{"role":"assistant","content":"ok"}]}`)
	padded, err := PadMissingReasoningContentJSON(raw)
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(string(padded), `{"model":"m"`), "non-message fields stay in place")
	assert.Contains(t, string(padded), `"role":"user","content":[{"type":"text","text":"a"},{"type":"image_url","image_url":{"url":"u"}}]`)
}
