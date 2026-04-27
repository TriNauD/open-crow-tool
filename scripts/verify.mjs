/**
 * 本地/CI 对齐的一次性校验：lint → test → Next build（占位 Supabase）→ 扩展 build。
 * 环境变量与 .github/workflows/ci.yml 中 job 级 env 保持一致；若改这里请同步改 CI。
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

const extRoot = join(root, 'chrome-extension');
run('npm', ['ci'], { cwd: extRoot, env: { ...process.env } });
run('npm', ['run', 'build'], { cwd: extRoot, env: { ...process.env } });
