#!/usr/bin/env node
/**
 * 从 web/public/logo.png 生成多尺寸 favicon.ico。
 *
 * 用 Node 而不是 Python：项目本身就是 Bun/Node 生态，换电脑只需要
 * `bun install`，不用额外装运行时或 pip 包。
 *
 * 依赖：sharp（已在 devDependencies 里）
 *
 * 用法：
 *   bun run favicon                # 默认：深色圆角底板版
 *   bun run favicon --transparent  # 纯透明底版
 *   bun run favicon --preview      # 额外输出白底/深色底对比图
 *
 * 旧文件备份到 .local/favicon-backup/，文件名带时间戳，永不覆盖。
 */
import { existsSync, statSync } from 'node:fs';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(here, '..');
const PROJECT_DIR = path.resolve(WEB_DIR, '..');
const LOGO = path.join(WEB_DIR, 'public', 'logo.png');
const OUTPUT = path.join(WEB_DIR, 'public', 'favicon.ico');
const BACKUP_DIR = path.join(PROJECT_DIR, '.local', 'favicon-backup');
const PREVIEW_DIR = path.join(BACKUP_DIR, 'preview');

/** 浏览器与系统实际会用到的尺寸；256 在 ICO 里用 0 表示。 */
const ICO_SIZES = [16, 32, 48, 64, 128, 256];
const PREVIEW_STRIP = [16, 32, 48, 64, 128];
/** slate-900，与主流产品 favicon 的深色底板一致。 */
const PLATE_COLOR = '#0f172a';
const PLATE_RADIUS_RATIO = 0.22;
const LOGO_INSET_RATIO = 0.78;

/** logo 不是正方形时居中裁切，避免非等比缩放把图形压扁。 */
async function toSquare(buffer) {
  const meta = await sharp(buffer).metadata();
  const { width, height } = meta;
  if (!width || !height) throw new Error('无法读取 logo 尺寸');
  if (width === height) return buffer;
  const side = Math.min(width, height);
  console.log(`[crop] ${width}x${height} 不是正方形，居中裁切为 ${side}x${side}`);
  return sharp(buffer)
    .extract({
      left: Math.floor((width - side) / 2),
      top: Math.floor((height - side) / 2),
      width: side,
      height: side,
    })
    .png()
    .toBuffer();
}

/** 渲染单个尺寸；transparent 保持透明，plated 叠一层深色圆角底板。 */
async function renderSize(source, size, variant) {
  if (variant === 'transparent') {
    return sharp(source)
      .resize(size, size, { kernel: 'lanczos3' })
      .png()
      .toBuffer();
  }
  const inner = Math.round(size * LOGO_INSET_RATIO);
  const radius = (size * PLATE_RADIUS_RATIO).toFixed(2);
  const plateSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" rx="${radius}" fill="${PLATE_COLOR}"/></svg>`,
  );
  const plate = await sharp(plateSvg).png().toBuffer();
  const logo = await sharp(source)
    .resize(inner, inner, { kernel: 'lanczos3' })
    .png()
    .toBuffer();
  const offset = Math.floor((size - inner) / 2);
  return sharp(plate)
    .composite([{ input: logo, top: offset, left: offset }])
    .png()
    .toBuffer();
}

/**
 * 组装 ICO 容器。现代格式允许直接内嵌 PNG 数据（Vista+），
 * 所以不需要写 BMP/DIB 编码器。
 */
function buildIco(items) {
  const count = items.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(count, 4);

  const entries = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const blobs = [];

  items.forEach((item, index) => {
    const base = index * 16;
    const dimension = item.size >= 256 ? 0 : item.size;
    entries.writeUInt8(dimension, base + 0); // width
    entries.writeUInt8(dimension, base + 1); // height
    entries.writeUInt8(0, base + 2); // 调色板数量
    entries.writeUInt8(0, base + 3); // reserved
    entries.writeUInt16LE(1, base + 4); // color planes
    entries.writeUInt16LE(32, base + 6); // bits per pixel
    entries.writeUInt32LE(item.buffer.length, base + 8); // 数据长度
    entries.writeUInt32LE(offset, base + 12); // 数据偏移
    offset += item.buffer.length;
    blobs.push(item.buffer);
  });

  return Buffer.concat([header, entries, ...blobs]);
}

/** 白底 / 深色底对比图，检查小尺寸下的可读性。 */
async function writePreviews(rows) {
  await mkdir(PREVIEW_DIR, { recursive: true });
  const pad = 24;
  const rowHeight = 128 + pad * 2;
  const width = pad + PREVIEW_STRIP.reduce((sum, size) => sum + size + pad, 0);
  const height = rowHeight * rows.length;

  for (const backdrop of [
    { name: 'white', color: '#ffffff' },
    { name: 'dark', color: '#202020' },
  ]) {
    const composites = [];
    rows.forEach((row, rowIndex) => {
      let x = pad;
      for (const size of PREVIEW_STRIP) {
        composites.push({
          input: row.buffers.get(size),
          top: rowIndex * rowHeight + pad + Math.floor((128 - size) / 2),
          left: x,
        });
        x += size + pad;
      }
    });
    const file = path.join(PREVIEW_DIR, `favicon-${backdrop.name}.png`);
    await sharp({ create: { width, height, channels: 4, background: backdrop.color } })
      .composite(composites)
      .png()
      .toFile(file);
    console.log(`[preview] ${file}`);
  }
  console.log(`          第一行 = ${rows[0]?.name ?? ''}，第二行 = ${rows[1]?.name ?? ''}`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const variant = args.has('--transparent') ? 'transparent' : 'plated';
  const wantPreview = args.has('--preview');

  if (!existsSync(LOGO)) throw new Error(`找不到 logo：${LOGO}`);

  await mkdir(BACKUP_DIR, { recursive: true });
  if (existsSync(OUTPUT)) {
    const stamp = new Date()
      .toISOString()
      .replaceAll(/[-:]/g, '')
      .replace('T', '-')
      .slice(0, 15);
    const backup = path.join(BACKUP_DIR, `favicon-old-${stamp}.ico`);
    await copyFile(OUTPUT, backup);
    console.log(`[backup] ${backup}  (${statSync(OUTPUT).size.toLocaleString()} bytes)`);
  }

  const source = await toSquare(await sharp(LOGO).ensureAlpha().png().toBuffer());

  const transparentBuffers = new Map();
  const platedBuffers = new Map();
  for (const size of ICO_SIZES) {
    transparentBuffers.set(size, await renderSize(source, size, 'transparent'));
    platedBuffers.set(size, await renderSize(source, size, 'plated'));
  }

  const chosen = variant === 'plated' ? platedBuffers : transparentBuffers;
  const ico = buildIco(ICO_SIZES.map((size) => ({ size, buffer: chosen.get(size) })));
  await writeFile(OUTPUT, ico);

  // sharp 不能解码 ICO，直接按自己写入的容器结构汇报即可。
  console.log(`[write]  ${OUTPUT}`);
  console.log(`         变体=${variant}  ${ico.length.toLocaleString()} bytes`);
  console.log(`         尺寸=${ICO_SIZES.join('/')}（256 在容器里记为 0）`);

  if (wantPreview) {
    await writePreviews([
      { name: '透明版', buffers: transparentBuffers },
      { name: '底板版', buffers: platedBuffers },
    ]);
  }
}

main().catch((error) => {
  console.error(`[error] ${error.message}`);
  process.exit(1);
});
