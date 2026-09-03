/**
 * 加载未打包扩展（chrome-extension/dist）的 Playwright 上下文。
 *
 * 前置：在仓库根目录执行 `npm run build --prefix chrome-extension`。
 *
 * @see https://playwright.dev/docs/chrome-extensions
 */
/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixture API uses `use` */
import fs from 'node:fs';
import path from 'node:path';
import {
  test as base,
  chromium,
  expect,
  type BrowserContext,
  type Page,
  type Worker,
  type TestInfo,
} from '@playwright/test';

const repoRoot = process.cwd();

const port =
  process.env.PORT ?? process.env.PLAYWRIGHT_PORT ?? '3107';
export const e2eBaseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

const pathToExtension = path.join(repoRoot, 'chrome-extension', 'dist');

function assertExtensionBuilt() {
  const mf = path.join(pathToExtension, 'manifest.json');
  if (!fs.existsSync(mf)) {
    throw new Error(
      `Missing ${mf}. Run: npm run build --prefix chrome-extension`
    );
  }
}

async function getExtensionServiceWorker(context: BrowserContext) {
  let [sw] = context.serviceWorkers();
  if (!sw) {
    try {
      sw = await context.waitForEvent('serviceworker', { timeout: 30_000 });
    } catch {
      [sw] = context.serviceWorkers();
    }
  }
  if (!sw) {
    throw new Error(
      'Extension service worker not found. Check chrome-extension/dist and Chromium channel.'
    );
  }
  return sw;
}

function extensionIdFromWorker(sw: { url: () => string }) {
  const u = sw.url();
  try {
    const parsed = new URL(u);
    if (parsed.hostname) return parsed.hostname;
  } catch {
    /* ignore */
  }
  const parts = u.split('/');
  return parts.length > 2 ? parts[2] : '';
}

async function seedCrowAuth(worker: Worker, apiBaseUrl: string) {
  const crow: Record<string, string | number | null> = {
    apiBaseUrl,
    accessToken: 'e2e-test-access-token-not-valid-jwt',
    refreshToken: '',
    supabaseUrl: '',
    supabaseAnonKey: '',
    expiresAt: null,
    crowAuthUpdatedAt: Date.now(),
  };
  type StorageLocal = {
    set: (items: Record<string, unknown>) => Promise<void>;
  };
  await worker.evaluate(
    async (c) => {
      const chromeApi = (
        globalThis as unknown as {
          chrome?: { storage?: { local?: StorageLocal } };
        }
      ).chrome;
      if (!chromeApi?.storage?.local) {
        throw new Error('no chrome.storage in SW');
      }
      await chromeApi.storage.local.set(c);
    },
    crow as Record<string, unknown>
  );
}

async function clearCrowAuth(worker: Worker) {
  await worker.evaluate(async () => {
    const chromeApi = (
      globalThis as unknown as {
        chrome?: { storage?: { local?: { clear: () => Promise<void> } } };
      }
    ).chrome;
    if (!chromeApi?.storage?.local) {
      throw new Error('no chrome.storage in SW');
    }
    await chromeApi.storage.local.clear();
  });
}

/** 在宿主页「这是啥？」划词浮标（锚点模式在亮 DOM body 直下，回退模式在开放 Shadow root 内） */
export async function expectCrowFabVisible(page: Page, timeout = 20_000) {
  const host = page.locator('#crow-ext-host');
  await expect(host).toBeAttached({ timeout });
  await expect
    .poll(
      async () =>
        host.evaluate((el: HTMLElement) => {
          const light = document.body.querySelector(
            ':scope > button.crow-btn'
          ) as HTMLElement | null;
          const btn =
            light ?? (el.shadowRoot?.querySelector('.crow-btn') as HTMLElement | null);
          if (!btn) return false;
          const r = btn.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }),
      { timeout }
    )
    .toBe(true);
}

export async function expectNoCrowFab(page: Page, timeout = 12_000) {
  const host = page.locator('#crow-ext-host');
  await expect(host).toBeAttached({ timeout });
  await expect
    .poll(
      async () =>
        host.evaluate((el: HTMLElement) => {
          return (
            !document.body.querySelector(':scope > button.crow-btn') &&
            !el.shadowRoot?.querySelector('.crow-btn')
          );
        }),
      { timeout }
    )
    .toBe(true);
}

export async function selectTopParagraphAndPointerUp(page: Page) {
  await selectSelectorAndPointerUp(page, '#selectable');
}

