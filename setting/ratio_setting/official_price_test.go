package ratio_setting

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOfficialModelRatioRoundTrip(t *testing.T) {
	previous := OfficialModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, UpdateOfficialModelRatioByJSONString(previous))
	})

	cacheRatio := 0.1
	createCacheRatio := 1.25
	source := map[string]OfficialPriceEntry{
		"gpt-5.6-luna": {
			OfficialModelName: "gpt-5.6-luna",
			ModelRatio:        1.25,
			CompletionRatio:   8.0,
			CacheRatio:        &cacheRatio,
			CreateCacheRatio:  &createCacheRatio,
		},
		"my-claude-alias": {
			OfficialModelName: "claude-opus-4-8",
			ModelRatio:        7.5,
			CompletionRatio:   5.0,
		},
	}

	raw, err := json.Marshal(source)
	require.NoError(t, err)
	require.NoError(t, UpdateOfficialModelRatioByJSONString(string(raw)))

	entry, ok := GetOfficialPrice("gpt-5.6-luna")
	require.True(t, ok)
	assert.Equal(t, 1.25, entry.ModelRatio)
	assert.Equal(t, 8.0, entry.CompletionRatio)
	require.NotNil(t, entry.CacheRatio)
	assert.Equal(t, 0.1, *entry.CacheRatio)

	// 人工映射:站点模型名与官方模型名不同
	entry, ok = GetOfficialPrice("my-claude-alias")
	require.True(t, ok)
	assert.Equal(t, "claude-opus-4-8", entry.OfficialModelName)
	assert.Nil(t, entry.CacheRatio)

	_, ok = GetOfficialPrice("not-exist")
	assert.False(t, ok)

	copy := GetOfficialModelRatioCopy()
	assert.Len(t, copy, 2)
}

func TestOfficialModelRatioInvalidJSON(t *testing.T) {
	err := UpdateOfficialModelRatioByJSONString(`{invalid`)
	assert.Error(t, err)
	// 非对象 JSON 也应报错
	err = UpdateOfficialModelRatioByJSONString(`[1,2,3]`)
	assert.Error(t, err)
}

func TestOfficialModelRatioEmptyReset(t *testing.T) {
	previous := OfficialModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, UpdateOfficialModelRatioByJSONString(previous))
	})

	require.NoError(t, UpdateOfficialModelRatioByJSONString(``))
	assert.Empty(t, GetOfficialModelRatioCopy())
	require.NoError(t, UpdateOfficialModelRatioByJSONString(`{}`))
	assert.Empty(t, GetOfficialModelRatioCopy())
}
