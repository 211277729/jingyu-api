#!/usr/bin/env node
/**
 * 增量上传前端构建产物到腾讯云 COS。
 *
 * 为什么需要它：COSBrowser 的「上传文件夹」是逐个 PUT 覆盖，没有内容对比，
 * 每次发版都要重传 60 MB+。这个脚本先列出远端对象，只上传「远端没有」和
 * 「大小不同」的文件。
 *
 * 安全约束（重要）：
 *   - 绝不删除远端对象。旧版本文件必须一直留着，否则发版瞬间拿到旧
 *     index.html 的浏览器会去请求已删除的 chunk 并 404，回滚也会 404。
 *   - 文件名带内容 hash，所以「同名必然同内容」，比较大小就够判断是否要重传。
 *
 * 依赖：cos-nodejs-sdk-v5（已在 devDependencies 里）
 *
 * 凭据（二选一，环境变量优先）：
 *   1) 环境变量：COS_SECRET_ID / COS_SECRET_KEY / COS_REGION / COS_BUCKET
 *   2) 配置文件：.local/cos.json
 *      {
 *        "secret_id": "AKIDxxxxxxxx",
 *        "secret_key": "xxxxxxxx",
 *        "region": "ap-guangzhou",
 *        "bucket": "your-bucket-1300000000"
 *      }
 *
 * 用法：
 *   bun run upload:dist --dry-run    # 只看会传什么
 *   bun run upload:dist              # 真正上传
 *   bun run upload:dist --source web/dist/static --prefix jingyuai-api/static/
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import COS from 'cos-nodejs-sdk-v5';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(here, '..');
const PROJECT_DIR = path.resolve(WEB_DIR, '..');
const DEFAULT_SOURCE = path.join(WEB_DIR, 'dist', 'static');
const DEFAULT_CONFIG = path.join(PROJECT_DIR, '.local', 'cos.json');
const DEFAULT_PREFIX = 'jingyuai-api/static/';

/** 构建产物文件名带内容 hash，内容永不变，可以永久缓存。 */
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const CONTENT_TYPES = new Map([
  ['.js', 'application/javascript; charset=utf-8'],
  ['.mjs', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.otf', 'font/otf'],
  ['.eot', 'application/vnd.ms-fontobject'],
]);

function contentTypeFor(file) {
  return CONTENT_TYPES.get(path.extname(file).toLowerCase()) ?? 'application/octet-stream';
}

function parseArgs(argv) {
  const options = {
    source: DEFAULT_SOURCE,
    prefix: DEFAULT_PREFIX,
    config: DEFAULT_CONFIG,
    dryRun: false,
    workers: 16,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--dry-run') options.dryRun = true;
    else if (token === '--source') options.source = path.resolve(argv[++index]);
    else if (token === '--prefix') options.prefix = argv[++index];
    else if (token === '--config') options.config = path.resolve(argv[++index]);
    else if (token === '--workers') options.workers = Number(argv[++index]);
  }
  if (!options.prefix.endsWith('/')) options.prefix += '/';
  return options;
}

async function loadCredentials(configPath) {
  const fromEnv = {
    secret_id: process.env.COS_SECRET_ID,
    secret_key: process.env.COS_SECRET_KEY,
    region: process.env.COS_REGION,
    bucket: process.env.COS_BUCKET,
  };
  if (fromEnv.secret_id && fromEnv.secret_key && fromEnv.region && fromEnv.bucket) {
    return { ...fromEnv, origin: '环境变量' };
  }
  if (!existsSync(configPath)) {
    throw new Error(
      `找不到凭据。请设置环境变量 COS_SECRET_ID / COS_SECRET_KEY / COS_REGION / COS_BUCKET，` +
        `或创建 ${configPath}`,
    );
  }
  const data = JSON.parse(await readFile(configPath, 'utf8'));
  const missing = ['secret_id', 'secret_key', 'region', 'bucket'].filter((key) => !data[key]);
  if (missing.length) throw new Error(`配置文件缺少字段：${missing.join(', ')}`);
  return { ...data, origin: configPath };
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function listRemote(cos, params) {
  return new Promise((resolve, reject) => {
    cos.getBucket(params, (error, data) => (error ? reject(error) : resolve(data)));
  });
}

function putObject(cos, params) {
  return new Promise((resolve, reject) => {
    cos.putObject(params, (error, data) => (error ? reject(error) : resolve(data)));
  });
}

/** 列出远端 prefix 下所有对象，返回 Map<key, size>。 */
async function collectRemote(cos, bucket, region, prefix) {
  const remote = new Map();
  let marker = '';
  for (;;) {
    const page = await listRemote(cos, {
      Bucket: bucket,
      Region: region,
      Prefix: prefix,
      Marker: marker,
      MaxKeys: 1000,
    });
    for (const item of page.Contents ?? []) remote.set(item.Key, Number(item.Size));
    if (String(page.IsTruncated).toLowerCase() !== 'true') break;
    marker = page.NextMarker ?? '';
    if (!marker) break;
  }
  return remote;
}

async function mapLimit(items, limit, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) return;
      await worker(items[current]);
    }
  });
  await Promise.all(runners);
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!existsSync(options.source)) throw new Error(`源目录不存在：${options.source}`);

  const creds = await loadCredentials(options.config);
  const cos = new COS({ SecretId: creds.secret_id, SecretKey: creds.secret_key });
  const { bucket, region } = creds;

  const files = await walk(options.source);
  const local = new Map();
  for (const file of files) {
    const key = options.prefix + path.relative(options.source, file).split(path.sep).join('/');
    local.set(key, file);
  }
  const localBytes = [...local.values()].reduce((sum, file) => sum + statSync(file).size, 0);

  console.log(`[scan]   本地 ${options.source}`);
  console.log(`         本地文件 ${local.size.toLocaleString()} 个，${mb(localBytes)}`);

  const remote = await collectRemote(cos, bucket, region, options.prefix);
  const remoteBytes = [...remote.values()].reduce((sum, size) => sum + size, 0);
  console.log(`[scan]   远端 cos://${bucket}/${options.prefix}  (凭据来源：${creds.origin})`);
  console.log(`         远端对象 ${remote.size.toLocaleString()} 个，${mb(remoteBytes)}`);

  const uploads = [];
  for (const [key, file] of local) {
    const size = statSync(file).size;
    if (!remote.has(key)) uploads.push({ key, file, kind: '新增', size });
    else if (remote.get(key) !== size) uploads.push({ key, file, kind: '大小变化', size });
    // 同名同大小：文件名带 hash，内容必然一致，跳过
  }
  const orphans = [...remote.keys()].filter((key) => !local.has(key));
  const uploadBytes = uploads.reduce((sum, item) => sum + item.size, 0);

  console.log(
    `\n[plan]   需上传 ${uploads.length.toLocaleString()} 个（${mb(uploadBytes)}），` +
      `跳过 ${(local.size - uploads.length).toLocaleString()} 个`,
  );
  for (const kind of ['新增', '大小变化']) {
    const count = uploads.filter((item) => item.kind === kind).length;
    if (count) console.log(`         ${kind}：${count} 个`);
  }
  if (orphans.length) {
    console.log(`         远端保留 ${orphans.length.toLocaleString()} 个本地已不存在的旧文件（本次不会删除）`);
  }

  if (!uploads.length) {
    console.log('\n[done]   无需上传');
    return;
  }

  if (options.dryRun) {
    for (const item of uploads.slice(0, 20)) {
      console.log(`         [${item.kind}] ${item.key}  (${item.size.toLocaleString()} B)`);
    }
    if (uploads.length > 20) console.log(`         …… 其余 ${uploads.length - 20} 个省略`);
    console.log('\n[dry-run] 未执行上传');
    return;
  }

  const started = Date.now();
  let done = 0;
  const failures = [];

  await mapLimit(uploads, options.workers, async (item) => {
    try {
      await putObject(cos, {
        Bucket: bucket,
        Region: region,
        Key: item.key,
        Body: createReadStream(item.file),
        ContentType: contentTypeFor(item.file),
        CacheControl: CACHE_CONTROL,
      });
    } catch (error) {
      failures.push({ key: item.key, reason: error.message });
      console.log(`[fail]   ${item.key}  ${error.message}`);
    }
    done += 1;
    if (done % 50 === 0 || done === uploads.length) console.log(`[upload] ${done}/${uploads.length}`);
  });

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n[done]   上传 ${uploads.length - failures.length} 个，耗时 ${seconds}s`);
  if (failures.length) {
    console.log(`[warn]   ${failures.length} 个失败：`);
    for (const failure of failures.slice(0, 10)) console.log(`         ${failure.key}  ${failure.reason}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[error] ${error.message}`);
  process.exit(1);
});
