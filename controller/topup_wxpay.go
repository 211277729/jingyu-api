package controller

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rsa"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/wechatpay-apiv3/wechatpay-go/core"
	"github.com/wechatpay-apiv3/wechatpay-go/core/auth/verifiers"
	"github.com/wechatpay-apiv3/wechatpay-go/core/downloader"
	"github.com/wechatpay-apiv3/wechatpay-go/core/notify"
	"github.com/wechatpay-apiv3/wechatpay-go/core/option"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments"
	native "github.com/wechatpay-apiv3/wechatpay-go/services/payments/native"
	"github.com/wechatpay-apiv3/wechatpay-go/utils"
)

// getWxPayClient builds a WeChat Pay APIv3 client from the configured merchant
// credentials. The certificate downloader keeps platform certificates fresh so
// webhook signatures can be verified without manual certificate rotation.
func getWxPayClient() (*core.Client, error) {
	privateKey, err := getWxPayPrivateKey()
	if err != nil {
		return nil, err
	}
	ctx := context.Background()
	return core.NewClient(ctx,
		option.WithWechatPayAutoAuthCipher(
			setting.WxPayMchId,
			setting.WxPaySerialNo,
			privateKey,
			setting.WxPayMchApiV3Key,
		),
	)
}

func getWxPayPrivateKey() (*rsa.PrivateKey, error) {
	if setting.WxPayPrivateKey == "" {
		return nil, errors.New("merchant private key is not configured")
	}
	return utils.LoadPrivateKey(setting.WxPayPrivateKey)
}

// getWxPayMoney converts the user-facing amount to CNY for WeChat Pay.
func getWxPayMoney(amount int64, group string) float64 {
	dAmount := decimal.NewFromInt(amount)
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount = dAmount.Div(decimal.NewFromFloat(common.QuotaPerUnit))
	}

	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}

	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(amount)]; ok {
		if ds > 0 {
			discount = ds
		}
	}

	return dAmount.
		Mul(decimal.NewFromFloat(setting.WxPayUnitPrice)).
		Mul(decimal.NewFromFloat(topupGroupRatio)).
		Mul(decimal.NewFromFloat(discount)).
		InexactFloat64()
}

func getWxPayMinTopup() int64 {
	minTopup := setting.WxPayMinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dMinTopup := decimal.NewFromInt(int64(minTopup))
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		quota, err := common.WalletQuotaFromDecimalStrict(dMinTopup.Mul(dQuotaPerUnit))
		if err != nil {
			return common.MaxWalletQuota
		}
		minTopup = int(quota)
	}
	return int64(minTopup)
}

func RequestWxPayAmount(c *gin.Context) {
	var req AmountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}

	minTopup := getWxPayMinTopup()
	if req.Amount < minTopup {
		paymentError(c, common.NewMessage("Top-up amount cannot be less than {{min}}", map[string]any{"min": minTopup}))
		return
	}
	id := c.GetInt("id")
	if rejectInvalidTopUpQuota(c, id, req.Amount) {
		return
	}

	group, err := model.GetUserGroup(id, true)
	if err != nil {
		paymentError(c, common.NewMessage("Failed to get the user group"))
		return
	}

	payMoney := getWxPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		paymentError(c, common.NewMessage("Payment amount is too low"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

// RequestWxPayPay creates a WeChat Pay Native order and returns the QR code
// URL (code_url). The user scans the QR code with WeChat to pay.
func RequestWxPayPay(c *gin.Context) {
	if !isWxPayTopUpEnabled() {
		paymentError(c, common.NewMessage("WeChat Pay is not enabled"))
		return
	}

	var req AmountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}
	minTopup := getWxPayMinTopup()
	if req.Amount < minTopup {
		paymentError(c, common.NewMessage("Top-up amount cannot be less than {{min}}", map[string]any{"min": minTopup}))
		return
	}
	id := c.GetInt("id")
	if rejectInvalidTopUpQuota(c, id, req.Amount) {
		return
	}

	group, _ := model.GetUserGroup(id, true)
	payMoney := getWxPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		paymentError(c, common.NewMessage("Payment amount is too low"))
		return
	}

	// 微信商户订单号仅允许字母数字-_|*，6-32 位
	tradeNo := fmt.Sprintf("WX%d-%s", id, common.GetRandomString(10))
	if len(tradeNo) > 32 {
		tradeNo = tradeNo[:32]
	}

	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = max(decimal.NewFromInt(req.Amount).Div(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart(), 1)
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodWxPay,
		PaymentProvider: model.PaymentProviderWxPay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("WxPay failed to create top-up order user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		paymentError(c, common.NewMessage("Failed to create order"))
		return
	}

	client, err := getWxPayClient()
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("WxPay SDK initialization failed user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		paymentError(c, common.NewMessage("Payment configuration error"))
		return
	}

	notifyUrl := service.GetCallbackAddress() + "/api/user/wxpay/notify"
	if setting.WxPayNotifyUrl != "" {
		notifyUrl = setting.WxPayNotifyUrl
	}
	expire := time.Now().Add(2 * time.Hour)

	svc := &native.NativeApiService{Client: client}
	resp, _, err := svc.Prepay(c.Request.Context(), native.PrepayRequest{
		Appid:       core.String(setting.WxPayAppId),
		Mchid:       core.String(setting.WxPayMchId),
		Description: core.String(setting.GetWxPayDescription()),
		OutTradeNo:  core.String(tradeNo),
		TimeExpire:  core.Time(expire),
		NotifyUrl:   core.String(notifyUrl),
		Amount: &native.Amount{
			Total:    core.Int64(decimal.NewFromFloat(payMoney).Mul(decimal.NewFromInt(100)).Round(0).IntPart()),
			Currency: core.String(setting.GetWxPayCurrency()),
		},
	})
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("WxPay failed to create order user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		paymentError(c, common.NewMessage("Failed to start payment"))
		return
	}
	if resp.CodeUrl == nil || *resp.CodeUrl == "" {
		logger.LogWarn(c.Request.Context(), common.LogText("WxPay order creation rejected user_id=%d trade_no=%s response=%q", id, tradeNo, common.GetJsonString(resp)))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		paymentError(c, common.NewMessage("Failed to start payment"))
		return
	}

	logger.LogInfo(c.Request.Context(), common.LogText("WxPay top-up order created user_id=%d trade_no=%s amount=%d money=%.2f", id, tradeNo, req.Amount, payMoney))

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"code_url": *resp.CodeUrl,
			"order_id": tradeNo,
		},
	})
}

