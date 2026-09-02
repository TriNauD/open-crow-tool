/**
 * 代码地图（docs/map/）同步校验：
 * 1) 分卷里以反引号列出的仓库路径必须真实存在；
 * 2) app/ lib/ components/ hooks/ chrome-extension/src/ db/migrations/ 下的
 *    *.ts / *.tsx / *.sql 源文件必须被至少一卷收录（*.d.ts 声明文件豁免）。
 * 挂在 npm run verify 与 CI：地图不同步 → 构建红。改这里请同步 ci.yml 的对应步骤。
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mapDir = join(root, 'docs', 'map');

/** 收录覆盖检查的源码目录（存在性检查的前缀比这里更宽，见 PATH_PREFIXES） */
const SCAN_DIRS = ['app', 'lib', 'components', 'hooks', 'chrome-extension/src', 'db/migrations'];
const COVER_EXTS = new Set(['.ts', '.tsx', '.sql']);
/** 反引号内以这些前缀开头的「文件样」路径会做存在性检查 */
const PATH_PREFIXES = [
  'app/',
  'lib/',
  'components/',
  'hooks/',
  'chrome-extension/',
  'db/migrations/',
  'scripts/',
  'e2e/',
  '__tests__/',
];
const FILE_LIKE_EXTS = /\.(ts|tsx|mjs|js|cjs|json|sql|md|css|html)$/i;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function toRelPosix(p) {
  return relative(root, p).split(sep).join('/');
}

function extractBacktickSpans(text) {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
}

function isPathLikeSpan(span) {
  if (/\s/.test(span)) return false;
  if (!FILE_LIKE_EXTS.test(span)) return false;
  return PATH_PREFIXES.some((prefix) => span.startsWith(prefix));
}

const mapFiles = readdirSync(mapDir).filter((f) => f.endsWith('.md'));
if (mapFiles.length === 0) {
  console.error('[check-map] docs/map/ 下没有任何 .md 分卷');
  process.exit(1);
}

const spans = [];
for (const f of mapFiles) {
  const text = readFileSync(join(mapDir, f), 'utf8');
  spans.push(...extractBacktickSpans(text));
}

const mentioned = new Set(spans.filter(isPathLikeSpan));
const stale = [...mentioned].filter((p) => !existsSync(join(root, p)));

const sources = walk(root)
  .map(toRelPosix)
  .filter((p) => SCAN_DIRS.some((d) => p === d || p.startsWith(d + '/')))
  .filter((p) => COVER_EXTS.has(p.slice(p.lastIndexOf('.'))))
  .filter((p) => !p.endsWith('.d.ts'))
  .sort();
const missing = sources.filter((p) => !mentioned.has(p));

if (stale.length > 0) {
  console.error(`[check-map] 地图中列出但已不存在的路径（更新对应分卷或删除条目）：`);
  for (const p of stale) console.error(`  - ${p}`);
}
if (missing.length > 0) {
  console.error(`[check-map] 源码目录中未被任何分卷收录的文件（补进 docs/map/ 对应分卷）：`);
  for (const p of missing) console.error(`  - ${p}`);
}
if (stale.length > 0 || missing.length > 0) {
  console.error(`[check-map] 未通过：${stale.length} 条失效路径，${missing.length} 个未收录文件。约定见 docs/map/README.md。`);
  process.exit(1);
}

console.log(`[check-map] OK：${mapFiles.length} 个分卷，覆盖 ${sources.length} 个源码文件，无失效路径。`);
