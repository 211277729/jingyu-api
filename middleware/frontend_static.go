package middleware

import (
	"bytes"
	"compress/gzip"
	"errors"
	"io"
	"mime"
	"net/http"
	"path"
	"strconv"
	"strings"
	"sync"

	"github.com/andybalholm/brotli"
	ginGzip "github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

// precompressedFile holds the compressed encodings of one frontend build
// file. The build never changes while the process runs, so each file is
// compressed once per encoding and the bytes are reused, instead of
// recompressing multi-megabyte chunks on every request.
type precompressedFile struct {
	once        sync.Once
	gzipBody    []byte
	brotliBody  []byte
	contentType string
	err         error
}

// pickResponseEncoding returns the content coding to serve. Brotli compresses
// the large JS bundles 15-20% smaller than gzip; gzip covers the rest.
func pickResponseEncoding(acceptEncoding, urlPath string, excluded bool) string {
	if excluded || strings.HasSuffix(urlPath, "/index.html") {
		return ""
	}
	accepts := func(token string) bool {
		return strings.Contains(acceptEncoding, token)
	}
	if accepts("br") {
		return "br"
	}
	if accepts("gzip") {
		return "gzip"
	}
	return ""
}

// cacheControlFor returns the Cache-Control value for one frontend path.
//
// Files under /static/ carry a content hash in their file name, so a given URL
// never changes content and can be cached for a year: a new build produces new
// URLs. index.html is the opposite — it is the file that points at those
// hashed URLs, so caching it would keep browsers requesting chunks that a later
// deployment deleted. Other assets (favicon, an admin-uploaded logo) keep the
// default revalidation behaviour.
func cacheControlFor(urlPath string) string {
	if strings.HasPrefix(urlPath, "/static/") {
		return "public, max-age=31536000, immutable"
	}
	return "no-cache"
}

// ServeFrontendFiles serves files from the embedded frontend build. Clients
// without a supported encoding, the image types the gzip middleware skips,
// directories, and the index.html redirect keep using http.FileServer.
func ServeFrontendFiles(frontendFS static.ServeFileSystem) gin.HandlerFunc {
	fileServer := http.FileServer(frontendFS)
	var cache sync.Map // URL path -> *precompressedFile
	return func(c *gin.Context) {
		urlPath := c.Request.URL.Path
		if !frontendFS.Exists("/", urlPath) {
			return
		}
		c.Abort()
		// Set on both response paths: a client that does not advertise brotli or
		// gzip falls through to http.FileServer below and still needs both headers.
		c.Writer.Header().Set("Cache-Control", cacheControlFor(urlPath))
		c.Writer.Header().Set("Vary", "Accept-Encoding")
		encoding := pickResponseEncoding(
			c.GetHeader("Accept-Encoding"),
			urlPath,
			ginGzip.DefaultExcludedExtentions.Contains(path.Ext(urlPath)),
		)
		if encoding == "" {
			fileServer.ServeHTTP(c.Writer, c.Request)
			return
		}

		value, ok := cache.Load(urlPath)
		if !ok {
			value, _ = cache.LoadOrStore(urlPath, &precompressedFile{})
		}
		file := value.(*precompressedFile)
		file.once.Do(func() {
			f, err := frontendFS.Open(urlPath)
			if err != nil {
				file.err = err
				return
			}
			defer f.Close()
			info, err := f.Stat()
			if err != nil {
				file.err = err
				return
			}
			if info.IsDir() {
				file.err = errors.New("directory")
				return
			}
			raw, err := io.ReadAll(f)
			if err != nil {
				file.err = err
				return
			}
			var gzipBuf bytes.Buffer
			gzipWriter := gzip.NewWriter(&gzipBuf)
			if _, err := gzipWriter.Write(raw); err != nil {
				file.err = err
				return
			}
			if err := gzipWriter.Close(); err != nil {
				file.err = err
				return
			}
			var brotliBuf bytes.Buffer
			brotliWriter := brotli.NewWriter(&brotliBuf)
			if _, err := brotliWriter.Write(raw); err != nil {
				file.err = err
				return
			}
			if err := brotliWriter.Close(); err != nil {
				file.err = err
				return
			}
			file.gzipBody = bytes.Clone(gzipBuf.Bytes())
			file.brotliBody = bytes.Clone(brotliBuf.Bytes())
			// Match http.FileServer: extension first, then content sniffing.
			file.contentType = mime.TypeByExtension(path.Ext(urlPath))
			if file.contentType == "" {
				file.contentType = http.DetectContentType(raw)
			}
		})
		if file.err != nil {
			fileServer.ServeHTTP(c.Writer, c.Request)
			return
		}

		body := file.gzipBody
		if encoding == "br" {
			body = file.brotliBody
		}
		// Range requests get the whole body; a server may ignore Range.
		header := c.Writer.Header()
		header.Set("Content-Encoding", encoding)
		header.Set("Vary", "Accept-Encoding")
		header.Set("Content-Type", file.contentType)
		header.Set("Content-Length", strconv.Itoa(len(body)))
		c.Writer.WriteHeader(http.StatusOK)
		if c.Request.Method != http.MethodHead {
			_, _ = c.Writer.Write(body)
		}
	}
}