// WxPayNotify handles the WeChat Pay payment result notification. Signature
// verification and AEAD decryption are delegated to the SDK notify handler;
// settlement reuses the same row-lock + status-check idempotency pattern as
// the other gateways.
func WxPayNotify(c *gin.Context) {
	if !isWxPayWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), common.LogText("WxPay webhook rejected reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.JSON(http.StatusForbidden, gin.H{"code": "FAIL", "message": "webhook disabled"})
		return
	}

	if _, err := getWxPayPrivateKey(); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("WxPay webhook private key invalid path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "merchant credential error"})
		return
	}

	// 触发证书下载器注册，保证平台证书可用于验签
	if _, err := getWxPayClient(); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("WxPay webhook client initialization failed path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "client initialization failed"})
		return
	}

	verifier := verifiers.NewSHA256WithRSAVerifier(downloader.MgrInstance().GetCertificateVisitor(setting.WxPayMchId))
	block, err := aes.NewCipher([]byte(setting.WxPayMchApiV3Key))
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("WxPay webhook APIv3 key invalid path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "apiv3 key error"})
		return
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("WxPay webhook AEAD initialization failed path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "apiv3 key error"})
		return
	}

	handler := notify.NewEmptyHandler().AddRSAWithAESGCM(verifier, aesgcm)
	transaction := new(payments.Transaction)
	if _, err := handler.ParseNotifyRequest(c.Request.Context(), c.Request, transaction); err != nil {
		logger.LogWarn(c.Request.Context(), common.LogText("WxPay webhook signature verification failed path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.JSON(http.StatusBadRequest, gin.H{"code": "FAIL", "message": "signature verification failed"})
		return
	}

	tradeNo := ""
	if transaction.OutTradeNo != nil {
		tradeNo = *transaction.OutTradeNo
	}
	tradeState := ""
	if transaction.TradeState != nil {
		tradeState = *transaction.TradeState
	}
	logger.LogInfo(c.Request.Context(), common.LogText("WxPay webhook received request trade_no=%s trade_state=%s client_ip=%s", tradeNo, tradeState, c.ClientIP()))

	switch tradeState {
	case "SUCCESS":
		// 进程内锁只是优化；重复/并发回调的正确性由 RechargeWxPay 的
		// 数据库行锁 + 事务内状态校验保证（多实例部署下同样安全）。
		LockOrder(tradeNo)
		defer UnlockOrder(tradeNo)

		if err := verifyWxPayNotifyAmount(transaction, tradeNo); err != nil {
			logger.LogWarn(c.Request.Context(), common.LogText("WxPay webhook amount mismatch trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), err.Error()))
			c.JSON(http.StatusBadRequest, gin.H{"code": "FAIL", "message": "amount mismatch"})
			return
		}

		if err := model.RechargeWxPay(tradeNo, c.ClientIP()); err != nil {
			logger.LogError(c.Request.Context(), common.LogText("WxPay top-up processing failed trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), err.Error()))
			c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "settlement failed"})
			return
		}
		logger.LogInfo(c.Request.Context(), common.LogText("WxPay top-up succeeded trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
	case "CLOSED", "REVOKED", "PAYERROR":
		if err := model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderWxPay, common.TopUpStatusFailed); err != nil &&
			!errors.Is(err, model.ErrTopUpNotFound) &&
			!errors.Is(err, model.ErrTopUpStatusInvalid) {
			logger.LogError(c.Request.Context(), common.LogText("WxPay failed to mark order as failed trade_no=%s error=%q", tradeNo, err.Error()))
		}
	default:
		logger.LogInfo(c.Request.Context(), common.LogText("WxPay webhook ignored event trade_no=%s trade_state=%s client_ip=%s", tradeNo, tradeState, c.ClientIP()))
	}

	c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "OK"})
}

// verifyWxPayNotifyAmount guards against partially-paid callbacks: the
// notified paid amount (in fen) must equal the locally stored order amount.
func verifyWxPayNotifyAmount(transaction *payments.Transaction, tradeNo string) error {
	if transaction.Amount == nil || transaction.Amount.Total == nil {
		return errors.New("notification missing amount")
	}
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		return model.ErrTopUpNotFound
	}
	expected := decimal.NewFromFloat(topUp.Money).Mul(decimal.NewFromInt(100)).Round(0).IntPart()
	if *transaction.Amount.Total != expected {
		return fmt.Errorf("amount mismatch expected=%d actual=%d", expected, *transaction.Amount.Total)
	}
	return nil
}
