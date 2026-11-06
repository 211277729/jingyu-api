package model

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetPricingIncludesOfficialPrice(t *testing.T) {
	resetPricingEndpointTestTables(t)

	previousModelRatio := ratio_setting.ModelRatio2JSONString()
	previousOfficial := ratio_setting.OfficialModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(previousModelRatio))
		require.NoError(t, ratio_setting.UpdateOfficialModelRatioByJSONString(previousOfficial))
	})

	insertPricingEndpointAbility(t, 911, "official-price-model")
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"official-price-model":1.5}`))
	require.NoError(
		t,
		ratio_setting.UpdateOfficialModelRatioByJSONString(`{
			"official-price-model": {
				"official_model_name": "official-price-model",
				"model_ratio": 5.0,
				"completion_ratio": 6.0,
				"cache_ratio": 0.1
			}
		}`),
	)

	priced := pricingByModel(GetPricing())["official-price-model"]
	require.NotNil(t, priced.OfficialPrice, "official price should be attached for token models")
	assert.Equal(t, 5.0, priced.OfficialPrice.ModelRatio)
	assert.Equal(t, 6.0, priced.OfficialPrice.CompletionRatio)
	require.NotNil(t, priced.OfficialPrice.CacheRatio)
	assert.Equal(t, 0.1, *priced.OfficialPrice.CacheRatio)
}
