/**
 * Chrome 扩展桥接 E2E（需已构建 chrome-extension/dist）。
 *
 * 覆盖手工回归常见场景：
 * - 已连接 + 顶层文档划词 → 浮标出现
 * - 未连接 + 划词 → 仍出现浮标（可点进解释；保存需连接）
 * - 先划词（未连接）再写入 storage → 模拟「连接插件」后浮标仍应可见（保留选区）
 * - 同源 iframe 内划词 → 浮标出现
 * - Options 页在写入 storage 后展示已连接
 *
 * 运行：npm run build --prefix chrome-extension && npm run test:e2e
 * 或：npm run test:e2e:ext
 */

import {
  e2eBaseURL,
  expect,
  expectCrowFabVisible,
  crowFabRect,
  crowFabAndSelectionRect,
  extensionSeed,
  sampleCrowFabRect,
  selectIframeParagraphAndPointerUp,
  selectSelectorAndPointerUp,
  selectTopParagraphAndPointerUp,
  test,
} from './extension-fixtures';
import type { Page } from '@playwright/test';

/** 等浮标真正可见并越过静默期 + 兜底复检窗口（1050ms）后的最终落位 */
async function settledFabRect(page: Page) {
  await expect
    .poll(async () => crowFabRect(page), { timeout: 15_000 })
    .not.toBeNull();
  await page.waitForTimeout(1250);
  return crowFabRect(page);
}

test.beforeEach(async ({ extensionWorker }) => {
  await extensionSeed.clearCrowAuth(extensionWorker);
});

