package setting

import "github.com/QuantumNous/new-api/common"

var (
	WxPayEnabled      bool
	WxPayAppId        string
	WxPayMchId        string
	WxPayMchApiV3Key  string
	WxPaySerialNo     string
	WxPayPrivateKey   string
	WxPayNotifyUrl    string
	WxPayUnitPrice    float64 = 1.0
	WxPayMinTopUp     int     = 1
	WxPayCurrency     string  = "CNY"
	WxPayDescription  string  = "Balance top-up"
	WxPayCallbackCert string
)

// GetWxPayCurrency returns the configured settlement currency. WeChat Pay
// official gateway only settles in CNY for Native orders.
func GetWxPayCurrency() string {
	if WxPayCurrency != "" {
		return WxPayCurrency
	}
	return "CNY"
}

// GetWxPayDescription returns the order description shown to the payer.
func GetWxPayDescription() string {
	if WxPayDescription != "" {
		return WxPayDescription
	}
	appName := common.SystemName
	if appName != "" {
		return appName + " balance top-up"
	}
	return "Balance top-up"
}

// GetWxPayCallbackCert returns the downloaded WeChat Pay platform certificate
// used to verify webhook signatures. Blank means the SDK auto-downloads the
// certificate through the platform certificate downloader.
func GetWxPayCallbackCert() string {
	return WxPayCallbackCert
}
