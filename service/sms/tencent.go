package sms

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// TencentSender 通过腾讯云短信服务（TC3-HMAC-SHA256 签名）发送验证码。
type TencentSender struct {
	SecretId   string
	SecretKey  string
	SdkAppId   string
	SignName   string
	TemplateId string
	Region     string
}

func hmacSha256(key []byte, data string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(data))
	return mac.Sum(nil)
}

func (t *TencentSender) Send(phone string, code string) error {
	payload, _ := json.Marshal(map[string]any{
		"PhoneNumberSet":   []string{phone}, // E.164 格式，如 +8613812345678
		"SmsSdkAppId":      t.SdkAppId,
		"SignName":         t.SignName,
		"TemplateId":       t.TemplateId,
		"TemplateParamSet": []string{code},
	})

	now := time.Now().UTC()
	timestamp := now.Unix()
	date := now.Format("2006-01-02")
	service := "sms"
	action := "SendSms"
	version := "2021-01-11"
	lowerAction := strings.ToLower(action)
	contentType := "application/json; charset=utf-8"

	payloadHash := sha256.Sum256(payload)
	canonicalRequest := strings.Join([]string{
		"POST",
		"/",
		"",
		"content-type:" + contentType + "\nx-tc-action:" + lowerAction + "\n",
		"content-type;x-tc-action",
		hex.EncodeToString(payloadHash[:]),
	}, "\n")

	canonicalHash := sha256.Sum256([]byte(canonicalRequest))
	stringToSign := strings.Join([]string{
		"TC3-HMAC-SHA256",
		fmt.Sprintf("%d", timestamp),
		date + "/" + service + "/tc3_request",
		hex.EncodeToString(canonicalHash[:]),
	}, "\n")

	kDate := hmacSha256([]byte("TC3"+t.SecretKey), date)
	kService := hmacSha256(kDate, service)
	kSigning := hmacSha256(kService, "tc3_request")
	signature := hex.EncodeToString(hmacSha256(kSigning, stringToSign))

	authorization := fmt.Sprintf(
		"TC3-HMAC-SHA256 Credential=%s/%s/%s/tc3_request, SignedHeaders=content-type;x-tc-action, Signature=%s",
		t.SecretId, date, service, signature,
	)

	req, err := http.NewRequest(http.MethodPost, "https://sms.tencentcloudapi.com/", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("build tencent sms request: %w", err)
	}
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-TC-Action", action)
	req.Header.Set("X-TC-Version", version)
	req.Header.Set("X-TC-Timestamp", fmt.Sprintf("%d", timestamp))
	req.Header.Set("X-TC-Region", t.Region)
	req.Header.Set("Authorization", authorization)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("request tencent sms: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Response struct {
			SendStatusSet []struct {
				Code    string `json:"Code"`
				Message string `json:"Message"`
			} `json:"SendStatusSet"`
			Error *struct {
				Code    string `json:"Code"`
				Message string `json:"Message"`
			} `json:"Error"`
		} `json:"Response"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("decode tencent response: %w", err)
	}
	if result.Response.Error != nil {
		return fmt.Errorf("tencent sms error %s: %s", result.Response.Error.Code, result.Response.Error.Message)
	}
	if len(result.Response.SendStatusSet) == 0 || result.Response.SendStatusSet[0].Code != "Ok" {
		if len(result.Response.SendStatusSet) > 0 {
			return fmt.Errorf("tencent sms error %s: %s", result.Response.SendStatusSet[0].Code, result.Response.SendStatusSet[0].Message)
		}
		return fmt.Errorf("tencent sms returned no status")
	}
	return nil
}
