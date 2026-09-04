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
            // 浮标 portal 到本 frame 的 body（亮 DOM 直下），shadow 兜底仅兼容历史实现
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

  test('E2E-EXT-11 锚定模式：平滑滚动期间浮标零 JS 干预（根治合成器相位差）', async ({
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

    // 平滑滚动制造一段持续滚动窗口，统计这期间浮标 style 被 JS 写入的次数。
    // 锚定模式下气泡是文档内容的一部分，浏览器合成滚动时把它和文字一起搬走，
    // JS 一次都不该写——这正是「合成器滚动 vs 主线程读坐标」相位差的根治点：
    // 只要在滚动中写坐标，就会把滞后的坐标盖到已滚到位的内容上，晃动原样回来。
    // （旧的 fixed + rAF 跟随方案在此处必然是每帧一次写入，约 60 次/秒。）
    const probe = await page.evaluate(async () => {
      const light = document.body.querySelector(
        ':scope > button.crow-btn'
      ) as HTMLElement | null;
      const host = document.getElementById('crow-ext-host');
      const btn =
        light ??
        (host?.shadowRoot?.querySelector('.crow-btn') as HTMLElement | null);
      if (!btn) return null;

      let writes = 0;
      const obs = new MutationObserver(() => {
        writes += 1;
      });
      obs.observe(btn, { attributes: true, attributeFilter: ['style'] });

      let lastScrollAt = Date.now();
      const onScroll = () => {
        lastScrollAt = Date.now();
      };
      window.addEventListener('scroll', onScroll, { passive: true });

      window.scrollBy({ top: 400, behavior: 'smooth' });
      await new Promise((r) => setTimeout(r, 150));

      // 采样时刻必须仍在滚动中，否则这次采样没有意义（静默期到了本就该校验）
      const stillScrolling = Date.now() - lastScrollAt < 50;
      obs.disconnect();
      window.removeEventListener('scroll', onScroll);
      return { writes, stillScrolling, position: getComputedStyle(btn).position };
    });

    expect(probe).not.toBeNull();
    // 先自证这条用例确实跑在锚定模式上：若退回 fixed，每帧都要写坐标，
    // 「零写入」断言必然失败——不会出现「回退了却恰好零写入」的假阳性。
    expect(probe!.position).toBe('absolute');
    expect(probe!.stillScrolling).toBe(true); // 再确认采样窗口确实落在滚动中
    expect(probe!.writes).toBe(0); // 最后断言滚动期间零写入

    // 滚停后位置仍然锁定：文字走了多少，气泡就走了多少
    await page.waitForTimeout(500);
    const after = await crowFabAndSelectionRect(page);
    expect(after).not.toBeNull();
    expect(after!.selTop).not.toBe(before!.selTop);
    expect(Math.abs(after!.selTop - after!.fabTop - gapBefore)).toBeLessThan(2);
  });

  test('E2E-EXT-12 锚定自检：气泡与文字脱钩时自动降级为 fixed 跟随', async ({
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

    const readPos = () =>
      page.evaluate(() => {
        const btn = document.body.querySelector(
          ':scope > button.crow-btn'
        ) as HTMLElement | null;
        return btn ? getComputedStyle(btn).position : null;
      });
    expect(await readPos()).toBe('absolute'); // 自证起点在锚定模式

    // 模拟脱钩：文字原地不动，只有气泡被挪走。等价于祖先变换在滚动中变化、
    // 气泡没被浏览器一起搬走——自检必须认出「文字没挪窝、gap 却漂了」并降级。
    await page.evaluate(() => {
      const btn = document.body.querySelector(
        ':scope > button.crow-btn'
      ) as HTMLElement | null;
      if (!btn) return;
      const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(btn.style.transform);
      if (!m) return;
      btn.style.transform = `translate(${m[1]}px, ${Number(m[2]) + 60}px) translateX(-50%)`;
    });

    // 等过静默期（140ms）+ 校验间隔（200ms），自检才会跑
    await page.waitForTimeout(800);
    expect(await readPos()).toBe('fixed');
  });

  test('E2E-EXT-13 锚定自检：reflow 只纠偏、不误判成脱钩降级', async ({
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

    // 模拟 reflow：内容上方撑开 180px（等价于 x.com 滚动时图片懒加载把文字顶下去）。
    // 文字在文档坐标里**真的挪了窝**，所以这是正常重排，不是锚定失效——
    // 按漂移大小判定会把这种几百像素的 reflow 全误杀成脱钩（x.com 上必然踩中）。
    await page.evaluate(() => {
      document.body.style.paddingTop = '180px';
    });

    await page.waitForTimeout(900);

    const pos = await page.evaluate(() => {
      const btn = document.body.querySelector(
        ':scope > button.crow-btn'
      ) as HTMLElement | null;
      return btn ? getComputedStyle(btn).position : null;
    });
    expect(pos).toBe('absolute'); // 没降级

    // 而且气泡应该已经纠偏、重新贴回文字
    const after = await crowFabAndSelectionRect(page);
    expect(after).not.toBeNull();
    expect(after!.selTop).toBeGreaterThan(before!.selTop + 100); // 文字确实下移了
    expect(Math.abs(after!.selTop - after!.fabTop - gapBefore)).toBeLessThan(2);
  });

  test('E2E-EXT-14 容器级锚定：气泡锚进独立滚动容器、随其一起滚（根治 ds/chatgpt 类站点）', async ({
    page,
    extensionWorker,
  }) => {
    test.slow();
    await extensionSeed.seedCrowAuth(extensionWorker, e2eBaseURL);
    await page.goto('/e2e-extension-host.html');
    await expect(page.locator('#crow-ext-host')).toBeAttached({
      timeout: 20_000,
    });
    // 在「独立滚动容器」内部划词，验证气泡锚进容器而非 body，随容器一起滚
    await selectSelectorAndPointerUp(page, '#selectable-in-box');
    // 等气泡出现（body 直子或 #scroll-box 内部都认）
    await page
      .waitForFunction(
        () => {
          const box = document.getElementById('scroll-box');
          return !!box?.querySelector('button.crow-btn') ||
            !!document.body.querySelector(':scope > button.crow-btn');
        },
        { timeout: 15_000 }
      )
      .catch(() => {});

    const probe = await page.evaluate(async () => {
      const box = document.getElementById('scroll-box') as HTMLElement | null;
      // 每次都重新查询「当前实时气泡」，避免持有被 React 协调重建过的陈旧引用
      const liveFab = () =>
        (box?.querySelector('button.crow-btn') as HTMLElement | null) ??
        (document.body.querySelector(':scope > button.crow-btn') as HTMLElement | null);
      const gapOf = () => {
        const f = liveFab();
        const sel = window.getSelection();
        if (!f || !sel || sel.isCollapsed || !sel.rangeCount) return null;
        const s = sel.getRangeAt(0).getBoundingClientRect();
        return s.top - f.getBoundingClientRect().top;
      };

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return { error: 'no-sel' };

      const fabBefore = liveFab();
      const gapBefore = gapOf();
      const inBoxBefore = !!box && !!fabBefore && box.contains(fabBefore);
      const posBefore = fabBefore ? getComputedStyle(fabBefore).position : null;

      // 多次滚动施压：验证气泡与文字一起走（gap 恒定），且组件不重挂
      let writes = 0;
      const obs = fabBefore
        ? new MutationObserver(() => {
            writes += 1;
          })
        : null;
      if (fabBefore && obs) obs.observe(fabBefore, { attributes: true, attributeFilter: ['style'] });

      const startTop = box ? box.scrollTop : 0;
      for (const y of [120, 240, 80, 300]) {
        if (box) box.scrollTo({ top: y, behavior: 'smooth' });
        await new Promise((r) => setTimeout(r, 220));
      }
      await new Promise((r) => setTimeout(r, 600));
      if (obs) obs.disconnect();

      const fabAfter = liveFab();
      const gapAfter = gapOf();
      const inBoxAfter = !!box && !!fabAfter && box.contains(fabAfter);
      const posAfter = fabAfter ? getComputedStyle(fabAfter).position : null;
      const midTop = box ? box.scrollTop : 0;
      const scrolled = Math.abs(midTop - startTop) > 20 || midTop > 20;

      return {
        fabSameNode: fabBefore === fabAfter,
        inBoxBefore,
        inBoxAfter,
        posBefore,
        posAfter,
        scrolled,
        writes,
        gapBefore,
        gapAfter,
        gapDrift: gapBefore != null && gapAfter != null ? Math.abs(gapAfter - gapBefore) : -1,
      };
    });

    expect(probe).not.toBeNull();
    // 挂载时气泡锚进容器（而非 body 直子）
    expect(probe!.inBoxBefore).toBe(true);
    // 多次滚动施压后仍在容器内、仍是 anchored（position:absolute），证明未被降级/重挂
    expect(probe!.inBoxAfter).toBe(true);
    expect(probe!.posBefore).toBe('absolute');
    expect(probe!.posAfter).toBe('absolute');
    expect(probe!.scrolled).toBe(true); // 容器确实滚动了
    expect(probe!.writes).toBeLessThanOrEqual(1); // 滚动期间 JS 近乎零干预
    // 滚前滚后气泡相对文字的位置恒定 = 不随滚动抖动。ds/chatgpt 类站点正是靠这条根治。
    expect(probe!.gapDrift).toBeLessThan(2);
    // 滚动前后气泡是同一个 DOM 节点：证明组件不重挂（重建会闪烁、且让
    // ds/chatgpt 类站点抖动复发）
    expect(probe!.fabSameNode).toBe(true);
  });

  test('E2E-EXT-15 容器级锚定：气泡被宿主裁到看不见时翻到另一侧（不降级）', async ({
    page,
    extensionWorker,
  }) => {
    test.slow();
    // 容器级锚定把气泡变成了宿主的裁剪对象：#scroll-box 只有 8px padding，而气泡默认
    // 放选区上方 38px——选区在容器顶部第一行时气泡会顶出上沿、32px 只露 2px。
    // 期望：翻到下方（仍锚在容器内，position 保持 absolute），而不是降级成 fixed。
    await extensionSeed.seedCrowAuth(extensionWorker, e2eBaseURL);
    await page.goto('/e2e-extension-host.html');
    await expect(page.locator('#crow-ext-host')).toBeAttached({
      timeout: 20_000,
    });
    await page.evaluate(() => {
      document.getElementById('scroll-box')?.scrollTo({ top: 0 });
    });
    await selectSelectorAndPointerUp(page, '#selectable-in-box');
    await page
      .waitForFunction(
        () => !!document.querySelector('#scroll-box button.crow-btn, body > button.crow-btn'),
        { timeout: 15_000 }
      )
      .catch(() => {});
    // 越过静默期 + 兜底复检窗口，取最终落位
    await page.waitForTimeout(1250);

    const probe = await page.evaluate(() => {
      const box = document.getElementById('scroll-box') as HTMLElement | null;
      const fab =
        (box?.querySelector('button.crow-btn') as HTMLElement | null) ??
        (document.body.querySelector(':scope > button.crow-btn') as HTMLElement | null);
      if (!box || !fab) return { error: 'no-fab' };
      const b = fab.getBoundingClientRect();
      const h = box.getBoundingClientRect();
      // 与 isClippedByHost 同一坐标系：宿主 padding box 才是可视区
      const padLeft = h.left + box.clientLeft;
      const padTop = h.top + box.clientTop;
      const ow = Math.min(b.right, padLeft + box.clientWidth) - Math.max(b.left, padLeft);
      const oh = Math.min(b.bottom, padTop + box.clientHeight) - Math.max(b.top, padTop);
      const sel = window.getSelection();
      const s =
        sel && !sel.isCollapsed && sel.rangeCount
          ? sel.getRangeAt(0).getBoundingClientRect()
          : null;
      return {
        inBox: box.contains(fab),
        position: getComputedStyle(fab).position,
        visible: ow > 0 && oh > 0 ? (ow * oh) / Math.max(1, b.width * b.height) : 0,
        // 气泡在选区下方时 gap 为负；翻面成功的直接证据
        gap: s ? s.top - b.top : null,
        boxScrollTop: box.scrollTop,
      };
    });

    expect(probe).not.toHaveProperty('error');
    expect(probe!.boxScrollTop).toBe(0); // 选区确实在容器顶部第一行
    // 没被裁：可见面积占比过半（旧行为下这里 ≈0.06，只剩一条边）
    expect(probe!.visible).toBeGreaterThan(0.6);
    // 翻面而非降级：仍锚在容器内、仍是 absolute
    expect(probe!.inBox).toBe(true);
    expect(probe!.position).toBe('absolute');
    // 气泡落到了选区下方（默认上方会被裁）
    expect(probe!.gap!).toBeLessThan(0);
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
