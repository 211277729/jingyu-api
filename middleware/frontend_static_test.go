package middleware

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/andybalholm/brotli"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type countingFrontendFS struct {
	static.ServeFileSystem
	opens atomic.Int32
}

func (f *countingFrontendFS) Open(name string) (http.File, error) {
	f.opens.Add(1)
	return f.ServeFileSystem.Open(name)
}

func performFrontendRequest(router http.Handler, method, target, acceptEncoding string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(method, target, nil)
	if acceptEncoding != "" {
		request.Header.Set("Accept-Encoding", acceptEncoding)
	}
	router.ServeHTTP(recorder, request)
	return recorder
}

// decodeCompressedBody reverses the response content coding.
func decodeCompressedBody(t *testing.T, encoding string, body []byte) []byte {
	t.Helper()
	switch encoding {
	case "br":
		reader := brotli.NewReader(bytes.NewReader(body))
		decoded, err := io.ReadAll(reader)
		require.NoError(t, err)
		return decoded
	case "gzip":
		reader, err := gzip.NewReader(bytes.NewReader(body))
		require.NoError(t, err)
		decoded, err := io.ReadAll(reader)
		require.NoError(t, err)
		return decoded
	default:
		return body
	}
}

func TestServeFrontendFilesCompressesEachFileOnce(t *testing.T) {
	gin.SetMode(gin.TestMode)
	frontendDir := t.TempDir()
	script := []byte(strings.Repeat("export const answer = 42;\n", 400))
	image := []byte("\x89PNG\r\n\x1a\nnot-really-an-image")
	require.NoError(t, os.MkdirAll(filepath.Join(frontendDir, "static", "js"), 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(frontendDir, "static", "js", "app.js"), script, 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(frontendDir, "logo.png"), image, 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(frontendDir, "index.html"), []byte("<html></html>"), 0o644))
	frontendFS := &countingFrontendFS{ServeFileSystem: static.LocalFile(frontendDir, false)}

	router := gin.New()
	router.NoRoute(ServeFrontendFiles(frontendFS), func(c *gin.Context) {
		c.String(http.StatusTeapot, "fallback")
	})

	plain := performFrontendRequest(router, http.MethodGet, "/static/js/app.js", "")
	require.Equal(t, http.StatusOK, plain.Code)
	assert.Empty(t, plain.Header().Get("Content-Encoding"))
	assert.Equal(t, script, plain.Body.Bytes())
	frontendFS.opens.Store(0)

	// Brotli is chosen whenever the client advertises it, even alongside gzip.
	compressedResponses := make([]*httptest.ResponseRecorder, 8)
	var compressedWG sync.WaitGroup
	for i := range compressedResponses {
		compressedWG.Go(func() {
			compressedResponses[i] = performFrontendRequest(router, http.MethodGet, "/static/js/app.js", "gzip, deflate, br")
		})
	}
	compressedWG.Wait()
	for _, response := range compressedResponses {
		require.Equal(t, http.StatusOK, response.Code)
		assert.Equal(t, "br", response.Header().Get("Content-Encoding"))
		assert.Equal(t, "Accept-Encoding", response.Header().Get("Vary"))
		assert.Equal(t, plain.Header().Get("Content-Type"), response.Header().Get("Content-Type"))
		assert.Equal(t, strconv.Itoa(response.Body.Len()), response.Header().Get("Content-Length"))
		assert.Equal(t, compressedResponses[0].Body.Bytes(), response.Body.Bytes())
	}
	brotliDecoded := decodeCompressedBody(t, "br", compressedResponses[0].Body.Bytes())
	assert.Equal(t, script, brotliDecoded)

	// Gzip-only clients still get gzip.
	gzipOnly := performFrontendRequest(router, http.MethodGet, "/static/js/app.js", "gzip")
	require.Equal(t, http.StatusOK, gzipOnly.Code)
	assert.Equal(t, "gzip", gzipOnly.Header().Get("Content-Encoding"))
	gzipDecoded := decodeCompressedBody(t, "gzip", gzipOnly.Body.Bytes())
	assert.Equal(t, script, gzipDecoded)
	assert.Less(t, len(gzipOnly.Body.Bytes()), len(script), "gzip must shrink a compressible script")

	head := performFrontendRequest(router, http.MethodHead, "/static/js/app.js", "br")
	assert.Equal(t, http.StatusOK, head.Code)
	assert.Equal(t, "br", head.Header().Get("Content-Encoding"))
	assert.Equal(t, strconv.Itoa(compressedResponses[0].Body.Len()), head.Header().Get("Content-Length"))
	assert.Empty(t, head.Body.Bytes())
	assert.Equal(t, int32(1), frontendFS.opens.Load(), "the file must be read and compressed once")

	png := performFrontendRequest(router, http.MethodGet, "/logo.png", "gzip")
	assert.Equal(t, http.StatusOK, png.Code)
	assert.Empty(t, png.Header().Get("Content-Encoding"))
	assert.Equal(t, image, png.Body.Bytes())

	index := performFrontendRequest(router, http.MethodGet, "/index.html", "gzip")
	assert.Equal(t, http.StatusMovedPermanently, index.Code)
	assert.Equal(t, "./", index.Header().Get("Location"))

	missing := performFrontendRequest(router, http.MethodGet, "/static/js/missing.js", "gzip")
	assert.Equal(t, http.StatusTeapot, missing.Code)
	assert.Equal(t, "fallback", missing.Body.String())
}
