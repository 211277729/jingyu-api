package sms

import "testing"

func TestNormalizePhone(t *testing.T) {
	cases := []struct {
		in      string
		want    string
		wantErr bool
	}{
		{in: "13812345678", want: "+8613812345678"},
		{in: " 13812345678 ", want: "+8613812345678"},
		{in: "+8613812345678", want: "+8613812345678"},
		{in: "8613812345678", want: "+8613812345678"},
		{in: "", wantErr: true},
		{in: "12345678", wantErr: true},
		{in: "12812345678", wantErr: true},
		{in: "138123456789", wantErr: true},
	}
	for _, c := range cases {
		got, err := NormalizePhone(c.in)
		if c.wantErr {
			if err == nil {
				t.Errorf("NormalizePhone(%q) expected error, got %q", c.in, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("NormalizePhone(%q) unexpected error: %v", c.in, err)
		}
		if got != c.want {
			t.Errorf("NormalizePhone(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestMaskPhone(t *testing.T) {
	if got := MaskPhone("+8613812345678"); got != "138****5678" {
		t.Errorf("MaskPhone = %q, want 138****5678", got)
	}
}

func TestGenerateNumericCode(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		code, err := GenerateNumericCode(4)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(code) != 4 {
			t.Fatalf("code length = %d, want 4", len(code))
		}
		for _, r := range code {
			if r < '0' || r > '9' {
				t.Fatalf("code %q contains non-digit %q", code, r)
			}
		}
		seen[code] = true
	}
	// 200 次采样应覆盖多个不同值，排除恒定输出的错误实现
	if len(seen) < 20 {
		t.Fatalf("expected random codes, got only %d distinct values", len(seen))
	}
}