/** 划选指定选择器内的全部内容并派发 pointerup（触发扩展的选区读取） */
export async function selectSelectorAndPointerUp(page: Page, selector: string) {
  await page.locator(selector).evaluate((el: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  });
  await page.evaluate(() => {
    document.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, cancelable: true })
    );
  });
}

export interface FabRect {
  top: number;
  left: number;
}

/**
 * 浮标当前矩形（仅在其真正可见时返回）。
 * 锚点模式在亮 DOM body 直下，回退模式在开放 Shadow root 内。
 */
export async function crowFabRect(page: Page): Promise<FabRect | null> {
  const host = page.locator('#crow-ext-host');
  return host.evaluate((el: HTMLElement) => {
    const light = document.body.querySelector(
      ':scope > button.crow-btn'
    ) as HTMLElement | null;
    const btn =
      light ?? (el.shadowRoot?.querySelector('.crow-btn') as HTMLElement | null);
    if (!btn) return null;
    if (getComputedStyle(btn).visibility !== 'visible') return null;
    const r = btn.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return { top: Math.round(r.top), left: Math.round(r.left) };
  });
}

/** 连续采样浮标位置（返回每次采样的整数矩形） */
export async function sampleCrowFabRect(
  page: Page,
  times: number,
  intervalMs: number
): Promise<FabRect[]> {
  return page.evaluate(
    async ({ times: n, intervalMs: gap }) => {
      const out: { top: number; left: number }[] = [];
      const read = () => {
        const light = document.body.querySelector(
          ':scope > button.crow-btn'
        ) as HTMLElement | null;
        const host = document.getElementById('crow-ext-host');
        const btn =
          light ??
          (host?.shadowRoot?.querySelector('.crow-btn') as HTMLElement | null);
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return { top: Math.round(r.top), left: Math.round(r.left) };
      };
      for (let i = 0; i < n; i += 1) {
        const r = read();
        if (r) out.push(r);
        await new Promise((res) => setTimeout(res, gap));
      }
      return out;
    },
    { times, intervalMs }
  );
}

/** 浮标当前矩形 + 选区矩形（视口坐标），用于断言「浮标与词一起走」 */
export async function crowFabAndSelectionRect(page: Page) {
  return page.evaluate(() => {
    const light = document.body.querySelector(
      ':scope > button.crow-btn'
    ) as HTMLElement | null;
    const host = document.getElementById('crow-ext-host');
    const btn =
      light ??
      (host?.shadowRoot?.querySelector('.crow-btn') as HTMLElement | null);
    const sel = window.getSelection();
    if (!btn || !sel || sel.isCollapsed || !sel.rangeCount) return null;
    const b = btn.getBoundingClientRect();
    const s = sel.getRangeAt(0).getBoundingClientRect();
    return { fabTop: b.top, selTop: s.top };
  });
}

export async function selectIframeParagraphAndPointerUp(page: Page) {
  const fl = page.frameLocator('iframe#inner');
  await fl.locator('#innerp').evaluate((el: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  });
  await fl.locator('body').evaluate(() => {
    document.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, cancelable: true })
    );
  });
}

export const test = base.extend<{
  extensionContext: BrowserContext;
  extensionWorker: Worker;
  extensionId: string;
}>({
  extensionContext: async ({}, use, testInfo: TestInfo) => {
    assertExtensionBuilt();
    const userDataDir = path.join(testInfo.outputDir, 'crow-ext-profile');
    fs.mkdirSync(userDataDir, { recursive: true });

    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
      baseURL: e2eBaseURL,
    });

    const warmup = await context.newPage();
    await warmup.goto('/e2e-extension-host.html');
    await expect(warmup.locator('#crow-ext-host')).toBeAttached({
      timeout: 30_000,
    });
    await warmup.close();

    await use(context);
    await context.close();
  },

  extensionWorker: async ({ extensionContext }, use) => {
    const sw = await getExtensionServiceWorker(extensionContext);
    await use(sw);
  },

  extensionId: async ({ extensionWorker }, use) => {
    await use(extensionIdFromWorker(extensionWorker));
  },

  /** 覆盖默认 context：扩展用持久化上下文（否则 page / expect 无法命中扩展）。 */
  context: async ({ extensionContext }, use) => {
    await use(extensionContext);
  },
});

export { expect };

export const extensionSeed = { seedCrowAuth, clearCrowAuth, e2eBaseURL };
