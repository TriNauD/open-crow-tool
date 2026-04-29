import { defineConfig, devices } from '@playwright/test';

/**
 * Browser E2E (see `qa-e2e-smoke`).
 *
 * Uses `npm run start` on an isolated PORT (default 3107) so Playwright never starts a second
 * `next dev` in the repo (Next 16 + Turbopack allow only one `next dev` per directory).
 *
 * Run locally after a production bundle exists:
 *   npm run build && npm run test:e2e
 * Or reuse your own preview / dev explicitly:
 *   PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
 *
 * CI: `Production build (Next.js)` precedes Playwright step; `.next/` is reused.
 * 含扩展用例（`e2e/extension-crow-bridge.spec.ts`）时须先有 `chrome-extension/dist`（CI 已在 E2E 前构建扩展）。
 */

const port =
  process.env.PORT ??
  process.env.PLAYWRIGHT_PORT ??
  '3107';
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run start',
        url: baseURL,
        reuseExistingServer: !!process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER,
        timeout: 180_000,
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, PORT: port },
      },
});
