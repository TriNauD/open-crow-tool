/**
 * 注册页「确认密码」— 纯 UI：两次不一致时在客户端拦截，不调 Supabase signUp。
 */

import { test, expect } from '@playwright/test';

test('注册页两次密码不一致时提示错误且留在注册页', async ({ page }) => {
  let signUpRequestCount = 0;
  await page.route('**/auth/v1/signup**', (route) => {
    signUpRequestCount += 1;
    return route.continue();
  });

  await page.goto('/register');
  await expect(page.getByRole('heading', { name: '注册账号' })).toBeVisible();

  await page.getByPlaceholder('邮箱').fill('e2e-register-mismatch@example.com');
  await page.getByPlaceholder('密码（至少 6 位）').fill('secret-one-123456');
  await page.getByPlaceholder('再次输入密码').fill('secret-two-654321');

  await page.getByRole('button', { name: '注册' }).click();

  await expect(page.getByText('两次输入的密码不一致')).toBeVisible();
  await expect(page).toHaveURL(/\/register/);
  expect(signUpRequestCount).toBe(0);
});
