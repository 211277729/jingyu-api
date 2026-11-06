#!/usr/bin/env node
/**
 * 把「Docker 构建阶段产出的前端资源」同步到本地 web/dist。
 *
 * 为什么需要它：本地 `bun run build` 与 Docker 内构建的产物 hash 并不相同
 * （bun 版本、环境变量、NODE_ENV 等差异），而线上 index.html 引用的是
 * **Docker 那套** hash。用本地构建的 dist 上传，文件名对不上，页面直接 404。
 *
 * 这个脚本只构建到 Dockerfile 的 dist 阶段（前端构建产物），不编译 Go，
 * 有缓存时几十秒完成，然后把前端产物原样落到 web/dist。
 *
 * 用法：
 *   bun run dist:from-image           # 构建并同步
 *   bun run dist:from-image --no-build  # 跳过构建，直接从已有镜像导出
 *
 * 之后照常：
 *   bun run upload:dist
 */
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const WEB_DIR = path.resolve(here, '..')
const PROJECT_DIR = path.resolve(WEB_DIR, '..')
const DIST = path.join(WEB_DIR, 'dist')
const STAGING = path.join(PROJECT_DIR, '.local', 'dist-staging')
const IMAGE = 'jingyu-api-web:export'
const CONTAINER = 'jingyu-dist-export'

function run(args, { inherit = true } = {}) {
  return execFileSync('docker', args, {
    cwd: PROJECT_DIR,
    stdio: inherit ? 'inherit' : 'pipe',
    // Dockerfile 用了 --mount=type=cache，只有 BuildKit 支持
    env: { ...process.env, DOCKER_BUILDKIT: '1' },
    encoding: 'utf8',
  })
}

function runQuiet(args) {
  try {
    return run(args, { inherit: false })
  } catch {
    return ''
  }
}

function syncDistFromBuildStage() {
  rmSync(STAGING, { recursive: true, force: true })
  // dist 阶段是 FROM scratch，--output 出来就是 dist 的原始内容
  run([
    'buildx',
    'build',
    '--target',
    'dist',
    '--output',
    `type=local,dest=${STAGING}`,
    '.',
  ])
  swapIntoDist()
}

function syncDistFromImage() {
  rmSync(STAGING, { recursive: true, force: true })
  mkdirSync(STAGING, { recursive: true })

  runQuiet(['rm', '-f', CONTAINER])
  // dist 镜像是 FROM scratch，没有 ENTRYPOINT/CMD，docker create 必须显式给一个
  // 命令（不会被执行，只用来建容器以便 docker cp）。
  run(['create', '--name', CONTAINER, IMAGE, '/bin/true'], { inherit: false })

  try {
    // dist 镜像的根目录就是 dist 内容本身（Dockerfile 里 FROM scratch 后 COPY 到 /）。
    // docker cp 到已存在的目录是「合并」，所以先落到空的 staging，再整体替换。
    run(['cp', `${CONTAINER}:/.`, STAGING])
    // 容器根目录的 /.dockerenv 不属于前端产物，去掉后再整体替换
    rmSync(path.join(STAGING, '.dockerenv'), { force: true })
  } finally {
    runQuiet(['rm', '-f', CONTAINER])
  }

  swapIntoDist()
}

function swapIntoDist() {
  rmSync(DIST, { recursive: true, force: true })
  mkdirSync(path.dirname(DIST), { recursive: true })
  renameSync(STAGING, DIST)
}

function report() {
  const indexHtml = path.join(DIST, 'index.html')
  if (!existsSync(indexHtml)) {
    console.log('[warn]   web/dist/index.html 不存在，导出可能失败')
    return
  }
  const html = readFileSync(indexHtml, 'utf8')
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .sort()
  console.log('[result] web/dist 里的资源地址：')
  for (const ref of refs) console.log(`         ${ref}`)
  console.log(
    '\n[tip]    这套 hash 必须和线上 index.html 一致。用下面的命令对照：'
  )
  console.log(
    '         curl -s https://你的域名/ | grep -oE "https://[^\\"]*cdn[^\\"]*"'
  )
  console.log('\n[tip]    确认后执行：bun run upload:dist')
}

function main() {
  const skipBuild = process.argv.includes('--no-build')

  if (!runQuiet(['version'])) {
    throw new Error('docker 不可用，请确认 Docker Desktop 已启动')
  }

  if (skipBuild) {
    console.log(`[skip]   跳过构建，直接导出已有镜像 ${IMAGE}`)
    if (!runQuiet(['image', 'inspect', IMAGE])) {
      throw new Error(`镜像 ${IMAGE} 不存在，请先去掉 --no-build 跑一次`)
    }
    console.log('[export] 从镜像导出前端产物 → web/dist')
    syncDistFromImage()
  } else {
    console.log('[build]  构建 Dockerfile 的 dist 阶段（只跑前端，不编译 Go）')
    console.log(
      '         docker buildx build --target dist --output type=local,... .'
    )
    syncDistFromBuildStage()
  }

  console.log('[done]   完成\n')
  report()
}

try {
  main()
} catch (error) {
  console.error(`[error] ${error.message}`)
  process.exit(1)
}
