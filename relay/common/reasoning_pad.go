package common

import (
	"path"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// DeepSeek thinking mode requires `reasoning_content` on every assistant turn
// when the request carries `tools`. Agent clients often leave the field absent
// (turns that produced no thinking, lost caches, cross-format conversions), and
// the upstream then rejects the whole multi-turn request with
// "The `reasoning_content` in the thinking mode must be passed back to the
// API.". These helpers fill the missing field per channel opt-in; an explicit
// empty string satisfies the upstream presence check without inventing
// reasoning content.

// ShouldPadReasoningContent reports whether the channel setting enables
// padding for the given upstream model name. Without model patterns every
// model on the channel is covered; with patterns, padding applies when any
// glob (`*`, `?`, case-insensitive) matches the model name.
func ShouldPadReasoningContent(setting dto.ChannelSettings, modelName string) bool {
	if !setting.PadReasoningContent {
		return false
	}
	if len(setting.PadReasoningContentModels) == 0 {
		return true
	}
	name := strings.ToLower(modelName)
	for _, pattern := range setting.PadReasoningContentModels {
		pattern = strings.ToLower(strings.TrimSpace(pattern))
		if pattern == "" {
			continue
		}
		if ok, err := path.Match(pattern, name); err == nil && ok {
			return true
		}
	}
	return false
}

// PadMissingReasoningContent pads assistant history messages that lack
// `reasoning_content` on a chat-completions request that carries tools.
// Messages already carrying the field (including explicit empty values) are
// passed through untouched.
func PadMissingReasoningContent(req *dto.GeneralOpenAIRequest) {
	if req == nil || len(req.Tools) == 0 {
		return
	}
	empty := ""
	for i := range req.Messages {
		m := &req.Messages[i]
		if m.Role != "assistant" || m.ReasoningContent != nil {
			continue
		}
		m.ReasoningContent = &empty
	}
}

// PadMissingReasoningContentJSON is the raw-JSON variant used on passthrough
// bodies. It edits the body in place via gjson/sjson so unknown fields and
// number precision outside `messages` are preserved byte-for-byte.
func PadMissingReasoningContentJSON(jsonData []byte) ([]byte, error) {
	tools := gjson.GetBytes(jsonData, "tools")
	if !tools.Exists() || !tools.IsArray() || len(tools.Array()) == 0 {
		return jsonData, nil
	}
	messages := gjson.GetBytes(jsonData, "messages")
	if !messages.Exists() || !messages.IsArray() {
		return jsonData, nil
	}
	result := jsonData
	for i, msg := range messages.Array() {
		if msg.Get("role").String() != "assistant" {
			continue
		}
		if msg.Get("reasoning_content").Exists() {
			continue
		}
		padded, err := sjson.SetBytes(result, "messages."+strconv.Itoa(i)+".reasoning_content", "")
		if err != nil {
			return result, err
		}
		result = padded
	}
	return result, nil
}

// PadReasoningContentForJSON applies channel-scoped reasoning padding to a raw
// chat-completions request body. The model name is read from the body's
// `model` field (the upstream-mapped name the channel will actually serve).
// The input slice is returned unchanged when padding is disabled or nothing
// needs padding.
func PadReasoningContentForJSON(setting dto.ChannelSettings, rawBody []byte) ([]byte, bool, error) {
	if !ShouldPadReasoningContent(setting, gjson.GetBytes(rawBody, "model").String()) {
		return rawBody, false, nil
	}
	padded, err := PadMissingReasoningContentJSON(rawBody)
	if err != nil {
		return rawBody, false, err
	}
	return padded, len(padded) != len(rawBody), nil
}
