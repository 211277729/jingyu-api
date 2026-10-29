package sms

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

// AliyunSender 通过阿里云短信服务（Dysmsapi RPC 风格）发送验证码。
type AliyunSender struct {
	AccessKeyId  string
	AccessSecret string
	SignName     string
	TemplateCode string
}

// percentEncode 按 Aliyun RPC 签名规范做 URL 编码。
func percentEncode(s string) string {
	encoded := url.QueryEscape(s)
	encoded = strings.ReplaceAll(encoded, "+", "%20")
	encoded = strings.ReplaceAll(encoded, "*", "%2A")
	encoded = strings.ReplaceAll(encoded, "%7E", "~")
	return encoded
}

func (a *AliyunSender) Send(phone string, code string) error {
	params := url.Values{}
	params.Set("AccessKeyId", a.AccessKeyId)
	params.Set("Action", "SendSms")
	params.Set("Format", "JSON")
	params.Set("PhoneNumbers", strings.TrimPrefix(phone, "+86"))
	params.Set("RegionId", "cn-hangzhou")
	params.Set("SignName", a.SignName)
	params.Set("SignatureMethod", "HMAC-SHA1")
	params.Set("SignatureNonce", uuid.New().String())
	params.Set("SignatureVersion", "1.0")
	params.Set("TemplateCode", a.TemplateCode)
	templateParam, _ := json.Marshal(map[string]string{"code": code})
	params.Set("TemplateParam", string(templateParam))
	params.Set("Timestamp", time.Now().UTC().Format("2006-01-02T15:04:05Z"))
	params.Set("Version", "2017-05-25")

	// 按参数名排序拼接规范化查询串并计算 HMAC-SHA1 签名
	keys := make([]string, 0, len(params))
	for key := range params {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	pairs := make([]string, 0, len(keys))
	for _, key := range keys {
		pairs = append(pairs, percentEncode(key)+"="+percentEncode(params.Get(key)))
	}
	stringToSign := "GET&%2F&" + percentEncode(strings.Join(pairs, "&"))
	mac := hmac.New(sha1.New, []byte(a.AccessSecret+"&"))
	mac.Write([]byte(stringToSign))
	params.Set("Signature", base64.StdEncoding.EncodeToString(mac.Sum(nil)))

	requestURL := "https://dysmsapi.aliyuncs.com/?" + params.Encode()
	resp, err := http.Get(requestURL)
	if err != nil {
		return fmt.Errorf("request aliyun dysmsapi: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Code    string `json:"Code"`
		Message string `json:"Message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("decode aliyun response: %w", err)
	}
	if result.Code != "OK" {
		return fmt.Errorf("aliyun sms error %s: %s", result.Code, result.Message)
	}
	return nil
}
