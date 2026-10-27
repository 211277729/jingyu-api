#!/usr/bin/env node
/**
 * 一条命令完成：构建镜像 + 把镜像里的前端产物同步到 web/dist。
 *
 * 顺序按「先产出前端、再编译 Go」安排，总耗时等同一次完整构建：
 *   1) build --target builder   → 前端产物（源码变了才重跑）
 *   2) 导出 /build/web/dist     → web/dist
 *   3) build（完整）            → 复用第 1 步的缓存，只跑 Go 编译
 *
 * 这样 web/dist 里的 hash 必然与镜像一致，`bun run upload:dist` 上传的就是
 * 线上 index.html 真正引用的那套文件。
 *
 * 用法：
 *   bun run build:image                # 构建 + 同步 dist（默认 tag: jingyu-api:test）
 *   bun run build:image --image-only   # 只构建镜像，不动 web/dist
 *   $env:IMAGE_TAG='jingyu-api:v1.2.0'; bun run build:image
 *
 * 仅需补传产物、镜像已经部署过时，用 `bun run dist:from-image --no-build`。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(here, '..');
const PROJECT_DIR = path.resolve(WEB_DIR, '..');
const DIST = path.join(WEB_DIR, 'dist');
const STAGING = path.join(PROJECT_DIR, '.local', 'dist-staging');
const VERSION_FILE = path.join(PROJECT_DIR, 'VERSION');

const STAGE_IMAGE = 'jingyu-api-web:export';
const STAGE_CONTAINER = 'jingyu-dist-export';
const IMAGE_TAG = process.env.IMAGE_TAG || 'jingyu-api:test';

function docker(args, { inherit = true } = {}) {
  return execFileSync('docker', args, {
    cwd: PROJECT_DIR,
    stdio: inherit ? 'inherit' : 'pipe',
    // 本机 BuildKit 拉不到 auth.docker.io，传统构建器才稳定
    env: { ...process.env, DOCKER_BUILDKIT: '0' },
    encoding: 'utf8',
  });
}

function dockerQuiet(args) {
  try {
    return docker(args, { inherit: false });
  } catch {
    return '';
  }
}

function syncDistFromStage() {
  rmSync(STAGING, { recursive: true, force: true });
  mkdirSync(STAGING, { recursive: true });

  dockerQuiet(['rm', '-f', STAGE_CONTAINER]);
  docker(['create', '--name', STAGE_CONTAINER, STAGE_IMAGE], { inherit: false });
  try {
    // docker cp 到已存在目录会合并，所以先落空目录再整体替换
    docker(['cp', `${STAGE_CONTAINER}:/build/web/dist/.`, STAGING]);
  } finally {
    dockerQuiet(['rm', '-f', STAGE_CONTAINER]);
  }

  rmSync(DIST, { recursive: true, force: true });
  renameSync(STAGING, DIST);
}

function printAssetAddresses() {
  const indexHtml = path.join(DIST, 'index.html');
  if (!existsSync(indexHtml)) {
    console.log('[warn]   web/dist/index.html 不存在');
    return;
  }
  const html = readFileSync(indexHtml, 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).sort();
  console.log('\n[dist]   web/dist 的资源地址：');
  for (const ref of refs) console.log(`         ${ref}`);
}

function main() {
  const imageOnly = process.argv.includes('--image-only');
  const version = existsSync(VERSION_FILE) ? readFileSync(VERSION_FILE, 'utf8').trim() : '';

  if (!dockerQuiet(['version'])) throw new Error('docker 不可用，请确认 Docker Desktop 已启动');

  if (!imageOnly) {
    console.log('[1/3]    构建前端阶段（build --target builder）');
    docker(['build', '--target', 'builder', '-t', STAGE_IMAGE, '.']);

    console.log('[2/3]    导出 /build/web/dist → web/dist');
    syncDistFromStage();
  }

  console.log(`[3/3]    构建镜像 ${IMAGE_TAG}（复用前端缓存，只编译 Go）`);
  docker(['build', '-t', IMAGE_TAG, '.']);

  if (version) {
    const versionTag = `jingyu-api:${version}`;
    docker(['tag', IMAGE_TAG, versionTag], { inherit: false });
    console.log(`[tag]    ${IMAGE_TAG} 同时标记为 ${versionTag}`);
  }

  if (!imageOnly) printAssetAddresses();

  console.log('\n[tip]    下一步：');
  console.log('         cd web && bun run upload:dist');
  console.log('         验证 CDN 返回 200 之后，再 docker save / scp / load / up -d');
}

try {
  main();
} catch (error) {
  console.error(`[error] ${error.message}`);
  process.exit(1);
}
