package common

import "strings"

// RelayRequestPathForChannel maps the playground's internal /pg prefix onto
// the public /v1 namespace, mirroring the RequestURLPath normalization applied
// when building RelayInfo. Advanced Custom route tables only declare /v1
// endpoints, so every place that matches a request path against a channel
// route (channel selection filters, request conversion) must compare the
// normalized path — otherwise playground requests fail with "no available
// channel" or "does not support request path".
func RelayRequestPathForChannel(path string) string {
	if strings.HasPrefix(path, "/pg") {
		return "/v1" + strings.TrimPrefix(path, "/pg")
	}
	return path
}
