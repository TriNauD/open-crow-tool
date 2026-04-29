/**
 * Chrome 扩展桥接 E2E（需已构建 chrome-extension/dist）。
 *
 * 覆盖手工回归常见场景：
 * - 已连接 + 顶层文档划词 → 浮标出现
 * - 未连接 + 划词 → 无浮标（仅有宿主、无 .crow-btn）
 * - 先划词（未连接）再写入 storage → 模拟「连接插件」后仍应出现浮标（merge dom ?? prev）
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
  expectNoCrowFab,
  extensionSeed,
  selectIframeParagraphAndPointerUp,
  selectTopParagraphAndPointerUp,
  test,
} from './extension-fixtures';

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

  test('E2E-EXT-02 未连接时划词不出现浮标', async ({ page }) => {
    await page.goto('/e2e-extension-host.html');
    await expect(page.locator('#crow-ext-host')).toBeAttached({
      timeout: 20_000,
    });
    await selectTopParagraphAndPointerUp(page);
    await expectNoCrowFab(page);
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
    await expectNoCrowFab(page);

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
            const btn = el.shadowRoot?.querySelector(
              '.crow-btn'
            ) as HTMLElement | null;
            if (!btn) return false;
            const r = btn.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          }),
        { timeout: 20_000 }
      )
      .toBe(true);
  });

  test('E2E-EXT-05 Options 页显示已连接', async ({
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
