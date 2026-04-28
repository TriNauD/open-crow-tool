/**
 * 本地/CI 对齐的一次性校验：lint → test → Next build（占位 Supabase）→ 扩展 build。
 * 环境变量与 .github/workflows/ci.yml 中 job 级 env 保持一致；若改这里请同步改 CI。
 *
 * 与 GitHub Actions 的差异（有意识保留）：
 * - CI 在 Next build 之后还会 playwright install + npm run test:e2e；本脚本默认不跑 E2E（慢、需浏览器）。
 *   提 PR 前若要完全对齐 CI：先 npm run build，再 npx playwright install --with-deps chromium，再 npm run test:e2e
 *   （或设 VERIFY_E2E=1 走下方可选步骤）。
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const ciBuildEnv = {
  ...process.env,
  SUPABASE_URL: 'https://ci-placeholder.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder',
  NEXT_PUBLIC_SUPABASE_URL: 'https://ci-placeholder.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder',
  NOTEBOOK_MULTI_USER_ENABLED: 'true',
};

const isWin = process.platform === 'win32';

function run(cmd, args, { cwd = root, env } = {}) {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd,
    env: env ?? { ...process.env },
    shell: isWin,
  });
  if (r.error) {
    console.error(r.error);
    process.exit(1);
  }
  if (r.status !== 0) {
    process.exit(r.status === null || r.status === undefined ? 1 : r.status);
  }
}

run('npm', ['run', 'lint'], { cwd: root, env: { ...process.env } });
run('npm', ['run', 'test'], { cwd: root, env: { ...process.env } });
run('npm', ['run', 'build'], { cwd: root, env: { ...ciBuildEnv } });

if (process.env.VERIFY_E2E === '1') {
  run('npx', ['playwright', 'install', '--with-deps', 'chromium'], { cwd: root });
  run('npm', ['run', 'test:e2e'], {
    cwd: root,
    env: { ...process.env, PORT: process.env.PORT ?? '3107' },
  });
}

const extRoot = join(root, 'chrome-extension');
run('npm', ['ci'], { cwd: extRoot, env: { ...process.env } });
run('npm', ['run', 'build'], { cwd: extRoot, env: { ...process.env } });
