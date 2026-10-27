#!/usr/bin/env node
/**
 * 把「Docker 构建阶段产出的前端资源」同步到本地 web/dist。
 *
 * 为什么需要它：本地 `bun run build` 与 Docker 内构建的产物 hash 并不相同
 * （bun 版本、环境变量、NODE_ENV 等差异），而线上 index.html 引用的是
 * **Docker 那套** hash。用本地构建的 dist 上传，文件名对不上，页面直接 404。
 *
 * 这个脚本只构建到 Dockerfile 的 builder 阶段（前端构建），不编译 Go，
 * 有缓存时几十秒完成，然后把 /build/web/dist 原样拷回 web/dist。
 *
 * 用法：
 *   bun run dist:from-image           # 构建并同步
 *   bun run dist:from-image --no-build  # 跳过构建，直接导出已有镜像
 *
 * 之后照常：
 *   bun run upload:dist
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
const IMAGE = 'jingyu-api-web:export';
const CONTAINER = 'jingyu-dist-export';

function run(args, { inherit = true } = {}) {
  return execFileSync('docker', args, {
    cwd: PROJECT_DIR,
    stdio: inherit ? 'inherit' : 'pipe',
    // BuildKit 在本机连不上 auth.docker.io，传统构建器才可用
    env: { ...process.env, DOCKER_BUILDKIT: '0' },
    encoding: 'utf8',
  });
}

function runQuiet(args) {
  try {
    return run(args, { inherit: false });
  } catch {
    return '';
  }
}

function syncDist() {
  rmSync(STAGING, { recursive: true, force: true });
  mkdirSync(STAGING, { recursive: true });

  runQuiet(['rm', '-f', CONTAINER]);
  run(['create', '--name', CONTAINER, IMAGE], { inherit: false });

  try {
    // docker cp 到已存在的目录是「合并」，所以先落到空的 staging，再整体替换
    run(['cp', `${CONTAINER}:/build/web/dist/.`, STAGING]);
  } finally {
    runQuiet(['rm', '-f', CONTAINER]);
  }

  rmSync(DIST, { recursive: true, force: true });
  renameSync(STAGING, DIST);
}

function report() {
  const indexHtml = path.join(DIST, 'index.html');
  if (!existsSync(indexHtml)) {
    console.log('[warn]   web/dist/index.html 不存在，导出可能失败');
    return;
  }
  const html = readFileSync(indexHtml, 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).sort();
  console.log('[result] web/dist 里的资源地址：');
  for (const ref of refs) console.log(`         ${ref}`);
  console.log('\n[tip]    这套 hash 必须和线上 index.html 一致。用下面的命令对照：');
  console.log('         curl -s https://你的域名/ | grep -oE "https://[^\\"]*cdn[^\\"]*"');
  console.log('\n[tip]    确认后执行：bun run upload:dist');
}

function main() {
  const skipBuild = process.argv.includes('--no-build');

  if (!runQuiet(['version'])) {
    throw new Error('docker 不可用，请确认 Docker Desktop 已启动');
  }

  if (skipBuild) {
    console.log(`[skip]   跳过构建，直接导出已有镜像 ${IMAGE}`);
    if (!runQuiet(['image', 'inspect', IMAGE])) {
      throw new Error(`镜像 ${IMAGE} 不存在，请先去掉 --no-build 跑一次`);
    }
  } else {
    console.log('[build]  构建 Dockerfile 的 builder 阶段（只跑前端，不编译 Go）');
    console.log(`         docker build --target builder -t ${IMAGE} .`);
    run(['build', '--target', 'builder', '-t', IMAGE, '.']);
  }

  console.log('[export] 导出 /build/web/dist → web/dist');
  syncDist();
  console.log('[done]   完成\n');
  report();
}

try {
  main();
} catch (error) {
  console.error(`[error] ${error.message}`);
  process.exit(1);
}
