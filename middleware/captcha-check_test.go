package middleware

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestMain(m *testing.M) {
	// 测试统一走内存存储路径，避免依赖外部 Redis。
	common.RedisEnabled = false
	os.Exit(m.Run())
}

// findNonce 穷举一个满足难度的 nonce，模拟前端求解过程。
func findNonce(t *testing.T, challenge string, difficulty int) string {
	t.Helper()
	for i := uint64(0); ; i++ {
		nonce := fmt.Sprintf("%d", i)
		digest := sha256.Sum256([]byte(challenge + ":" + nonce))
		if countLeadingZeroBits(digest) >= difficulty {
			return nonce
		}
	}
}

func TestCountLeadingZeroBits(t *testing.T) {
	var digest [sha256.Size]byte
	if got := countLeadingZeroBits(digest); got != 256 {
		t.Fatalf("all-zero digest: got %d, want 256", got)
	}
	var one [sha256.Size]byte
	binary.BigEndian.PutUint64(one[:8], 1) // 最高位是 0，只有次高位起为 1？1 的最高 bit 是 0
	// 0x0000...0001 最高字节为 0，前导零 = 8*7 + 7 = 63
	if got := countLeadingZeroBits(one); got != 63 {
		t.Fatalf("single trailing bit: got %d, want 63", got)
	}
	var high [sha256.Size]byte
	high[0] = 0x80
	if got := countLeadingZeroBits(high); got != 0 {
		t.Fatalf("leading set bit: got %d, want 0", got)
	}
}

func TestVerifyPoWSolution(t *testing.T) {
	const challenge = "0123456789abcdef"
	nonce := findNonce(t, challenge, 20)
	if !verifyPoWSolution(challenge, nonce, 20) {
		t.Fatalf("valid solution rejected")
	}
	if verifyPoWSolution(challenge, nonce, 24) {
		t.Fatalf("solution below higher difficulty accepted")
	}
	if verifyPoWSolution(challenge, nonce+"0", 20) {
		t.Fatalf("tampered nonce accepted")
	}
	if verifyPoWSolution(challenge+"0", nonce, 20) {
		t.Fatalf("different challenge accepted")
	}
}

func TestPoWChallengeIssueAndConsume(t *testing.T) {
	// 测试环境未启用 Redis，走内存存储路径。
	id, challenge, err := IssuePoWChallenge("1.2.3.4", 20, 120)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	record, ok := ConsumePoWChallenge(id)
	if !ok {
		t.Fatalf("challenge not found after issue")
	}
	if record.Challenge != challenge || record.Difficulty != 20 || record.IP != "1.2.3.4" {
		t.Fatalf("unexpected record: %+v", record)
	}
	// 一次性：二次消费必须失败（防重放）。
	if _, ok := ConsumePoWChallenge(id); ok {
		t.Fatalf("challenge consumed twice")
	}
	if _, ok := ConsumePoWChallenge("nonexistent"); ok {
		t.Fatalf("nonexistent challenge consumed")
	}
}
