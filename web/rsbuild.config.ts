import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, loadEnv } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss'
import { tanstackRouter } from '@tanstack/router-plugin/rspack'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Local HTTPS dev server.
//
// Why HTTPS: the API may run with SESSION_COOKIE_SECURE=true, in which case the
// backend rejects cookie-authenticated refresh/logout from any Origin that is
// not in SESSION_COOKIE_TRUSTED_URL — and that allowlist only accepts https://
// entries (common/session_cookie.go rejects http at startup). Serving the dev
// server over HTTPS makes the browser Origin "https://localhost:<port>", which
// is an entry the allowlist can legally hold. On plain HTTP the Origin is
// http://localhost:<port> and page refresh silently logs the user out.
//
// Certs live in ./certs (gitignored) and are generated per machine. When they
// are absent the dev server falls back to plain HTTP, so this config stays
// safe for anyone who has not created them.
const devKeyPath = path.resolve(__dirname, 'certs/dev-localhost-key.pem')
const devCertPath = path.resolve(__dirname, 'certs/dev-localhost-cert.pem')
const devHttps =
  existsSync(devKeyPath) && existsSync(devCertPath)
    ? { key: readFileSync(devKeyPath), cert: readFileSync(devCertPath) }
    : undefined

export default defineConfig(({ envMode }) => {
  const env = loadEnv({ mode: envMode, prefixes: ['VITE_'] })
  const serverUrl =
    process.env.VITE_REACT_APP_SERVER_URL ||
    env.rawPublicVars.VITE_REACT_APP_SERVER_URL ||
    'http://localhost:3000'

  const isProd = envMode === 'production'
  const devProxy = Object.fromEntries(
    (['/api', '/v1', '/mj', '/pg'] as const).map((key) => [
      key,
      { target: serverUrl, changeOrigin: true },
    ])
  ) as Record<string, { target: string; changeOrigin: boolean }>

  return {
    plugins: [pluginReact(), pluginTailwindcss({ optimize: false })],
    // Rsbuild 2: replaces deprecated `performance.chunkSplit` (RSPack 2 aligned)
    splitChunks: {
      preset: 'default',
      cacheGroups: {
        'vendor-react': {
          test: /node_modules[\\/](react|react-dom)[\\/]/,
          name: 'vendor-react',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        'vendor-ui-primitives': {
          test: /node_modules[\\/](@base-ui|@radix-ui)[\\/]/,
          name: 'vendor-ui-primitives',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        'vendor-tanstack': {
          test: /node_modules[\\/]@tanstack[\\/]/,
          name: 'vendor-tanstack',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
      },
    },
    source: {
      entry: {
        index: './src/main.tsx',
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    html: {
      template: './index.html',
      favicon: './public/favicon.ico',
    },
    server: {
      host: '0.0.0.0',
      // Dev-server port. Defaults to 5173 — the port every README, the
      // makefile (`DEV_WEB_PORT`) and docker-compose.dev.yml name — and is
      // overridable with DEV_PORT in web/.env or web/.env.local.
      //
      // Not 3000: that belongs to the backend, so defaulting there would both
      // collide with a local backend and send the proxy target below back to
      // this same dev server.
      //
      // Deliberately non-prefixed (no VITE_): it configures the dev server, so
      // it must not be inlined into the client bundle.
      //
      // The backend matches SESSION_COOKIE_TRUSTED_URL origins exactly, port
      // included — changing this requires updating that allowlist entry too.
      port: Number(env.parsed.DEV_PORT) || 5173,
      strictPort: false,
      // undefined keeps the default plain-HTTP dev server.
      https: devHttps,
      proxy: devProxy,
    },
    output: {
      assetPrefix: isProd ? 'https://cdnwb.xiaoyuji.cn/jingyuai-api/' : '/',
      // Production optimizations
      minify: isProd,
      target: 'web',
      distPath: {
        root: 'dist',
      },
      // Rely on Rsbuild default legalComments ("linked" → per-chunk *.LICENSE.txt) in all modes.
      // Do not set "none" in production: that strips minifier-preserved third-party notices and
      // extracted license files, which some distributions require for open-source compliance.
    },
    performance: {
      // Remove console in production
      removeConsole: isProd ? ['log'] : false,
      buildCache: false,
    },
    tools: {
      rspack: {
        plugins: [
          tanstackRouter({
            target: 'react',
            // Dev: avoid per-route async chunks (reduces white flash on navigation + faster HMR feedback).
            // Prod: keep route-based code splitting.
            autoCodeSplitting: isProd,
          }),
        ],
      },
    },
  }
})