test.describe('Crow extension bridge', () => {
  test('E2E-EXT-01 已连接时顶层划词出现浮标', async ({
    page,
    extensionWorker,
  }) => {
    await extensionSeed.seedCrowAuth(extensionWorker, e2eBaseURL);
    await page.goto('/e2e-extension-host.html');
    await expect(page.locator('#crow-ext-host')).toBeAttached({
      timeout: 20_000,
    });
    await selectTopParagraphAndPointerUp(page);
    await expectCrowFabVisible(page);
  });

  test('E2E-EXT-02 未连接时划词仍出现浮标', async ({ page }) => {
    await page.goto('/e2e-extension-host.html');
    await expect(page.locator('#crow-ext-host')).toBeAttached({
      timeout: 20_000,
    });
    await selectTopParagraphAndPointerUp(page);
    await expectCrowFabVisible(page);
  });

  test('E2E-EXT-03 先划词再写入会话仍应出现浮标', async ({
    page,
    extensionWorker,
  }) => {
    await page.goto('/e2e-extension-host.html');
    await expect(page.locator('#crow-ext-host')).toBeAttached({
      timeout: 20_000,
    });
    await selectTopParagraphAndPointerUp(page);
    await expectCrowFabVisible(page);

    await extensionSeed.seedCrowAuth(extensionWorker, e2eBaseURL);
    await expectCrowFabVisible(page, 25_000);
  });

  test('E2E-EXT-04 iframe 内划词出现浮标', async ({
    page,
    extensionWorker,
  }) => {
    await extensionSeed.seedCrowAuth(extensionWorker, e2eBaseURL);
    await page.goto('/e2e-extension-host.html');
    const innerFl = page.frameLocator('iframe#inner');
    await innerFl.locator('#innerp').waitFor({ state: 'visible', timeout: 15_000 });
    await selectIframeParagraphAndPointerUp(page);

    const frame = page.frameLocator('iframe#inner');
    const host = frame.locator('#crow-ext-host');
    await expect(host).toBeAttached({ timeout: 20_000 });
    await expect
      .poll(
        async () =>
          host.evaluate((el: HTMLElement) => {
            // 锚点定位模式在亮 DOM（本 frame 的 body），回退模式在 shadow root
            const light = document.body.querySelector(
              ':scope > button.crow-btn'
            ) as HTMLElement | null;
            const btn =
              light ?? (el.shadowRoot?.querySelector('.crow-btn') as HTMLElement | null);
            if (!btn) return false;
            const r = btn.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          }),
        { timeout: 20_000 }
      )
      .toBe(true);
  });

  test('E2E-EXT-06 浮标落位后不再上下横跳', async ({
    page,
    extensionWorker,
  }) => {
    test.slow();
    await extensionSeed.seedCrowAuth(extensionWorker, e2eBaseURL);
    await page.goto('/e2e-extension-host.html');
    await expect(page.locator('#crow-ext-host')).toBeAttached({
      timeout: 20_000,
    });
    await selectTopParagraphAndPointerUp(page);
    await expectCrowFabVisible(page);

    // 采样 2.5s：覆盖旧实现 400ms / 1000ms 的兜底复检时刻。
    // 自遮挡导致的「上方被占→翻下方→下方被占→翻上方」每 400ms 永久横跳，
    // 必然在这条断言上暴露。
    const samples = await sampleCrowFabRect(page, 25, 100);
    expect(samples.length).toBeGreaterThan(15);
    const distinct = new Set(samples.map((s) => `${s.top}|${s.left}`));
    expect([...distinct]).toHaveLength(1);
  });

  test('E2E-EXT-07 换一段划词后浮标固定到新词位置且不再移动', async ({
    page,
    extensionWorker,
  }) => {
    test.slow();
    await extensionSeed.seedCrowAuth(extensionWorker, e2eBaseURL);
    await page.goto('/e2e-extension-host.html');
    await expect(page.locator('#crow-ext-host')).toBeAttached({
      timeout: 20_000,
    });

    await selectTopParagraphAndPointerUp(page);
    const first = await settledFabRect(page);
    expect(first).not.toBeNull();

    await selectSelectorAndPointerUp(page, '#selectable-2');
    const second = await settledFabRect(page);
    expect(second).not.toBeNull();
    // 换了词：浮标必须跟着换位置
    expect(second!.top).not.toBe(first!.top);

    const samples = await sampleCrowFabRect(page, 15, 100);
    const distinct = new Set(samples.map((s) => `${s.top}|${s.left}`));
    expect([...distinct]).toHaveLength(1);
  });

  test('E2E-EXT-08 滚动时浮标与选区文字锁在一起（间隙恒定，一起移动）', async ({
    page,
    extensionWorker,
  }) => {
    test.slow();
    await extensionSeed.seedCrowAuth(extensionWorker, e2eBaseURL);
    await page.goto('/e2e-extension-host.html');
    await expect(page.locator('#crow-ext-host')).toBeAttached({
      timeout: 20_000,
    });
    await selectTopParagraphAndPointerUp(page);
    await settledFabRect(page);

    const before = await crowFabAndSelectionRect(page);
    expect(before).not.toBeNull();
    const gapBefore = before!.selTop - before!.fabTop;

    await page.evaluate(() => window.scrollBy(0, 160));
    await page.waitForTimeout(200);

    const after = await crowFabAndSelectionRect(page);
    expect(after).not.toBeNull();
    // 锁在一起：文字上移多少，浮标就上移多少（间隙不变 = 无漂移、无滞后）
    expect(Math.abs(before!.selTop - after!.selTop - 160)).toBeLessThan(2);
    expect(Math.abs(after!.selTop - after!.fabTop - gapBefore)).toBeLessThan(2);
  });

  test('E2E-EXT-10 transform 模拟滚动（不派发 scroll 事件）时浮标仍与选区锁在一起', async ({
    page,
    extensionWorker,
  }) => {
    test.slow();
    await extensionSeed.seedCrowAuth(extensionWorker, e2eBaseURL);
    await page.goto('/e2e-transform-scroll.html');
    await expect(page.locator('#p')).toBeAttached({ timeout: 20_000 });
    await selectSelectorAndPointerUp(page, '#p');
    await settledFabRect(page);

    const before = await crowFabAndSelectionRect(page);
    expect(before).not.toBeNull();
    const gapBefore = before!.selTop - before!.fabTop;

    // 站点用 transform 移动内容：全程不派发任何 scroll 事件。
    // 旧实现靠 scroll 事件触发更新，在此场景会完全冻结——本用例即为此而加。
    await page.evaluate(() => {
      const c = document.getElementById('content');
      if (c) c.style.transform = 'translateY(-160px)';
    });
    await page.waitForTimeout(250);

    const after = await crowFabAndSelectionRect(page);
    expect(after).not.toBeNull();
    // 持续 rAF 不依赖 scroll 事件：文字上移 160，浮标也上移 160（间隙恒定）
    expect(Math.abs(before!.selTop - after!.selTop - 160)).toBeLessThan(2);
    expect(Math.abs(after!.selTop - after!.fabTop - gapBefore)).toBeLessThan(2);
  });

  test('E2E-EXT-09 Options 页显示已连接', async ({
    page,
    extensionWorker,
    extensionId,
  }) => {
    expect(extensionId.length).toBeGreaterThan(4);
    await extensionSeed.seedCrowAuth(extensionWorker, e2eBaseURL);
    await page.goto(
      `chrome-extension://${extensionId}/src/options/index.html`
    );
    await expect(
      page.getByText('插件已连接到你的账号', { exact: false })
    ).toBeVisible({ timeout: 15_000 });
  });
});
