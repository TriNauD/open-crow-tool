/**
 * BRAINSTORM 阶段 A — A1 首页发送快捷键文案（QA §0.2 对表：E2E-A1-01〜04）。
 * 运行态通过 addInitScript 覆盖 navigator UA/platform，近似 Mac / Win / 手机，无需真机矩阵。
 */

import { test, expect } from '@playwright/test';

/** 注入页内运行；字符串写在闭包内便于 Playwright 序列化到浏览器上下文 */
function scriptWinDesktop() {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    get() {
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0';
    },
  });
  Object.defineProperty(navigator, 'platform', {
    configurable: true,
    get() {
      return 'Win32';
    },
  });
}

function scriptMacSafariDesktop() {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    get() {
      return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari';
    },
  });
  Object.defineProperty(navigator, 'platform', {
    configurable: true,
    get() {
      return 'MacIntel';
    },
  });
}

function scriptIPhoneSafari() {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    get() {
      return 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
    },
  });
  Object.defineProperty(navigator, 'platform', {
    configurable: true,
    get() {
      return 'iPhone';
    },
  });
}

async function openHomeWithInit(
  browser: import('@playwright/test').Browser,
  initFn: () => void,
) {
  const context = await browser.newContext();
  await context.addInitScript(initFn);
  const page = await context.newPage();
  await page.goto('/');
  return { context, page };
}

// E2E-A1-01：对应 QA §0.2 — 未改写 navigator；文案须为 Apple / Win 合法桌面文案之一（覆盖 Mac 本机与 Linux CI）。
test('E2E-A1-01 首页宿主桌面环境显示 Enter 发送合法文案', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '这是啥？' }).first()).toBeVisible();
  const hint = page.getByTestId('home-send-shortcut-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText(
    /^(↵ 发送 · ⌥↵ 换行|Enter 发送 · Alt\+Enter 换行)$/,
  );
});

// E2E-A1-02：QA §0.2 — 对应「桌面 Windows/Linux」提示（伪 UA）
test('E2E-A1-02 伪造 Windows → 文案为 Enter 发送 · Alt+Enter 换行', async ({ browser }) => {
  const { context, page } = await openHomeWithInit(browser, scriptWinDesktop);
  try {
    await expect(page.getByRole('button', { name: '这是啥？' }).first()).toBeVisible();
    await expect(page.getByTestId('home-send-shortcut-hint')).toHaveText(
      'Enter 发送 · Alt+Enter 换行',
    );
  } finally {
    await context.close();
  }
});

// E2E-A1-03：QA §0.2 — 对应「桌面 Mac」提示（伪 UA）
test('E2E-A1-03 伪造 Mac → 文案为 ↵ 发送 · ⌥↵ 换行', async ({ browser }) => {
  const { context, page } = await openHomeWithInit(browser, scriptMacSafariDesktop);
  try {
    await expect(page.getByRole('button', { name: '这是啥？' }).first()).toBeVisible();
    await expect(page.getByTestId('home-send-shortcut-hint')).toHaveText(
      '↵ 发送 · ⌥↵ 换行',
    );
  } finally {
    await context.close();
  }
});

// E2E-A1-04：QA §0.2 — 对应「手机无快捷键文案」（伪 UA；真机仍为手测 §0.2 步骤 6 等）
test('E2E-A1-04 伪造 iPhone → 不出现 home-send-shortcut-hint', async ({
  browser,
}) => {
  const { context, page } = await openHomeWithInit(browser, scriptIPhoneSafari);
  try {
    await expect(page.getByRole('button', { name: '这是啥？' }).first()).toBeVisible();
    await expect(page.getByTestId('home-send-shortcut-hint')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
