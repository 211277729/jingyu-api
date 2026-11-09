package service

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ip_geo_setting"
)

func TestParseIpApi(t *testing.T) {
	body := []byte(`{"status":"success","country":"美国","regionName":"加利福尼亚州","city":"山景城","isp":"Google LLC"}`)
	info, err := parseIpApi("8.8.8.8", "ip-api.com", body)
	if err != nil {
		t.Fatalf("parseIpApi failed: %v", err)
	}
	if info.Country != "美国" || info.Region != "加利福尼亚州" || info.City != "山景城" || info.Isp != "Google LLC" {
		t.Fatalf("unexpected fields: %+v", info)
	}
	if info.UpdatedAt == 0 {
		t.Fatal("updated_at should be set")
	}
}

func TestParseIpApiFailure(t *testing.T) {
	body := []byte(`{"status":"fail","message":"invalid query"}`)
	_, err := parseIpApi("x", "ip-api.com", body)
	if err == nil || !strings.Contains(err.Error(), "invalid query") {
		t.Fatalf("expected message error, got %v", err)
	}
}

func TestParseIpSb(t *testing.T) {
	body := []byte(`{"country":"China","region":"Zhejiang","city":"Hangzhou","organization":"Alibaba","isp":""}`)
	info, err := parseIpSb("223.5.5.5", "ip.sb", body)
	if err != nil {
		t.Fatalf("parseIpSb failed: %v", err)
	}
	if info.Isp != "Alibaba" {
		t.Fatalf("isp should fall back to organization: %+v", info)
	}
	if info.Country != "China" || info.Region != "Zhejiang" || info.City != "Hangzhou" {
		t.Fatalf("unexpected fields: %+v", info)
	}
}

func TestParseIpSbMissingLocation(t *testing.T) {
	body := []byte(`{"country":"","city":""}`)
	if _, err := parseIpSb("x", "ip.sb", body); err == nil {
		t.Fatal("expected error for missing location")
	}
}

func TestParseBaiduDomestic(t *testing.T) {
	body := []byte(`{"status":"0","data":[{"location":"浙江省杭州市 阿里云"}]}`)
	info, err := parseBaidu("223.5.5.5", "Baidu", body)
	if err != nil {
		t.Fatalf("parseBaidu failed: %v", err)
	}
	if info.Region != "浙江省" || info.City != "杭州市" || info.Isp != "阿里云" {
		t.Fatalf("unexpected split: %+v", info)
	}
}

func TestParseBaiduMunicipality(t *testing.T) {
	body := []byte(`{"status":"0","data":[{"location":"北京市 联通"}]}`)
	info, err := parseBaidu("123.0.0.1", "Baidu", body)
	if err != nil {
		t.Fatalf("parseBaidu failed: %v", err)
	}
	if info.Region != "北京市" || info.City != "北京市" || info.Isp != "联通" {
		t.Fatalf("municipality split wrong: %+v", info)
	}
}

func TestParseBaiduOverseas(t *testing.T) {
	body := []byte(`{"status":"0","data":[{"location":"美国"}]}`)
	info, err := parseBaidu("8.8.8.8", "Baidu", body)
	if err != nil {
		t.Fatalf("parseBaidu failed: %v", err)
	}
	if info.Country != "美国" || info.Region != "" || info.Isp != "" {
		t.Fatalf("overseas mapping wrong: %+v", info)
	}
}

func TestSplitBaiduLocationNoIsp(t *testing.T) {
	region, city, isp := splitBaiduLocation("广东省深圳市")
	if region != "广东省" || city != "深圳市" || isp != "" {
		t.Fatalf("unexpected split: %q %q %q", region, city, isp)
	}
}

func TestValidateProvidersJSON(t *testing.T) {
	valid := `[{"name":"a","url_template":"http://x/{ip}","type":"ip_api","enabled":true}]`
	if err := ip_geo_setting.ValidateProvidersJSON(valid); err != nil {
		t.Fatalf("valid providers rejected: %v", err)
	}

	noPlaceholder := `[{"name":"a","url_template":"http://x/","type":"ip_api","enabled":true}]`
	if err := ip_geo_setting.ValidateProvidersJSON(noPlaceholder); err == nil {
		t.Fatal("missing {ip} should be rejected")
	}

	badType := `[{"name":"a","url_template":"http://x/{ip}","type":"hiofd_html","enabled":true}]`
	if err := ip_geo_setting.ValidateProvidersJSON(badType); err == nil {
		t.Fatal("unknown type should be rejected")
	}

	if err := ip_geo_setting.ValidateProvidersJSON(`not-json`); err == nil {
		t.Fatal("invalid JSON should be rejected")
	}
}

func TestIsPrivateOrReservedIp(t *testing.T) {
	private := []string{"127.0.0.1", "10.0.0.1", "192.168.1.1", "172.16.0.1", "::1", "169.254.1.1", "not-an-ip", ""}
	for _, ip := range private {
		if !model.IsPrivateOrReservedIp(ip) {
			t.Fatalf("%q should be private/reserved", ip)
		}
	}
	public := []string{"8.8.8.8", "223.5.5.5", "1.2.4.8"}
	for _, ip := range public {
		if model.IsPrivateOrReservedIp(ip) {
			t.Fatalf("%q should be public", ip)
		}
	}
}
